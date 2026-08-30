# Ethics amendment — COMPGame Stage 2

**Status: DRAFT for supervisor review, then HSESC submission. Not yet submitted.**
Prepared 2026-08-30. Names, reference numbers and dates in `[square brackets]` need
filling before this goes anywhere.

> **Do not open Stage 2 recruitment until this amendment is approved.** The approved
> protocol covers a single-sitting, anonymous, four-topic focus group. What is built
> is a semester-long, pseudonymous, thirteen-topic cohort study on researcher-operated
> hardware. Those are different studies in every dimension an ethics committee cares
> about, and the difference is not something the code can resolve.

---

## 1. What is being amended

| | Approved (Stage 1) | Proposed (Stage 2) |
|---|---|---|
| Design | One-group pretest–posttest focus group | Within-subjects, order randomised **per topic per participant**, assigned server-side |
| Participants | Small convenience group (n ≈ [N]) | Whole COMP3423 cohort, ~300 students in 3 sections |
| Duration | **One sitting, 45–60 min** | **13 sittings over a 13-week semester**, ~12 min each, unsupervised, on the student's own device |
| Topics | 4 | 13 |
| Identifiability | **Anonymous** — no account, participant code `P01` | **Pseudonymous** — student ID + password account, SID retained in the live database |
| Data location | Password-protected PolyU-associated storage | **Researcher-operated workstation**, exposed to the internet through an authenticated tunnel |
| Free text | Paper reflections | Tutor conversations and short-answer responses, stored verbatim, graded by a **locally hosted** language model |
| Administration | Researcher present throughout | Unsupervised; a teacher panel exists for password resets and section corrections |

Everything in §5 (constructs, instruments, voluntariness, withdrawal rights, no
payment, retention period) is **unchanged** and is not part of this request.

---

## 2. Material changes, the risk each creates, and the mitigation

### 2.1 Anonymous → pseudonymous

**What changed.** Stage 1 collected no identifier. Stage 2 requires an account,
because a study spread across thirteen weeks must recognise the same participant in
week 11 as in week 2, and because a student who changes laptop must not lose their
progress. The credential is student ID plus a password the student chooses.

**Risk.** The live database contains real student IDs. A breach would identify
participants and link them to their answers.

**Mitigation.**
- Real student IDs **never leave the machine**. Every research export replaces the ID
  with an HMAC-SHA-256 pseudonym computed at the export boundary
  (`backend/auth_store.py::pseudonym`). The key is held outside the repository and
  outside version control.
- Passwords are stored only as `scrypt` hashes (n=2¹⁴, r=8, p=1) with a per-user
  random salt. They are never logged and never returned by any endpoint.
- The sign-in endpoint returns one identical failure for an unknown ID, a wrong
  password, an unclaimed account and a withdrawn account, so it cannot be used to
  discover who is enrolled — including by timing, which was measured and equalised
  on 2026-08-30.
- Withdrawal tombstones the account, ends every session immediately, and
  `research_store.forget_participant` erases the participant's rows.

**Residual limitation, stated plainly.** A password can be shared, and where no class
list is configured an unenrolled person could create an account. This is
authentication, not strong identity verification. It is disclosed here and will be
disclosed in the paper's limitations.

### 2.2 One supervised sitting → thirteen unsupervised sittings

**Risk.** Greater cumulative burden; no researcher present to answer questions or
notice distress; participation becomes entangled with the rhythm of the course.

**Mitigation.**
- Per-sitting burden is **~12 minutes** (6 pre items, an activity, 6 post items), not
  a 60-minute block. Total across the semester is comparable to one hour of revision.
- Every topic can be skipped. Skipping topics does not remove the student from the
  study and carries no consequence.
- Contact details for the researcher and supervisor are on every page of the
  information sheet and in the app's About page.
- Nothing in the platform is graded, and no score is visible to teaching staff in a
  form attached to a name (see §2.6).

### 2.3 Data on researcher-operated hardware, not PolyU storage

