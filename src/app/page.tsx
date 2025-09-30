"use client"

import { api as db } from "../../convex/_generated/api"
import { useMutation, useQuery } from "convex/react"

export default function Home() {
  const spellCount = useQuery(db.spell.getCount)
  const campaigns = useQuery(db.campaign.get)
  const createCampaign = useMutation(db.campaign.createCampaign);

  return (
    <>
      <main className="flex min-h-screen flex-col items-center justify-center ">
        <div className="container flex flex-col items-center justify-center gap-12 px-4 py-16">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:gap-8">
            spellcount: {spellCount}
          </div>
          <button onClick={async () => await createCampaign({ name: "ironfang", description: "the one", ownerId: "" })}>create campaign</button>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:gap-8">
            {campaigns?.map((campaign) => {
              return (
                <div key={campaign._id}>{campaign.name}</div>
              )
            })}
          </div>
        </div>
      </main>
    </>
  );
}
