#!/usr/bin/env python3
"""Bootstrap a factory product: its brain vault, its event model journey setup, its code repo.

Usage: python3 bootstrap.py --name "Sample Product" --slug sample-product --pitch "One line." \\
           --modules Billing,Catalog --stack laravel --root ~/Code [--brain-template PATH_OR_URL] \\
           [--pack PATH_OR_URL] [--date YYYY-MM-DD] [--dry-run]

Creates <root>/<slug>-docs and <root>/<slug>, then proves the repo's .factory/recipe.yml from a
clean clone. Local only: it never creates a GitHub repository and never pushes.
Exit code: 0 when everything passed, 1 when a step failed, 2 on bad input.
"""
import argparse, datetime, json, os, re, shutil, subprocess, sys, tempfile

HERE = os.path.dirname(os.path.abspath(__file__))
SKILLS = os.path.abspath(os.path.join(HERE, "..", ".."))
DEFAULT_BRAIN = os.environ.get("FACTORY_BRAIN_TEMPLATE", "https://github.com/codysseydev/brain-template")
DEFAULT_PACKS = {"laravel": os.environ.get("FACTORY_LARAVEL_PACK", "https://github.com/codysseydev/laravel-template")}
SLUG_RE = re.compile(r"^[a-z][a-z0-9]*(-[a-z0-9]+)*$")
MODULE_RE = re.compile(r"^[A-Z][A-Za-z0-9]*$")
JOURNEY_DIR = os.path.join("Architecture", "event-model-generator")


class Fail(Exception):
    pass


def run(cmd, cwd=None, what=None):
    p = subprocess.run(cmd, cwd=cwd, capture_output=True, text=True)
    if p.returncode != 0:
        raise Fail(f"{what or ' '.join(cmd[:3])} failed (exit {p.returncode}):\n{(p.stdout + p.stderr).strip()[-2000:]}")
    return p


def sibling_or_installed(name, rel):
    for base in (os.path.join(SKILLS, name), os.path.join(os.path.expanduser("~/.claude/skills"), name)):
        path = os.path.join(base, rel)
        if os.path.exists(path):
            return path
    raise Fail(f"cannot find {name}/{rel} next to this skill or under ~/.claude/skills")


def resolve_template(spec, tmp, script, label):
    """A local path is used as is. Anything else is cloned into tmp."""
    path = os.path.abspath(os.path.expanduser(spec))
    if not re.match(r"^(https?://|git@|ssh://)", spec):
        if not os.path.isdir(path):
            raise Fail(f"{label} {spec} is not a directory")
    else:
        path = os.path.join(tmp, label)
        run(["git", "clone", "--quiet", "--depth", "1", spec, path], what=f"cloning the {label} {spec}")
    if not os.path.isfile(os.path.join(path, script)):
        raise Fail(f"{label} {spec} has no {script}")
    return path


def non_empty(path):
    return os.path.exists(path) and (not os.path.isdir(path) or bool(os.listdir(path)))


def setup_event_model(brain, name):
    em_sample = sibling_or_installed("event-model", os.path.join("examples", "sample-product"))
    wb = sibling_or_installed("event-model", os.path.join("scripts", "wb.py"))
    dest = os.path.join(brain, JOURNEY_DIR)
    os.makedirs(dest, exist_ok=True)
    for f in ("product.py", "wb_state.json"):
        shutil.copy2(os.path.join(em_sample, f), os.path.join(dest, f))
    title = f"01 \u00b7 {name}"
    story = f"Story: to be written in domain design. The first feature in {name} adds the slices."
    with open(os.path.join(dest, "j01.py"), "w", encoding="utf-8") as f:
        f.write('"""Journey 01 of ' + name.replace('"', "'") + '. Empty on purpose: the first feature adds lanes and slices."""\n'
                f"J01 = dict(\n    key='01', title={title!r},\n    story={story!r},\n"
                "    lanes=[], slices=[], hotspots=[],\n)\n")
    path = os.path.join(dest, "product.py")
    with open(path, encoding="utf-8") as f:
        text = f.read()
    text, n = re.subn(r"('name':\s*)'[^']*'", lambda m: f"{m.group(1)}{name!r}", text, count=1)
    if n != 1:
        raise Fail("product.py in the event-model sample has no 'name' entry to set")
    # The sample is a bike shop. Name nothing of it in the new product's files.
    text = re.sub(r'^""".*?"""', f'"""{name}: journeys for the event model. Edit PRODUCT, then list the journeys in FRAMES.\n\nproduct.py exports two things the event-model scripts read:\n  PRODUCT  config: names and legend wording. Anything left out falls back to the defaults in scripts/model.py.\n  FRAMES   the journeys, in the order they should appear on board 00 (legends and the modules wall).\n"""', text, count=1, flags=re.S)
    text = re.sub(r"('es_actor_desc':\s*)'[^']*'", r"\1'People or systems that issue commands.'", text)
    text = re.sub(r"('es_ext_desc':\s*)'[^']*'", r"\1'Things outside the product that take part.'", text)
    with open(path, "w", encoding="utf-8") as f:
        f.write(text)
    gi = os.path.join(brain, ".gitignore")
    existing = open(gi, encoding="utf-8").read() if os.path.exists(gi) else ""
    if ".wb/" not in existing.split():
        with open(gi, "a", encoding="utf-8") as f:
            f.write(("" if existing.endswith("\n") or not existing else "\n") + ".wb/\n")
    run([sys.executable, wb, "--product", dest, "check"], what="event-model check")
    run([sys.executable, wb, "--product", dest, "plan"], what="event-model plan")  # writes .wb/ (gitignored); boards without a URL are skipped