**This is the change most likely to attract conditions, and it should.** The service
runs on a workstation operated by the researcher and reached through an authenticated
tunnel.

**Mitigation.**
- The application binds to **loopback only**; the tunnel is the sole ingress and
  terminates TLS. There is no open port on the residential network.
- Session cookies are `HttpOnly`, `SameSite=Lax` and `Secure`; cross-origin access is
  restricted to the deployment origin, not a wildcard.
- Automated hourly backups of the database, retained locally.
- **Full-disk encryption on the host is a condition of go-live** and is on the
  pre-launch checklist.
- No student data is sent to any third-party service at any point — see §2.4.

**Alternative offered.** If the committee prefers institutional hosting, the same
build runs unchanged against a PolyU-provided VM; the only change is a hostname. The
researcher will move it on request rather than argue the point.

### 2.4 Free text, and language models

Students type into two places that are stored verbatim: the AI tutor, and one
short-answer question per topic.

**Risk.** Free text can contain anything, including identifying or sensitive
disclosure the study never asked for.

**Mitigation.**
- **All language-model processing is local.** The tutor and the offline grader run on
  Ollama on the same machine. No prompt, answer or reflection is transmitted to
  OpenAI, Anthropic, Google or any other external service. There is no API key for a
  hosted model in the deployment.
- Short-answer grading runs **offline and blind**: the grader sees the response text
  and a rubric, never a participant identifier or a condition label.
- The teacher-facing report is generated in two passes; the identifiable pass counts
  in code, and the model sees text only. An anonymised copy is written every time.
- Free-text fields are covered by the same withdrawal erasure as everything else.
- The information sheet will tell students, in plain words, not to type anything
  personal into the tutor, and that what they type is stored.

### 2.5 Randomised assignment inside a credit-bearing course

**This is the point on which the amendment most deserves scrutiny, and it has a clean
answer: nothing is withheld from anyone.**

Each topic is a unit of seven steps. The randomisation changes **the order of two of
them**, not their presence:

```
FLIP     brief → pre-check → GAME → post-check → assessment → tutor → close
CONTROL  brief → pre-check → post-check → GAME → assessment → tutor → close
```

Every participant, in every condition, on every topic, completes the same seven steps
and receives the same learning material, the same assessment and the same tutor
access. The independent variable is whether the interactive Understanding game comes
before or after the post-check. There is **no untreated arm and no withheld
resource**, so the equipoise question that normally attends randomisation inside a
taught course does not arise.

Assignment is deterministic and balanced per participant across the thirteen topics
(roughly half each), and is recorded server-side at release time rather than inferred
from what a student happened to do.

### 2.6 A teacher-facing panel

An administrative page exists so a lecturer can correct a student's section and reset
a forgotten password — the two support tasks that otherwise block a participant.

**Mitigation.** Access requires both a valid session and membership of a file-based
allowlist. Every mutation is written to an audit table with the acting staff ID. The
panel **cannot** read answers or scores, cannot return password material, and cannot
delete anything. Research data reaches staff only through the pseudonymised export.

### 2.7 Recruitment inside a class the researcher belongs to

**Risk.** Perceived pressure. An invitation that arrives via the course, from a peer,
about a platform the lecturer has endorsed, is not a neutral invitation.

**Mitigation.**
- Recruitment is by **written invitation** (`docs/study-pack/08_recruitment-email.md`),
  not a verbal request in a lecture where declining is visible to peers.
- The consent screen states that participation is unrelated to marks, that the
  lecturer will not be told who did or did not take part, and that the platform is
  **available to use regardless of consent**. A student who declines still gets the
  games; they are simply not measured.
- No incentive, no payment, no course credit.

---

## 3. Revised consent text (replaces the corresponding sections of the approved sheet)

