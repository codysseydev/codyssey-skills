#!/usr/bin/env python3
"""The AI policy check: decide whether a step may read a client's code.

Two forms, exactly one of --record and --registry:

  check-policy.py --record <file> --repo <dir> --model <id> [--tool claude-code] [--step read-code]
  check-policy.py --registry <file> --repo-name <owner/name> --repo <dir> --model <id>
                  [--tool claude-code] [--step read-code]

The second form is the factory's. It reads `mode:` from `.ai/kanon.yml` on origin/main through
git, never from the working tree, then looks the repo up in the registry (a JSON object of
owner/name -> record path). A repo in the registry is a client repo whatever the file says.

One JSON object on stdout. Exit 0 for `continue` and `not-client`, 1 for `stop`, 2 for bad usage.
On `continue` the scan of the repo's policy files adds warnings: the registry form scans origin/main
through git and opens no file under --repo, the --record form scans the working tree. On `stop`
nothing in the repo is read. Stdlib only.
"""
import argparse
import json
import os
import re
import subprocess
import sys

STEPS = {"read-code": ["read-code"], "factory-run": ["read-code", "factory-run"]}
MODES = ("canon-first", "project-first")
BASE_REF = "refs/remotes/origin/main"


# ---------- the record ----------

def _unquote(text):
    text = text.strip()
    if len(text) >= 2 and text[0] == text[-1] and text[0] in "'\"":
        return text[1:-1]
    return text


def parse_frontmatter(text):
    """The frontmatter as {key: str | list[str]}. Raises ValueError on anything unreadable."""
    lines = text.splitlines()
    if not lines or lines[0].strip() != "---":
        raise ValueError("no frontmatter")
    out = {}
    open_key = None
    for number, line in enumerate(lines[1:], start=2):
        if line.strip() == "---":
            return out
        if not line.strip() or line.lstrip().startswith("#"):
            continue
        item = re.match(r"^[ \t]*-[ \t]+(.*)$", line)
        if item:
            if open_key is None:
                raise ValueError(f"line {number}: list item without a key: {line.strip()}")
            if out[open_key] == "":
                out[open_key] = []
            out[open_key].append(_unquote(item.group(1)))
            continue
        pair = re.match(r"^([A-Za-z0-9_-]+):[ \t]*(.*)$", line)
        if not pair:
            raise ValueError(f"line {number}: not 'key: value': {line.strip()}")
        key, value = pair.group(1), pair.group(2).strip()
        if key in out:
            raise ValueError(f"line {number}: {key} given twice")
        open_key = key if value == "" else None
        if value.startswith("[") and value.endswith("]"):
            out[key] = [_unquote(part) for part in value[1:-1].split(",") if part.strip()]
        else:
            out[key] = _unquote(value)
    raise ValueError("frontmatter is not closed")


def _scalar(raw):
    if isinstance(raw, list):
        raise ValueError("a list")
    return raw.strip().lower()


def parse_yes_no(raw):
    value = _scalar(raw)
    if value in ("yes", "true"):
        return "yes"
    if value in ("no", "false"):
        return "no"
    raise ValueError(value)


def parse_one_of(*allowed):
    def parse(raw):
        value = _scalar(raw)
        if value not in allowed:
            raise ValueError(value)
        return value
    return parse


def parse_list(raw):
    items = [raw] if isinstance(raw, str) else raw
    items = [item.strip().lower() for item in items]
    if not all(items):
        raise ValueError("an empty entry")
    return items


def parse_retention(raw):
    value = _scalar(raw)
    if not re.fullmatch(r"none|end-of-engagement|\d+d", value):
        raise ValueError(value)
    return value


def parse_models(raw):
    items = parse_list(raw)
    for item in items:
        if "*" in item and not re.fullmatch(r"[^*\s]+-\*", item):
            raise ValueError(item)
    return items


def _model_matches(entry, model):
    if entry == "any":
        return True
    if entry.endswith("-*"):
        return model.startswith(entry[:-1])
    return model == entry


# A step's column holds only what that step adds: STEPS lists the columns each step runs.
def _forbids_if_no(value, ctx):
    return "no" if value == "no" else None


def _tool_not_listed(value, ctx):
    tool = ctx["tool"].lower()
    return None if "any" in value or tool in value else f"{tool} is not listed"


def _model_not_listed(value, ctx):
    model = ctx["model"].lower()
    return None if any(_model_matches(entry, model) for entry in value) else f"{model} matches no entry"


