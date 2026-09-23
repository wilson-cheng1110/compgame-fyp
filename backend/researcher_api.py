"""The researcher (PI) surface, as a standalone APIRouter.

WHY IT IS SEPARATE FROM admin_api, AND WHY THAT SEPARATION IS THE WHOLE POINT.

The teacher (admin) surface is deliberately BLIND to the manipulation: it cannot read
answers, scores, arms, or the pseudonymised export (see admin_api.py's docstring). That
blindness is a research-integrity control, not a permissions convenience -- a lecturer
who learns which students are in FLIP vs CONTROL can teach to compensate, and
differential instruction by condition is a confound that lands on H1 and cannot be
removed after the fact.

So the things the teacher must NOT see -- arm balance, compliance, the export -- live
here, behind a SECOND allowlist file the teacher does not have to be on:

  1. a valid `session` cookie                 -> 401 without one
  2. that session's SID is in RESEARCHER_PATH  -> 403 otherwise

is_researcher is INDEPENDENT of is_admin (not a superset): the PI who also teaches is
on both lists; a teacher who is only a teacher is on neither this list nor this page,
and the page is invisible to them by construction. Nothing here checks is_admin.

WHAT THIS SURFACE DOES:
  * /monitor  read-only. Arm balance and compliance per topic, the coverage headline,
    N per section (including the MSc cross-population section), and questionnaire
    completion. Derived from the sink by measures.py -- no client-reported numbers,
    no Ollama.
  * /export   the pseudonymised dataset, gated on THIS session (is_researcher) rather
    than the X-Export-Token header. Real SIDs never leave -- it shares research_api's
    one pseudonymisation boundary (pseudonymised_rows) with the token path, so the two
    cannot drift. Audited: a dataset leaving the box is a recorded event.
  * /participant + /forget  the erasure the consent form promises. A participant may
    ask for their responses to be discarded; this is the operator action that does it,
    with a preview of the blast radius first and an audit entry after. It does NOT touch
    the account tombstone (that is what stops a withdrawn SID reappearing) -- same
    contract as research_store.forget_participant.

BLIND GRADING STAYS OFFLINE. There is deliberately no grading route here: grade_batch.py
is the blind offline pass (docs/revamp.md Part 8.2), and pulling grading onto a
logged-in web surface would undo the blinding. The monitor reports its STATUS only.
"""

import asyncio
import io
import json
import os
from collections import defaultdict
from typing import Optional

from fastapi import APIRouter, Cookie, Response
from fastapi.responses import JSONResponse, PlainTextResponse
from pydantic import BaseModel

import auth_store
import measures
import research_api
import research_store
import schedule

router = APIRouter(prefix="/api/researcher", tags=["researcher"])


class ForgetRequest(BaseModel):
    sid: str


def _researcher(session: Optional[str], response: Response):
    """(sid, None) for a researcher; (None, body) with the status already set otherwise.

    A byte-for-byte parallel of admin_api._admin, on the OTHER allowlist. The failure
    mode of getting a two-part gate wrong once is the whole surface, so it is written
    exactly once and every route below calls it.
    """
    user = auth_store.resolve_session(session or "")
    if user is None:
        response.status_code = 401
        return None, {"error": "no_session"}
    if not auth_store.is_researcher(user["sid"]):
        # 403, and -- like the teacher gate -- no hint about what would make it a 200.
        # A teacher who is not on the researcher list learns only that it is not theirs.
        response.status_code = 403
        return None, {"error": "not_researcher",
                      "message": "This page is for the study's researcher."}
    return user["sid"], None


@router.get("/whoami")
async def whoami(response: Response, session: Optional[str] = Cookie(default=None)):
    """The page asks this before drawing anything -- a teacher or student who guesses
    the URL gets a plain refusal, not a flash of the monitoring dashboard."""
    sid, err = _researcher(session, response)
    if err:
        return err
    return {"ok": True, "sid": sid}


# ── monitoring (read-only) ────────────────────────────────────────────────────

