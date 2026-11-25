#!/usr/bin/env python3
"""Check the discovery pass's output before it is placed.

  check-overlay.py --work <dir> --repo <client repo> [--kanon-root <dir>]

The work folder holds policy.json, standards-report.md, .ai/kanon.yml and .ai/rules/project/*.md.
The script proves that:

- .ai/kanon.yml parses in the strict subset and matches references/kanon-yml.schema.json,
- every overlay entry names one real Kanon rule by its catalog ID,
- every citation in the report and every evidence item in the overlay resolves in the client repo at
  the commit named by `Read at`, outside the paths the AI policy ignores,
- the report and the overlay agree, and `Silent on` lists the Kanon families with no entry.

One JSON object on stdout: {"result": "ok" | "invalid", "problems": [{"where", "problem"}]}.
Exit 0 ok, 1 invalid, 2 bad usage. It reads the repo through git only. Stdlib only.
"""
import argparse
import importlib.util
import json
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
SKILL = os.path.dirname(HERE)
SCHEMA_PATH = os.path.join(SKILL, "references", "kanon-yml.schema.json")
FAMILIES = os.path.join("kanon", "catalog", "families.json")
EFFECTS = ("adopt", "change", "off", "project-only")
SOURCES = ("written down", "configured", "pattern in code")
FRAMEWORKS = ("laravel", "symfony")
SYMFONY_FAMILIES = ("symfony", "php-core", "reliability")
HEADER = ["Convention", "Evidence", "Source", "Kanon rule", "Effect"]
OVERLAY = ".ai/kanon.yml"
RULES_DIR = ".ai/rules/project"
MAX_SPAN = 20


def _sibling(name):
    spec = importlib.util.spec_from_file_location(name.replace("-", "_").removesuffix(".py"), os.path.join(HERE, name))
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


inventory = _sibling("inventory.py")


def collapse(text):
    return re.sub(r"\s+", " ", text).strip()


# ---------- .ai/kanon.yml: the strict subset ----------

YAML_WORDS = {"off", "on", "yes", "no", "true", "false", "y", "n", "null", "~"}
# YAML 1.1 readers break lines on these and YAML 1.2 readers do not, so the two can read different values.
ODD_BREAKS = {"\x85": "U+0085", "\u2028": "U+2028", "\u2029": "U+2029", "\r": "a carriage return without a line feed"}
PLAIN = re.compile(r"[A-Za-z_./][A-Za-z0-9_./+:-]*")


def _scalar(text, number):
    text = text.strip()
    if text.startswith('"'):
        escapes = re.findall(r"\\(.)", text[1:-1])
        if any(escaped not in ('"', "\\") for escaped in escapes):
            raise ValueError(f"line {number}: a double-quoted string may only escape \\\" and \\\\; use a single-quoted string")
        try:
            value = json.loads(text)
        except ValueError as error:
            raise ValueError(f"line {number}: bad double-quoted string: {error}")
        if not isinstance(value, str):
            raise ValueError(f"line {number}: not a string")
        return value
    if text.startswith("'"):
        if len(text) < 2 or not text.endswith("'"):
            raise ValueError(f"line {number}: unclosed single-quoted string")
        inner = text[1:-1]
        if "'" in inner.replace("''", ""):
            raise ValueError(f"line {number}: a quote inside a single-quoted string must be doubled")
        return inner.replace("''", "'")
    if text.lower() in YAML_WORDS or not PLAIN.fullmatch(text) or text.endswith(":") or re.match(r"\.\d", text):
        raise ValueError(f"line {number}: quote this value: {text}")
    return text


