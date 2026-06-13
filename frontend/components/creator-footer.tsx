import Link from "next/link"
import { Pixelify_Sans } from "next/font/google"

const pixelifySans = Pixelify_Sans({
  weight: ["400", "500"],
  subsets: ["latin"],
  display: "swap",
})

export default function CreatorFooter() {
  return (
    <footer className={`w-full bg-[#f4eba7] py-4 border-t-2 border-black ${pixelifySans.className}`}>
      <div className="container mx-auto px-8 md:px-16 text-center">
        <p className="text-black text-xs">
          © {new Date().getFullYear()} COMPGame | All Rights Reserved |
          <Link href="/about" className="ml-1 underline hover:text-[#a16207]">
            About
          </Link>
          <span className="mx-1">|</span>
          <a href="mailto:wing-yi-chloe.wong@connect.polyu.hk" className="underline hover:text-[#a16207]">
            Contact
          </a>
        </p>
      </div>
    </footer>
  )
}
