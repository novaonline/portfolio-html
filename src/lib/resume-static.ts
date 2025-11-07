import { readFileSync, existsSync } from "node:fs";

const ROOT = new URL("../../", import.meta.url);

function readJSON(name: string) {
  return JSON.parse(readFileSync(new URL(name, ROOT), "utf-8"));
}

export const resume = process.env.RESUME_JSON
  ? JSON.parse(process.env.RESUME_JSON)
  : existsSync(new URL("resume.json", ROOT))
    ? readJSON("resume.json")
    : readJSON("resume.example.json");

export const allowedSkills: string[] =
  resume?.sections?.skills?.items?.map((s: any) => s?.name).filter(Boolean) ?? [];
