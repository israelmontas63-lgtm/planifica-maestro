import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";

const EXCLUDED_BY_DEFAULT = new Set([
  "test_archivos_congelados.mjs",
  "test_conmutacion_timeout.mjs",
  "test_endpoints.mjs",
  "test_error_handling.mjs",
  "test_http_extremo_a_extremo.mjs",
  "test_wikipedia.mjs"
]);

const args = process.argv.slice(2);
const testsDir = path.resolve(process.cwd(), "tests");

let testFiles = [];

const explicitFiles = args.filter((a) => !a.startsWith("--"));
const includeAll = args.includes("--all");

if (explicitFiles.length > 0) {
  testFiles = explicitFiles;
} else {
  const files = fs.readdirSync(testsDir);
  testFiles = files
    .filter((f) => (f.startsWith("test_") && f.endsWith(".mjs")) || f.endsWith(".test.mjs"))
    .filter((f) => includeAll || !EXCLUDED_BY_DEFAULT.has(f))
    .sort()
    .map((f) => path.join("tests", f));
}

if (testFiles.length === 0) {
  console.log("No se encontraron archivos de prueba para ejecutar.");
  process.exit(0);
}

const nodeArgs = [
  "--import",
  "./tests/setup_test_env.mjs",
  "--test",
  ...testFiles
];

const proc = spawn(process.execPath, nodeArgs, {
  stdio: "inherit",
  shell: false
});

proc.on("close", (code) => {
  process.exit(code ?? 0);
});
