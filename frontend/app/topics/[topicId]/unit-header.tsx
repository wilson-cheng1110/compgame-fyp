import Image from "next/image"
import Link from "next/link"

// Deliberately NOT a client component: it is rendered by the server page as well as
// inside the interactive unit, so it must work before (and without) hydration.
export default function UnitHeader() {
  return (
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
  )
}