def parse_kanon_yml(text):
    """The file as a dict. Raises ValueError with the line number on anything outside the subset.

    The subset: `key: value` at column 0, `  - key: value` list items, `    key: value` item keys,
    `      - value` list items under an item key, and full-line # comments.
    """
    out = {}
    top = item = sub = None
    for number, line in enumerate(text.split("\n"), start=1):
        line = line.removesuffix("\r")
        for char, name in ODD_BREAKS.items():
            if char in line:
                raise ValueError(f"line {number}: {name} is a line break to some YAML readers and not to others")
        line = line.rstrip()
        if not line.strip() or line.lstrip().startswith("#"):
            continue
        if "\t" in line[: len(line) - len(line.lstrip())]:
            raise ValueError(f"line {number}: tab in the indent")
        pair = re.fullmatch(r"([a-z_]+):(?: (.*))?", line)
        if pair:
            key, value = pair.group(1), (pair.group(2) or "").strip()
            if key in out:
                raise ValueError(f"line {number}: {key} given twice")
            item = sub = None
            if value:
                out[key] = _scalar(value, number)
                top = None
            else:
                out[key] = []
                top = key
            continue
        start = re.fullmatch(r"  - ([a-z_]+):(?: (.*))?", line)
        if start and top:
            item = {}
            out[top].append(item)
            sub = None
            key, value = start.group(1), (start.group(2) or "").strip()
        else:
            field = re.fullmatch(r"    ([a-z_]+):(?: (.*))?", line)
            if field and item is not None:
                key, value = field.group(1), (field.group(2) or "").strip()
            else:
                member = re.fullmatch(r"      - (.*)", line)
                if member and sub is not None:
                    sub.append(_scalar(member.group(1), number))
                    continue
                raise ValueError(f"line {number}: not in the .ai/kanon.yml form: {line.strip()}")
        if key in item:
            raise ValueError(f"line {number}: {key} given twice in one entry")
        if value:
            item[key] = _scalar(value, number)
            sub = None
        else:
            item[key] = sub = []
    return out


# ---------- the schema: the keyword subset of kanon/scripts/catalog.mjs ----------

def _type_of(value):
    if value is None:
        return "null"
    if isinstance(value, bool):
        return "boolean"
    if isinstance(value, list):
        return "array"
    if isinstance(value, dict):
        return "object"
    if isinstance(value, int):
        return "integer"
    if isinstance(value, float):
        return "number"
    return "string"


def _walk(root, schema, value, path, errors):
    if "$ref" in schema:
        node = root
        for part in schema["$ref"][2:].split("/"):
            node = node[part]
        _walk(root, node, value, path, errors)
    if "type" in schema:
        actual = _type_of(value)
        if not (actual == schema["type"] or (schema["type"] == "number" and actual == "integer")):
            errors.append({"path": path, "message": f"expected {schema['type']}, got {actual}"})
            return
    if "enum" in schema and value not in schema["enum"]:
        shown = ", ".join(json.dumps(option) for option in schema["enum"])
        errors.append({"path": path, "message": f"must be one of {shown} (got {json.dumps(value)})"})
    if "pattern" in schema and isinstance(value, str) and not re.search(schema["pattern"], value):
        errors.append({"path": path, "message": f"{json.dumps(value)} does not match pattern {schema['pattern']}"})
    if isinstance(value, dict):
        for key in schema.get("required", []):
            if key not in value:
                errors.append({"path": path, "message": f'missing required property "{key}"'})
        known = schema.get("properties", {})
        for key, sub in known.items():
            if key in value:
                _walk(root, sub, value[key], path + [key], errors)
        if schema.get("additionalProperties") is False:
            for key in value:
                if key not in known:
                    errors.append({"path": path, "message": f'unknown property "{key}"'})
    if isinstance(value, list):
        if "minItems" in schema and len(value) < schema["minItems"]:
            errors.append({"path": path, "message": f"must have at least {schema['minItems']} item(s)"})
        if "items" in schema:
            for index, element in enumerate(value):
                _walk(root, schema["items"], element, path + [index], errors)
    if "oneOf" in schema:
        branches = []
        for sub in schema["oneOf"]:
            found = []
            _walk(root, sub, value, path, found)
            branches.append(found)
        matching = sum(1 for found in branches if not found)
        if matching > 1:
            errors.append({"path": path, "message": "matches more than one oneOf alternative"})
        if matching == 0:
            errors.extend(min(branches, key=len))


def validate(schema, value):
    """[{"path": [...], "message"}] for value against schema. Empty when it matches."""
    errors = []
    _walk(schema, schema, value, [], errors)
    return errors


