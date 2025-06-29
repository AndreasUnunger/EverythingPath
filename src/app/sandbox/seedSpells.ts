"use server"

import { api } from "convex/_generated/api";
import type { Doc } from "convex/_generated/dataModel";
import { fetchMutation } from "convex/nextjs";
import fs from "fs";
import path from "path";

export default async function handleFileUpload(_: any) {

  try {
    const filePath = path.join(process.cwd(), "public", "spells.json");
    const file = fs.readFileSync(filePath, "utf-8");

    const spells: Doc<"spell">[] = JSON.parse(file)

    await fetchMutation(api.spell.addManySpells, { spells });

  } catch (err) {
    console.log('failed', err)
  }
}