def _build_monitor() -> dict:
    """Everything the monitor shows, derived from the sink. Synchronous and mildly
    heavy (it scans the events table a couple of times via measures), so the handler
    dispatches it off the event loop."""
    known_sections = list(schedule.sections().keys())      # includes MSC

    # N per section, seeded from the schedule so a section with zero sign-ups (a fresh
    # MSc cohort, say) still appears rather than silently missing.
    by_section: dict[str, dict] = {
        s: {"total": 0, "claimed": 0, "withdrawn": 0, "disabled": 0} for s in known_sections
    }
    parts = auth_store.list_participants()
    totals = {"total": 0, "claimed": 0, "withdrawn": 0, "disabled": 0}
    for p in parts:
        sec = (p.get("section") or "—")
        bucket = by_section.setdefault(sec, {"total": 0, "claimed": 0, "withdrawn": 0, "disabled": 0})
        bucket["total"] += 1
        totals["total"] += 1
        if p.get("has_password"):
            bucket["claimed"] += 1; totals["claimed"] += 1
        if p.get("withdrawn"):
            bucket["withdrawn"] += 1; totals["withdrawn"] += 1
        if p.get("disabled"):
            bucket["disabled"] += 1; totals["disabled"] += 1

    # Per-topic arm balance + compliance, from the derived manipulation check. ONE scan
    # of the sink, filtered ONCE, and BOTH the coverage headline and the arm table read
    # off that SAME filtered set -- otherwise the two panels on the same page disagree
    # (code review). Two filters:
    #   * enrolled_only -- drop non-roster / e2e traffic when a roster is active (the sink
    #     does not separate test traffic from participants); the dropped count is reported.
    #   * topic in `order` -- keep only real, current schedule topics; an off-schedule or
    #     legacy topic_id has no arm and would otherwise read as a phantom study topic.
    order = {t["id"]: i for i, t in enumerate(schedule._load().get("topics", []))}
    pairs = measures.per_topic()
    pairs, dropped = measures.enrolled_only(pairs)
    pairs = [r for r in pairs if r["topic_id"] in order]

    # Coverage computed INLINE from the same `pairs` -- deliberately NOT measures.coverage(),
    # which re-scans the sink unfiltered and would report a different denominator than the
    # arm table below. Same reductions measures.coverage() uses, over the filtered set.
    determinable = [r for r in pairs if r["played_first"] is not None]
    coverage = {
        "pairs": len(pairs),
        "determinable": len(determinable),
        "complied": sum(1 for r in determinable if r["complied"]),
        "no_activity": sum(1 for r in pairs if r["played_first_basis"] == "activity never recorded"),
        "no_posttest": sum(1 for r in pairs if r["played_first_basis"] == "post-check not sat"),
        "took_escape": sum(1 for r in pairs if r["skipped_activity"]),
    }

    agg: dict[str, dict] = defaultdict(
        lambda: {"flip": 0, "control": 0, "determinable": 0, "complied": 0,
                 "no_activity": 0, "no_posttest": 0})
    for r in pairs:
        a = agg[r["topic_id"]]
        if r["arm"] == schedule.FLIP:
            a["flip"] += 1
        elif r["arm"] == schedule.CONTROL:
            a["control"] += 1
        if r["played_first"] is not None:
            a["determinable"] += 1
            if r["complied"]:
                a["complied"] += 1
        if r["played_first_basis"] == "activity never recorded":
            a["no_activity"] += 1
        elif r["played_first_basis"] == "post-check not sat":
            a["no_posttest"] += 1
    arms = [{"topic_id": tid, "order": order[tid] + 1, **agg[tid]}
            for tid in sorted(agg, key=lambda t: order[t])]

    return {
        "sink": research_store.summary(),
        "accounts": {**totals, "by_section": by_section},
        "coverage": coverage,
        "arms": arms,
        # DISTINCT participants per questionnaire instrument -- "how many finished each".
        "questionnaires": research_store.event_counts_by_type("questionnaire"),
        # Capture health: one row per event_type (count, distinct participants, first/last
        # seen). Aggregate-only -- COUNT(DISTINCT ...), never a participant_id. The
        # stale-event-type / capture-gap detector.
        "sink_census": measures.sink_census(),
        # Data-hygiene reconcile of sink streams vs auth accounts -- COUNTS ONLY, no SID.
        # split_by_check_letter flags people recorded under both the letter and numeric SID.
        "sink_reconcile": measures.sink_reconcile(),
        "roster_active": auth_store.roster_active(),
        "test_traffic_excluded": dropped,   # None when no roster is gating
    }


@router.get("/monitor")
async def monitor(response: Response, session: Optional[str] = Cookie(default=None)):
    sid, err = _researcher(session, response)
    if err:
        return err
    return await asyncio.to_thread(_build_monitor)


# ── the research-papers dashboard (aggregate-only, one place per paper) ────────
#
# The shared demographics distribution + one live slice per paper, for /researcher's
# per-paper pages. Everything here is a composition of measures.py functions (which return
# COUNTS, never a SID) plus, for paper 08 ONLY, an OFFLINE read of the grades report --
# grading never touches the sink here, so the deliberate blind-offline boundary is intact.
# Same _researcher() gate as every other route: the teacher stays blind to all of it.

GRADES_DIR = os.environ.get(
    "GRADES_DIR",
    os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "reports", "grades"))