> **What will I be asked to do?**
> Over this semester, thirteen short topics will open on the COMPGame platform, one or
> two a week, matching your COMP3423 lectures. Each takes about **12 minutes** and you
> can do it whenever you like, on your own device: a few multiple-choice questions, a
> short interactive activity, a few more questions, and a short written answer. An AI
> tutor is available throughout. You can skip any topic, stop at any point, and take
> part in as many or as few as you wish.
>
> **What is being compared?**
> For each topic, the platform varies **the order** of two steps — whether the
> interactive activity comes before or after the second set of questions. Everyone
> does every step on every topic; nothing is withheld from anyone. We are studying
> whether the order affects how well the concept is learned.
>
> **What information is collected?**
> Your student ID, so the platform can recognise you across the semester and across
> devices, and a password you choose. Your answers, your written responses, your
> conversations with the AI tutor, and timing information. **We do not collect your
> name.**
>
> Your student ID is stored on the study server and is **replaced by a code before any
> data is analysed or shared**. Nobody outside the research team can link the analysed
> data back to you.
>
> **Where is my data kept, and does anything leave?**
> On a secured computer operated by the researcher, reachable only over an encrypted
> connection. The AI tutor runs **on that same computer** — nothing you type is sent to
> any outside company or online AI service. Please still avoid typing personal
> information into the tutor: what you type is stored.
>
> **Does this affect my grades?**
> No. Nothing here is graded, no score reaches your course marks, and your lecturer
> will not be told who took part. The games are available to you whether or not you
> consent to the research; consenting only means your answers may be analysed.
>
> **Can I change my mind?**
> Yes, at any time and without giving a reason. Choose *Withdraw* in your account and
> your account is closed, you are signed out everywhere, and your responses are deleted
> from the research data.

---

## 4. Data management summary

| | |
|---|---|
| Collected | Student ID, chosen password (hashed), per-topic answers and scores, short written responses, tutor conversations, timing and interaction telemetry |
| Not collected | Name, email, demographics beyond the optional background items, IP address, location, any device identifier |
| Identifier at rest | Student ID, on the study server only |
| Identifier in analysis | HMAC-SHA-256 pseudonym, applied at the export boundary |
| Key handling | Held outside the repository and outside version control; a verified off-machine copy exists; fingerprint recorded so a copy can be checked without exposing the key; the key is never regenerated |
| Third-party processing | **None.** All model inference is local |
| Backups | Hourly local database snapshot |
| Withdrawal | Account tombstoned, all sessions ended, research rows erased |
| Retention | As per PolyU FYP regulations, then securely deleted |
| Access | Researcher and supervisor only |

---

## 5. Unchanged from the approved protocol

Research questions and constructs; the validated instruments (IMI, CoI adapted, ARCS-S,
Paas load); voluntary participation; the right to decline any item; the right to
withdraw without penalty; absence of payment or course credit; the retention and
deletion schedule; supervisor oversight.

---

## 6. Attachments to submit with this amendment

1. Revised Participant Information Sheet and Consent Form (§3 text merged into
   `docs/study-pack/01_information-sheet-and-consent.md`).
2. Recruitment invitation (`docs/study-pack/08_recruitment-email.md`).
3. Instruments: `docs/quiz-item-banks.md`, `docs/study-pack/03_concept-inventory.md`,
   `04_post-questionnaire.md`, `05_reflection-and-load.md`.
4. Data management summary (§4 above).
5. Security description: deployment runbook §§1, 2, 2c (`docs/runbook.md`).

---

## 7. Open questions for the supervisor before submission

1. **Hosting.** Is researcher-operated hardware acceptable, or should this move to a
   PolyU VM? The build is indifferent; the answer changes §2.3 and the security
   attachment.
2. **Class list.** If a roster is supplied, sign-up is restricted to enrolled students
   and sections are authoritative. Without one, sign-up is open and a student
   self-reports their section. Which does the department prefer?
3. **Withdrawal after analysis.** Erasure is immediate in the live data. Once a result
   is in a submitted paper it cannot be retracted from that paper. The consent text
   should state the cut-off date explicitly — what should it be?
4. **Reporting to teaching staff.** A tutorial-preparation report is generated for the
   lecturer. It is written in two versions, one identifiable and one anonymised. Which
   version may the lecturer receive, and does its existence need to be in the consent
   text?
