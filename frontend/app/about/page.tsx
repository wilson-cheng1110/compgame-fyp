import Image from "next/image"
import Link from "next/link"
import { Pixelify_Sans, Press_Start_2P } from "next/font/google"

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

export default function AboutPage() {
  return (
    <main className={`flex min-h-screen flex-col ${pixelifySans.variable} ${pressStart2P.variable}`}>
      {/* Header */}
      <header className="w-full bg-[#f4eba7] py-3 border-b-2 border-black">
        <div className="container mx-auto px-8 md:px-16 flex items-center justify-between">
          <Link href="/" className="flex items-center">
            <Image
              src="https://hebbkx1anhila5yf.public.blob.vercel-storage.com/logo-6j0in4cMtwP0VsfG29Fx3ycVPSyTKf.png"
              alt="COMPGame Logo"
              width={40}
              height={40}
              className="mr-3"
            />
            <span className="font-press-start-2p text-black text-xl">COMPGame</span>
          </Link>

          <Link href="/signup">
            <button className="bg-[#facc15] border-2 border-[#a16207] px-5 py-2 font-pixelify-sans text-base font-bold hover:bg-[#FDE047] transition-colors">
              Sign Up
            </button>
          </Link>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 bg-white">
        <div className="container mx-auto px-8 md:px-16 py-12">
          <h1 className="font-press-start-2p text-3xl mb-8 text-center">About COMPGame</h1>

          <div className="max-w-3xl mx-auto bg-[#f8f9fa] p-8 rounded-lg shadow-md">
            <h2 className="font-press-start-2p text-xl mb-4">Our Mission</h2>
            <p className="font-pixelify-sans mb-6">
              COMPGame was created as a final-year project to change how computer science concepts are taught and learned through flipped classrooms. By leveraging gamification principles, we created an interactive platform that makes complex CS concepts more understandable, engaging, and fun.
            </p>

            <h2 className="font-press-start-2p text-xl mb-4">The Team</h2>
            <p className="font-pixelify-sans mb-6">
              COMPGame was developed by Chloe Wong at the Hong Kong Polytechnic University (PolyU) as part of the Final Year Project. The project was supervised by Dr Jeff Tang and completed in April 2025.
            </p>

            <h2 className="font-press-start-2p text-xl mb-4">Technologies</h2>
            <p className="font-pixelify-sans mb-6">
              This platform was built using Next.js, React, TypeScript, and Tailwind CSS. We've implemented various
              interactive games to teach concepts like Fitts' Law, Gestalt Principles, CPU Scheduling, and Page
              Replacement Algorithms.
            </p>

            <h2 className="font-press-start-2p text-xl mb-4">Acknowledgments</h2>
            <p className="font-pixelify-sans mb-6">
              I want to thank Pixlr and Microsoft Designer for their contributions and support throughout the development of this project.
            </p>

            <h2 className="font-press-start-2p text-xl mb-4">Contact</h2>
            <p className="font-pixelify-sans">
              Have questions, feedback, or suggestions? We'd love to hear from you! Contact us at{" "}
              <a href="mailto:wing-yi-chloe.wong@connect.polyu.hk" className="text-blue-600 hover:underline">
                wing-yi-chloe.wong@connect.polyu.hk
              </a>
              .
            </p>
          </div>

          <div className="text-center mt-12">
            <Link href="/">
              <button className="bg-[#facc15] border-2 border-[#a16207] px-5 py-2 font-pixelify-sans text-base font-bold hover:bg-[#FDE047] transition-colors">
                Back to Home
              </button>
            </Link>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="w-full bg-[#f4eba7] py-4 border-t-2 border-black">
        <div className="container mx-auto px-8 md:px-16 text-center">
          <p className="font-pixelify-sans text-black">© {new Date().getFullYear()} COMPGame | All Rights Reserved</p>
        </div>
      </footer>
    </main>
  )
}
