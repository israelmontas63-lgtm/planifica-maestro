/**
 * scripts/agente_local_windows.mjs
 *
 * Prototipo de agente local acompañante para Windows (Fase H).
 * NO ejecuta shell arbitrario ni modifica archivos fuera del directorio autorizado.
 * Requiere instalación/ejecución local explícita por el usuario y configuración
 * de Durable Objects (`DISPOSITIVO_HUB`) en Cloudflare para enlazarse en vivo.
 */

import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { spawn } from "node:child_process";

export const ACCIONES_WINDOWS_PERMITIDAS = Object.freeze([
  "estado_dispositivo",
  "crear_documento_autorizado",
  "abrir_aplicacion_permitida"
]);

export const APLICACIONES_PERMITIDAS = Object.freeze({
  notepad: { comando: "notepad.exe", args: [] },
  calc: { comando: "calc.exe", args: [] },
  mspaint: { comando: "mspaint.exe", args: [] }
});

export function validarNombreArchivoSeguro(nombre = "") {
  const limpio = String(nombre || "").trim();
  if (!limpio || limpio.length > 120) {
    throw new Error("Nombre de archivo inválido o demasiado largo.");
  }
  if (limpio.includes("..") || limpio.includes("/") || limpio.includes("\\") || limpio.includes(":")) {
    throw new Error("Ruta de archivo no permitida: solo se acepta nombre de archivo simple.");
  }
  if (!/^[a-zA-Z0-9._-]+\.(txt|md)$/i.test(limpio)) {
    throw new Error("Solo se permiten archivos .txt o .md con caracteres alfanuméricos, guiones o puntos.");
  }
  return limpio;
}

export async function ejecutarAccionLocalWindows(solicitud = {}, opciones = {}) {
  const { accion, parametros = {}, autorizadoPorUsuario = false } = solicitud;
  const directorioBase = opciones.directorioBase || path.join(os.homedir(), "Documents", "PlanificaMaestro");
  const spawnFn = opciones.spawnFn || spawn;

  if (!ACCIONES_WINDOWS_PERMITIDAS.includes(accion)) {
    return {
      ok: false,
      bloqueado: true,
      error: `Acción no permitida en allowlist de Windows: '${String(accion || "")}'.`
    };
  }

  if (accion === "estado_dispositivo") {
    return {
      ok: true,
      accion,
      datos: {
        plataforma: os.platform(),
        release: os.release(),
        arquitectura: os.arch(),
        hostname: os.hostname(),
        uptimeSegundos: Math.floor(os.uptime()),
        memoriaLibreMB: Math.round(os.freemem() / (1024 * 1024)),
        memoriaTotalMB: Math.round(os.totalmem() / (1024 * 1024))
      }
    };
  }

  if (!autorizadoPorUsuario) {
    return {
      ok: false,
      bloqueado: true,
      requiereAutorizacion: true,
      error: `La acción '${accion}' requiere autorización explícita del usuario.`
    };
  }

  if (accion === "crear_documento_autorizado") {
    const nombreSeguro = validarNombreArchivoSeguro(parametros.nombreArchivo);
    const contenido = String(parametros.contenido ?? "");
    const baseResuelta = path.resolve(directorioBase);
    const rutaDestino = path.resolve(baseResuelta, nombreSeguro);

    if (!rutaDestino.startsWith(baseResuelta + path.sep)) {
      throw new Error("Violación de confinamiento de directorio.");
    }

    fs.mkdirSync(baseResuelta, { recursive: true });
    fs.writeFileSync(rutaDestino, contenido, "utf8");
    const verificado = fs.existsSync(rutaDestino);

    return {
      ok: verificado,
      accion,
      datos: {
        ruta: rutaDestino,
        bytesEscritos: Buffer.byteLength(contenido, "utf8"),
        verificado
      }
    };
  }

  if (accion === "abrir_aplicacion_permitida") {
    const appKey = String(parametros.aplicacion || "").trim().toLowerCase();
    const spec = APLICACIONES_PERMITIDAS[appKey];
    if (!spec) {
      return {
        ok: false,
        bloqueado: true,
        error: `Aplicación '${appKey}' fuera de la lista permitida (${Object.keys(APLICACIONES_PERMITIDAS).join(", ")}).`
      };
    }

    const child = spawnFn(spec.comando, spec.args, {
      detached: true,
      stdio: "ignore",
      shell: false
    });
    if (child && typeof child.unref === "function") {
      child.unref();
    }

    return {
      ok: true,
      accion,
      datos: {
        aplicacion: appKey,
        comando: spec.comando,
        pid: child?.pid ?? null
      }
    };
  }

  return { ok: false, error: "Acción no manejada." };
}

if (import.meta.url === `file://${process.argv[1]?.replace(/\\/g, "/")}`) {
  ejecutarAccionLocalWindows({ accion: "estado_dispositivo" }).then((estado) => {
    console.log(JSON.stringify({
      agente: "planifica-maestro-windows-local",
      estadoHub: "requiere_durable_object_y_token_hmac",
      accionesPermitidas: ACCIONES_WINDOWS_PERMITIDAS,
      estado
    }, null, 2));
  });
}
