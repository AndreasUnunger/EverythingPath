"use client"

import { useOrganization } from "@clerk/nextjs"
import { api as db } from "../../convex/_generated/api"
import { useConvexAuth, useMutation, useQuery } from "convex/react"

export default function Home() {
  const spellCount = useQuery(db.spell.getCount)
  const createCampaign = useMutation(db.campaign.createCampaign);
  const { organization } = useOrganization()
  console.log(organization)
  const user = useConvexAuth();
  console.log("user on page.ts", user)
  const campaigns = useQuery(db.campaign.getCampaigns, !!organization?.id ? { organizationId: organization.id } : "skip")

  return (
    <>
      <main className="flex min-h-screen flex-col items-center justify-center ">
        <div className="container flex flex-col items-center justify-center gap-12 px-4 py-16">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:gap-8">
            spellcount: {spellCount}
          </div>
          <button onClick={async () => await createCampaign({ name: "ironfang", description: "the one", ownerId: "", organizationId: organization?.id ?? "skip" })}>create campaign</button>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:gap-8">
            {campaigns?.map((campaign) => {
              return (
                <div key={campaign._id}>{campaign.name}</div>
              )
            })}
          </div>
          <div>
            {organization?.name}
          </div>
        </div>
      </main>
    </>
  );
}
