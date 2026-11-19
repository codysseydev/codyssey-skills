#!/usr/bin/env python3
"""Prove a repository's .factory/recipe.yml from a clean state.

Usage: python3 prove-recipe.py REPO [--out FILE] [--keep-going] [--timeout SECONDS] [--keep-copy]

Clones REPO (a local git repository) into a temp directory, so vendor/, .env and untracked
files are gone. Runs setup steps in order (stops at the first failure), then every check in
order (stops at the first failure unless --keep-going), and always runs teardown. Prints JSON
evidence and writes it to --out. Exit code 0 only when every step passed; 2 on bad input.

The recipe is a fixed, restricted YAML shape (see parse_recipe). Anything else is an error.
"""
import argparse, datetime, json, os, re, shutil, subprocess, sys, tempfile, time

SECTIONS = ("setup", "checks", "teardown")
NAME_RE = re.compile(r"^[A-Za-z0-9][A-Za-z0-9_.-]*$")
TAIL_LINES = 40
TAIL_CHARS = 4000


class RecipeError(Exception):
    pass


def _value(raw, lineno):
    raw = raw.strip()
    if not raw:
        raise RecipeError(f"line {lineno}: empty value")
    if raw[0] in "'\"":
        q = raw[0]
        if len(raw) < 2 or raw[-1] != q:
            raise RecipeError(f"line {lineno}: unterminated {q} quote")
        inner = raw[1:-1]
        if q == '"':
            inner = inner.replace('\\"', '"').replace("\\\\", "\\")
        else:
            inner = inner.replace("''", "'")
        if not inner.strip():
            raise RecipeError(f"line {lineno}: empty value")
        return inner
    if raw[0] in "|>[{&*!":
        raise RecipeError(f"line {lineno}: only plain or quoted one-line values are allowed, got {raw[:20]!r}")
    return raw


def parse_recipe(text):
    """Parse exactly this shape and nothing else:

    version: 1
    setup:
      - name: <id>
        run: <one-line shell command>
    checks: ...
    teardown: ...

    Blank lines and full-line # comments are ignored. Sections may be empty (`setup: []`).
    Returns {"version": 1, "setup": [...], "checks": [...], "teardown": [...]} where each
    step is {"name", "run"}.
    """
    recipe = {"version": None, "setup": [], "checks": [], "teardown": []}
    seen = set()
    section = None
    step = None  # the dict being filled; needs a run before the next item or section
    step_line = 0

    def close_step():
        if step is not None and "run" not in step:
            raise RecipeError(f"line {step_line}: step {step['name']!r} has no run")

    for n, line in enumerate(text.splitlines(), 1):
        if "\t" in line:
            raise RecipeError(f"line {n}: tabs are not allowed, indent with spaces")
        body = line.strip()
        if not body or body.startswith("#"):
            continue
        indent = len(line) - len(line.lstrip(" "))
        if indent == 0:
            close_step()
            step = None
            m = re.match(r"^([a-z]+):\s*(.*)$", line)
            if not m:
                raise RecipeError(f"line {n}: expected 'version: 1' or a section header, got {body!r}")
            key, rest = m.group(1), m.group(2)
            if key == "version":
                if recipe["version"] is not None:
                    raise RecipeError(f"line {n}: version given twice")
                if rest != "1":
                    raise RecipeError(f"line {n}: version must be 1, got {rest!r}")
                recipe["version"] = 1
                section = None
            elif key in SECTIONS:
                if key in seen:
                    raise RecipeError(f"line {n}: section {key!r} given twice")
                seen.add(key)
                section = key
                if rest not in ("", "[]"):
                    raise RecipeError(f"line {n}: after '{key}:' put steps on the next lines, or [] for none")
                if rest == "[]":
                    section = None
            else:
                raise RecipeError(f"line {n}: unknown key {key!r} (allowed: version, {', '.join(SECTIONS)})")
            continue
        if section is None:
            raise RecipeError(f"line {n}: indented line outside a section: {body!r}")
        m = re.match(r"^  - name:\s*(.*)$", line)
        if m:
            close_step()
            name = _value(m.group(1), n)
            if not NAME_RE.match(name):
                raise RecipeError(f"line {n}: step name {name!r} must match {NAME_RE.pattern}")
            if any(s["name"] == name for s in recipe[section]):
                raise RecipeError(f"line {n}: duplicate step name {name!r} in {section}")
            step = {"name": name}
            step_line = n
            recipe[section].append(step)
            continue
        m = re.match(r"^    run:\s*(.*)$", line)
        if m:
            if step is None:
                raise RecipeError(f"line {n}: 'run:' before any '- name:'")
            if "run" in step:
                raise RecipeError(f"line {n}: step {step['name']!r} has two run lines")
            step["run"] = _value(m.group(1), n)
            continue
        raise RecipeError(f"line {n}: unexpected line {body!r}; a step is '  - name: <id>' then '    run: <command>'")
    close_step()
    if recipe["version"] is None:
        raise RecipeError("missing 'version: 1'")
    if not recipe["checks"]:
        raise RecipeError("the recipe needs at least one check")
    return recipe


