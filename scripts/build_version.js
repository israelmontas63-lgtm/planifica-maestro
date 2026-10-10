import fs from "node:fs";
import { execSync } from "node:child_process";
import path from "node:path";

let commit = process.env.CF_PAGES_COMMIT_SHA || process.env.COMMIT_SHA || "unknown";
if (commit === "unknown") {
  try {
    commit = execSync("git rev-parse --short HEAD").toString().trim();
  } catch (e) {
    commit = "cf-build";
  }
} else if (commit.length > 7) {
  commit = commit.slice(0, 7);
}

const versionData = {
  commit,
  fecha: new Date().toISOString(),
  nombre: "Planifica Maestro PWA"
};

const distDir = path.resolve("client/dist");
if (!fs.existsSync(distDir)) {
  fs.mkdirSync(distDir, { recursive: true });
}

const targetPath = path.resolve(distDir, "version.json");
fs.writeFileSync(targetPath, JSON.stringify(versionData, null, 2));
console.log(`📌 [Build] client/dist/version.json generado con commit: ${commit}`);
