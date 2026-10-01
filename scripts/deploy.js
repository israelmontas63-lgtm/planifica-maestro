import fs from "node:fs";
import { execSync } from "node:child_process";
import path from "node:path";

// Cargar CLOUDFLARE_API_TOKEN desde .dev.vars de forma segura si no está en el ambiente
let token = process.env.CLOUDFLARE_API_TOKEN;
const devVarsPath = path.resolve(process.cwd(), ".dev.vars");

if (!token && fs.existsSync(devVarsPath)) {
  const content = fs.readFileSync(devVarsPath, "utf8");
  const match = content.match(/^CLOUDFLARE_API_TOKEN\s*=\s*(.+)$/m);
  if (match) {
    token = match[1].trim().replace(/^["']|["']$/g, "");
  }
}

if (!token) {
  console.error("❌ CLOUDFLARE_API_TOKEN no encontrado en variables de entorno ni en .dev.vars");
  process.exit(1);
}

console.log("🚀 [AutoDeploy] Compilando cliente PWA...");
execSync("npm run build --prefix client", { stdio: "inherit" });

console.log("🚀 [AutoDeploy] Desplegando y activando en Cloudflare Workers al 100%...");
execSync("npx wrangler deploy", {
  stdio: "inherit",
  env: { ...process.env, CLOUDFLARE_API_TOKEN: token },
});

console.log("✅ [AutoDeploy] ¡Despliegue automático completado y 100% activo en producción!");