def at(path):
    """overlay[0].effect for ["overlay", 0, "effect"]."""
    shown = ""
    for part in path:
        shown += f"[{part}]" if isinstance(part, int) else (f".{part}" if shown else part)
    return shown


# ---------- naming a Kanon rule ----------

def default_kanon_root(skill_dir):
    """The first folder that holds kanon/catalog/families.json: the skill folder (the installed copy), then the repo root."""
    for candidate in (skill_dir, os.path.dirname(os.path.dirname(skill_dir))):
        if os.path.isfile(os.path.join(candidate, FAMILIES)):
            return candidate
    return None


def load_kanon(root):
    with open(os.path.join(root, FAMILIES), encoding="utf-8") as handle:
        families = json.load(handle)
    by_prefix, ids = {}, {}
    for family in families:
        path = os.path.join(root, "kanon", "catalog", family["family"] + ".json")
        by_prefix[family["prefix"]] = (family["family"], os.path.isfile(path))
        if not os.path.isfile(path):
            continue
        with open(path, encoding="utf-8") as handle:
            catalog = json.load(handle)
        for section in catalog["sections"]:
            for entry in section["entries"]:
                if "id" in entry:
                    ids[entry["id"]] = {"family": family["family"], "rule": entry["rule"]}
    return {"root": root, "families": families, "by_prefix": by_prefix, "ids": ids}


def resolve(entry, kanon):
    """(family, key, problem) for an overlay entry. The key is the one name of the rule."""
    key = ("id", entry["id"])
    info = kanon["ids"].get(entry["id"])
    if info is not None:
        return info["family"], key, None
    family, has_catalog = kanon["by_prefix"].get(entry["id"].split("-")[0], (None, True))
    if not has_catalog:
        return None, key, f"{entry['id']}: the {family} family has no catalog file in kanon/catalog, so its rules cannot be named yet"
    return None, key, f"{entry['id']}: no such ID in kanon/catalog"


def rule_label(key):
    return key[1]


def framework_families(kanon, framework):
    """The Kanon families that apply to a framework: the files its Kanon skill reads."""
    names = {family["family"] for family in kanon["families"]}
    return names & set(SYMFONY_FAMILIES) if framework == "symfony" else names - {"symfony"}


def silent_set(kanon, framework, touched):
    """The families `Silent on` must list: the framework's families with no overlay entry."""
    return framework_families(kanon, framework) - set(touched)


# ---------- the report ----------

CITATION = re.compile(r'`([^`]+)`(?: "([^"|`]+)")?')
FILE_REF = re.compile(r"([^:]+):([1-9][0-9]*)(?:-([1-9][0-9]*))?")


def parse_citations(cell):
    """([item], error). An item is a file, commit or branch citation. Files and commits need a quote."""
    cell = cell.strip()
    if not cell:
        return [], "no citation"
    items, position = [], 0
    while position < len(cell):
        found = CITATION.match(cell, position)
        if not found:
            return items, f"cannot read the citation at: {cell[position:position + 40]} (a quote holds no double quote, pipe or backtick)"
        ref, quote = found.group(1), found.group(2)
        if ref.startswith("commit:"):
            item = {"kind": "commit", "sha": ref[len("commit:"):], "quote": quote, "ref": ref}
        elif ref.startswith("branch:"):
            item = {"kind": "branch", "name": ref[len("branch:"):], "quote": quote, "ref": ref}
        else:
            parts = FILE_REF.fullmatch(ref)
            if not parts:
                return items, f"{ref}: not path:line, path:line-line, commit:<sha> or branch:<name>"
            item = {
                "kind": "file", "path": parts.group(1), "start": int(parts.group(2)),
                "end": int(parts.group(3)) if parts.group(3) else None, "quote": quote, "ref": ref,
            }
        if item["kind"] != "branch" and not item["quote"]:
            return items, f"{ref}: add a short quote in double quotes"
        if item["kind"] == "branch" and item["quote"]:
            return items, f"{ref}: a branch citation takes no quote"
        items.append(item)
        position = found.end()
        if position < len(cell):
            if not cell.startswith("; ", position):
                return items, "separate citations with '; '"
            position += 2
    return items, None