# Order is the order of the stop's report.
FIELDS = {
    "ai_allowed": (parse_yes_no, {"read-code": _forbids_if_no}),
    "tools": (parse_list, {"read-code": _tool_not_listed}),
    "models": (parse_models, {"read-code": _model_not_listed}),
    "code_leaves_machine": (
        parse_one_of("no", "model-provider", "yes"),
        {"read-code": _forbids_if_no},
    ),
    "cloud_sessions": (parse_yes_no, {}),
    "commit_ai_files": (parse_yes_no, {"factory-run": _forbids_if_no}),
    "retention": (parse_retention, {}),
}


def check(raw, step, ctx):
    """Blocking entries for a parsed record: [{"field", "reason"}], in FIELDS order."""
    blocking = []
    for key, (parse, rules) in FIELDS.items():
        given = raw.get(key)
        if not given:
            blocking.append({"field": key, "reason": "missing"})
            continue
        try:
            value = parse(given)
        except ValueError:
            shown = ", ".join(given) if isinstance(given, list) else given
            blocking.append({"field": key, "reason": f"not an allowed value: {shown}"})
            continue
        for column in STEPS[step]:
            rule = rules.get(column)
            detail = rule(value, ctx) if rule else None
            if detail:
                blocking.append({"field": key, "reason": f"forbids {column}: {detail}"})
                break
    return blocking


# ---------- the factory form: is this a client repo ----------

def _git(repo, *args):
    try:
        env = {k: v for k, v in os.environ.items() if not k.startswith("GIT_")}
        env["GIT_NO_REPLACE_OBJECTS"] = "1"
        return subprocess.run(["git", "-C", repo, *args], capture_output=True, env=env)
    except OSError as error:
        raise RuntimeError(str(error))


def _git_error(proc, name):
    return proc.stderr.decode("utf-8", "replace").strip() or f"git {name} exited {proc.returncode}"


def require_top_level(repo):
    """Raises RuntimeError unless repo is the top level of a git work tree, not a folder inside one."""
    proc = _git(repo, "rev-parse", "--show-toplevel")
    if proc.returncode != 0:
        raise RuntimeError(_git_error(proc, "rev-parse"))
    top = proc.stdout.decode("utf-8", "replace").rstrip("\n")
    try:
        same = os.path.samefile(top, repo)
    except OSError as error:
        raise RuntimeError(str(error))
    if not same:
        raise RuntimeError(f"{repo} is not the top level of its git repo ({top})")


def _list_tree(repo, *args):
    """The entries of a git tree as [(mode, oid, name)], names as str. Raises RuntimeError on a git error."""
    listed = _git(repo, "ls-tree", "-z", *args)
    if listed.returncode != 0:
        raise RuntimeError(_git_error(listed, "ls-tree"))
    entries = []
    for entry in listed.stdout.split(b"\0"):
        if entry:
            meta, name = entry.split(b"\t", 1)
            mode, _, oid = meta.split()
            entries.append((mode.decode(), oid.decode(), name.decode("utf-8", "replace")))
    return entries


def _the_one(entries, wanted, label, variants):
    """The (mode, oid) of the entry named exactly `wanted`, or None. Raises on a case variant."""
    found = None
    for mode, oid, name in entries:
        if name == wanted:
            found = (mode, oid)
        elif name.casefold() in variants:
            raise RuntimeError(f"{label} has a case variant: {name}")
    return found


def kanon_yml_at(repo, ref=BASE_REF):
    """The text of .ai/kanon.yml at ref, or None when the file is absent. Raises RuntimeError when it cannot be read."""
    root = _the_one(_list_tree(repo, "--full-tree", ref), ".ai", "the repo root", {".ai"})
    if root is None:
        return None
    if root[0] != "040000":
        raise RuntimeError(".ai is a symlink" if root[0] == "120000" else f".ai is not a folder (mode {root[0]})")
    entry = _the_one(_list_tree(repo, "--full-tree", f"{ref}:.ai"), "kanon.yml", ".ai/", {"kanon.yml", "kanon.yaml"})
    if entry is None:
        return None
    if entry[0] not in ("100644", "100755"):
        raise RuntimeError(
            ".ai/kanon.yml is a symlink" if entry[0] == "120000" else f".ai/kanon.yml is not a regular file (mode {entry[0]})"
        )
    shown = _git(repo, "cat-file", "blob", entry[1])
    if shown.returncode != 0:
        raise RuntimeError(_git_error(shown, "cat-file"))
    try:
        return shown.stdout.decode("utf-8-sig")
    except UnicodeDecodeError as error:
        raise RuntimeError(f".ai/kanon.yml is not UTF-8: {error}")


