/**
 * scripts/que_cambio.mjs
 * 
 * Compara el estado actual del repositorio contra la etiqueta 'estable-camara-v1'.
 * Marca en ROJO cualquier archivo congelado que haya sido modificado.
 */

import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const RED = "\x1b[31;1m";
const GREEN = "\x1b[32;1m";
const YELLOW = "\x1b[33;1m";
const CYAN = "\x1b[36;1m";
const RESET = "\x1b[0m";

console.log(`${CYAN}======================================================================${RESET}`);
console.log(`${CYAN}REPORTE DE CONTROL DE CAMBIOS: diff contra etiqueta 'estable-camara-v1'${RESET}`);
console.log(`${CYAN}======================================================================${RESET}\n`);

// Cargar lista de archivos congelados
const congeladosPath = path.resolve(process.cwd(), "tests/congelados.json");
let congelados = {};
if (fs.existsSync(congeladosPath)) {
  congelados = JSON.parse(fs.readFileSync(congeladosPath, "utf8"));
}

const listaCongelados = Object.keys(congelados);

let diffStat = "";
let diffNames = [];

try {
  diffStat = execSync("git diff --stat estable-camara-v1", { encoding: "utf8" }).trim();
  const rawNames = execSync("git diff --name-only estable-camara-v1", { encoding: "utf8" }).trim();
  if (rawNames) {
    diffNames = rawNames.split(/\r?\n/).filter(Boolean);
  }
} catch (e) {
  console.error(`${RED}Error al ejecutar git diff contra estable-camara-v1: ${e.message}${RESET}`);
  process.exit(1);
}

// También verificar archivos modificados en working tree o staged
try {
  const statusOutput = execSync("git status --porcelain", { encoding: "utf8" }).trim();
  if (statusOutput) {
    const lines = statusOutput.split(/\r?\n/);
    for (const line of lines) {
      const parts = line.trim().split(/\s+/);
      const file = parts.slice(1).join(" ");
      if (file && !diffNames.includes(file)) {
        diffNames.push(file);
      }
    }
  }
} catch (e) {}

const congeladosModificados = diffNames.filter((file) => {
  const norm = file.replace(/\\/g, "/");
  return listaCongelados.some((c) => c.replace(/\\/g, "/") === norm);
});

if (congeladosModificados.length > 0) {
  console.log(`${RED}🚨 ¡ALERTA DE SEGURIDAD! SE DETECTARON ARCHIVOS CONGELADOS MODIFICADOS:${RESET}`);
  for (const f of congeladosModificados) {
    console.log(`  ${RED}❌ [MODIFICADO SIN AUTORIZACIÓN] -> ${f}${RESET}`);
  }
  console.log(`\n${YELLOW}Regla: Ningún archivo congelado puede modificarse sin una PROPUESTA DE CAMBIO y aprobación escrita previa.${RESET}\n`);
} else {
  console.log(`${GREEN}✅ INTEGRIDAD VERIFICADA: Ningún archivo congelado ha sido modificado.${RESET}\n`);
}

console.log(`${CYAN}--- Resumen de cambios (git diff --stat estable-camara-v1) ---${RESET}`);
if (!diffStat) {
  console.log("Árbol idéntico a la versión congelada 'estable-camara-v1' (0 cambios en archivos rastreados).\n");
} else {
  const lines = diffStat.split(/\r?\n/);
  for (const line of lines) {
    const isFrozen = listaCongelados.some((c) => line.includes(c));
    if (isFrozen) {
      console.log(`${RED}${line} [CONGELADO]${RESET}`);
    } else {
      console.log(line);
    }
  }
  console.log("");
}