def parse_rule_cell(cell):
    cell = cell.strip()
    if cell == "none":
        return {"kind": "none"}, None
    if re.fullmatch(r"[A-Z]+-[0-9]{3}", cell):
        return {"kind": "id", "id": cell}, None
    return None, "Kanon rule is none or a catalog ID such as ORCH-011"


def rule_key(rule):
    return ("id", rule["id"]) if rule["kind"] == "id" else None


def _cells(line):
    return [cell.strip() for cell in line.strip().strip("|").split("|")]


def parse_report(text):
    """(report, problems). report: read_at, framework, rows, silent."""
    problems = []

    def add(where, problem):
        problems.append({"where": where, "problem": problem})

    report = {"read_at": None, "framework": None, "rows": [], "silent": []}
    lines = text.splitlines()
    for line in lines:
        for field, name in (("read_at", "Read at"), ("framework", "Framework")):
            found = re.fullmatch(rf"{name}:[ \t]*(\S+)[ \t]*", line)
            if found and report[field] is None:
                report[field] = found.group(1)
    if report["read_at"] is None:
        add("Read at", "the report needs a `Read at: <commit sha>` line")
    if report["framework"] not in FRAMEWORKS:
        add("Framework", f"the report needs `Framework: laravel` or `Framework: symfony` (got {report['framework']})")

    headings = {line.strip(): number for number, line in enumerate(lines) if line.startswith("## ")}
    for name in ("Conventions", "Silent on"):
        if sum(1 for line in lines if line.startswith("## ") and line.strip() == f"## {name}") > 1:
            add(name, f"the report has more than one `## {name}` section")
    if "## Conventions" not in headings:
        add("Conventions", "the report needs a `## Conventions` section")
    if "## Silent on" not in headings:
        add("Silent on", "the report needs a `## Silent on` section")

    def section(name):
        start = headings.get(name)
        if start is None:
            return []
        end = min([n for n in headings.values() if n > start], default=len(lines))
        return list(enumerate(lines[start + 1:end], start + 2))

    table = [(number, line) for number, line in section("## Conventions") if line.strip().startswith("|")]
    if table:
        if _cells(table[0][1]) != HEADER:
            add("Conventions", "the table header must be: " + " | ".join(HEADER))
        separator = len(table) > 1 and all(re.fullmatch(r":?-{3,}:?", cell) for cell in _cells(table[1][1])) and len(_cells(table[1][1])) == len(HEADER)
        if not separator:
            add("Conventions", "the table's second line must be the |---|---|---|---|---| separator")
        for index, (number, line) in enumerate(table[2 if separator else 1:], start=1):
            cells = _cells(line)
            where = f"report row {index} (line {number})"
            if len(cells) != 5:
                add(where, f"{len(cells)} cells, expected 5 (a cell cannot hold |)")
                continue
            convention, evidence, source, rule_cell, effect = cells
            where = f"report row {index} ({convention[:50]})"
            row = {"line": number, "where": where, "convention": convention, "citations": [], "source": source,
                   "rule": {"kind": "none"}, "effect": effect, "ok": True}
            if not convention:
                add(where, "the convention is empty")
            citations, error = parse_citations(evidence)
            row["citations"] = citations
            if error:
                add(where, f"evidence: {error}")
            if source not in SOURCES:
                add(where, f"source must be one of: {', '.join(SOURCES)} (got {source})")
            rule, error = parse_rule_cell(rule_cell)
            if error:
                add(where, error)
                row["ok"] = False
            else:
                row["rule"] = rule
            if effect not in EFFECTS:
                add(where, f"effect must be one of: {', '.join(EFFECTS)} (got {effect})")
                row["ok"] = False
            report["rows"].append(row)
    for number, line in section("## Silent on"):
        if not line.strip():
            continue
        bullet = re.fullmatch(r"- (\S+)", line.strip())
        if bullet:
            report["silent"].append(bullet.group(1))
        else:
            add("Silent on", f"line {number}: one bullet per family, `- <family>`")
    return report, problems


# ---------- citations ----------

def _git(repo, *args):
    return inventory.git(repo, *args)


def _out(proc):
    return proc.stdout.decode("utf-8", "replace")


