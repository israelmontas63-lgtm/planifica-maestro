/**
 * Middleware de seguridad institucional para Planifica Maestro
 * Bloquea con HTTP 401 cualquier petición no autenticada contra las APIs del backend.
 */
function authMiddleware(req, res, next) {
  // Rutas exentas de autenticación: healthcheck y verificación de credenciales
  const rutaExenta = (
    req.path === "/api/health" ||
    req.path === "/health" ||
    req.path === "/api/auth/verify" ||
    req.path === "/auth/verify"
  );

  if (rutaExenta) {
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
