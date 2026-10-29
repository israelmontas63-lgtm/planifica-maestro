// Traduce cualquier fallo del cerebro a una explicación concreta: componente, motivo, qué falta y opciones.
// Regla: nunca devolver "inténtalo de nuevo" / "más tarde" / "tuve dificultades" sin motivo.

export const CODIGOS_FALLO = [
  "SIN_CLAVE_IA", "CUOTA_IA_AGOTADA", "PROVEEDOR_IA_SATURADO", "IA_RESPUESTA_INVALIDA",
  "CURRICULO_SIN_DATOS", "CURRICULO_NO_CONECTADO", "CONFLICTO_AREA_TEMA", "DATOS_INCOMPLETOS",
  "CUOTA_DISPOSITIVO", "LIMITE_RITMO", "SERVIDOR_NO_RESPONDE", "ERROR_INTERNO"
];

const CATALOGO = {
  SIN_CLAVE_IA: { componente: "Servicio de IA", motivo: "No puedo planificar porque el servidor no tiene configurada la clave del servicio de IA.", queFalta: "Configurar la clave de IA (GEMINI_API_KEY) en Cloudflare.", reintentable: false },
  CUOTA_IA_AGOTADA: { componente: "Servicio de IA", motivo: "No puedo planificar ahora porque el proveedor de IA informó que se agotó su cuota de uso.", queFalta: "Que se renueve la cuota del proveedor o configurar un proveedor de respaldo.", reintentable: false },
  PROVEEDOR_IA_SATURADO: { componente: "Servicio de IA", motivo: "El servicio de IA no respondió a tiempo o devolvió un error de su lado; no es un problema de tu solicitud.", queFalta: "Que el proveedor de IA se recupere o que el proveedor de respaldo esté disponible.", reintentable: true },
  IA_RESPUESTA_INVALIDA: { componente: "Generación de la planificación", motivo: "La IA respondió, pero la planificación llegó incompleta o con formato inválido, así que no la puedo mostrar.", queFalta: "Una respuesta de la IA con todos los bloques de la planificación.", reintentable: true },
  CURRICULO_SIN_DATOS: { componente: "Currículo oficial", motivo: "No encontré ese tema en el currículo oficial que tengo cargado.", queFalta: "Un tema que exista en el currículo cargado para ese grado y área.", reintentable: false },
  CURRICULO_NO_CONECTADO: { componente: "Base de datos del currículo (Supabase)", motivo: "No puedo consultar el currículo oficial porque el servidor no logra conectarse a la base de datos.", queFalta: "La conexión a Supabase y las tablas del currículo.", reintentable: false },
  CONFLICTO_AREA_TEMA: { componente: "Interpretación del pedido", motivo: "El pedido mezcla un área con un tema que pertenece a otra.", queFalta: "Que me confirmes cuál de las dos opciones quieres.", reintentable: false },
  DATOS_INCOMPLETOS: { componente: "Interpretación del pedido", motivo: "Me faltan datos para planificar.", queFalta: "Completar los datos que faltan.", reintentable: false },
  CUOTA_DISPOSITIVO: { componente: "Cuota del dispositivo", motivo: "Este dispositivo llegó a su límite de planificaciones del período.", queFalta: "Que se reinicie la cuota del período o aumentar el límite.", reintentable: false },
  LIMITE_RITMO: { componente: "Límite de peticiones", motivo: "Se enviaron demasiadas solicitudes en poco tiempo y el servidor las limita para protegerse.", queFalta: "Esperar a que pase la ventana del límite.", reintentable: true },
  SERVIDOR_NO_RESPONDE: { componente: "Conexión con el servidor", motivo: "No pude comunicarme con el servidor.", queFalta: "Que el servidor vuelva a responder.", reintentable: true },
  ERROR_INTERNO: { componente: "Servidor", motivo: "Falló un paso interno del servidor y no pude identificar cuál con certeza.", queFalta: "Revisar el detalle técnico y los registros del servidor.", reintentable: false }
};