def resolve_commit(repo, name):
    """The full sha of a commit, or None."""
    if not re.fullmatch(r"[0-9a-f]{7,40}", name):
        return None
    proc = _git(repo, "rev-parse", "--verify", "-q", f"{name}^{{commit}}")
    return _out(proc).strip() if proc.returncode == 0 else None


def blob_lines(repo, sha, path):
    """The lines of a regular file at sha, or None."""
    listed = _git(repo, "ls-tree", "-z", sha, "--", path)
    if listed.returncode != 0:
        return None
    for entry in _out(listed).split("\0"):
        meta, _, name = entry.partition("\t")
        parts = meta.split()
        if name == path and len(parts) == 3 and parts[1] == "blob" and parts[0] in ("100644", "100755"):
            shown = _git(repo, "cat-file", "blob", parts[2])
            if shown.returncode != 0:
                return None
            lines = _out(shown).replace("\r\n", "\n").split("\n")
            return lines[:-1] if lines and lines[-1] == "" else lines
    return None


def quote_problem(quote):
    """Why a quote is too weak to show anything, or None."""
    if len(re.sub(r"\s", "", quote)) < 3:
        return "the quote needs at least 3 characters that are not spaces"
    if not re.search(r"[^\W_]", quote):
        return "the quote needs a letter or digit"
    return None


def check_citation(repo, sha, item, ignored, listed):
    """None when the citation holds at commit sha, else the problem as text.

    listed is the set of paths the inventory lists at sha, recomputed from the repo.
    """
    weak = quote_problem(item["quote"]) if item.get("quote") is not None else None
    if item["kind"] == "branch":
        refs = _out(_git(repo, "for-each-ref", "--format=%(refname)", "refs/heads", "refs/remotes")).splitlines()
        known = {r.removeprefix("refs/heads/").removeprefix("refs/remotes/") for r in refs}
        return None if item["name"] in known else f"branch:{item['name']}: no such branch"
    if item["kind"] == "commit":
        found = resolve_commit(repo, item["sha"])
        if found is None:
            return f"commit:{item['sha']}: not a commit in the repo"
        if weak:
            return f"commit:{item['sha']}: {weak}"
        if _git(repo, "merge-base", "--is-ancestor", found, sha).returncode != 0:
            return f"commit:{item['sha']}: not reachable from Read at"
        subject = _out(_git(repo, "log", "-1", "--format=%s", found)).strip()
        if item.get("quote") and collapse(item["quote"]) not in collapse(subject):
            return f"commit:{item['sha']}: the quote is not in the subject \"{subject}\""
        return None
    path, start = item["path"], item["start"]
    end = item.get("end") or start
    name = f"{path}:{start}" + (f"-{end}" if item.get("end") else "")
    if not path or path.startswith("/") or ".." in path.split("/") or "\0" in path:
        return f"{name}: not a repo-relative path"
    if path in ignored:
        return f"{name}: the path is ignored by the AI policy"
    if path not in listed:
        return f"{name}: not a path the inventory lists at Read at (a source or a sibling)"
    if end < start:
        return f"{name}: the range runs backwards"
    if end - start + 1 > MAX_SPAN:
        return f"{name}: a range spans at most {MAX_SPAN} lines"
    if weak:
        return f"{name}: {weak}"
    lines = blob_lines(repo, sha, path)
    if lines is None:
        return f"{name}: not in the repo as a regular file at {sha[:7]}"
    if end > len(lines):
        return f"{name}: past the end ({len(lines)} lines)"
    span = lines[start - 1:end]
    if not "".join(span).strip():
        return f"{name}: blank line"
    if item.get("quote") and collapse(item["quote"]) not in collapse(" ".join(span)):
        return f"{name}: the quote is not on the cited line"
    return None


# ---------- the whole check ----------

def _read(path):
    with open(path, encoding="utf-8") as handle:
        return handle.read()


