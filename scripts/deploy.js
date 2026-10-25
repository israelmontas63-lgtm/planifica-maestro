import fs from "node:fs";
import { execSync } from "node:child_process";
import path from "node:path";

// Cargar CLOUDFLARE_API_TOKEN de forma segura sin imprimir secretos
let token = process.env.CLOUDFLARE_API_TOKEN;
const deployLocalPath = path.resolve(process.cwd(), ".env.deploy.local");
const devVarsPath = path.resolve(process.cwd(), ".dev.vars");

if (!token && fs.existsSync(deployLocalPath)) {
  const content = fs.readFileSync(deployLocalPath, "utf8");
  const match = content.match(/^CLOUDFLARE_API_TOKEN\s*=\s*(.+)$/m);
  if (match) {
    token = match[1].trim().replace(/^["']|["']$/g, "");
  }
}

if (!token && fs.existsSync(devVarsPath)) {
  const content = fs.readFileSync(devVarsPath, "utf8");
  const match = content.match(/^CLOUDFLARE_API_TOKEN\s*=\s*(.+)$/m);
  if (match) {
    token = match[1].trim().replace(/^["']|["']$/g, "");
  }
}

if (!token) {
  console.error("❌ CLOUDFLARE_API_TOKEN no encontrado en variables de entorno, .env.deploy.local ni .dev.vars");
  process.exit(1);
}

console.log("🚀 [AutoDeploy] Compilando cliente PWA...");
execSync("npm run build --prefix client", { stdio: "inherit" });

// Escribir dist/version.json (Fase 1.3: marca de versión oficial sin tocar el código de la app)
let commitHash = "unknown";
try {
  commitHash = execSync("git rev-parse --short HEAD").toString().trim();
} catch (e) {
  // fallback si no está git disponible
}

const versionInfo = {
  commit: commitHash,
  fecha: new Date().toISOString(),
  cache_version: "planifica-maestro-v3",
  build_id: `pm-${commitHash}-${Date.now()}`,
  ambiente: "produccion",
  nombre: "Planifica Maestro PWA"
};

const versionJsonPath = path.resolve("client/dist/version.json");
fs.writeFileSync(versionJsonPath, JSON.stringify(versionInfo, null, 2));
console.log(`📌 [AutoDeploy] dist/version.json generado para commit: ${commitHash} con cache_version: planifica-maestro-v3`);

console.log("🚀 [AutoDeploy] Desplegando y activando en Cloudflare Workers al 100%...");
execSync(`npx wrangler deploy --keep-vars --message "deploy ${commitHash}"`, {
  stdio: "inherit",
  env: { ...process.env, CLOUDFLARE_API_TOKEN: token },
});

console.log("✅ [AutoDeploy] ¡Despliegue automático completado y 100% activo en producción!");
