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
    ownerHeader.trim() === expectedOwnerKey.trim()
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
    req.path === "/api/plan/esquemas" ||
    req.path === "/plan/esquemas"
  );

  if (rutaExenta || req.isOwner) {
    return next();
  }

  // Si REQUIRE_ACCESS_KEY está en "false", se desactiva temporalmente el bloqueo 401 para uso personal
  // Para reactivar la protección institucional: pon REQUIRE_ACCESS_KEY=true en server/.env
  if (process.env.REQUIRE_ACCESS_KEY === "false") {
    return next();
  }

  const expectedKey = process.env.APP_ACCESS_KEY;

  // Si no está configurada la variable en .env, permitir en modo desarrollo
  if (!expectedKey) {
    return next();
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