def check_work(work, repo, kanon_root):
    """(problems, read_at): every problem in the work folder as [{"where", "problem"}], and the full sha
    of the report's `Read at` when it resolved and matched inventory.json, else None."""
    problems = []

    def add(where, problem):
        problems.append({"where": where, "problem": problem})

    policy_mod = _sibling("check-policy.py")
    kanon = load_kanon(kanon_root)

    try:
        policy = json.loads(_read(os.path.join(work, "policy.json")))
        if policy.get("result") != "continue":
            add("policy.json", "the policy check did not say continue")
    except (OSError, ValueError, AttributeError) as error:
        add("policy.json", f"missing or unreadable in the work folder: {error}")
    try:
        inventory.require_top_level(repo)
        repo_ok = True
    except inventory.Stop as stop:
        add("--repo", str(stop))
        repo_ok = False
    listing = None
    try:
        listing = json.loads(_read(os.path.join(work, "inventory.json")))
        inventory_read_at, inventory_branches = listing["read_at"], set(listing["branches"])
    except (OSError, ValueError, KeyError, TypeError) as error:
        add("inventory.json", f"missing or unreadable in the work folder: {error}")

    # the overlay
    entries = []
    try:
        parsed = parse_kanon_yml(_read(os.path.join(work, OVERLAY)))
    except OSError:
        add(OVERLAY, "missing in the work folder")
        parsed = None
    except ValueError as error:
        add(OVERLAY, str(error))
        parsed = None
    bad = set()
    if parsed is not None:
        with open(SCHEMA_PATH, encoding="utf-8") as handle:
            schema = json.load(handle)
        for error in validate(schema, parsed):
            add(f"{OVERLAY} {at(error['path'])}".strip(), error["message"])
            if len(error["path"]) >= 2 and error["path"][0] == "overlay":
                bad.add(error["path"][1])
        entries = [(i, e) for i, e in enumerate(parsed.get("overlay", [])) if isinstance(e, dict) and i not in bad]
        if parsed.get("mode") == "canon-first":
            add(f"{OVERLAY} mode", "standards-discovery writes mode: project-first")

    # the report
    report, report_problems = None, []
    try:
        report, report_problems = parse_report(_read(os.path.join(work, "standards-report.md")))
    except OSError:
        add("standards-report.md", "missing in the work folder")
    problems.extend(report_problems)
    sha = None
    if repo_ok and report and report["read_at"]:
        sha = resolve_commit(repo, report["read_at"].lower())
        if sha is None:
            add("Read at", f"{report['read_at']} is not a commit in the repo")
        elif listing is not None and sha != inventory_read_at:
            add("Read at", f"{sha} differs from read_at in inventory.json ({inventory_read_at})")
            sha = None
    ignored, listed = set(), set()
    if sha:
        try:
            committed = inventory.ignore_files_at(repo, sha)
            inventory.require_same_ignore_files(repo, committed)
            ignored = inventory.ignored_paths(repo, sha, committed)
            listed = inventory.listed_paths(inventory.listing(repo, sha, ignored))
        except inventory.Stop as stop:
            add("ignore files", str(stop))
            sha = None

    # each overlay entry
    by_key = {}
    touched = set()
    framework = report["framework"] if report and report["framework"] in FRAMEWORKS else None
    for index, entry in entries:
        family, key, problem = resolve(entry, kanon)
        where = f"{OVERLAY} overlay[{index}]"
        if problem:
            add(where, problem)
            continue
        if framework and family not in framework_families(kanon, framework):
            add(where, f"{rule_label(key)}: {family} is not a {framework} family, so the {framework} Kanon has no such rule")
            continue
        touched.add(family)
        if key in by_key:
            add(where, f"{rule_label(key)} is named twice (overlay[{by_key[key][0]}] and overlay[{index}])")
            continue
        by_key[key] = (index, entry)
        effect, rule = entry["effect"], entry.get("rule")
        if effect == "change" and not rule:
            add(where, f"{rule_label(key)}: a change entry needs rule, a file under {RULES_DIR}/")
        if effect != "change" and rule:
            add(where, f"{rule_label(key)}: {effect} takes no rule, only a change entry does")
        if rule and not os.path.isfile(os.path.join(work, rule)):
            add(where, f"{rule_label(key)}: the rule file {rule} does not exist in the work folder")
        for ref in entry["evidence"]:
            parts = FILE_REF.fullmatch(ref)
            if sha and parts:
                item = {"kind": "file", "path": parts.group(1), "start": int(parts.group(2)),
                        "end": int(parts.group(3)) if parts.group(3) else None, "quote": None}
                problem = check_citation(repo, sha, item, ignored, listed)
                if problem:
                    add(where, f"{rule_label(key)}: evidence {problem}")

    # the prose rule files
    rules_dir = os.path.join(work, RULES_DIR)
    for name in sorted(os.listdir(rules_dir)) if os.path.isdir(rules_dir) else []:
        if not name.endswith(".md"):
            continue
        try:
            front = policy_mod.parse_frontmatter(_read(os.path.join(rules_dir, name)))
        except (OSError, ValueError) as error:
            front, why = {}, str(error)
        else:
            why = "the paths list is empty or missing"
        if not isinstance(front.get("paths"), list) or not front["paths"]:
            add(f"{RULES_DIR}/{name}", f"needs a frontmatter paths: list with at least one glob ({why})")

    if report is None:
        return problems, sha

    # the rows, and the rows against the entries
    row_keys = {}
    for row in report["rows"]:
        where = row["where"]
        if sha:
            for item in row["citations"]:
                if item["kind"] == "branch" and listing is not None and item["name"] not in inventory_branches:
                    add(where, f"branch:{item['name']}: not in the branch list of inventory.json")
                    continue
                problem = check_citation(repo, sha, item, ignored, listed)
                if problem:
                    add(where, problem)
        if not row["ok"]:
            continue
        key = rule_key(row["rule"])
        if row["effect"] == "project-only" and key is not None:
            add(where, "a project-only row takes Kanon rule none")
            continue
        if row["effect"] != "project-only" and key is None:
            add(where, f"a {row['effect']} row needs a Kanon rule, not none")
            continue
        if key is None:
            continue
        if key in row_keys:
            add(where, f"{rule_label(key)} has two rows in the report")
            continue
        row_keys[key] = row
        entry = by_key.get(key)
        if entry is None:
            add(where, f"{rule_label(key)} has no overlay entry")
            continue
        index, entry = entry
        if entry["effect"] != row["effect"]:
            add(where, f"{rule_label(key)}: the row says effect {row['effect']}, overlay[{index}] says {entry['effect']}")
        cited = {item["ref"] for item in row["citations"]}
        for ref in entry["evidence"]:
            if ref not in cited:
                add(f"{OVERLAY} overlay[{index}]", f"{rule_label(key)}: evidence {ref} is not among the citations of its report row")
    for key, (index, _) in by_key.items():
        if key not in row_keys:
            add(f"{OVERLAY} overlay[{index}]", f"{rule_label(key)} has no row in the report")

    # Silent on
    if report["framework"] in FRAMEWORKS:
        want, have = silent_set(kanon, report["framework"], touched), set(report["silent"])
        if want - have:
            add("Silent on", "missing: " + ", ".join(sorted(want - have)))
        if have - want:
            add("Silent on", f"must not list (it has an overlay entry, or is not a {report['framework']} family): " + ", ".join(sorted(have - want)))
    return problems, sha


def main(argv=None):
    parser = argparse.ArgumentParser(description="Check the discovery pass's report, overlay and citations.")
    parser.add_argument("--work", required=True, help="the work folder in the client's brain")
    parser.add_argument("--repo", required=True, help="the client repo")
    parser.add_argument("--kanon-root", help="a folder that holds kanon/catalog/families.json and the reference files")
    args = parser.parse_args(argv)
    for flag in ("work", "repo"):
        if not os.path.isdir(getattr(args, flag)):
            parser.error(f"--{flag} is not a directory: {getattr(args, flag)}")
    root = args.kanon_root or default_kanon_root(SKILL)
    if root is None or not os.path.isfile(os.path.join(root, FAMILIES)):
        print(f"no {FAMILIES} under {root or 'the skill folder or the repo root'}: pass --kanon-root", file=sys.stderr)
        return 2
    problems, _ = check_work(args.work, args.repo, root)
    print(json.dumps({"result": "invalid" if problems else "ok", "problems": problems}, indent=2))
    return 1 if problems else 0


if __name__ == "__main__":
    sys.exit(main())