def _grades_report() -> Optional[dict]:
    """Grader reliability for paper 08, read from the OFFLINE grades dir -- NOT the sink.
    Returns the persisted Cohen's kappa (grade_batch.py --kappa now writes kappa.json) plus
    the newest non-dry-run batch's level distribution, or None if no real pass has run."""
    try:
        files = [f for f in os.listdir(GRADES_DIR) if f.endswith(".json")]
    except OSError:
        return None
    kappa = None
    kpath = os.path.join(GRADES_DIR, "kappa.json")
    if os.path.exists(kpath):
        try:
            with open(kpath, encoding="utf-8") as fh:
                kappa = json.load(fh)
        except (OSError, ValueError):
            kappa = None
    latest = None
    for f in sorted(files, reverse=True):
        if f == "kappa.json":
            continue
        try:
            with open(os.path.join(GRADES_DIR, f), encoding="utf-8") as fh:
                blob = json.load(fh)
        except (OSError, ValueError):
            continue
        if blob.get("dry_run"):
            continue
        latest = {"generated": blob.get("generated"), "model": blob.get("model"),
                  "summary": blob.get("summary")}
        break
    if latest is None and kappa is None:
        return None
    return {"kappa": kappa, "batch": latest}


def _paper_slice(pid: str) -> dict:
    """One paper's LIVE slice as a normalized envelope the frontend renders generically:
    {id, basis, status, stats:[{label,value,sub}], note, table?}. Aggregate-only. status is
    'live' (a real measure), 'proxy' (a live stand-in for a construct whose PRIMARY analysis
    is an offline pass), 'flag_off' (telemetry was off -> zero rows), or 'pending'."""
    def env(basis, status, stats, note=None, table=None):
        return {"id": pid, "basis": basis, "status": status,
                "stats": stats, "note": note, "table": table}

    order = {t["id"]: i for i, t in enumerate(schedule._load().get("topics", []))}

    def _study_pairs():
        pairs, _ = measures.enrolled_only(measures.per_topic())
        return [r for r in pairs if r["topic_id"] in order]

    if pid == "01-flip-effectiveness":
        by = {schedule.FLIP: [], schedule.CONTROL: []}
        for r in _study_pairs():
            pre, post, arm = r["pre_score"], r["post_score"], r["arm"]
            if pre is None or post is None or arm not in by:
                continue
            g = ((post - pre) / (100 - pre)) if pre < 100 else None
            by[arm].append((pre, post, g))

        def _agg(xs):
            n = len(xs)
            gains = [g for _, _, g in xs if g is not None]
            return {"n": n,
                    "pre": round(sum(p for p, _, _ in xs) / n, 1) if n else None,
                    "post": round(sum(q for _, q, _ in xs) / n, 1) if n else None,
                    "gain": round(sum(gains) / len(gains), 3) if gains else None}

        f, c = _agg(by[schedule.FLIP]), _agg(by[schedule.CONTROL])
        stats = [
            {"label": "FLIP pairs (pre+post)", "value": f["n"],
             "sub": f"⟨g⟩ {f['gain'] if f['gain'] is not None else '—'}"},
            {"label": "CONTROL pairs (pre+post)", "value": c["n"],
             "sub": f"⟨g⟩ {c['gain'] if c['gain'] is not None else '—'}"},
        ]

        # The by-(topic, arm) DETAIL table — the computed table that used to be discarded.
        # Reads measures.gain_detail(): per topic per assigned arm, the pair count, pre/
        # post means, mean ⟨g⟩ (over gain_n, since a pre==100 pair yields no normalised
        # gain), the CEILING shares (post≥90 / ==100 — the ceiling the delayed retention
        # DV exists to escape), and DIFFERENTIAL ATTRITION (no-activity / no-post-check by
        # assigned arm). Every count sits beside its denominator (assigned / n). The
        # frontend renders this generic {columns, rows} table already (04/05 do).
        gd = measures.gain_detail()
        table = {
            "columns": ["Topic", "Arm", "n (pre+post)", "mean pre", "mean post", "⟨g⟩",
                        "post≥90", "post=100", "assigned", "no activity", "no post-check"],
            "rows": [[r["topic_id"], r["arm"], r["n_pairs"], r["pre_mean"], r["post_mean"],
                      r["gain"], r["ceiling_ge90"], r["ceiling_eq100"], r["assigned"],
                      r["no_activity"], r["no_posttest"]]
                     for r in gd],
        }

        # The DELAYED retention block (docs/end-of-study-battery-plan.md): the
        # immediate post-test DV is ceiling'd (≈91/100), compressing the FLIP-CONTROL
        # gap; a Form-C re-test weeks later, where productive-failure theory predicts
        # the flip effect should show up as SLOWER decay in FLIP, is not. Window-gated
        # to ~2026-11-23..26, so this reads "pending" (not "live") until then.
        ret = measures.retention_summary()
        if ret["n"]:
            stats += [
                {"label": "Retention — FLIP", "value": ret["flip"]["mean_score"] or "—",
                 "sub": f"n={ret['flip']['n']}"},
                {"label": "Retention — CONTROL", "value": ret["control"]["mean_score"] or "—",
                 "sub": f"n={ret['control']['n']}"},
                {"label": "Mean weeks since post-check", "value": ret["mean_weeks_since_post"] or "—",
                 "sub": f"{ret['with_interval']} with a known interval"},
            ]
        return env("Normalised gain ⟨g⟩ from the MC pre/post concept inventory, by assigned "
                   "arm — the primary H1 DV — plus the DELAYED Form-C retention score once the "
                   "end-of-study battery has run. The short-answer probe is the secondary "
                   "offline pass. The table breaks it out per topic per arm, with ceiling "
                   "shares and differential attrition.",
                   "live", stats,
                   ("Interim read; retention re-test is the delayed DV — see the retention rows "
                    "above for where the flip effect is predicted to show up (productive-"
                    "failure theory: FLIP should decay slower)." if ret["n"] else
                    "Interim read over determinable pairs; the full pre-registered N needs the "
                    "remaining topics to release. Retention re-test (delayed DV) is pending — "
                    "the end-of-study battery runs ~2026-11-23..26."),
                   table=table)

    if pid == "02-motivation-experience":
        q = measures.questionnaire_by_arm()
        paas = q["paas"]

        def _eff(side):
            return side["mean_effort"] if side["mean_effort"] is not None else "—"

        stats = [
            {"label": "IMI completed", "value": q["imi"]["n"], "sub": f"raw mean {q['imi']['mean_raw'] or '—'}"},
            {"label": "CoI completed", "value": q["coi"]["n"], "sub": f"raw mean {q['coi']['mean_raw'] or '—'}"},
            {"label": "ARCS completed", "value": q["arcs"]["n"], "sub": f"raw mean {q['arcs']['mean_raw'] or '—'}"},
            {"label": "PAAS effort — FLIP", "value": _eff(paas["flip"]), "sub": f"{paas['flip']['responses']} responses"},
            {"label": "PAAS effort — CONTROL", "value": _eff(paas["control"]), "sub": f"{paas['control']['responses']} responses"},
        ]

        # The RETROSPECTIVE affect recall block (end-of-study battery): AR1
        # enjoyment / AR2 perceived learning / AR3 mental effort, per topic, split by
        # the arm assigned for that topic -- the retrospective twin of PAAS above.
        ar = measures.affect_recall_summary()
        ar_table = None
        if ar["flip"]["participants"] or ar["control"]["participants"]:
            def _ar(arm_block, item):
                v = arm_block["items"][item]["mean"]
                return v if v is not None else "—"
            stats += [
                {"label": "Affect recall — enjoyment (AR1) FLIP/CONTROL",
                 "value": f"{_ar(ar['flip'], 'AR1')} / {_ar(ar['control'], 'AR1')}"},
                {"label": "Affect recall — perceived learning (AR2) FLIP/CONTROL",
                 "value": f"{_ar(ar['flip'], 'AR2')} / {_ar(ar['control'], 'AR2')}"},
                {"label": "Affect recall — effort (AR3) FLIP/CONTROL",
                 "value": f"{_ar(ar['flip'], 'AR3')} / {_ar(ar['control'], 'AR3')}"},
            ]
            # The per-topic AR1/AR2/AR3 breakdown affect_recall_summary already computes
            # (`by_topic`) but this slice previously read only the cohort ['flip']/['control']
            # blocks from and discarded. Each mean carries its own n (its denominator). The
            # by-ARM split is the stat cards above; this is the per-TOPIC view. (A per-topic-
            # per-arm cell would be a NEW measure — out of scope for a pass-through, and since
            # arm is randomised per topic only the two views the measure already emits are
            # meaningful.) Rendered by the generic {columns, rows} table renderer (04/05 too).
            def _cell(item_block):
                return item_block["mean"] if item_block["mean"] is not None else "—"
            ar_table = {
                "columns": ["Topic", "AR1 mean", "AR1 n", "AR2 mean", "AR2 n",
                            "AR3 mean", "AR3 n"],
                "rows": [[t["topic_id"],
                          _cell(t["items"]["AR1"]), t["items"]["AR1"]["n"],
                          _cell(t["items"]["AR2"]), t["items"]["AR2"]["n"],
                          _cell(t["items"]["AR3"]), t["items"]["AR3"]["n"]]
                         for t in ar["by_topic"]],
            }

        # The REAL H2/H3 instrument (measures.questionnaire_subscales): reverse-applied subscale
        # means — IMI (4 subscales), CoI (2), ARCS (2) — the scored form the analysis needs, vs
        # the single raw item mean the stat cards above show. Cohort-level (these instruments have
        # no per-arm split — a real design limit, kept in the note). One row per (instrument,
        # subscale) with its mean + n. The FE renders ONE table, so this scored table is preferred
        # when there are questionnaire responses; the per-topic affect-recall table is the
        # fallback (it only has data after the end-of-study battery runs).
        subs = measures.questionnaire_subscales()
        has_subs = any(subs[name]["n_respondents"] for name in ("imi", "coi", "arcs"))
        sub_table = None
        if has_subs:
            sub_table = {
                "columns": ["Instrument", "Subscale", "mean (reverse-applied)", "n"],
                "rows": [[name.upper(), s["subscale"],
                          s["mean"] if s["mean"] is not None else "—", s["n"]]
                         for name in ("imi", "coi", "arcs")
                         for s in subs[name]["subscales"]],
            }
            # Headline: the two IMI subscales most central to H2 (intrinsic interest / value).
            _imi = {s["subscale"]: s for s in subs["imi"]["subscales"]}
            for _sub, _lab in (("IE", "IMI interest/enjoyment"), ("VU", "IMI value/usefulness")):
                if _sub in _imi and _imi[_sub]["mean"] is not None:
                    stats.append({"label": _lab, "value": _imi[_sub]["mean"],
                                  "sub": f"n={_imi[_sub]['n']} (reverse-applied)"})

        table = sub_table or ar_table
        return env("IMI/CoI/ARCS completion + raw item means (cohort-level), PAAS mental "
                   "effort split by the arm assigned per topic, the reverse-applied subscale "
                   "means (IMI/CoI/ARCS — the scored H2/H3 instrument, in the table) and — once "
                   "the end-of-study battery has run — the retrospective affect-recall block "
                   "(AR1-3) by arm.",
                   "live", stats,
                   "Cohort instruments span all topics (no per-arm split). The table is the "
                   "reverse-applied subscale means (each with its n); when no questionnaire "
                   "responses exist it falls back to the per-topic affect-recall means. Affect "
                   "recall is retrospective (end of study) — PAAS above is its prospective twin.",
                   table)

    if pid in ("03-reflection-help-seeking", "07-ai-tutor-design"):
        rs = measures.reflection_summary()
        stats = [
            {"label": "Reflections completed", "value": rs["reflections"]},
            {"label": "Dialogs skipped", "value": rs["skipped"]},
            {"label": "Participants reflected", "value": rs["participants_reflected"]},
            {"label": "Mean human turns", "value": rs["mean_human_turns"] if rs["mean_human_turns"] is not None else "—"},
            {"label": "Asked for the answer", "value": f"{round(100 * rs['direct_answer_rate'])}%" if rs["direct_answer_rate"] is not None else "—"},
        ]
        if pid.startswith("03"):
            return env("Reflection ENGAGEMENT from the tutor transcripts (turns, skip rate, "
                       "direct-answer use) — the live proxy. Coded DEPTH is the offline "
                       "code_batch.py human double-coding pass.", "proxy", stats,
                       "Metacognitive depth (none/shallow/generative) needs two human coders + "
                       "Cohen's κ ≥ 0.6 (code_batch.py) — pending, not shown as a number.")
        return env("AI-tutor interaction from the mandatory post-test reflection: turns, skip "
                   "rate, and how often students asked for the answer outright. Read alongside "
                   "the CoI instrument (paper 02) and H1 gain.", "live", stats,
                   "Free-chat /api/ask + /api/socratic usage and per-turn latency are NOT "
                   "persisted — an optional later add.")

    if pid == "04-test-taking-behaviour":
        s = measures.effort_summary()
        stats = [
            {"label": "Check submissions", "value": s["submissions"]},
            {"label": "Straight-lined", "value": s["straight_lined"]},
            {"label": "Median s/item", "value": s["median_sec_per_item"] if s["median_sec_per_item"] is not None else "—"},
            {"label": "Fastest s/item", "value": s["fastest_sec_per_item"] if s["fastest_sec_per_item"] is not None else "—"},
        ]
        table = {"columns": ["Verdict", "n"], "rows": [[k, v] for k, v in sorted(s["verdicts"].items())]}
        return env("Time against accuracy on every pre/post check: the straight-lining / "
                   "rapid-guess classifier (measures.effort) — the fit map's 'hidden asset'.",
                   "live", stats, None, table)

    if pid == "05-cross-population-transfer":
        secmap = {p["sid"]: (p.get("section") or "—") for p in auth_store.list_participants()}
        agg = defaultdict(lambda: {"pairs": 0, "determinable": 0, "complied": 0})
        for r in _study_pairs():
            b = agg[secmap.get(r["participant_id"], "—")]
            b["pairs"] += 1
            if r["played_first"] is not None:
                b["determinable"] += 1
                if r["complied"]:
                    b["complied"] += 1
        # KEEP the section coverage/compliance as stat cards — the FE renders ONE table, now the
        # population×arm gain DV — so every section's pairs + determinable stays visible here.
        stats = [{"label": f"{sec}", "value": v["pairs"], "sub": f"{v['determinable']} determinable"}
                 for sec, v in sorted(agg.items())]

        # The INTERACTION DV proper (measures.gain_by_population_arm): normalised gain ⟨g⟩ per
        # (population, arm), UG (A/B/C pooled) vs MSc (MSC). The FLIP−CONTROL gain GAP for each
        # population and the difference of the two gaps (the interaction — the cross-population
        # effect itself) are the headline; the per-cell breakdown, each with its own n / gain_n /
        # SD, is the table. Aggregate-only; rendered by the generic {columns, rows} renderer.
        gpa = measures.gain_by_population_arm()

        def _fmt(x):
            return x if x is not None else "—"

        stats.append({
            "label": "FLIP−CONTROL gain gap — UG vs MSc",
            "value": f"{_fmt(gpa['ug_gain_gap'])} / {_fmt(gpa['msc_gain_gap'])}",
            "sub": (f"interaction {gpa['interaction']}" if gpa["interaction"] is not None
                    else "interaction —"),
        })
        table = {
            "columns": ["Population", "Arm", "n (pre+post)", "mean pre", "mean post", "⟨g⟩", "SD"],
            "rows": [[c["population"], c["arm"], c["n"], c["pre_mean"], c["post_mean"],
                      c["gain"], c["gain_sd"]] for c in gpa["cells"]],
        }
        return env("The cross-population INTERACTION DV: normalised gain ⟨g⟩ per (population, "
                   "arm) — does the flip effect (the FLIP−CONTROL gain gap) differ between UG "
                   "(sections A/B/C pooled) and the MSc cohort? Section coverage/compliance is "
                   "kept in the stat cards. MSc inclusion in the analysis is HSESC-gated.",
                   "live", stats, gpa["note"], table)

    if pid == "06-classroom-rct-methods":
        mon = _build_monitor()
        cov, acc = mon["coverage"], mon["accounts"]

        def _rate(n, d):
            return round(100 * n / d, 1) if d else None

        _comp_rate = _rate(cov["complied"], cov["determinable"])
        # Per-section enrolment line, from the by_section census _build_monitor already
        # computes — this slice previously read only its totals.
        by_sec = acc.get("by_section") or {}
        enrol_line = " · ".join(f"{s} {v['total']}" for s, v in sorted(by_sec.items())) or "—"

        stats = [
            {"label": "Accounts", "value": acc["total"], "sub": f"{acc['claimed']} signed up"},
            {"label": "Events in sink", "value": mon["sink"]["total_events"]},
            {"label": "Determinable pairs", "value": cov["determinable"], "sub": f"of {cov['pairs']}"},
            {"label": "Complied", "value": cov["complied"],
             "sub": (f"{_comp_rate}% of determinable" if _comp_rate is not None else None)},
            {"label": "No activity (silent-fail signal)", "value": cov["no_activity"]},
            # CONSORT participant-flow counts _build_monitor already computes but this slice
            # previously dropped: no post-check, the logged escape hatch, disabled accounts.
            {"label": "No post-check", "value": cov["no_posttest"]},
            {"label": "Took escape hatch", "value": cov["took_escape"]},
            {"label": "Withdrawn", "value": acc["withdrawn"]},
            {"label": "Disabled", "value": acc["disabled"]},
            {"label": "Enrolment by section", "value": enrol_line},
        ]

        # The per-topic arm-balance table _build_monitor already computes (mon["arms"]) but
        # this slice previously read only its coverage totals from. Compliance shown as a
        # RATE (complied/determinable) beside the count. Aggregate-only: counts per topic,
        # never a participant row. Rendered by the generic {columns, rows} renderer.
        table = {
            "columns": ["Topic", "FLIP", "CONTROL", "determinable", "complied", "compliance %"],
            "rows": [[a["topic_id"], a["flip"], a["control"], a["determinable"], a["complied"],
                      _rate(a["complied"], a["determinable"])]
                     for a in mon["arms"]],
        }
        return env("The running-a-real-RCT machinery itself: server-side per-topic "
                   "randomisation, the manipulation check, coverage incl. the no_activity "
                   "silent-failure signal, the CONSORT participant-flow counts, "
                   "consent/withdrawal, and the per-topic arm balance — the monitor's own figures.",
                   "live", stats,
                   "This paper's 'data' is the method working — it reads the monitor. "
                   "Compliance is complied/determinable per topic.", table)

    if pid == "08-small-local-model":
        rep = _grades_report()
        if not rep:
            return env("Grader reliability (Cohen's κ, level distribution, model, N) for the "
                       "small local model, read from the OFFLINE grades report — not the sink.",
                       "pending", [{"label": "Grader κ", "value": "—", "sub": "no grade pass yet"}],
                       "Run grade_batch.py (a real pass) + --kappa against ~60 hand-coded "
                       "answers; the panel then reads reports/grades/kappa.json.")
        k = rep.get("kappa") or {}
        batch = rep.get("batch") or {}
        summary = batch.get("summary") or {}
        stats = [
            {"label": "Cohen's κ", "value": k.get("kappa") if k.get("kappa") is not None else "—",
             "sub": ("usable ≥0.6" if k.get("usable") else "below 0.6 — descriptive only") if k else None},
            {"label": "κ n", "value": k.get("n") if k else "—",
             "sub": f"of {k.get('hand_coded')} hand-coded" if k.get("hand_coded") else None},
            {"label": "Model", "value": batch.get("model") or k.get("model") or "—"},
            {"label": "Raw agreement", "value": k.get("agreement") if k.get("agreement") is not None else "—"},
            {"label": "Grade pass generated", "value": batch.get("generated") or "—"},
        ]
        # The by-topic grader level distribution grade_batch.py persists (batch.summary) but
        # this slice previously read only batch.model from and discarded. graded_n EXCLUDES
        # ungradeable — a null is a missing datum, not a wrong answer (grade_batch.summarise);
        # full% is over graded_n. Aggregate-only. The grading RUN stays offline; this only
        # surfaces the persisted result. Rendered by the generic {columns, rows} renderer.
        table = None
        if summary:
            table = {
                "columns": ["Topic", "graded n", "full", "partial", "none",
                            "ungradeable", "full %"],
                "rows": [[t, s.get("graded_n"), s.get("full"), s.get("partial"),
                          s.get("none"), s.get("ungradeable"), s.get("full_pct")]
                         for t, s in sorted(summary.items())],
            }
        return env("Grader reliability against a human coder (Cohen's κ) plus the by-topic "
                   "grader level distribution, read from the offline grades report — the sink "
                   "is never routed through a grader, preserving the blind boundary.",
                   "live", stats,
                   None if (k and k.get("usable")) else "κ below 0.6 (or unrun): report the "
                   "short-answer grades as descriptive colour, not a measure.", table)

    if pid == "09-game-psychophysics":
        g = measures.game_result_summary()
        status = "live" if g["total_trials"] > 0 else "flag_off"
        stats = [{"label": "Game-result trials", "value": g["total_trials"]},
                 {"label": "Topics with trials", "value": len(g["topics"])}]

        # The reframed DV proper (measures.game_psychophysics_summary): each paradigm's own
        # metric split by the ASSIGNED arm. Coverage (the stat cards) says HOW MANY trials; this
        # says WHAT THEY SHOW — one row per (paradigm, arm) with N and the paradigm's headline
        # statistic. The FE renders ONE table, so this by-arm DV table replaces the per-topic
        # coverage table (topics-with-trials remains a stat card). Empty when telemetry was off,
        # so it is only built when there ARE trials — flag_off then reads with no table.
        table = None
        if g["total_trials"] > 0:
            gp = measures.game_psychophysics_summary()

            def _fmt(x):
                return x if x is not None else "—"

            def _stat_for(paradigm, side):
                if paradigm == "stroop":
                    return (f"cons {_fmt(side['consistent_ms'])} / incons "
                            f"{_fmt(side['inconsistent_ms'])} ms; Δ {_fmt(side['congruency_delta_ms'])}")
                if paradigm == "hick":
                    return ("; ".join(f"n={b['n_choices']}:{_fmt(b['mean_rt_ms'])}ms"
                                      for b in side["by_n_choices"]) or "—")
                if paradigm == "fitts":
                    return ("; ".join(f"{b['condition']}:{_fmt(b['mean_mt_ms'])}ms"
                                      for b in side["by_condition"]) or "—")
                return f"JND {_fmt(side['mean_jnd_pct'])}%"

            rows = []
            for paradigm, arm in (("stroop", schedule.FLIP), ("stroop", schedule.CONTROL),
                                  ("hick", schedule.FLIP), ("hick", schedule.CONTROL),
                                  ("fitts", schedule.FLIP), ("fitts", schedule.CONTROL),
                                  ("weber", schedule.FLIP), ("weber", schedule.CONTROL)):
                side = gp[paradigm]["flip" if arm == schedule.FLIP else "control"]
                rows.append([paradigm.capitalize(), arm, side["n"], _stat_for(paradigm, side)])
            table = {"columns": ["Paradigm", "Arm", "N", "Statistic"], "rows": rows}
        return env("Per-paradigm psychophysics DV split by assigned arm — Stroop congruency "
                   "delta, Hick RT×n_choices, Fitts MT by condition (distance/size), Weber JND — "
                   "the reframed DV. Trial coverage is in the stat cards. Live only when "
                   "TELEMETRY_ENABLED was on in prod.", status, stats, g["note"], table)

    return env("Unknown paper.", "pending", [], "No live slice for this id.")


