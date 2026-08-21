import Image from "next/image"
import Link from "next/link"

// In the CUBIK register (app/shell.css) like the rest of the shell.
//
// CONTENT CORRECTIONS made here, all checked against the codebase rather than
// rewritten to taste:
//
//  * The topic list said "Fitts' Law, Gestalt Principles, CPU Scheduling and Page
//    Replacement Algorithms". CPU Scheduling and Page Replacement are NOT among the
//    13 topics (lib/topic-definitions.ts) — they are OS topics from an earlier
//    4-topic version of this project, and CLAUDE.md records that table as wrong and
//    corrected on 2026-08-16. Replaced with what the app actually contains.
//  * The stack paragraph listed only the frontend. The backend (FastAPI + LangChain
//    + ChromaDB + Ollama) is most of what makes the tutor work and was unmentioned.
//  * The header linked to /signup, which was retired when login became SID-only
//    against an enrolled-SID allowlist. A dead link on a public page.
//
// PERSONAL DATA REMOVED 2026-08-21, on Wilson's instruction. The page previously
// carried a named author, a named supervisor, "April 2025", and a personal
// @connect.polyu.hk address presented as the support contact. All four were wrong
// for a 2026 cohort — that address would have taken 300 students' account problems
// to someone who is not running this study — and none of it belongs on a page read
// during an ethics-approved run.
//
// NOTE FOR THE PAPER, not for this file: removing the credit from the PRODUCT is a
// data-hygiene fix, not a licence to drop it from the write-up. If COMPGame builds
// on a prior FYP, that still needs declaring in the report the same way the
// WorldMonitor reference is (CLAUDE.md, "Academic integrity note").

export default function AboutPage() {
  return (
    <main className="shell min-h-screen flex flex-col">
      <header className="u-nav">
        <div className="mx-auto w-full max-w-3xl px-5 h-14 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <Image src="/images/logo.png" alt="" width={26} height={26} priority />
            <span style={{ fontWeight: 600, letterSpacing: "-.01em" }}>COMPGame</span>
          </Link>
          <Link href="/login" className="u-faint hover:underline">
            Sign in
          </Link>
        </div>
      </header>

      <div className="flex-1">
        <div className="mx-auto w-full max-w-3xl px-5 py-16">
          <p className="u-eyebrow">About</p>
          <h1 className="u-h1 mt-1">COMPGame</h1>
          <p className="u-stem u-muted mt-3">
            A flipped-learning platform for COMP3423 Human–Computer Interaction at PolyU: learn
            each concept by playing with it first, then test yourself, with an AI tutor available
            throughout.
          </p>

          <div className="u-card p-8 mt-9 space-y-8">
            <section>
              <h2 className="u-h2">Why it exists</h2>
              <p className="u-stem u-muted mt-3">
                Traditional teaching tests you on material you have already been lectured at.
                COMPGame inverts that: you meet a concept inside an interactive activity, build an
                intuition for it, and only then check what you understood. Whether that ordering
                actually helps is not assumed here — it is measured, topic by topic, and reported
                honestly either way.
              </p>
            </section>

            <section>
              <h2 className="u-h2">What is in it</h2>
              <p className="u-stem u-muted mt-3">
                Thirteen topics from the COMP3423 syllabus, released in lecture order: Fitts&apos;
                Law, Gestalt principles, Hick&apos;s Law, Miller&apos;s 7±2, the principle of
                consistency, Weber&apos;s Law, Norman&apos;s action cycle, mental models,
                problem solving, visual perception, language and ambiguity, ergonomics, and
                experiment design. Each has an Understanding activity and an Assessment.
              </p>
            </section>

            <section>
              <h2 className="u-h2">How it is built</h2>
              <p className="u-stem u-muted mt-3">
                The interface is Next.js, React, TypeScript and Tailwind CSS. The tutor is a
                retrieval-augmented pipeline — FastAPI and LangChain over a ChromaDB vector store
                built from the course lecture slides, answering through a locally hosted Ollama
                model. Nothing a student writes leaves the course machine.
              </p>
            </section>

            <section>
              <h2 className="u-h2">Questions or problems</h2>
              <p className="u-stem u-muted mt-3">
                If you cannot sign in, or something here is not working, tell your course
                team — they can check your student ID against the class list. Questions about
                the study itself, including how to withdraw, are answered on the consent page
                you saw when you first signed in.
              </p>
            </section>
          </div>

          <div className="mt-9">
            <Link href="/">
              <button className="u-btn">← Back to home</button>
            </Link>
          </div>
        </div>
      </div>

      <footer style={{ borderTop: "1px solid var(--rule)" }}>
        <div className="mx-auto w-full max-w-3xl px-5 py-6">
          <p className="u-faint">© {new Date().getFullYear()} COMPGame</p>
        </div>
      </footer>
    </main>
  )
}
