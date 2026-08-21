import Link from "next/link"

// The site footer, in the CUBIK register (app/shell.css). Renders inside a `.shell`
// page, so it inherits the tokens rather than setting its own colours.
//
// The personal "Contact" mailto that used to sit here was removed 2026-08-21: this
// renders on the PUBLIC LANDING PAGE, so that address was the first contact detail a
// visitor saw, and it pointed at someone not running the 2026 study. The file keeps
// its name only to avoid churning the import — there is no creator attribution left
// in it.
export default function CreatorFooter() {
  return (
    <footer style={{ borderTop: "1px solid var(--rule)" }}>
      <div className="mx-auto w-full max-w-5xl px-5 py-6 flex items-center justify-between gap-4 flex-wrap">
        <p className="u-faint">© {new Date().getFullYear()} COMPGame</p>
        <div className="flex items-center gap-4">
          <Link href="/about" className="u-faint hover:underline">
            About
          </Link>
          <Link href="/login" className="u-faint hover:underline">
            Sign in
          </Link>
        </div>
      </div>
    </footer>
  )
}
