#!/usr/bin/env python3
"""Publish prototype reference material for the #148 tickets.

Usage: publish_refs.py [--apply]  (dry run by default)
Requires state.json {"shots_sha": "<commit of the screenshot branch>"} for --apply.
"""
import json
import subprocess
import sys
from pathlib import Path

REPO = "AndreasUnunger/EverythingPath"
ROOT = Path(__file__).resolve().parent
APPLY = "--apply" in sys.argv
STATE = json.loads((ROOT / "state.json").read_text()) if (ROOT / "state.json").exists() else {}
SHA = STATE.get("shots_sha", "<shots-sha>")
PREFIX = "ui-rework-148"  # folder in the screenshot branch
RUN_LINK = f"https://github.com/{REPO}/issues/148#how-to-run-a-pinned-prototype"

# area -> overview images (group/file), deviation files, prototype tag names
AREAS = {
    140: (["upkeep/upkeep-upkeep-{v}.png"], ["upkeep/deviations-upkeep.md"], ["upkeep"]),
    142: (["activity/activity-activity-slots-{v}.png"], ["activity/deviations-activity.md"], ["activity-slots"]),
    143: (["event/event-event-{v}.png"], ["event/deviations-event.md"], ["event"]),
    144: (["persistent/persistent-persistent-{v}.png", "persistent/persistent-week-layout-{v}.png"],
          ["persistent/deviations-persistent.md"], ["persistent", "week-layout"]),
    145: (["summary/summary-summary-{v}.png"], ["summary/deviations-145.md"], ["summary"]),
    138: (["setup-correction/setup-setup-correction-{v}.png"], ["setup-correction/deviations-setup.md"], ["setup-correction"]),
    139: (["setup-correction/militia-setup-correction-{v}.png"], ["setup-correction/deviations-militia.md"], ["setup-correction"]),
    141: (["characters/characters-characters-officers-{v}.png"], ["characters/deviations-characters.md"], ["characters-officers"]),
    146: (["history-home/history-home-finished-weeks-{v}.png"],
          ["history-home/deviations-finished-weeks.md", "summary/deviations-146.md"], ["finished-weeks", "summary"]),
    147: (["history-home/history-home-campaign-home-{v}.png"], ["history-home/deviations-campaign-home.md"], ["campaign-home"]),
}
FOCUS_GROUPS = ["upkeep", "activity", "event", "persistent", "summary",
                "setup-correction", "characters", "history-home"]
TICKET_AREA = {}
for area, tickets in {
    140: [156, 157, 158], 142: [159, 161, 162, 190], 143: [163, 164, 165, 166, 191, 192, 193],
    144: [167, 168], 145: [169, 170, 171, 194], 138: [172, 173, 195], 139: [175, 176, 177, 178],
    141: [179, 180, 181, 182, 183, 196], 146: [184, 185, 197], 147: [187, 189],
}.items():
    for t in tickets:
        TICKET_AREA[t] = area
TICKET_MARKER = "Read the owning spec and original discussions before implementation."
SPEC_MARKER_START = "### Reference screenshots and deviations"


def gh(*args, input_text=None):
    out = subprocess.run(["gh", *args], input=input_text, capture_output=True, text=True)
    if out.returncode != 0:
        raise SystemExit(f"gh {' '.join(args)} failed: {out.stderr}")
    return out.stdout


def img(rel):
    return f"https://github.com/{REPO}/blob/{SHA}/{PREFIX}/{rel}?raw=true"


def exists(rel):
    return (ROOT / rel).exists()


def overview_files(area):
    pats, _, _ = AREAS[area]
    out = []
    for p in pats:
        for v in ("tablet", "phone", "desktop"):
            rel = p.format(v=v)
            if exists(rel):
                out.append((v, rel))
    return out


RESP = json.loads((ROOT / "responsive/focus.json").read_text()) if exists("responsive/focus.json") else {}


