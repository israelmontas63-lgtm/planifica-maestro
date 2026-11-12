// worker/services/registroHerramientas.js
// Registro central de herramientas con niveles de riesgo (1, 2, 3), validación de parámetros,
// protección contra prompt injection y bitácora de auditoría sin secretos.

export const NIVEL_RIESGO = Object.freeze({
  NIVEL_1_CONSULTA: 1,
  NIVEL_2_OPERACION_REVERSIBLE: 2,
  NIVEL_3_ACCION_CON_IMPACTO: 3,
});

const PATRONES_INYECCION = [
  /ignore\s+(all\s+)?previous\s+instructions/i,
  /ignora\s+(todas\s+)?las\s+instrucciones\s+anteriores/i,
  /system\s+override|modo\s+desarrollador|jailbreak/i,
  /ejecuta\s+(comando|shell|bash|powershell|cmd)/i,
  /autorizaci[oó]n\s+autom[aá]tica|bypass\s+auth/i,
];

export function detectarPromptInjection(texto = "") {
  const s = String(texto || "");
  for (const rx of PATRONES_INYECCION) {
    if (rx.test(s)) {
      return { detectado: true, patron: rx.source };
    }
  }
  return { detectado: false, patron: null };
}

export function crearRegistroHerramientas() {
  const herramientas = new Map();
  const bitacoraAuditoria = [];
  const ejecucionesIdempotentes = new Map();

  function registrar(definicion) {
    if (!definicion || !definicion.nombre || typeof definicion.ejecutar !== "function") {
      throw new Error("Definición de herramienta inválida: requiere nombre y función ejecutar.");
    }
    const entrada = {
      nombre: String(definicion.nombre),
      descripcion: String(definicion.descripcion || ""),
      parametros: definicion.parametros || {},
      esquemaEntrada: definicion.esquemaEntrada || { required: [] },
      resultadoEsperado: String(definicion.resultadoEsperado || ""),
      permisos: Array.isArray(definicion.permisos) ? definicion.permisos : ["docente"],
      habilitada: definicion.habilitada !== false,
      efectosSecundarios: Boolean(definicion.efectosSecundarios),
      nivelRiesgo: Number(definicion.nivelRiesgo || NIVEL_RIESGO.NIVEL_1_CONSULTA),
      tiempoMaximoMs: Number(definicion.tiempoMaximoMs || 10000),
      politicaErrores: String(definicion.politicaErrores || "falla_cerrada"),
      criterioVerificacion: typeof definicion.criterioVerificacion === "function"
        ? definicion.criterioVerificacion
        : (res) => Boolean(res && res.ok !== false),
      ejecutar: definicion.ejecutar,
    };
    herramientas.set(entrada.nombre, entrada);
    return entrada;
  }

  function obtener(nombre) {
    return herramientas.get(nombre) || null;
  }

  function listarPublicas() {
    return Array.from(herramientas.values()).map(({ ejecutar, criterioVerificacion, ...meta }) => meta);
  }

  function validarParametros(def, params = {}) {
    if (!params || typeof params !== "object" || Array.isArray(params)) {
      return { valido: false, motivo: "Los parámetros deben ser un objeto JSON." };
    }
    const requeridos = def.esquemaEntrada?.required || [];
    for (const campo of requeridos) {
      if (params[campo] === undefined || params[campo] === null || params[campo] === "") {
        return { valido: false, motivo: `Falta parámetro obligatorio: ${campo}` };
      }
    }
    // Bloqueo explícito de ejecución arbitraria de comandos de sistema
    const textoParams = JSON.stringify(params);
    if (/(?:^|[\s"'`])(rm\s+-rf|del\s+\/f|format\s+[a-z]:|powershell\s+-enc)/i.test(textoParams)) {
      return { valido: false, motivo: "Parámetros bloqueados por política de ejecución segura." };
    }
    return { valido: true };
  }

  async function ejecutar(nombre, params = {}, contexto = {}) {
    const inicio = Date.now();
    const def = herramientas.get(nombre);
    const origen = String(contexto.origenFuente || "usuario");
    const esOrigenExterno = ["web", "documento", "correo", "archivo"].includes(origen);

    const registrarEvento = ({ estado, autorizado, fallo = null }) => {
      bitacoraAuditoria.push({
        timestamp: new Date().toISOString(),
        usuarioId: contexto.usuarioId || "anonimo",
        dispositivoId: contexto.dispositivoId || "pwa",
        herramienta: nombre,
        nivelRiesgo: def ? def.nivelRiesgo : null,
        autorizacion: autorizado ? "APROBADA" : "DENEGADA",
        origenFuente: origen,
        resultado: estado,
        fallo,
        duracionMs: Date.now() - inicio,
      });
    };

    if (!def) {
      registrarEvento({ estado: "ERROR", autorizado: false, fallo: "HERRAMIENTA_NO_REGISTRADA" });
      return { ok: false, codigo: "HERRAMIENTA_NO_REGISTRADA", mensaje: `Herramienta desconocida: ${nombre}` };
    }

    if (!def.habilitada) {
      registrarEvento({ estado: "BLOQUEADO", autorizado: false, fallo: "HERRAMIENTA_DESHABILITADA" });
      return { ok: false, codigo: "HERRAMIENTA_DESHABILITADA", mensaje: `La herramienta '${nombre}' está deshabilitada.` };
    }

    // 0. Verificar identidad y permisos desde contexto controlado por el servidor
    const requiereChequeoPermiso = Array.isArray(contexto.permisosUsuario)
      || def.nivelRiesgo >= NIVEL_RIESGO.NIVEL_2_OPERACION_REVERSIBLE
      || def.permisos.some((p) => p !== "docente");

    if (requiereChequeoPermiso && (contexto.usuarioAutenticado === false || !contexto.usuarioId)) {
      registrarEvento({ estado: "RECHAZADO", autorizado: false, fallo: "USUARIO_NO_AUTENTICADO" });
      return { ok: false, codigo: "USUARIO_NO_AUTENTICADO", mensaje: "Se requiere usuario autenticado para ejecutar esta herramienta." };
    }

    if (Array.isArray(contexto.permisosUsuario) || def.permisos.some((p) => p !== "docente")) {
      const permisosUser = Array.isArray(contexto.permisosUsuario) ? contexto.permisosUsuario : [];
      const tieneTodos = def.permisos.every((p) => permisosUser.includes(p) || permisosUser.includes("*"));
      if (!tieneTodos) {
        registrarEvento({ estado: "DENEGADO", autorizado: false, fallo: "PERMISO_DENEGADO" });
        return {
          ok: false,
          codigo: "PERMISO_DENEGADO",
          mensaje: `El usuario no posee los permisos requeridos (${def.permisos.join(", ")}) para '${nombre}'.`,
        };
      }
    }

    // 1. Validar parámetros en servidor
    const validacion = validarParametros(def, params);
    if (!validacion.valido) {
      registrarEvento({ estado: "RECHAZADO", autorizado: false, fallo: validacion.motivo });
      return { ok: false, codigo: "PARAMETROS_INVALIDOS", mensaje: validacion.motivo };
    }

    // 2. Protección contra prompt injection en parámetros o fuente externa
    const chequeoInyeccion = detectarPromptInjection(JSON.stringify(params));
    if (chequeoInyeccion.detectado) {
      registrarEvento({ estado: "BLOQUEADO", autorizado: false, fallo: "PROMPT_INJECTION_DETECTADO" });
      return {
        ok: false,
        codigo: "BLOQUEO_SEGURIDAD_INYECCION",
        mensaje: "Operación bloqueada por detección de instrucción maliciosa en los datos.",
      };
    }

    // 3. Control de autorización por nivel de riesgo
    // Una fuente externa (web, documento, correo, archivo) NUNCA puede autorizar Nivel 3.
    const accionCoincide = !contexto.accionAutorizada || contexto.accionAutorizada === nombre;
    const autorizacionValida = def.nivelRiesgo < NIVEL_RIESGO.NIVEL_3_ACCION_CON_IMPACTO
      || (contexto.autorizacionExplicitaUsuario === true && !esOrigenExterno && accionCoincide);

    if (!autorizacionValida) {
      registrarEvento({ estado: "REQUIERE_AUTORIZACION", autorizado: false, fallo: "FALTA_AUTORIZACION_NIVEL_3" });
      return {
        ok: false,
        requiereAutorizacion: true,
        codigo: "REQUIERE_AUTORIZACION_EXPLICITA",
        herramienta: nombre,
        nivelRiesgo: def.nivelRiesgo,
        mensaje: `La acción '${nombre}' tiene impacto (Nivel 3) y requiere autorización explícita del usuario.`,
      };
    }

    // 3b. Idempotencia obligatoria en operaciones con efectos secundarios
    const claveIdemp = contexto.claveIdempotencia ? `${contexto.usuarioId || "anon"}:${nombre}:${contexto.claveIdempotencia}` : null;
    if (def.efectosSecundarios) {
      if (!claveIdemp) {
        registrarEvento({ estado: "RECHAZADO", autorizado: false, fallo: "FALTA_CLAVE_IDEMPOTENCIA" });
        return {
          ok: false,
          codigo: "FALTA_CLAVE_IDEMPOTENCIA",
          mensaje: `La operación con efectos secundarios '${nombre}' requiere claveIdempotencia.`,
        };
      }
      if (ejecucionesIdempotentes.has(claveIdemp)) {
        registrarEvento({ estado: "IDEMPOTENTE_OMITIDA", autorizado: true });
        return { ok: true, duplicada: true, datos: ejecucionesIdempotentes.get(claveIdemp) };
      }
    }

    // 4. Ejecución con timeout máximo y verificación posterior
    try {
      const resultado = await Promise.race([
        Promise.resolve(def.ejecutar(params, contexto)),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error(`TIMEOUT_HERRAMIENTA_${def.tiempoMaximoMs}ms`)), def.tiempoMaximoMs)
        ),
      ]);

      const verificado = def.criterioVerificacion(resultado);
      if (!verificado) {
        registrarEvento({ estado: "VERIFICACION_FALLIDA", autorizado: true, fallo: "NO_SUPERO_CRITERIO_VERIFICACION" });
        return {
          ok: false,
          codigo: "VERIFICACION_FALLIDA",
          mensaje: `La herramienta '${nombre}' ejecutó pero no superó su criterio de verificación.`,
          datos: resultado,
        };
      }

      if (def.efectosSecundarios && claveIdemp) {
        if (ejecucionesIdempotentes.size >= 500) {
          const firstKey = ejecucionesIdempotentes.keys().next().value;
          ejecucionesIdempotentes.delete(firstKey);
        }
        ejecucionesIdempotentes.set(claveIdemp, resultado);
      }

      registrarEvento({ estado: "EXITO", autorizado: true });
      return { ok: true, datos: resultado };
    } catch (err) {
      const msg = String(err?.message || err).slice(0, 200);
      registrarEvento({ estado: "ERROR", autorizado: true, fallo: msg });
      return { ok: false, codigo: "ERROR_EJECUCION_HERRAMIENTA", mensaje: msg };
    }
  }

  function obtenerAuditoria() {
    return [...bitacoraAuditoria];
  }

  return {
    registrar,
    obtener,
    listarPublicas,
    validarParametros,
    ejecutar,
    obtenerAuditoria,
  };
}