def valid_repo_name(name):
    if not re.fullmatch(r"[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+", name) or name.endswith(".git"):
        return False
    return not {".", ".."} & set(name.split("/"))


def _case_collisions(registry):
    """The registry keys that casefold to the same name, as 'a, b; c, d'. Empty when there are none."""
    groups = {}
    for name in registry:
        groups.setdefault(name.casefold(), []).append(name)
    return "; ".join(", ".join(names) for names in groups.values() if len(names) > 1)


_ROOT_KEY = re.compile(r"^(?:([A-Za-z0-9_-]+)|\"([A-Za-z0-9_-]+)\"|'([A-Za-z0-9_-]+)')[ \t]*:(?:[ \t]+(.*))?$")
_DOC_START = re.compile(r"^---(?:[ \t]+#.*|[ \t]*)$")
_DOC_END = re.compile(r"^\.\.\.(?:[ \t]+#.*|[ \t]*)$")


def read_modes(text):
    """The raw `mode` values at the root of a kanon.yml, as unquoted strings. Raises ValueError on any shape it does not read.

    An allow-list, not a YAML parser: one document, root keys at column 0 as plain or quoted names, and
    everything indented (or a list item) under a key skipped. Anything else is unreadable.
    """
    given = []
    started = content = False
    for number, line in enumerate(text.splitlines(), start=1):
        if not line.strip() or line.lstrip().startswith("#"):
            continue
        if line.startswith("\t"):
            raise ValueError(f"line {number}: starts with a tab")
        if _DOC_START.match(line):
            if started or content:
                raise ValueError(f"line {number}: more than one document")
            started = True
            continue
        if _DOC_END.match(line):
            raise ValueError(f"line {number}: more than one document")
        found = _ROOT_KEY.match(line)
        if not found:
            if content and (line.startswith(" ") or line == "-" or line.startswith("- ")):
                continue
            raise ValueError(f"line {number}: not a root key: {line.strip()[:40]}")
        content = True
        key = found.group(1) or found.group(2) or found.group(3)
        if key.casefold() == "mode" and key != "mode":
            raise ValueError(f"line {number}: key {key} is not spelled mode")
        if key == "mode":
            given.append(_unquote(re.sub(r"(?:^|[ \t]+)#.*$", "", found.group(4) or "")))
    return given


def client_record(registry, repo_name, repo):
    """(mode, record path, blocking). A record path of None with no blocking means not a client repo."""
    for name in registry:
        if not valid_repo_name(name):
            return None, None, [{"field": "record", "reason": f"registry key is not owner/name: {name}"}]
    colliding = _case_collisions(registry)
    if colliding:
        return None, None, [{"field": "record", "reason": f"registry keys differ only in case: {colliding}"}]
    try:
        require_top_level(repo)
        text = kanon_yml_at(repo)
    except RuntimeError as error:
        return None, None, [{"field": "mode", "reason": f"unreadable: {error}"}]
    try:
        given = read_modes(text or "")
    except ValueError as error:
        return None, None, [{"field": "mode", "reason": f"unreadable: {error}"}]
    if len(given) > 1:
        return None, None, [{"field": "mode", "reason": "mode given twice in .ai/kanon.yml"}]
    mode = given[0] if given else "canon-first"
    if mode == "":
        return None, None, [{"field": "mode", "reason": "empty"}]
    if mode not in MODES:
        return mode, None, [{"field": "mode", "reason": f"not an allowed value: {mode}"}]
    by_name = {name.casefold(): path for name, path in registry.items()}
    path = by_name.get(repo_name.casefold())
    if path is not None:
        path = os.path.expanduser(path)
        if not os.path.isabs(path):
            return mode, None, [{"field": "record", "reason": f"relative path not allowed: {path}"}]
        return mode, path, []
    if mode == "project-first":
        return mode, None, [{"field": "record", "reason": "missing, no registry entry"}]
    return mode, None, []


def _no_duplicate_keys(pairs):
    seen = set()
    for key, _ in pairs:
        if key in seen:
            raise ValueError(f"key given twice: {key}")
        seen.add(key)
    return dict(pairs)


