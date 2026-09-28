#!/usr/bin/env python3
"""Publish the 2026-09-27 parallel-work / right-sizing ticket rework.

Usage: publish.py [--apply]   (default is a dry run that prints the plan)
State is recorded in state.json so a partial run can be resumed safely.
"""
import json
import re
import subprocess
import sys
from pathlib import Path

REPO = "AndreasUnunger/EverythingPath"
ROOT = Path(__file__).resolve().parent
GROUPS = ["A", "B", "C"]
APPLY = "--apply" in sys.argv
STATE_PATH = ROOT / "state.json"
state = json.loads(STATE_PATH.read_text()) if STATE_PATH.exists() else {"new": {}}

OWNER = {"T13b": 142, "T15b": 143, "T16b": 143, "T17b": 143,
         "T21b": 145, "T24b": 138, "T32b": 141, "T36b": 146}
AREA_CHAIN = [(142, 140), (143, 142), (144, 143), (145, 144), (138, 145),
              (139, 138), (141, 139), (146, 141), (147, 146)]


def save_state():
    STATE_PATH.write_text(json.dumps(state, indent=2))


def gh(*args, input_text=None):
    out = subprocess.run(["gh", *args], input=input_text, capture_output=True, text=True)
    if out.returncode != 0:
        raise SystemExit(f"gh {' '.join(args)} failed: {out.stderr}")
    return out.stdout.strip()


def act(desc, fn):
    print(("APPLY " if APPLY else "PLAN  ") + desc)
    return fn() if APPLY else None


def issue_id(n):
    return int(gh("api", f"repos/{REPO}/issues/{n}", "--jq", ".id"))


def resolve(ref):
    return int(state["new"][ref]) if ref.startswith("T") else int(ref)


def fill(text):
    text = text.replace("{{AMENDMENT_URL}}", state.get("amendment_url", "{{AMENDMENT_URL}}"))
    for tid, num in state["new"].items():
        text = text.replace("{{" + tid + "}}", str(num))
    return text


def load_group(g):
    d = ROOT / g
    edges = json.loads((d / "edges.json").read_text())
    closes = json.loads((d / "closes.json").read_text()) if (d / "closes.json").exists() else {}
    bodies = {p.stem: p for p in d.glob("[0-9]*.md") if "-close-comment" not in p.stem}
    news = {p.stem[4:]: p for p in d.glob("new-*.md")}
    return edges, closes, bodies, news


edges, closes, bodies, news = {}, {}, {}, {}
for g in GROUPS:
    e, c, b, n = load_group(g)
    edges.update(e); closes.update(c); bodies.update(b); news.update(n)

# 1. Amendment comment on #148.
if "amendment_url" not in state:
    text = (ROOT / "amendment.md").read_text()
    url = act("comment amendment on #148", lambda: gh(
        "issue", "comment", "148", "-R", REPO, "--body-file", "-", input_text=text))
    if url:
        state["amendment_url"] = url; save_state()

# 2. Create new tickets (bodies filled in a second pass once all numbers exist).
for tid, path in sorted(news.items()):
    if tid in state["new"]:
        continue
    title = (path.parent / f"new-{tid}.title").read_text().strip()
    url = act(f"create {tid} '{title}' under #{OWNER[tid]}", lambda: gh(
        "issue", "create", "-R", REPO, "--title", title, "--label", "ready-for-agent",
        "--body", fill(path.read_text())))
    if url:
        num = int(url.rstrip("/").split("/")[-1])
        state["new"][tid] = num; save_state()
        gh("api", "-X", "POST", f"repos/{REPO}/issues/{OWNER[tid]}/sub_issues",
           "-F", f"sub_issue_id={issue_id(num)}")

# 3. Fill bodies of new tickets and edit changed existing tickets.
for tid, path in sorted(news.items()):
    if tid in state["new"]:
        act(f"fill body {tid} (#{state['new'][tid]})", lambda: gh(
            "issue", "edit", str(state["new"][tid]), "-R", REPO, "--body-file", "-",
            input_text=fill(path.read_text())))
for n, path in sorted(bodies.items()):
    args = ["issue", "edit", n, "-R", REPO, "--body-file", "-"]
    tpath = path.parent / f"{n}.title"
    if tpath.exists():
        args += ["--title", tpath.read_text().strip()]
    act(f"edit #{n}" + (" +title" if tpath.exists() else ""),
        lambda: gh(*args, input_text=fill(path.read_text())))