def prove(repo, out):
    script = sibling_or_installed("factory-onboard", os.path.join("scripts", "prove-recipe.py"))
    p = subprocess.run([sys.executable, script, repo, "--out", out], capture_output=True, text=True)
    try:
        with open(out, encoding="utf-8") as f:
            return p.returncode, json.load(f)
    except (OSError, ValueError):
        return p.returncode, {"error": (p.stdout + p.stderr).strip()[-2000:], "passed": False}


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("--name", required=True)
    ap.add_argument("--slug", required=True)
    ap.add_argument("--pitch", required=True)
    ap.add_argument("--modules", default="", help="comma-separated module names, from Architecture/Bounded Contexts.md")
    ap.add_argument("--stack", default="laravel", choices=sorted(DEFAULT_PACKS))
    ap.add_argument("--root", required=True, help="folder that will hold <slug>-docs and <slug>")
    ap.add_argument("--brain-template", default=DEFAULT_BRAIN, help="path or git URL (env FACTORY_BRAIN_TEMPLATE)")
    ap.add_argument("--pack", help="path or git URL of the stack pack (env FACTORY_LARAVEL_PACK for laravel)")
    ap.add_argument("--date", default=datetime.date.today().isoformat())
    ap.add_argument("--dry-run", action="store_true",
                    help="local git only; the recipe is committed instead of proposed in a PR")
    args = ap.parse_args(argv)

    if not SLUG_RE.match(args.slug):
        print(f"error: --slug must be lowercase kebab-case, got {args.slug!r}", file=sys.stderr)
        return 2
    modules = [m for m in (x.strip() for x in args.modules.split(",")) if m]
    bad = [m for m in modules if not MODULE_RE.match(m)]
    if bad:
        print(f"error: module names must be StudlyCase, got {bad}", file=sys.stderr)
        return 2
    try:
        datetime.date.fromisoformat(args.date)
    except ValueError:
        print(f"error: --date must be YYYY-MM-DD, got {args.date!r}", file=sys.stderr)
        return 2
    root = os.path.abspath(os.path.expanduser(args.root))
    brain, repo = os.path.join(root, f"{args.slug}-docs"), os.path.join(root, args.slug)
    for p in (brain, repo):
        if non_empty(p):
            print(f"error: {p} exists and is not empty; refusing to touch it", file=sys.stderr)
            return 2

    report = {"slug": args.slug, "brain": brain, "repo": repo, "dry_run": args.dry_run, "steps": [], "passed": False}
    tmp = tempfile.mkdtemp(prefix="factory-bootstrap-")
    try:
        os.makedirs(root, exist_ok=True)
        brain_tpl = resolve_template(args.brain_template, tmp, os.path.join("scripts", "new-brain.py"), "brain-template")
        pack = resolve_template(args.pack or DEFAULT_PACKS[args.stack], tmp, os.path.join("scripts", "new-repo.py"), "pack")

        # 1. the brain vault
        run([sys.executable, os.path.join(brain_tpl, "scripts", "new-brain.py"), "--name", args.name, "--slug", args.slug,
             "--pitch", args.pitch, "--target", brain, "--date", args.date], what="new-brain.py")
        report["steps"].append("brain created")

        # 2. the event model journey setup, then the brain's own checker, then a commit in the brain
        setup_event_model(brain, args.name)
        checker = os.path.join(brain, ".claude", "skills", "vault-structure", "scripts", "check-structure.py")
        if os.path.exists(checker):
            run([sys.executable, checker], cwd=brain, what="the brain's structure checker")
        run(["git", "add", "-A"], cwd=brain)
        run(["git", "commit", "-q", "-m", "Add the event model journey setup"], cwd=brain)
        report["steps"].append("event model journey setup checked and committed")

        # 3. the code repo from the pack
        cmd = [sys.executable, os.path.join(pack, "scripts", "new-repo.py"), "--name", args.name, "--slug", args.slug,
               "--pitch", args.pitch, "--target", repo, "--date", args.date]
        if modules:
            cmd += ["--modules", ",".join(modules)]
        run(cmd, what="new-repo.py")
        report["steps"].append("repo created")

        # 4. prove the repo's recipe from a clean clone
        code, evidence = prove(repo, os.path.join(tmp, "evidence.json"))
        report["evidence"] = evidence
        if code != 0:
            raise Fail("the repo's .factory/recipe.yml did not prove: " + (evidence.get("error") or "see evidence"))
        report["steps"].append("recipe proved from a clean clone")
        report["passed"] = True
        report["next"] = ("Local only, nothing pushed. Ask the user, then create the private GitHub repos "
                          f"{args.slug}-docs and {args.slug} with gh and push. "
                          + ("Dry run: the recipe stays committed locally." if args.dry_run
                             else "Run factory-onboard on the repo to confirm the recipe and open its PR."))
    except Fail as e:
        report["error"] = str(e)
    finally:
        shutil.rmtree(tmp, ignore_errors=True)
    print(json.dumps(report, indent=2))
    return 0 if report["passed"] else 1


if __name__ == "__main__":
    sys.exit(main())
