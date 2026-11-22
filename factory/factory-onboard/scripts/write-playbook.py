#!/usr/bin/env python3
"""Write a starter .factory/playbook.md, or check that one has all seven sections.

Usage: python3 write-playbook.py REPO [--check] [--out FILE]

Without a playbook the script writes one from facts it can read mechanically: the recipe,
package.json and composer.json scripts, .claude/skills, .claude/agents and .ai/rules. A
section with nothing to say gets the line `None yet.`.

With a playbook the script never rewrites existing text. It adds the sections that are
missing (before the next section that is present in canonical order, else at the end), each
with `None yet.`. It lists backticked items it cannot resolve in the repo, so a model can
fix those lines and leave the rest of the prose alone.

--check writes nothing. It exits 1 when the file is missing or a heading is missing.
Prints JSON (and writes it to --out). Exit codes: 0 passed, 1 check failed, 2 bad input.
The script never commits.
"""
import argparse, importlib.util, json, os, re, subprocess, sys

HERE = os.path.dirname(os.path.abspath(__file__))
SECTIONS = ("Checks", "Review", "Scaffolding", "Local setup", "Cleanup", "Notes", "Post-merge")
NONE_LINE = "None yet."
# The archive run reads these two lines after a merge. `none` means the signal is not exercised.
POST_MERGE_BODY = (
    "After the PR merges, the archive run reads the deploy check on the merge commit and looks for new Sentry issues. "
    "Name the check run and the Sentry project here, or leave `none`.\n"
    "\n"
    "- Deploy check: none\n"
    "- Sentry: none"
)
GATE_WORDS = {"lint", "check", "analyse", "analyze", "typecheck", "test", "phpstan", "pint", "arkitect", "rector", "build"}
NOT_GATE_WORDS = {"fix", "watch"}
# Subcommands that are not project scripts, so they never count as an unresolved script.
BUILTINS = {
    "composer": {"install", "update", "require", "remove", "dump-autoload", "dumpautoload", "validate", "audit",
                 "outdated", "show", "init", "create-project", "config", "diagnose", "global", "exec", "clear-cache",
                 "check-platform-reqs", "status", "search", "why", "why-not", "licenses", "reinstall", "bump",
                 "self-update", "help", "list", "archive", "fund", "prohibits", "depends", "browse", "suggests"},
    "pnpm": {"install", "i", "add", "remove", "rm", "update", "up", "dlx", "exec", "store", "audit", "outdated",
             "list", "ls", "why", "link", "unlink", "rebuild", "prune", "dedupe", "fetch", "approve-builds", "env",
             "setup", "config", "help", "init", "publish", "pack", "patch", "licenses", "create", "import"},
    "yarn": {"install", "add", "remove", "up", "upgrade", "dlx", "exec", "audit", "info", "why", "link", "unlink",
             "config", "help", "init", "publish", "pack", "workspaces", "workspace", "cache", "set", "plugin",
             "node", "global", "create", "generate-lock-entry", "outdated", "list", "ls", "bin"},
}
ROOT_ONLY = {"npm": {"test", "start", "stop", "restart"}}
TOKEN_RE = re.compile(r"`([^`\n]+)`")
FENCE_RE = re.compile(r"^\s*(```|~~~)")
REMOTE_RE = re.compile(r"^(?:(?:https?|ssh|git)://[^/]+/|[\w.-]+@[\w.-]+:)(?:[^/]+/)+([^/]+?)/?$")
H2_RE = re.compile(r"^##\s+(.*?)\s*$")


def load_parse_recipe():
    path = os.path.join(HERE, "prove-recipe.py")
    spec = importlib.util.spec_from_file_location("prove_recipe", path)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


def read_json(path):
    try:
        with open(path, encoding="utf-8") as f:
            data = json.load(f)
        return data if isinstance(data, dict) else {}
    except (OSError, ValueError):
        return {}


def code(text):
    return f"`` {text} ``" if "`" in text else f"`{text}`"


def headings(text):
    """Map section name to its line index, for the `## ` lines outside code fences."""
    found, fenced = {}, False
    for i, line in enumerate(text.splitlines()):
        if FENCE_RE.match(line):
            fenced = not fenced
        elif not fenced:
            m = H2_RE.match(line)
            if m and m.group(1) in SECTIONS and m.group(1) not in found:
                found[m.group(1)] = i
    return found


def package_manager(repo):
    if os.path.exists(os.path.join(repo, "pnpm-lock.yaml")):
        return "pnpm"
    if os.path.exists(os.path.join(repo, "yarn.lock")):
        return "yarn"
    return "npm"


def is_gate(name):
    parts = set(re.split(r"[:._-]", name.lower()))
    return bool(parts & GATE_WORDS) and not parts & NOT_GATE_WORDS


def script_bodies(value):
    items = value if isinstance(value, list) else [value]
    out = []
    for s in items:
        if isinstance(s, str):
            s = re.sub(r"^@(php|composer)\s+", lambda m: "php " if m.group(1) == "php" else "composer ", s.strip())
            out.append(" ".join(s.split()))
    return out


