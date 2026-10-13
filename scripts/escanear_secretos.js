import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

/**
 * scripts/escanear_secretos.js
 * Escáner de seguridad y anti-fugas de credenciales.
 * Compatible con Git Hooks (pre-commit) y CI/CD (npm test).
 */

const REGLAS = [
  { nombre: 'Google Gemini API Key (AQ.*)', regex: /AQ\.[A-Za-z0-9_-]{35,}/g },
  { nombre: 'Google Gemini API Key (AIza*)', regex: /AIza[0-9A-Za-z-_]{35}/g },
  { nombre: 'Groq API Key (gsk_*)', regex: /gsk_[A-Za-z0-9_-]{40,}/g },
  { nombre: 'OpenRouter API Key (sk-or-*)', regex: /sk-or-v1-[A-Za-z0-9_-]{40,}/g },
  { nombre: 'Anthropic API Key (sk-ant-*)', regex: /sk-ant-[A-Za-z0-9_-]{40,}/g },
  { nombre: 'ElevenLabs API Key (sk_*)', regex: /sk_[a-fA-F0-9]{48}/g },
  { nombre: 'Cloudflare API Token (cfat_*)', regex: /cfat_[A-Za-z0-9_-]{30,}/g },
  { nombre: 'Tavily API Key (tvly-*)', regex: /tvly-[A-Za-z0-9_-]{30,}/g },
  { nombre: 'Supabase JWT Key', regex: /eyJhbGciOi[A-Za-z0-9_-]{80,}/g },
  { nombre: 'Clave Institucional Maestra', regex: /RD-Maestro-[0-9]{4,}/g }
];

const ARCHIVOS_IGNORADOS = new Set([
  '.dev.vars',
  'scripts/escanear_secretos.js',
  'tools/scan_bundle_keys.cjs'
]);

function obtenerArchivosGit() {
  try {
    // Si estamos en pre-commit, escanear cambios en staged
    const staged = execSync('git diff --cached --name-only --diff-filter=ACM', { encoding: 'utf8' })
      .trim()
      .split('\n')
      .filter(Boolean);
    if (staged.length > 0) return staged;
  } catch (e) {}

  // Si no hay staged o falla, listar archivos rastreados
  try {
    return execSync('git ls-files', { encoding: 'utf8' })
      .trim()
      .split('\n')
      .filter(Boolean);
  } catch (e) {
    return [];
  }
}

function escanearArchivo(rutaRelativa) {
  if (ARCHIVOS_IGNORADOS.has(rutaRelativa.replace(/\\/g, '/'))) return [];
  const rutaAbs = path.resolve(process.cwd(), rutaRelativa);
  if (!fs.existsSync(rutaAbs)) return [];
  if (fs.statSync(rutaAbs).isDirectory()) return [];

  // Omitir binarios y archivos de datos grandes
  if (/\.(pdf|docx|png|jpg|jpeg|mp3|zip|woff|woff2|lock)$/i.test(rutaRelativa)) return [];

  let contenido = '';
  try {
    contenido = fs.readFileSync(rutaAbs, 'utf8');
  } catch (e) {
    return [];
  }

  const hallazgos = [];
  const lineas = contenido.split('\n');
  lineas.forEach((linea, num) => {
    // Ignorar comentarios que mencionan patrones como ejemplo
    if (linea.includes('[OCULTO]') || linea.includes('ejemplo') || linea.includes('regex')) return;

    for (const regla of REGLAS) {
      regla.regex.lastIndex = 0;
      if (regla.regex.test(linea)) {
        hallazgos.push({
          archivo: rutaRelativa,
          linea: num + 1,
          tipo: regla.nombre
        });
      }
    }
  });
  return hallazgos;
}

export function ejecutarEscaneo() {
  // 1. Intentar gitleaks si está disponible en PATH
  try {
    execSync('gitleaks version', { stdio: 'ignore' });
    console.log('🛡️ [Gitleaks] Binario gitleaks detectado en el sistema.');
    try {
      execSync('gitleaks protect --staged --verbose', { stdio: 'inherit' });
      console.log('✅ [Gitleaks] Escaneo de gitleaks completado sin alertas.');
    } catch (glErr) {
      console.error('❌ [Gitleaks] Bloqueo: gitleaks detectó secretos en los cambios.');
      return false;
    }
  } catch (e) {
    // Gitleaks no disponible -> Usar motor nativo
  }

  // 2. Motor nativo de inspección
  console.log('🔍 [Guardia Secretos] Inspeccionando archivos en busca de credenciales...');
  const archivos = obtenerArchivosGit();
  const todosHallazgos = [];

  for (const f of archivos) {
    const res = escanearArchivo(f);
    if (res.length > 0) {
      todosHallazgos.push(...res);
    }
  }

  if (todosHallazgos.length > 0) {
    console.error('\n🚨 ALERTA CRÍTICA: Se detectaron credenciales en el código:');
    for (const h of todosHallazgos) {
      console.error(`  - ${h.tipo} en ${h.archivo}:L${h.linea} (VALOR: [OCULTO])`);
    }
    console.error('\n⚠️ OPERACIÓN ABORTADA. Elimina las credenciales antes de continuar.\n');
    return false;
  }

  console.log('✅ [Guardia Secretos] 0 secretos detectados en archivos rastreados.');
  return true;
}

// Ejecución directa por CLI
if (process.argv[1] && process.argv[1].endsWith('escanear_secretos.js')) {
  const ok = ejecutarEscaneo();
  if (!ok) process.exit(1);
}
