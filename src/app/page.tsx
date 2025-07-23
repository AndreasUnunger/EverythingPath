"use client"

import { api as db } from "../../convex/_generated/api"
import { useQuery } from "convex/react"
import { SignedIn, SignedOut, SignInButton, UserButton } from "@clerk/nextjs";

export default function Home() {
  const spellCount = useQuery(db.spell.getCount)

  return (
    <>
      <header className="z-[100] h-[--m-top] fixed top-0 left-0 w-full flex items-center bg-white/80 sky-50 backdrop-blur-xl border-b border-slate-200">
        <div className="container flex flex-col items-center justify-center gap-12 p-4">
          <div className="grid text-white gap-12 ">
            <SignedOut>
              <SignInButton />
            </SignedOut>
            <SignedIn>
              <UserButton />
            </SignedIn>
          </div>
        </div>
      </header>
      <main className="flex min-h-screen flex-col items-center justify-center -white">
        <div className="container flex flex-col items-center justify-center gap-12 px-4 py-16">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:gap-8">
            {spellCount}
          </div>
        </div>
      </main>
    </>
  );
}
