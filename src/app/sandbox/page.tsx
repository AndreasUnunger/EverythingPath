"use client"

import { useQuery } from "convex/react";
import handleFileUpload from "./seedSpells"
import { api } from "@convex/_generated/api";

export default function Sandbox() {
  const spells = useQuery(api.spell.get);
  const spellCount = spells?.length ?? 0

  const handleClick = (_: any) => {
    if (spellCount > 0) {
      window.alert("Spells already loaded")
      return
    }
    handleFileUpload()
  }

  return (
    <button type="button" onClick={handleClick} >seed spells</button>
  )
}
