import fs from "node:fs";
import { execSync } from "node:child_process";

if (!fs.existsSync("client/node_modules/vite")) {
  console.log("📦 [Build] Instalando dependencias del cliente PWA en entorno limpio...");
  execSync("npm ci --prefix client", { stdio: "inherit" });
} else {
  console.log("⚡ [Build] Dependencias de client ya instaladas, omitiendo instalación.");
}
