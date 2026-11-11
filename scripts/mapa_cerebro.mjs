import fs from "fs"; import path from "path";
const root = process.cwd();
const seen = new Set(); const q = ["worker/index.js"];
const re = /(?:import\s+(?:[^'"]*?from\s+)?|import\(\s*|require\(\s*)['"](\.{1,2}\/[^'"]+)['"]/g;
while (q.length) {
  const f = q.pop(); if (seen.has(f)) continue; seen.add(f);
  const p = path.join(root, f); if (!fs.existsSync(p)) continue;
  const src = fs.readFileSync(p, "utf8"); let m;
  while ((m = re.exec(src))) {
    const t = path.normalize(path.join(path.dirname(f), m[1])).replace(/\\/g, "/");
    for (const c of [t, t + ".js", t + ".mjs"]) { const a = path.join(root, c); if (fs.existsSync(a) && fs.statSync(a).isFile()) { q.push(c); break; } }
  }
}
const all = [];
for (const d of ["worker", "worker/services", "worker/routes", "shared"]) for (const n of fs.readdirSync(path.join(root, d))) { if (/\.m?js$/.test(n) && !/\.test\./.test(n)) all.push(d + "/" + n); }
console.log("CONECTADOS:"); all.filter(f => seen.has(f)).forEach(f => console.log("  +", f));
console.log("\nHUERFANOS:"); all.filter(f => !seen.has(f)).forEach(f => console.log("  -", f));
