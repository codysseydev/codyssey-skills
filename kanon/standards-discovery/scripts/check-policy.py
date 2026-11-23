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
On `continue` the scan of the repo's policy files adds warnings. On `stop` nothing in the repo
is read. Stdlib only.
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


def parse_bool(raw):
    value = _scalar(raw)
    if value in ("yes", "true"):
        return True
    if value in ("no", "false"):
        return False
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


def _model_matches(entry, model):
    return entry == "any" or model == entry or model.startswith(entry + "-")


# A forbid rule takes the parsed value and the run's context and returns why the step is
# forbidden, or None. A step's column holds only what that step adds: STEPS lists the columns.
def _forbids_if_no(value, ctx):
    return "no" if value is False else None


def _tool_not_listed(value, ctx):
    tool = ctx["tool"].lower()
    return None if "any" in value or tool in value else f"{tool} is not listed"


def _model_not_listed(value, ctx):
    model = ctx["model"].lower()
    return None if any(_model_matches(entry, model) for entry in value) else f"{model} matches no entry"


def _forbids_if_value_no(value, ctx):
    return "no" if value == "no" else None


# key -> (parser, {step column: forbid rule}). Order is the order of the stop's report.
FIELDS = {
    "ai_allowed": (parse_bool, {"read-code": _forbids_if_no}),
    "tools": (parse_list, {"read-code": _tool_not_listed}),
    "models": (parse_list, {"read-code": _model_not_listed}),
    "code_leaves_machine": (
        parse_one_of("no", "model-provider", "yes"),
        {"read-code": _forbids_if_value_no},
    ),
    "cloud_sessions": (parse_bool, {}),
    "commit_ai_files": (parse_bool, {"factory-run": _forbids_if_no}),
    "retention": (parse_retention, {}),
}


def check(raw, step, ctx):
    """Blocking entries for a parsed record: [{"field", "reason"}], in FIELDS order."""
    blocking = []
    for key, (parse, rules) in FIELDS.items():
        given = raw.get(key)
        if given is None or given == "" or given == []:
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
        return subprocess.run(["git", "-C", repo, *args], capture_output=True)
    except OSError as error:
        raise RuntimeError(str(error))


def _git_error(proc, name):
    return proc.stderr.decode("utf-8", "replace").strip() or f"git {name} exited {proc.returncode}"


def kanon_yml_at(repo, ref=BASE_REF):
    """The text of .ai/kanon.yml at ref, or None when the file is absent. Raises RuntimeError when it cannot be read."""
    listed = _git(repo, "ls-tree", ref, "--", ".ai/kanon.yml")
    if listed.returncode != 0:
        raise RuntimeError(_git_error(listed, "ls-tree"))
    if not listed.stdout.strip():
        return None
    shown = _git(repo, "show", f"{ref}:.ai/kanon.yml")
    if shown.returncode != 0:
        raise RuntimeError(_git_error(shown, "show"))
    try:
        return shown.stdout.decode("utf-8-sig")
    except UnicodeDecodeError as error:
        raise RuntimeError(f".ai/kanon.yml is not UTF-8: {error}")


def client_record(registry, repo_name, repo):
    """(mode, record path, blocking). A record path of None with no blocking means not a client repo."""
    try:
        text = kanon_yml_at(repo)
    except RuntimeError as error:
        return None, None, [{"field": "mode", "reason": f"unreadable: {error}"}]
    mode = "canon-first"
    for line in (text or "").splitlines():
        found = re.match(r"^[\"']?mode[\"']?[ \t]*:[ \t]*(.*?)[ \t]*(?:#.*)?$", line)
        if found:
            mode = _unquote(found.group(1))
            break
    if mode not in MODES:
        return mode, None, [{"field": "mode", "reason": f"not an allowed value: {mode}"}]
    by_name = {name.casefold(): path for name, path in registry.items()}
    if repo_name.casefold() in by_name:
        return mode, os.path.expanduser(by_name[repo_name.casefold()]), []
    if mode == "project-first":
        return mode, None, [{"field": "record", "reason": "missing, no registry entry"}]
    return mode, None, []


# ---------- the scan ----------

AI_CLAUSE = re.compile(
    r"(?<!\w)(AI|A\.I\.|artificial intelligence|LLMs?|large language models?|ChatGPT|Copilot|Claude|Cursor|generative|GPT-?\d*)(?!\w)",
    re.IGNORECASE,
)
_TEXT_EXT = r"(\.(md|markdown|rst|txt))?"
README_OR_CONTRIBUTING = re.compile(rf"(readme|contributing){_TEXT_EXT}", re.IGNORECASE)
CONTRIBUTING = re.compile(rf"contributing{_TEXT_EXT}", re.IGNORECASE)
IGNORE_FILES = (".aiignore", ".cursorignore")


def policy_files(repo):
    """Yield (relative path, kind) for each file the scan may open. Lists only the root, .github/ and docs/.

    kind is ignore-file, clause, symlink, or unreadable for a name that is not a regular file or a folder that cannot be listed.
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


def scan(repo):
    warnings = []
    for rel, kind in policy_files(repo):
        if kind in ("symlink", "unreadable"):
            warnings.append({"file": rel, "signal": kind})
            continue
        try:
            with open(os.path.join(repo, rel), encoding="utf-8", errors="replace") as handle:
                lines = handle.read().splitlines()
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
    if not os.path.isdir(args.repo):
        parser.error(f"--repo is not a directory: {args.repo}")
    if args.record:
        args.record = os.path.expanduser(args.record)
    if args.registry:
        args.registry = os.path.expanduser(args.registry)

    result = {"result": "stop", "step": args.step, "record": args.record, "blocking": [], "warnings": []}
    if args.registry:
        result["mode"] = None
        registry = {}
        try:
            if os.path.exists(args.registry):
                with open(args.registry, encoding="utf-8") as handle:
                    registry = json.load(handle)
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
        result["warnings"] = scan(args.repo)
    return emit(result)


def emit(result):
    print(json.dumps(result, indent=2))
    return 1 if result["result"] == "stop" else 0


if __name__ == "__main__":
    sys.exit(main())