# 4. Close merged tickets.
for n, why in sorted(closes.items()):
    if n in state.get("closed", []):
        continue
    cpath = next(ROOT / g / f"{n}-close-comment.md" for g in GROUPS
                 if (ROOT / g / f"{n}-close-comment.md").exists())
    act(f"close #{n} ({why})", lambda: (
        gh("issue", "comment", n, "-R", REPO, "--body-file", "-", input_text=fill(cpath.read_text())),
        gh("issue", "close", n, "-R", REPO, "--reason", "not planned"),
        state.setdefault("closed", []).append(n), save_state()))

# 5. Rewire native blocked-by edges on tickets, then drop the area-to-area chain.
def current_blockers(n):
    return {int(x) for x in gh("api", f"repos/{REPO}/issues/{n}/dependencies/blocked_by",
                               "--jq", ".[].number").split()}

for ref, wanted_refs in sorted(edges.items()):
    if ref in closes or (ref.startswith("T") and ref not in state["new"] and APPLY):
        continue
    n = resolve(ref) if (APPLY or not ref.startswith("T")) else ref
    wanted = {resolve(w) if (APPLY or not w.startswith("T")) else w for w in wanted_refs}
    have = current_blockers(n) if not str(n).startswith("T") else set()
    for b in sorted(have - wanted, key=str):
        act(f"#{n}: remove blocker #{b}", lambda: gh(
            "api", "-X", "DELETE", f"repos/{REPO}/issues/{n}/dependencies/blocked_by/{issue_id(b)}"))
    for b in sorted(wanted - have, key=str):
        act(f"{n}: add blocker {b}", lambda: gh(
            "api", "-X", "POST", f"repos/{REPO}/issues/{n}/dependencies/blocked_by",
            "-F", f"issue_id={issue_id(b)}"))

for area, prev in AREA_CHAIN:
    if prev in current_blockers(area):
        act(f"area #{area}: remove chain blocker #{prev}", lambda: gh(
            "api", "-X", "DELETE", f"repos/{REPO}/issues/{area}/dependencies/blocked_by/{issue_id(prev)}"))

# 6. Fill new ticket numbers into the amendment, point area specs and #148 at it.
if state.get("amendment_url"):
    comment_id = state["amendment_url"].split("issuecomment-")[-1]
    act("fill amendment comment", lambda: gh(
        "api", "-X", "PATCH", f"repos/{REPO}/issues/comments/{comment_id}",
        "-f", f"body={fill((ROOT / 'amendment.md').read_text())}"))
AREAS = [140, 142, 143, 144, 145, 138, 139, 141, 146, 147]
for area in AREAS:
    if str(area) in state.get("area_commented", []):
        continue
    note = (f"Blocking amendment: this area's tickets are now blocked only by real dependencies, "
            f"and the area-to-area shipping chain in §7 no longer gates work. Scope and acceptance are unchanged. "
            f"See the [parallel-work and right-sizing amendment (2026-09-27)]({state.get('amendment_url', '{{AMENDMENT_URL}}')}).")
    act(f"comment on area #{area}", lambda: gh(
        "issue", "comment", str(area), "-R", REPO, "--body", note))
    if APPLY:
        state.setdefault("area_commented", []).append(str(area)); save_state()
if not state.get("parent_noted"):
    def note_parent():
        body = gh("issue", "view", "148", "-R", REPO, "--json", "body", "--jq", ".body")
        marker = "| 12 | [Campaign list/home](https://github.com/AndreasUnunger/EverythingPath/issues/147) |"
        line = (f"\n\n**Amended 2026-09-27:** work now runs in parallel. Native dependencies encode only real "
                f"dependencies, and several tickets were merged or split; see the "
                f"[parallel-work and right-sizing amendment]({state['amendment_url']}). The order above "
                f"is a suggested priority, not a gate.")
        assert marker in body
        gh("issue", "edit", "148", "-R", REPO, "--body-file", "-", input_text=body.replace(marker, marker + line, 1))
        state["parent_noted"] = True; save_state()
    act("add amendment pointer under #148 implementation order", note_parent)

save_state()
print("done" if APPLY else "dry run complete")
