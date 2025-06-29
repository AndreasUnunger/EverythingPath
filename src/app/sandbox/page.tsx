"use client"

import handleFileUpload from "./seedSpells"

export default function Sandbox() {

  return (
    <button type="button" onClick={handleFileUpload} >seed spells</button>
  )
}