def spec_section(area):
    _, devs, tags = AREAS[area]
    lines = [f"{SPEC_MARKER_START} (added 2026-09-27)", ""]
    tag_list = ", ".join(f"`prototype-approved/{t}`" for t in tags)
    lines.append(
        f"Pinned commits are protected by the tags {tag_list}. The area prototypes are tablet references; "
        f"phone and desktop layouts come from the responsive prototypes shown below. "
        f"To run a prototype, see [How to run a pinned prototype]({RUN_LINK}). "
        f"Each implementation ticket's **Focus** line names the prototype state for that slice. "
        f"Screenshots were taken at the pinned commits on 2026-09-27; all pinned prototypes booted and rendered.")
    lines.append("")
    shots = overview_files(area)
    if shots:
        lines.append("Area prototype (the tablet view is the reference):")
        lines.append("")
        lines.append(" ".join(f"[{v} · {Path(rel).stem}]({img(rel)})" for v, rel in shots))
        tablet = [rel for v, rel in shots if v == "tablet"]
        for rel in tablet:
            lines += ["", f"![{Path(rel).stem}]({img(rel)})"]
    resp = RESP.get(str(area))
    if resp:
        lines += ["", f"Phone and desktop: `{resp['prototype']}` — {resp['focus']}", ""]
        lines.append(" ".join(f"[{Path(s).stem}]({img('responsive/' + Path(s).name)})" for s in resp.get("screenshots", [])))
    lines += ["", "**Don't copy from the prototype** (collected from this spec and its amendments):", ""]
    for d in devs:
        text = (ROOT / d).read_text().strip().splitlines()
        body = [l for l in text if not l.startswith("# ")]
        lines += [l for l in body]
        lines.append("")
    return "\n".join(lines).rstrip() + "\n"


def ticket_focus(ticket):
    entries = []
    for g in FOCUS_GROUPS:
        f = ROOT / g / "focus.json"
        if f.exists():
            data = json.loads(f.read_text())
            if str(ticket) in data:
                entries.append((g, data[str(ticket)]))
    return entries


def ticket_block(ticket):
    area = TICKET_AREA[ticket]
    parts = []
    for g, e in ticket_focus(ticket):
        parts.append(f"**Focus for this ticket ({e['prototype']}):** {e['focus']}")
        shots = [e["screenshot"]] if e.get("screenshot") else []
        shots += sorted(p.name for p in (ROOT / g).glob(f"{ticket}-focus-*.png"))
        for shot in shots:
            parts.append(f"![#{ticket} {Path(shot).stem}]({img(g + '/' + shot)})")
    if not parts:
        raise SystemExit(f"no focus for #{ticket}")
    spec = f"https://github.com/{REPO}/issues/{area}#3-prototypes"
    parts.append(
        f"Area screenshots (tablet, phone and desktop) and the **don't copy from the prototype** list are in "
        f"[owning spec #{area} §3]({spec}). To run a prototype, see [How to run a pinned prototype]({RUN_LINK}). "
        f"Pinned commits are protected by `prototype-approved/*` tags.")
    return "\n\n".join(parts) + "\n\n"


def update_spec(area):
    body = gh("issue", "view", str(area), "-R", REPO, "--json", "body", "--jq", ".body").rstrip("\n")
    if SPEC_MARKER_START in body:
        return None
    idx = body.index("\n## 4.")
    new = body[:idx].rstrip() + "\n\n" + spec_section(area) + body[idx:]
    if len(new) > 65000:
        raise SystemExit(f"#{area} body too long: {len(new)}")
    return new


def update_ticket(ticket):
    body = gh("issue", "view", str(ticket), "-R", REPO, "--json", "body", "--jq", ".body").rstrip("\n")
    if "**Focus for this ticket" in body:
        return None
    idx = body.index(TICKET_MARKER)
    return body[:idx] + ticket_block(ticket) + body[idx:]


def update_parent():
    body = gh("issue", "view", "148", "-R", REPO, "--json", "body", "--jq", ".body").rstrip("\n")
    if "## How to run a pinned prototype" in body:
        return None
    section = (ROOT / "run-instructions.md").read_text().strip()
    resp_dev = ROOT / "responsive/deviations-responsive.md"
    if resp_dev.exists():
        lines = [l for l in resp_dev.read_text().strip().splitlines() if not l.startswith("# ")]
        section += "\n\n**Don't copy from the responsive shell/pages prototypes:**\n\n" + "\n".join(lines).strip()
    idx = body.index("\n## Implementation progress")
    return body[:idx].rstrip() + "\n\n" + section + "\n" + body[idx:]


def put(num, body):
    print(("APPLY " if APPLY else "PLAN  ") + f"edit #{num} (+{len(body)} chars total)")
    if APPLY:
        gh("issue", "edit", str(num), "-R", REPO, "--body-file", "-", input_text=body)
    else:
        (ROOT / "preview").mkdir(exist_ok=True)
        (ROOT / "preview" / f"{num}.md").write_text(body)


if APPLY and "shots_sha" not in STATE:
    raise SystemExit("state.json needs shots_sha")
b = update_parent()
if b:
    put(148, b)
for area in AREAS:
    b = update_spec(area)
    if b:
        put(area, b)
for t in sorted(TICKET_AREA):
    b = update_ticket(t)
    if b:
        put(t, b)
print("done" if APPLY else "dry run complete; previews in preview/")