def tail(text):
    lines = text.splitlines()[-TAIL_LINES:]
    out = "\n".join(lines)
    return out[-TAIL_CHARS:]


def run_step(kind, step, cwd, timeout):
    start = time.monotonic()
    try:
        p = subprocess.run(step["run"], shell=True, cwd=cwd, capture_output=True, text=True,
                           errors="replace", timeout=timeout)
        code, out = p.returncode, (p.stdout or "") + (p.stderr or "")
    except subprocess.TimeoutExpired as e:
        code = 124
        raw = (e.stdout or b"") + (e.stderr or b"")
        out = (raw.decode("utf-8", "replace") if isinstance(raw, bytes) else raw) + f"\n[timed out after {timeout}s]"
    return {"phase": kind, "name": step["name"], "command": step["run"], "exit_code": code,
            "passed": code == 0, "duration_s": round(time.monotonic() - start, 2), "output_tail": tail(out)}


def git(*args, cwd=None):
    return subprocess.run(["git", *args], cwd=cwd, capture_output=True, text=True)


def prove(repo, keep_going=False, timeout=1800, keep_copy=False):
    repo = os.path.abspath(repo)
    evidence = {"repo": repo, "head": None, "clean": False, "started": datetime.datetime.now().isoformat(timespec="seconds"),
                "steps": [], "passed": False, "error": None}
    recipe_path = os.path.join(repo, ".factory", "recipe.yml")
    head = git("rev-parse", "HEAD", cwd=repo)
    if head.returncode != 0:
        evidence["error"] = f"{repo} is not a git repository with a commit: {head.stderr.strip()}"
        return evidence
    evidence["head"] = head.stdout.strip()
    tmp = tempfile.mkdtemp(prefix="prove-recipe-")
    copy = os.path.join(tmp, "clean")
    try:
        clone = git("clone", "--quiet", "--no-hardlinks", repo, copy)
        if clone.returncode != 0:
            evidence["error"] = f"git clone failed: {clone.stderr.strip()}"
            return evidence
        co = git("checkout", "--quiet", evidence["head"], cwd=copy)
        if co.returncode != 0:
            evidence["error"] = f"checkout of HEAD failed: {co.stderr.strip()}"
            return evidence
        evidence["clean"] = True
        evidence["copy"] = copy
        recipe_file = os.path.join(copy, ".factory", "recipe.yml")
        try:
            with open(recipe_file, encoding="utf-8") as f:
                recipe = parse_recipe(f.read())
        except FileNotFoundError:
            evidence["error"] = ".factory/recipe.yml is not committed at HEAD" + (
                " (it exists in the working tree but is not committed)" if os.path.exists(recipe_path) else "")
            return evidence
        except RecipeError as e:
            evidence["error"] = f"recipe.yml: {e}"
            return evidence

        ok = True
        for step in recipe["setup"]:
            r = run_step("setup", step, copy, timeout)
            evidence["steps"].append(r)
            if not r["passed"]:
                ok = False
                break
        if ok:
            for step in recipe["checks"]:
                r = run_step("checks", step, copy, timeout)
                evidence["steps"].append(r)
                if not r["passed"]:
                    ok = False
                    if not keep_going:
                        break
        for step in recipe["teardown"]:
            r = run_step("teardown", step, copy, timeout)
            evidence["steps"].append(r)
            if not r["passed"]:
                ok = False
        evidence["passed"] = ok
        return evidence
    finally:
        if keep_copy:
            evidence["kept_copy"] = copy
        else:
            shutil.rmtree(tmp, ignore_errors=True)
            evidence.pop("copy", None)


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("repo", help="path to a local git repository")
    ap.add_argument("--out", help="write the JSON evidence to this file")
    ap.add_argument("--keep-going", action="store_true", help="run every check even after one fails")
    ap.add_argument("--timeout", type=int, default=1800, help="seconds allowed per step (default 1800)")
    ap.add_argument("--keep-copy", action="store_true", help="leave the clean copy on disk for debugging")
    args = ap.parse_args(argv)
    if not os.path.isdir(args.repo):
        print(f"error: {args.repo} is not a directory", file=sys.stderr)
        return 2
    evidence = prove(args.repo, args.keep_going, args.timeout, args.keep_copy)
    text = json.dumps(evidence, indent=2)
    print(text)
    if args.out:
        with open(args.out, "w", encoding="utf-8") as f:
            f.write(text + "\n")
    if evidence["error"] and not evidence["steps"]:
        return 2
    return 0 if evidence["passed"] else 1


if __name__ == "__main__":
    sys.exit(main())