def read_registry(path):
    """The registry's JSON, or {} when the path is truly absent. Raises OSError or ValueError otherwise.

    A dangling symlink or a path inside a folder that cannot be entered is not absent.
    """
    try:
        with open(path, encoding="utf-8") as handle:
            return json.load(handle, object_pairs_hook=_no_duplicate_keys)
    except FileNotFoundError:
        try:
            os.lstat(path)
        except FileNotFoundError:
            pass
        else:
            raise
        ancestor = os.path.dirname(os.path.abspath(path))
        while True:
            try:
                os.lstat(ancestor)
                break
            except FileNotFoundError:
                parent = os.path.dirname(ancestor)
                if parent == ancestor:
                    break
                ancestor = parent
        if os.path.islink(ancestor) and not os.path.exists(ancestor):
            raise FileNotFoundError(f"{ancestor} is a symlink that does not resolve")
        return {}


# ---------- the scan ----------

AI_CLAUSE = re.compile(
    r"(?<!\w)(?:ChatGPT|Copilot|Claude|Cursor|GPT-?\d*"
    r"|(?i:artificial intelligence|large language models?|generative AI))(?!\w)"
    r"|(?<![\w.])(?i:AI|A\.I\.|LLMs?)(?!\w)"
)
_TEXT_EXT = r"(\.(md|markdown|rst|txt))?"
README_OR_CONTRIBUTING = re.compile(rf"(readme|contributing){_TEXT_EXT}", re.IGNORECASE)
CONTRIBUTING = re.compile(rf"contributing{_TEXT_EXT}", re.IGNORECASE)
IGNORE_FILES = (".aiignore", ".cursorignore")


def _classify(mode, kind):
    """The scan kind for a policy-named entry, by git file mode."""
    if mode == "120000":
        return "symlink"
    return kind if mode in ("100644", "100755") else "unreadable"


def disk_files(repo):
    """Yield (relative path, kind) for each file the scan may open. Lists only the root, .github/ and docs/.

    kind is ignore-file, clause, symlink, or unreadable (not a regular file, or a folder that cannot be listed).
    """
    def kind_of(rel, kind):
        path = os.path.join(repo, rel)
        if os.path.islink(path):
            return "symlink"
        return kind if os.path.isfile(path) else "unreadable"

    for name in IGNORE_FILES:
        if os.path.lexists(os.path.join(repo, name)):
            yield name, kind_of(name, "ignore-file")
    for folder, pattern in (("", README_OR_CONTRIBUTING), (".github", CONTRIBUTING), ("docs", CONTRIBUTING)):
        path = os.path.join(repo, folder)
        if folder and os.path.islink(path):
            yield folder, "symlink"
            continue
        if not os.path.isdir(path):
            continue
        try:
            names = sorted(os.listdir(path))
        except OSError:
            yield folder or ".", "unreadable"
            continue
        for name in names:
            if pattern.fullmatch(name):
                rel = os.path.join(folder, name)
                yield rel, kind_of(rel, "clause")


def git_files(repo, ref):
    """Like disk_files, read from the tree at ref. Returns (files, blobs): the (path, kind) list and {path: oid}.

    Names match without regard to case and are reported as they stand in the tree.
    """
    files, blobs = [], {}

    def add(rel, mode, oid, kind):
        found = _classify(mode, kind)
        files.append((rel, found))
        if found == kind:
            blobs[rel] = oid

    def named(entries, wanted):
        return [entry for entry in sorted(entries, key=lambda entry: entry[2]) if entry[2].casefold() == wanted]

    try:
        root = _list_tree(repo, "--full-tree", ref)
    except RuntimeError:
        return [(".", "unreadable")], blobs
    for wanted in IGNORE_FILES:
        for mode, oid, name in named(root, wanted):
            add(name, mode, oid, "ignore-file")
    for mode, oid, name in sorted(root, key=lambda entry: entry[2]):
        if README_OR_CONTRIBUTING.fullmatch(name):
            add(name, mode, oid, "clause")
    for wanted in (".github", "docs"):
        for mode, oid, folder in named(root, wanted):
            if mode == "120000":
                files.append((folder, "symlink"))
            if mode != "040000":
                continue
            try:
                entries = _list_tree(repo, oid)
            except RuntimeError:
                files.append((folder, "unreadable"))
                continue
            for mode, oid, name in sorted(entries, key=lambda entry: entry[2]):
                if CONTRIBUTING.fullmatch(name):
                    add(os.path.join(folder, name), mode, oid, "clause")
    return files, blobs


