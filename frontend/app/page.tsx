import Image from "next/image"
import Link from "next/link"
import CreatorFooter from "@/components/creator-footer"

// The public front door, in the CUBIK register (app/shell.css).
//
// CONTENT FIXED, not just restyled:
//  * It read "START YOUR **Computer Science** JOURNEY". This is a Human–Computer
//    Interaction course — COMP3423 — not general CS. Same class of error as the
//    /about topic list, and on the one page a visitor sees first.
//  * Both calls to action pointed at /signup, which is now a redirect stub: there
//    is no sign-up, accounts are pre-enrolled from the class list and a student's
//    first sign-in creates theirs (docs/revamp.md Part 0). They point at /login.
//  * The pixel-art hero was a remote vercel-storage blob — an external dependency
//    on the page most likely to be opened on a phone, over a slow connection, by
//    someone deciding whether this looks like real coursework. It is gone; the
//    hero is type now, which is also what the CUBIK system does.

export default function Home() {
  return (
    <main className="shell min-h-screen flex flex-col">
      <header className="u-nav">
        <div className="mx-auto w-full max-w-5xl px-5 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Image src="/images/logo.png" alt="" width={26} height={26} priority />
            <span style={{ fontWeight: 600, letterSpacing: "-.01em" }}>COMPGame</span>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/about" className="u-faint hover:underline">
              About
            </Link>
            <Link href="/login">
              <button className="u-btn u-btn-primary">Sign in</button>
            </Link>
          </div>
        </div>
      </header>

      <div className="flex-1">
        {/* Hero. CUBIK's rhythm: a lot of air, one tight-tracked statement, one
            unambiguous action. No carousel, no background image, no second CTA
            competing with the first. */}
        <section className="mx-auto w-full max-w-3xl px-5 pt-24 pb-20 md:pt-32 md:pb-24">
          <p className="u-eyebrow">COMP3423 · Human–Computer Interaction</p>
          <h1
            className="mt-3"
            style={{
              color: "var(--ink)",
              fontSize: "clamp(2.25rem, 6vw, 3.75rem)",
              fontWeight: 600,
              letterSpacing: "-0.045em",
              lineHeight: 1.05,
              textWrap: "balance",
            }}
          >
            Play with the idea first. Then find out what stuck.
          </h1>
          <p className="u-stem u-muted mt-6" style={{ fontSize: "1.125rem" }}>
            Every topic starts as something you can poke at rather than something you are told.
            You build an intuition, then check it — and an AI tutor is there throughout, asking
            questions instead of handing over answers.
          </p>

          <div className="flex flex-wrap items-center gap-3 mt-9">
            <Link href="/login">
              <button className="u-btn u-btn-primary u-btn-lg">Sign in with your student ID</button>
            </Link>
            <Link href="/about">
              <button className="u-btn u-btn-lg">What is this?</button>
            </Link>
          </div>
          <p className="u-faint mt-4">
            No password. Your ID just needs to be on the class list for this study.
          </p>
        </section>

        {/* Three panels, because there are exactly three things a student needs to
            know before signing in — not because three is a nice number for a grid. */}
        <section
          className="mx-auto w-full max-w-5xl px-5 pb-24 md:pb-32"
          style={{ borderTop: "1px solid var(--rule)", paddingTop: "4rem" }}
        >
          <div className="grid gap-5 md:grid-cols-3">
            <Panel
              n="13"
              title="topics, in lecture order"
              body="Fitts' Law, Gestalt, Hick's Law, Miller's 7±2 and nine more. Each one opens the week your lecture reaches it, so nothing arrives out of sequence."
            />
            <Panel
              n="2"
              title="parts to every topic"
              body="An activity you play, and a check that tells you what you actually took from it. Roughly twenty minutes, and you can stop and come back."
            />
            <Panel
              n="1"
              title="tutor, always there"
              body="It answers from your own lecture slides, and it pushes back with questions rather than giving you the answer. Nothing you write leaves the course machine."
            />
          </div>
        </section>
      </div>

      <CreatorFooter />
    </main>
  )
}

function Panel({ n, title, body }: { n: string; title: string; body: string }) {
  return (
    <div className="u-card p-6">
      <p className="u-num" style={{ fontSize: "2rem", color: "var(--accent)", lineHeight: 1 }}>
        {n}
      </p>
      <p className="mt-2" style={{ fontWeight: 600, color: "var(--ink)" }}>
        {title}
      </p>
      <p className="u-faint mt-2" style={{ lineHeight: 1.6 }}>
        {body}
      </p>
    </div>
  )
}