def find_gates(repo):
    """[(gate name, command, bodies)] from package.json and composer.json scripts with gate-like names."""
    gates = []
    pkg = read_json(os.path.join(repo, "package.json")).get("scripts")
    pm = package_manager(repo)
    for name, value in (pkg.items() if isinstance(pkg, dict) else []):
        if is_gate(name):
            cmd = f"{pm} {name}" if pm in ("pnpm", "yarn") else f"npm run {name}"
            gates.append((name, cmd, script_bodies(value)))
    comp = read_json(os.path.join(repo, "composer.json")).get("scripts")
    for name, value in (comp.items() if isinstance(comp, dict) else []):
        if is_gate(name):
            gates.append((name, f"composer {name}", script_bodies(value)))
    return gates


def covered(gate, runs):
    name, cmd, bodies = gate
    norm = [" ".join(r.split()) for r in runs]
    return any(cmd in r or any(b and b in r for b in bodies) for r in norm)


def table(rows):
    return ["| Gate | Command |", "|---|---|"] + [f"| {g} | {code(c)} |" for g, c in rows]


def subdirs(repo, rel, pred):
    base = os.path.join(repo, rel)
    if not os.path.isdir(base):
        return []
    return sorted(d for d in os.listdir(base) if os.path.isdir(os.path.join(base, d)) and pred(d))


def section_body(name, repo, recipe):
    lines = []
    if name == "Post-merge":
        return POST_MERGE_BODY
    if name == "Checks":
        gates = find_gates(repo)
        if recipe is not None:
            lines.append("The gates are the checks in `.factory/recipe.yml`. Gates the recipe lacks:")
            gates = [g for g in gates if not covered(g, [s["run"] for s in recipe["checks"]])]
            lines.append("")
        if gates:
            lines += table([(g[0], g[1]) for g in gates])
        else:
            lines.append(NONE_LINE)
    elif name == "Review":
        for d in subdirs(repo, os.path.join(".claude", "skills"), lambda d: "review" in d.lower()):
            lines.append(f"- Review skill: `{d}` ({code(f'.claude/skills/{d}/')})")
        if os.path.isdir(os.path.join(repo, ".ai", "rules")):
            lines.append("- Rule pack: `.ai/rules/`")
    elif name == "Scaffolding":
        for d in subdirs(repo, os.path.join(".claude", "skills"), lambda d: d.startswith("new-")):
            lines.append(f"- Scaffolding skill: `{d}` ({code(f'.claude/skills/{d}/')})")
        agents = os.path.join(repo, ".claude", "agents")
        if os.path.isdir(agents):
            for f in sorted(os.listdir(agents)):
                if f.endswith(".md") and "implementer" in f.lower():
                    lines.append(f"- Implementer agent: `.claude/agents/{f}`")
    elif name in ("Local setup", "Cleanup") and recipe is not None:
        steps = recipe["setup" if name == "Local setup" else "teardown"]
        if steps:
            lines.append(f"From the recipe's `{'setup' if name == 'Local setup' else 'teardown'}` section, in order, "
                         "from the repo root.")
            lines.append("")
            lines += [f"{i}. `{s['name']}`: {code(s['run'])}" for i, s in enumerate(steps, 1)]
    return "\n".join(lines) if lines and any(l.strip() for l in lines) else NONE_LINE


def starter(repo, recipe):
    name = repo_name(repo)
    out = [f"# Factory project file: {name}", "",
           f"Holds {name}'s specifics for the factory playbook in codysseydev/codyssey-skills "
           "(playbooks/factory.md). `factory-onboard` wrote the first version from the repo. "
           "A PR that changes a check command or the local setup updates this file in the same change.", ""]
    for s in SECTIONS:
        out += [f"## {s}", "", section_body(s, repo, recipe), ""]
    return "\n".join(out)


def add_missing(text):
    """Insert each missing section as pure additions. Returns (new text, [names], {name: where})."""
    lines = text.splitlines(keepends=True)
    if lines and not lines[-1].endswith("\n"):
        lines[-1] += "\n"
    added, where = [], {}
    for s in SECTIONS:
        found = headings("".join(lines))
        if s in found:
            continue
        block = [f"## {s}\n", "\n", (POST_MERGE_BODY if s == "Post-merge" else NONE_LINE) + "\n", "\n"]
        later = [found[t] for t in SECTIONS[SECTIONS.index(s) + 1:] if t in found]
        if later:
            at = min(later)
            lines[at:at] = block
            where[s] = "before " + next(t for t in SECTIONS if found.get(t) == at)
        else:
            if lines and lines[-1].strip():
                lines.append("\n")
            lines += block
            where[s] = "end"
        added.append(s)
    return "".join(lines), added, where


def git_ok(repo, *args):
    return subprocess.run(["git", *args], cwd=repo, capture_output=True).returncode == 0


