"use client"

import { api as db } from "../../convex/_generated/api"
import { useQuery } from "convex/react"
import NavBar from "../components/NavBar"

export default function Home() {
  const spellCount = useQuery(db.spell.getCount)

  return (
    <>
      <NavBar />
      <main className="flex min-h-screen flex-col items-center justify-center ">
        <div className="container flex flex-col items-center justify-center gap-12 px-4 py-16">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:gap-8">
            {spellCount}
          </div>
        </div>
      </main>
    </>
  );
}
