"use client"

import { useEffect, useState } from "react"
import Image from "next/image"
import Link from "next/link"
import { useRouter } from "next/navigation"
import Cookies from "js-cookie"
import { auth } from "@/lib/api"

// The page the consent form has always pointed at.
//
// `/consent` says, and has said since it was written: "You can withdraw from your
// account page whenever you like." There was no account page. `auth.withdraw()`
// existed in lib/api.ts with zero call sites, so the one thing a participant is
// unconditionally entitled to do was unreachable from the interface.
//
// The backend half was already finished: POST /api/auth/withdraw tombstones the
// account, kills every session, and writes a `consent_withdrawn` event. This is
// the button.

interface Me {
  sid: string
  username: string | null
  avatarId: string | null
  section?: string | null
}

export default function AccountPage() {
  const router = useRouter()
  const [me, setMe] = useState<Me | null>(null)
  const [checking, setChecking] = useState(true)
  const [confirming, setConfirming] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    if (Cookies.get("darkMode") === "true") document.body.classList.add("dark-mode")
    // The server session is authoritative, exactly as the dashboard learned to be:
    // a stale `user` cookie must never be enough to render this page.
    auth.me().then((res) => {
      if (!res.ok || !res.data) {
        router.push("/login")
        return
      }
      setMe({
        sid: res.data.sid,
        username: res.data.username,
        avatarId: res.data.avatarId,
        section: res.data.section ?? null,
      })
      setChecking(false)
    })
  }, [router])

  const handleExport = () => {
    if (!me) return
    // Everything this browser holds about you, in one file. The research copy is
    // separate and pseudonymised at the export boundary -- this is the student's.
    const payload = {
      exportedAt: new Date().toISOString(),
      sid: me.sid,
      username: me.username,
      avatarId: me.avatarId,
      section: me.section,
      note:
        "This is the copy your browser holds. Your answers are also stored on the course " +
        "machine; ask the course team for that copy or to erase it.",
    }
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" }),
    )
    const a = document.createElement("a")
    a.href = url
    a.download = `COMPGame_${me.sid}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleWithdraw = async () => {
    setBusy(true)
    setError("")
    const res = await auth.withdraw()
    if (!res.ok) {
      setBusy(false)
      setError("That didn't go through. Try again, or tell the course team and they will do it.")
      return
    }
    Cookies.remove("user")
    router.push("/?withdrawn=1")
  }

  if (checking) {
    return (
      <main className="shell min-h-screen flex items-center justify-center">
        <p className="u-muted">Loading…</p>
      </main>
    )
  }

  return (
    <main className="shell min-h-screen">
      <header className="u-nav">
        <div className="mx-auto w-full max-w-3xl px-5 h-14 flex items-center justify-between">
          <Link href="/dashboard" className="flex items-center gap-2.5">
            <Image src="/images/logo.png" alt="" width={26} height={26} priority />
            <span style={{ fontWeight: 600, letterSpacing: "-.01em" }}>COMPGame</span>
          </Link>
          <Link href="/dashboard" className="u-faint hover:underline">
            All topics
          </Link>
        </div>
      </header>

      <div className="mx-auto w-full max-w-2xl px-5 py-10">
        <p className="u-eyebrow">Your account</p>
        <h1 className="u-h1 mt-1">{me?.username || "Your account"}</h1>

        <div className="u-card p-6 mt-6">
          <dl className="flex flex-col gap-3">
            <div className="flex items-center justify-between gap-4">
              <dt className="u-faint">Student ID</dt>
              <dd className="u-num">{me?.sid}</dd>
            </div>
            {me?.section && (
              <div className="flex items-center justify-between gap-4">
                <dt className="u-faint">Section</dt>
                <dd className="u-num">{me.section}</dd>
              </div>
            )}
          </dl>
        </div>

        <div className="u-card p-6 mt-5">
          <h2 className="u-h2">Your data</h2>
          <p className="u-stem u-muted mt-3">
            Download what this browser holds about you. Your answers are also stored on the course
            machine; the research copy has your ID replaced before anyone analyses it.
          </p>
          <button onClick={handleExport} className="u-btn u-btn-block mt-5">
            Download my data
          </button>
        </div>

        <div className="u-card p-6 mt-5" style={{ borderColor: "var(--state-late)" }}>
          <h2 className="u-h2">Leave the study</h2>
          <p className="u-stem u-muted mt-3">
            Taking part is voluntary and stopping does not affect your grade. Withdrawing closes
            your account immediately and signs you out everywhere. You can ask the course team to
            erase everything already recorded about you.
          </p>

          {error && (
            <p className="u-stem mt-4" style={{ color: "var(--state-late)" }}>
              {error}
            </p>
          )}

          {!confirming ? (
            <button
              onClick={() => setConfirming(true)}
              data-testid="withdraw-start"
              className="u-btn u-btn-block mt-5"
              style={{ color: "var(--state-late)", borderColor: "var(--state-late)" }}
            >
              Withdraw from the study
            </button>
          ) : (
            <div className="mt-5">
              <p className="u-stem">
                This closes your account now. You will be signed out and will not be able to sign
                back in.
              </p>
              <div className="flex flex-col sm:flex-row gap-3 mt-4">
                <button
                  onClick={handleWithdraw}
                  disabled={busy}
                  data-testid="withdraw-confirm"
                  className="u-btn u-btn-lg flex-1"
                  style={{ color: "var(--state-late)", borderColor: "var(--state-late)" }}
                >
                  {busy ? "Closing…" : "Yes, withdraw me"}
                </button>
                <button
                  onClick={() => setConfirming(false)}
                  disabled={busy}
                  className="u-btn u-btn-primary u-btn-lg flex-1"
                >
                  Keep my account
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </main>
  )
}
