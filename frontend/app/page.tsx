import Image from "next/image"
import Link from "next/link"
import { Pixelify_Sans, Press_Start_2P } from "next/font/google"
import CreatorFooter from "@/components/creator-footer"

const pixelifySans = Pixelify_Sans({
  weight: ["400", "500", "600", "700"],
  subsets: ["latin"],
  display: "swap",
  variable: "--font-pixelify-sans",
})

const pressStart2P = Press_Start_2P({
  weight: ["400"],
  subsets: ["latin"],
  display: "swap",
  variable: "--font-press-start-2p",
})

export default function Home() {
  return (
    <main className={`flex min-h-screen flex-col ${pixelifySans.variable} ${pressStart2P.variable}`}>
      {/* Header with increased margins */}
      <header className="w-full bg-[#f4eba7] py-3 border-b-2 border-black">
        <div className="container mx-auto px-8 md:px-16 flex items-center justify-between">
          {/* Logo and site name with increased margin */}
          <div className="flex items-center">
            <Image
              src="https://hebbkx1anhila5yf.public.blob.vercel-storage.com/logo-6j0in4cMtwP0VsfG29Fx3ycVPSyTKf.png"
              alt="COMPGame Logo"
              width={40}
              height={40}
              className="mr-3"
            />
            <span className="font-press-start-2p text-black text-xl">COMPGame</span>
          </div>

          {/* Sign Up button with specified light yellow hover effect */}
          <div>
            <Link href="/signup">
              <button className="bg-[#facc15] border-2 border-[#a16207] px-5 py-2 font-pixelify-sans text-base font-bold hover:bg-[#fde047] transition-colors shadow-[3px_3px_0px_0px_#000]">
                Sign Up
              </button>
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 relative flex flex-col items-center justify-center">
        {/* Background Image with black overlay */}
        <div className="absolute inset-0 z-0">
          <Image
            src="https://hebbkx1anhila5yf.public.blob.vercel-storage.com/homepage_bg-qSkD6pdrDVGYQJYuVrEBgWiKqkkqvV.png"
            alt="Pixel Art Background"
            fill
            className="object-cover"
            priority
          />
          <div className="absolute inset-0 bg-black opacity-30"></div>
        </div>

        {/* Content */}
        <div className="z-10 text-center px-4 max-w-4xl text-container">
          <h2 className="font-press-start-2p text-black text-lg sm:text-xl md:text-2xl mb-6">START YOUR</h2>
          <h1 className="font-press-start-2p text-[#facc15] text-4xl sm:text-5xl md:text-6xl lg:text-7xl mb-6 text-shadow-yellow whitespace-nowrap">
            Computer Science
          </h1>
          <h2 className="font-press-start-2p text-black text-lg sm:text-xl md:text-2xl mb-12">JOURNEY</h2>

          <div className="h-[60px] sm:h-[70px] flex items-center justify-center">
            <Link href="/signup">
              <button className="get-started-btn bg-[#facc15] border-4 border-[#a16207] px-8 py-3 font-pixelify-sans font-bold text-lg sm:text-xl hover:bg-[#FDE047] transition-transform duration-200">
                Get Started
              </button>
            </Link>
          </div>
        </div>

        {/* Bottom Tagline */}
        <div className="absolute bottom-16 z-10 w-full text-center px-4 overflow-hidden">
          <p className="font-press-start-2p text-black text-xs whitespace-nowrap bg-[#f4eba7] bg-opacity-70 py-2 mx-auto inline-block px-4">
            Learn And Assess Your Knowledge Through An Interactive Game-Based Experience!
          </p>
        </div>
      </div>
      <CreatorFooter />
    </main>
  )
}
