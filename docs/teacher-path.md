> **UPDATE 2026-08-30 — all three defects below are now FIXED** (and re-confirmed by the
> multi-agent sweep): teachers skip the participant consent/baseline gates and never enter
> the research sink; `/admin` is linked from the dashboard (and a staff banner); and the
> tutorial brief is readable AND now generable in-browser (`/admin/reports` + a Generate
> button). The narrative below is kept as the record of what was wrong.

# The teacher's path, every screen

Companion to `student-path.md`. Written 2026-08-30 after Wilson asked where it was —
and the honest answer is that most of it does not exist yet.

Two people use this system. The student path is nine steps of designed flow. The
teacher path is, in three places, not a path at all.

Derived from the code: `middleware.ts`, `lib/session-handoff.ts`,
`backend/admin_api.py`, `backend/generate_tutorial_report.py`, and a query against
the live sink.

---

## 1. Becoming a teacher

There is no teacher sign-up. An account becomes a teacher when its SID is written
into two gitignored files on the box:

```
backend/enrolled_sids.txt   so they can sign up at all (when a roster is configured)
backend/admin_sids.txt      so /api/admin/* answers them
```

A file, not a database flag, and deliberately: revoking a teacher must not need a
migration or a running app, and the whole list must be reviewable in one `cat`.

---

## 2. Signing in — and the first defect

A teacher signs in at `/login` like everyone else, and then hits the **identical**
gate chain:

```
/consent  ->  /onboarding/avatar  ->  /onboarding/username  ->  /onboarding/baseline
```

`is_admin` is **never consulted** in `auth_api.py`, `topic_api.py` or
`research_api.py`. So a teacher must agree to a *participant* information sheet, pick
an avatar, choose a username, and **sit the prior-knowledge pre-test** before the app
will let them anywhere.

### DEFECT 1 — teachers are in the participant pool

That is not only awkward, it contaminates the data. Queried from the live sink today:

```
22074221D  topic_pretest x3 · topic_posttest x3 · topic_complete x3 ·
           reflection_skipped x3 · topic_probe x1 · topic_probe_post x1 ·
           pre_test_complete x1 · consent_recorded x1
24E00399A  pre_test_complete x1 · consent_recorded x1
```

Wilson's own admin account has **three completed topics** sitting in the sink,
indistinguishable from a student's. `measures.enrolled_only()` cannot help: teachers
are on the roster, because they had to be to sign up.

**Fix, two parts.** `research_store.record_event` should drop events from admin SIDs
— one place, robust whatever the UI does — and the gate chain should let a teacher
past consent and the baseline, because those instruments are for participants and a
teacher is not one.

---

## 3. Reaching the panel — the second defect

### DEFECT 2 — `/admin` is linked from nowhere

`grep` across every page and component finds the string only inside two code
comments. There is no button, no menu item, no link from the dashboard, no hint after
sign-in. **A teacher reaches the panel by typing the URL from memory, or not at all.**

Once there, `/admin` is genuinely good:

| section | what it does |
|---|---|
| Accounts | search, section counts, roster status |
| Section | correct a student's section — refused when a class list is authoritative |
| Password | reset a lost password, optionally ending their sessions. **Never echoes the password back** |
| Lecture dates | move one lecture for one section. **Previews first**, names the topics that would change state, refuses a date that breaks the schedule or lands on a no-class day |
| Audit | every mutation, with the old value, readable by teachers — an audit trail nobody can read is decoration |

It deliberately **cannot** read answers or scores, return password material, or delete
anything.

---

## 4. Getting the tutorial brief — the third and worst defect

This is the thing the teacher actually needs, weekly, and the path is:

```
ssh onto the 3090
cd backend
python generate_tutorial_report.py --topic memory --section A
open  reports/COMP3423/section-A/memory-2026-08-30-teacher.md   in an editor
```

### DEFECT 3 — the brief is not reachable from the app at all

No route serves it. `grep` for `FileResponse` / `StaticFiles` / `reports/` across the
backend returns nothing outside the generator itself. The persona the report was
designed for — *reads one page, standing up, thirty minutes before the tutorial* —
**has no way to reach that page.**

The report itself is well-built: counts computed in code and never by the LLM, three
files every time (`-teacher` with SIDs, `-discussion` safe to project, `-research`
which is the only one that mentions the experiment), a structural check that the
anonymised copy really is anonymous, and full output with `--no-llm` so the numbers
never depend on a model being up. All of that is upstream of a delivery problem.

**Fix.** `/admin/reports`: list what has been generated for the teacher's sections,
render it in the browser, and offer a "generate for this topic" button. The
`-research` copy stays off that list — it is Wilson's.

---

## 5. What the teacher path looks like when it works

| # | where | what they do | how often |
|---|---|---|---|
| 1 | `/login` | sign in | each session |
| 2 | `/admin` | **reachable by clicking** | as needed |
| 3 | `/admin` → Accounts | fix a section, reset a password | rarely |
| 4 | `/admin` → Lecture dates | move a lecture for a typhoon or a holiday | rarely |
| 5 | `/admin` → Reports | read this week's brief for their section | **weekly, the main job** |
| 6 | the brief | items missed · misconceptions · who has not done the activity · who is struggling · a warning line when the daily checks failed | before each tutorial |

Steps 2, 5 and 6's delivery do not exist yet. Step 6's *content* does.

---

## 6. What the teacher must never see

The lecturer's copies are **blind to the experiment** (implemented 2026-08-30): no
arms, no FLIP/CONTROL, no "played it before the second check". A lecturer who learns
the manipulation exists can, with the best intentions, teach to compensate — and
differential instruction by condition is a confound that lands on H1 and cannot be
removed afterwards.

They also must never be handed the scoring key: reverse-scored items and subscale
membership are researcher-only, and the questionnaire endpoint strips both.

---

## 7. Summary — three defects, all small, all before 8 Sept

| | defect | cost |
|---|---|---|
| 1 | teachers consent, sit the baseline, and land in the participant pool | drop admin SIDs in `record_event` + skip the two gates |
| 2 | `/admin` is linked from nowhere | one conditional link in the dashboard nav |
| 3 | the tutorial brief cannot be reached from the app | `/admin/reports` — list, view, generate |

None is hard. All three are the difference between a teacher path and a teacher
path on paper.
