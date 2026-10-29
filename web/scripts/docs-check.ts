// Fails (exit 1) when docs/knowledge/ drifts from the code. Usage: npm run docs:check
// Offline checks come from docs-lib (also run by src/lib/docs.test.ts). This script adds the git check:
// a source file mapped in MANIFEST.json that changed against origin/main (committed or not) needs its doc
// and 17-CHANGELOG.md to change too. The "commits" block is refreshed by docs:generate but not compared,
// because it can never contain the commit that is being made.
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { checkDocs, facts, generators, KB, loadDocs, manifestProblems, ROOT } from "./docs-lib";

const problems = checkDocs(loadDocs(), generators(), facts());
const git = (args: string[]) => {
  try {
    return execFileSync("git", args, { cwd: ROOT, encoding: "utf8" }).split(/\r?\n/).filter(Boolean);
  } catch {
    return null;
  }
};
const base = git(["merge-base", "HEAD", "origin/main"])?.[0];
if (base) {
  const changed = [...new Set([...(git(["diff", "--name-only", base]) ?? []), ...(git(["ls-files", "--others", "--exclude-standard"]) ?? [])])];
  const manifest = JSON.parse(readFileSync(join(KB, "MANIFEST.json"), "utf8")) as Record<string, string[]>;
  problems.push(...manifestProblems(manifest, changed));
} else {
  console.log("note: no origin/main to compare against; MANIFEST change check skipped");
}
if (problems.length) {
  for (const p of problems) console.log(`FAIL ${p}`);
  console.log(`docs:check FAILED (${problems.length} problem(s))`);
  process.exit(1);
}
console.log("docs:check PASS");