def repo_name(repo):
    """The repo name from the origin URL, else the folder name. A worktree folder has its own name."""
    folder = os.path.basename(os.path.abspath(repo))
    try:
        p = subprocess.run(["git", "remote", "get-url", "origin"], cwd=repo, capture_output=True, text=True)
    except OSError:
        return folder
    m = p.returncode == 0 and REMOTE_RE.match(p.stdout.strip())
    return (m and m.group(1).removesuffix(".git")) or folder


def path_exists(repo, token):
    if os.path.exists(os.path.join(repo, token.rstrip("/") or token)):
        return True
    # Generated or local paths (vendor/, .env, node_modules/) are not drift. Git refs (origin/main) are not paths.
    return (git_ok(repo, "check-ignore", "-q", token)
            or git_ok(repo, "rev-parse", "--verify", "--quiet", token + "^{commit}"))


def scripts_of(repo, tool):
    fname = "package.json" if tool != "composer" else "composer.json"
    data = read_json(os.path.join(repo, fname)).get("scripts")
    return fname, (set(data) if isinstance(data, dict) else set())


def command_problem(repo, segment):
    m = re.match(r"^(pnpm|npm|yarn|composer)\s+(.*)$", segment.strip())
    if not m:
        return None
    tool, rest = m.group(1), m.group(2).split()
    if not rest or rest[0].startswith("-"):
        return None
    if rest[0] in ("run", "run-script") and len(rest) > 1:
        script = rest[1]
    elif rest[0] in ("run", "run-script"):
        return None
    elif tool == "npm":
        if rest[0] not in ROOT_ONLY["npm"]:
            return None  # `npm install` and friends are not scripts
        script = rest[0]
    elif rest[0] in BUILTINS[tool]:
        return None
    else:
        script = rest[0]
    fname, known = scripts_of(repo, tool)
    if script in known:
        return None
    return f"script {script!r} is not in {fname}" if os.path.exists(os.path.join(repo, fname)) else f"{fname} does not exist"


def find_unresolved(text, repo):
    out, section, fenced = [], "", False
    for n, line in enumerate(text.splitlines(), 1):
        if FENCE_RE.match(line):
            fenced = not fenced
            continue
        if fenced:
            continue
        m = H2_RE.match(line)
        if m:
            section = m.group(1)
            continue
        for tok in TOKEN_RE.findall(line):
            tok = tok.strip()
            why = None
            if " " not in tok and (tok.startswith(".") or "/" in tok):
                if not (tok.startswith(("/", "~")) or "://" in tok or re.search(r"[*<>{}$]", tok)
                        or tok in (".", "..") or path_exists(repo, tok)):
                    why = "path does not exist in the repo"
            else:
                for seg in tok.split("&&"):
                    why = command_problem(repo, seg)
                    if why:
                        break
            if why:
                out.append({"section": section, "line": n, "token": tok, "why": why})
    return out


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("repo", help="path to the repository")
    ap.add_argument("--check", action="store_true", help="write nothing; fail when the file or a section is missing")
    ap.add_argument("--out", help="write the JSON result to this file")
    args = ap.parse_args(argv)
    repo = os.path.abspath(args.repo)
    if not os.path.isdir(repo):
        print(f"error: {args.repo} is not a directory", file=sys.stderr)
        return 2
    path = os.path.join(repo, ".factory", "playbook.md")
    result = {"path": path, "created": False, "added_sections": [], "placement": {}, "unresolved": [], "passed": False}
    exists = os.path.isfile(path)

    if args.check:
        text = open(path, encoding="utf-8").read() if exists else ""
        missing = [s for s in SECTIONS if s not in headings(text)]
        result.update(exists=exists, missing_sections=missing, passed=exists and not missing)
        if exists:
            result["unresolved"] = find_unresolved(text, repo)
    else:
        recipe = None
        recipe_path = os.path.join(repo, ".factory", "recipe.yml")
        if os.path.isfile(recipe_path):
            pr = load_parse_recipe()
            try:
                with open(recipe_path, encoding="utf-8") as f:
                    recipe = pr.parse_recipe(f.read())
            except pr.RecipeError as e:
                print(f"error: .factory/recipe.yml: {e}", file=sys.stderr)
                return 2
        os.makedirs(os.path.dirname(path), exist_ok=True)
        if exists:
            with open(path, encoding="utf-8", newline="") as f:
                old = f.read()
            text, added, where = add_missing(old)
            if added:
                with open(path, "w", encoding="utf-8", newline="") as f:
                    f.write(text)
            result.update(added_sections=added, placement=where)
        else:
            text = starter(repo, recipe)
            with open(path, "w", encoding="utf-8", newline="") as f:
                f.write(text)
            result.update(created=True, added_sections=list(SECTIONS), placement={s: "new file" for s in SECTIONS})
        result["unresolved"] = find_unresolved(text, repo)
        result["passed"] = all(s in headings(text) for s in SECTIONS)

    out = json.dumps(result, indent=2)
    print(out)
    if args.out:
        with open(args.out, "w", encoding="utf-8") as f:
            f.write(out + "\n")
    return 0 if result["passed"] else 1


if __name__ == "__main__":
    sys.exit(main())