const lista = (a) => (Array.isArray(a) ? a.filter(Boolean) : []);

const quitarAcentos = (s) => String(s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
const fmtGrado = (g) => (/^\d+$/.test(String(g || "").trim()) ? `${String(g).trim()}.º` : String(g || "").trim());
const AREAS = ["Lengua Española", "Matemática", "Ciencias Sociales", "Ciencias de la Naturaleza"];

export function limpiarDetalle(texto) {
  return String(texto || "")
    .replace(/(key|token|apikey|api_key|authorization)\s*[=:]\s*\S+/gi, "$1=[REDACTADO]")
    .replace(/[A-Za-z0-9_\-]{28,}/g, "[REDACTADO]")
    .slice(0, 300);
}

export function clasificarFallo({ status, mensaje = "", nombre = "" } = {}) {
  const m = String(mensaje).toLowerCase();
  if (/api key|apikey|api_key|clave de ia/.test(m)) return "SIN_CLAVE_IA";
  if (/supabase|postgrest|buscar_curriculo|does not exist|rpc/.test(m)) return "CURRICULO_NO_CONECTADO";
  if (status === 429 || /quota|cuota|resource_exhausted|rate limit/.test(m)) return "CUOTA_IA_AGOTADA";
  if (nombre === "AbortError" || /timeout|timed out|tiempo agotado/.test(m) || (status >= 500 && status <= 599)) return "PROVEEDOR_IA_SATURADO";
  if (/json|parse|estructura|bloques/.test(m)) return "IA_RESPUESTA_INVALIDA";
  return "ERROR_INTERNO";
}

export function explicarFallo({ codigo, detalle = "", datos = {} } = {}) {
  const cod = CATALOGO[codigo] ? codigo : "ERROR_INTERNO";
  const base = CATALOGO[cod];
  let motivo = base.motivo;
  let queFalta = base.queFalta;
  const opciones = [];
  const d = datos || {};

  if (cod === "CURRICULO_SIN_DATOS") {
    const g = fmtGrado(d.grado);
    const donde = [d.area, g].filter(Boolean).join(" de ");
    motivo = `No encontré el tema "${d.tema || "indicado"}"${donde ? ` en ${donde}` : ""} dentro del currículo oficial cargado.`;
    for (const t of lista(d.cercanos).slice(0, 4)) {
      opciones.push({ texto: `Planificar "${t}"`, mensaje: `Quiero la planificación de ${d.area || ""} ${g} tema ${t}`.replace(/\s+/g, " ").trim() });
    }
  }
  if (cod === "CONFLICTO_AREA_TEMA") {
    const g = fmtGrado(d.grado);
    const temaEsArea = [d.areaDelTema, d.areaPedida].some((a) => a && quitarAcentos(a) === quitarAcentos(d.tema));
    if (temaEsArea) {
      motivo = `"${d.tema}" es un área, no un tema. Pediste ${d.areaPedida || "otra área"}; dime si quieres planificar ${d.areaDelTema || d.tema}${g ? ` de ${g}` : ""} o un tema de ${d.areaPedida || "esa área"}.`;
      if (d.areaDelTema) opciones.push({ texto: `Planificar ${d.areaDelTema}${g ? ` de ${g}` : ""}`, mensaje: `Muéstrame temas de ${d.areaDelTema} ${g}`.replace(/\s+/g, " ").trim() });
      if (d.areaPedida) opciones.push({ texto: `Elegir un tema de ${d.areaPedida}`, mensaje: `Muéstrame temas de ${d.areaPedida} ${g}`.replace(/\s+/g, " ").trim() });
    } else {
      motivo = `Pediste ${d.areaPedida || "un área"}, pero el tema "${d.tema || "indicado"}" corresponde a ${d.areaDelTema || "otra área"}; no los puedo mezclar sin que me confirmes cuál quieres.`;
      if (d.areaDelTema) opciones.push({ texto: `Planificar ${d.areaDelTema}${g ? ` de ${g}` : ""} tema ${d.tema || ""}`.trim(), mensaje: `Quiero la planificación de ${d.areaDelTema} ${g} tema ${d.tema || ""}`.replace(/\s+/g, " ").trim() });
      if (d.areaPedida) opciones.push({ texto: `Elegir otro tema de ${d.areaPedida}`, mensaje: `Muéstrame temas de ${d.areaPedida} ${g}`.replace(/\s+/g, " ").trim() });
    }
  }
  if (cod === "DATOS_INCOMPLETOS" && lista(d.faltantes).length) {
    const f = lista(d.faltantes);
    motivo = `Me faltan datos para planificar: ${f.join(", ")}.`;
    queFalta = `Que me indiques ${f.join(", ")}.`;
    const tail = d.tema ? ` tema ${d.tema}` : "";
    if (f.includes("grado")) {
      for (const g of ["1.º", "2.º", "3.º", "4.º", "5.º", "6.º"]) {
        opciones.push({ texto: g, mensaje: `Quiero la planificación de ${d.area || ""} ${g}${tail}`.replace(/\s+/g, " ").trim() });
      }
    } else if (f.includes("área") || f.includes("area")) {
      for (const a of AREAS) {
        opciones.push({ texto: a, mensaje: `Quiero la planificación de ${a} ${fmtGrado(d.grado)}${tail}`.replace(/\s+/g, " ").trim() });
      }
    }
  }
  if (cod === "IA_RESPUESTA_INVALIDA" && lista(d.faltantes).length) {
    queFalta = `Estos bloques de la planificación: ${lista(d.faltantes).join(", ")}.`;
  }
  if (cod === "CUOTA_DISPOSITIVO" && d.limite) {
    motivo = `Este dispositivo ya usó ${d.usadas ?? d.limite} de sus ${d.limite} planificaciones del período.`;
  }
  if (cod === "LIMITE_RITMO" && d.esperaSegundos) {
    queFalta = `Esperar unos ${d.esperaSegundos} segundos.`;
  }
  if (cod === "SERVIDOR_NO_RESPONDE") {
    motivo = d.sinInternet
      ? "No pude comunicarme con el servidor: este dispositivo no tiene conexión a internet."
      : "No pude comunicarme con el servidor: no respondió (puede estar caído o saturado).";
  }

  const partes = cod === "DATOS_INCOMPLETOS" ? [motivo] : [motivo, `Falta: ${queFalta}`];
  if (base.reintentable) partes.push("Es un fallo que puede ser momentáneo; puedes pedirlo otra vez.");
  if (opciones.length) partes.push("Opciones:");

  return {
    error: true,
    codigoError: cod,
    componente: base.componente,
    motivo,
    queFalta,
    opciones,
    reintentable: base.reintentable,
    detalleTecnico: limpiarDetalle(detalle),
    textoUsuario: partes.join(" ")
  };
}

export function describirCapacidades(capacidades = []) {
  const malas = lista(capacidades).filter((c) => c.estado === "falla" || (c.estado === "no_configurado" && !/V2|STREAMING/.test(c.componente)));
  if (!malas.length) return "Revisé mis componentes (IA, base curricular, cuotas) y todos responden bien.";
  return "Revisé mis componentes y esto no funciona: " + malas.map((c) => `${c.componente}: ${c.detalle}`).join("; ") + ".";
}

export function esPreguntaAutodiagnostico(texto) {
  const t = String(texto || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
  if (!t || t.length > 80) return false;
  return /por que (no (puedes|pudiste|funciona|me (haces|hiciste|respondes)|planific(as|aste|a)\b)|fallo|te fallo)|que (te paso|te pasa)\b|que paso con (la|mi|esa|esta) planificacion/.test(t);
}
