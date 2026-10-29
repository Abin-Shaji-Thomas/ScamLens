// Rewrites every GENERATED block and FACT in docs/knowledge/ from the code. Usage: npm run docs:generate
import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { apply, facts, generators, KB, loadDocs, ROOT } from "./docs-lib";

const gitLog = execFileSync("git", ["log", "--format=%ad|%s", "--date=short"], { cwd: ROOT, encoding: "utf8" });
const gens = generators({ gitLog });
const fx = facts();
let changed = 0;
for (const d of loadDocs()) {
  const next = apply(d.text, gens, fx);
  if (next !== d.text) {
    writeFileSync(join(KB, d.name), next);
    changed++;
    console.log(`updated ${d.name}`);
  }
}
console.log(`docs:generate done (${changed} file(s) changed)`);