@router.get("/demographics")
async def demographics(response: Response, session: Optional[str] = Cookie(default=None)):
    """The shared demographics distribution (age summary + per-option counts incl. decline
    rates). Aggregate-only — no participant row leaves. Belongs on THIS internal surface,
    not the public board or the removed stats strip."""
    sid, err = _researcher(session, response)
    if err:
        return err
    return await asyncio.to_thread(measures.demographics_summary)


@router.get("/paper/{pid}")
async def paper(pid: str, response: Response, session: Optional[str] = Cookie(default=None)):
    """One paper's live-data slice (aggregate-only envelope). Heavy — scans the sink via
    measures — so it dispatches off the event loop, like /monitor."""
    sid, err = _researcher(session, response)
    if err:
        return err
    return await asyncio.to_thread(_paper_slice, pid)


# ── the erasure the consent form promises ─────────────────────────────────────

@router.get("/participant")
async def participant(sid: str, response: Response,
                      session: Optional[str] = Cookie(default=None)):
    """Preview a forget: how many rows it would remove, and whether they withdrew.

    A destructive erase should show its blast radius BEFORE it runs -- research_store
    kept count_for() for exactly this. Returns pseudonym too, so the researcher can find
    the same person in an export they already hold.
    """
    who, err = _researcher(session, response)
    if err:
        return err
    target = (sid or "").strip().upper()
    if not target:
        response.status_code = 400
        return {"error": "bad_sid", "message": "Give a student ID."}
    events = await asyncio.to_thread(research_store.count_for, target)
    withdrawn = target in await asyncio.to_thread(auth_store.withdrawn_sids)
    return {"sid": target, "events": events, "withdrawn": withdrawn,
            "pseudonym": auth_store.pseudonym(target)}


