"use client"

import NavBar from "~/components/NavBar";
import { api as db } from "@convex/_generated/api"
import { useQuery } from "convex/react"

export default function Home() {
  const tasks = useQuery(db.character.get)

  return (
    <>
      <NavBar />
      <main className="flex min-h-screen flex-col items-center justify-center ">
        <div className="container flex flex-col items-center justify-center gap-12 px-4 py-16">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:gap-8">
            {tasks?.map(({ _id, name }) => <div key={_id}>{name}</div>)}
          </div>
        </div>
      </main>
    </>
  );
}