def _warnings(files, read):
    """Warnings for (path, kind) pairs; read(path) returns the text or raises OSError."""
    warnings = []
    for rel, kind in files:
        if kind in ("symlink", "unreadable"):
            warnings.append({"file": rel, "signal": kind})
            continue
        try:
            lines = read(rel).splitlines()
        except OSError:
            warnings.append({"file": rel, "signal": "unreadable"})
            continue
        if kind == "ignore-file":
            patterns = [line.strip() for line in lines if line.strip() and not line.strip().startswith("#")]
            warnings.append({"file": rel, "signal": "ignore-file", "patterns": patterns})
            continue
        for number, line in enumerate(lines, start=1):
            if AI_CLAUSE.search(line):
                warnings.append({"file": rel, "line": number, "signal": "ai-clause", "text": line.strip()[:200]})
    return warnings


def scan(repo):
    """The warnings from the policy files on disk (the --record form)."""
    def read(rel):
        with open(os.path.join(repo, rel), encoding="utf-8", errors="replace") as handle:
            return handle.read()

    return _warnings(disk_files(repo), read)


def scan_git(repo, ref=BASE_REF):
    """The warnings from the policy files at ref, read through git and never from disk (the registry form)."""
    files, blobs = git_files(repo, ref)

    def read(rel):
        shown = _git(repo, "cat-file", "blob", blobs[rel])
        if shown.returncode != 0:
            raise OSError(_git_error(shown, "cat-file"))
        return shown.stdout.decode("utf-8", "replace")

    return _warnings(files, read)


# ---------- the command ----------

def main(argv=None):
    parser = argparse.ArgumentParser(description="Decide whether a step may read a client's code.")
    parser.add_argument("--record", help="the policy record, a Markdown file with frontmatter")
    parser.add_argument("--registry", help="JSON file mapping owner/name to a record path")
    parser.add_argument("--repo-name", help="owner/name, with --registry")
    parser.add_argument("--repo", required=True, help="the repo or one of its worktrees")
    parser.add_argument("--model", required=True)
    parser.add_argument("--tool", default="claude-code")
    parser.add_argument("--step", choices=sorted(STEPS), default="read-code")
    args = parser.parse_args(argv)
    if bool(args.record) == bool(args.registry):
        parser.error("give exactly one of --record and --registry")
    if args.registry and not args.repo_name:
        parser.error("--registry needs --repo-name")
    if args.registry and not valid_repo_name(args.repo_name):
        parser.error(f"--repo-name must be owner/name (letters, digits, . _ -; no . or .. part; not ending in .git): {args.repo_name}")
    if not os.path.isdir(args.repo):
        parser.error(f"--repo is not a directory: {args.repo}")
    if args.record:
        args.record = os.path.expanduser(args.record)
    if args.registry:
        args.registry = os.path.expanduser(args.registry)

    result = {"result": "stop", "step": args.step, "record": args.record, "blocking": [], "warnings": []}
    if args.registry:
        result["mode"] = None
        try:
            registry = read_registry(args.registry)
            if not isinstance(registry, dict) or not all(isinstance(v, str) for v in registry.values()):
                raise ValueError("not an object of owner/name to path")
            result["mode"], result["record"], result["blocking"] = client_record(registry, args.repo_name, args.repo)
        except (OSError, ValueError) as error:
            result["blocking"] = [{"field": "record", "reason": f"unreadable registry: {error}"}]
        if not result["blocking"] and result["record"] is None:
            result["result"] = "not-client"
            return emit(result)
    if not result["blocking"]:
        try:
            with open(result["record"], encoding="utf-8") as handle:
                raw = parse_frontmatter(handle.read())
            result["blocking"] = check(raw, args.step, {"tool": args.tool, "model": args.model})
        except FileNotFoundError:
            result["blocking"] = [{"field": "record", "reason": "missing"}]
        except (OSError, ValueError) as error:
            result["blocking"] = [{"field": "record", "reason": f"unreadable: {error}"}]
    if not result["blocking"]:
        result["result"] = "continue"
        result["warnings"] = scan_git(args.repo) if args.registry else scan(args.repo)
    return emit(result)


def emit(result):
    print(json.dumps(result, indent=2))
    return 1 if result["result"] == "stop" else 0


if __name__ == "__main__":
    sys.exit(main())