@router.post("/forget")
async def forget(body: ForgetRequest, response: Response,
                 session: Optional[str] = Cookie(default=None)):
    """Erase every research event for one participant. Returns rows removed.

    The account tombstone is NOT touched -- it is what stops a withdrawn SID signing up
    again and reappearing in the data, and it is the record that the withdrawal happened
    (same contract as research_store.forget_participant). Audited with the row count, so
    the log alone shows an erasure was carried out and how much it took.
    """
    who, err = _researcher(session, response)
    if err:
        return err
    target = (body.sid or "").strip().upper()
    if not target:
        response.status_code = 400
        return {"error": "bad_sid", "message": "Give a student ID."}
    removed = await asyncio.to_thread(research_store.forget_participant, target)
    auth_store.audit(who, "researcher_forget", target, f"removed={removed}")
    return {"ok": True, "sid": target, "removed": removed}


# ── the export, gated on THIS session (not the token) ─────────────────────────

@router.get("/export")
async def export(response: Response, format: str = "json",
                 session: Optional[str] = Cookie(default=None)):
    """Pseudonymised export, downloaded from the browser by the signed-in researcher.

    Distinct from /api/research/export's X-Export-Token path only in HOW it authorises
    (this session's is_researcher membership vs a header token) -- it shares the SAME
    pseudonymisation boundary (research_api.pseudonymised_rows), so real SIDs never
    leave and withdrawn participants are excluded, identically. Putting the token in the
    browser bundle would leak it; the session cookie is the right credential here.
    Audited -- a dataset leaving the box is a recorded event.
    """
    sid, err = _researcher(session, response)
    if err:
        return JSONResponse(err, status_code=response.status_code)
    rows = await asyncio.to_thread(research_api.pseudonymised_rows)
    auth_store.audit(sid, "researcher_export", None, f"format={format} rows={len(rows)}")
    if format == "csv":
        return PlainTextResponse(
            research_api.rows_as_csv(rows),
            media_type="text/csv",
            headers={"Content-Disposition": "attachment; filename=research_events.csv"},
        )
    return JSONResponse(rows)
