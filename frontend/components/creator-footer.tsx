import Link from "next/link"
import { Pixelify_Sans } from "next/font/google"

const pixelifySans = Pixelify_Sans({
  weight: ["400", "500"],
  subsets: ["latin"],
  display: "swap",
})

// The personal "Contact" mailto that used to sit here was removed 2026-08-21. This
// footer renders on app/page.tsx — the PUBLIC LANDING PAGE — so that address was the
// first thing a visitor saw, and it pointed at someone who is not running the 2026
// study. The file keeps its name only to avoid churning the import; there is no
// creator attribution in it any more.
export default function CreatorFooter() {
  return (
    <footer className={`w-full bg-[#f4eba7] py-4 border-t-2 border-black ${pixelifySans.className}`}>
      <div className="container mx-auto px-8 md:px-16 text-center">
        <p className="text-black text-xs">
          © {new Date().getFullYear()} COMPGame |
          <Link href="/about" className="ml-1 underline hover:text-[#a16207]">
            About
          </Link>
        </p>
      </div>
    </footer>
  )
}
