const crypto = require("crypto");

function timingSafeEqualStr(a, b) {
  if (typeof a !== "string" || typeof b !== "string") return false;
  const aBuf = Buffer.from(a);
  const bBuf = Buffer.from(b);
  if (aBuf.length !== bBuf.length) return false;
  return crypto.timingSafeEqual(aBuf, bBuf);
}

/**
 * Middleware de seguridad institucional para Planifica Maestro
 * Bloquea con HTTP 401 cualquier petición no autenticada contra las APIs del backend.
 */
function authMiddleware(req, res, next) {
  // 1. Verificación del modo DUEÑO / ADMINISTRADOR en CADA petición del servidor
  const ownerHeader = req.headers["x-owner-key"];
  const expectedOwnerKey = process.env.OWNER_MASTER_KEY;
  if (
    expectedOwnerKey &&
    expectedOwnerKey.trim() !== "ESCRIBE_AQUI_TU_LLAVE_SECRETA" &&
    ownerHeader &&
    typeof ownerHeader === "string" &&
    timingSafeEqualStr(ownerHeader.trim(), expectedOwnerKey.trim())
  ) {
    req.isOwner = true;
  } else {
    req.isOwner = false;
  }

  // Rutas exentas de autenticación general: healthcheck y verificación de credenciales
  const rutaExenta = (
    req.path === "/api/health" ||
    req.path === "/health" ||
    req.path === "/api/auth/verify" ||
    req.path === "/auth/verify" ||
    req.path === "/api/auth/owner-verify" ||
    req.path === "/auth/owner-verify" ||
    req.path === "/api/auth/owner-stats" ||
    req.path === "/auth/owner-stats" ||
    req.path === "/api/plan/esquemas" ||
    req.path === "/plan/esquemas"
  );

  if (rutaExenta || req.isOwner) {
    return next();
  }

  // Si REQUIRE_ACCESS_KEY está en "false" o ACCESO_ABIERTO está en "true", se habilita la beta abierta sin barreras
  // Para reactivar la protección institucional cerrada: pon REQUIRE_ACCESS_KEY=true y ACCESO_ABIERTO=false en server/.env
  if (process.env.REQUIRE_ACCESS_KEY === "false" || process.env.ACCESO_ABIERTO === "true") {
    return next();
  }

  const expectedKey = process.env.APP_ACCESS_KEY;

  // Seguridad por defecto (Fail-Closed): si no está configurada la clave en el servidor, se bloquea todo.
  if (!expectedKey) {
    return res.status(500).json({ error: "Servidor mal configurado. Falta clave institucional." });
  }

  // Comprobar token en headers (x-app-key, x-access-token, Authorization Bearer) o query param
  let token = req.headers["x-app-key"] || req.headers["x-access-token"];
  
  if (!token && req.headers["authorization"]) {
    const parts = req.headers["authorization"].split(" ");
    if (parts.length === 2 && parts[0].toLowerCase() === "bearer") {
      token = parts[1];
    }
  }

  if (!token && req.query) {
    token = req.query.access_key;
  }

  if (!token || token.trim() !== expectedKey.trim()) {
    console.warn(`[SEGURIDAD] Petición no autorizada rechazada (401) en ${req.method} ${req.originalUrl} desde IP ${req.ip}`);
    return res.status(401).json({
      error: "Acceso no autorizado. Se requiere clave institucional en los encabezados HTTP.",
      codigo: "UNAUTHORIZED"
    });
  }

  next();
}

module.exports = authMiddleware;
