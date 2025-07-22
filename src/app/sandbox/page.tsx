"use client"

import { useQuery } from "convex/react";
import { api } from "@convex/_generated/api";

export default function Sandbox() {
  const spellCount = useQuery(api.spell.getCount);

  return (
    <div>Spell count: {spellCount}</div>
  )
}
