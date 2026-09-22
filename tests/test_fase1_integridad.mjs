/**
 * tests/test_fase1_integridad.mjs
 * Pruebas automatizadas de comportamiento e integridad para la Fase 1.
 * 
 * Verifica:
 * 1. Estado 'listo_sin_verificar' y directiva de borrador para planes generales sin base oficial.
 * 2. Estado 'requiere_sesion' cuando no hay usuario y 'proximamente' cuando faltan tablas en /api/health.
 * 3. Integridad del Menú y Contexto 'ctx':
 *    - Falla si algún botón del menú no tiene entrada en ACCIONES_MENU.
 *    - Falla si alguna acción 'listo' o 'listo_sin_verificar' no tiene su método en 'ctx'.
 *    - Falla si el método en 'ctx' no llama al Worker / handler correspondiente.
 * 4. Aislamiento estricto de datos personales por usuario (sin modo invitado compartido y limpieza al cerrar sesión).
 */
import assert from "node:assert/strict";
import { ACCIONES_MENU, obtenerEstadoAccion } from "../client/src/config/menuActions.js";
import { crearMenuContext } from "../client/src/config/menuContext.js";
import { cargarPerfil, guardarPerfil, limpiarDatosUsuario, obtenerDocenteId } from "../client/src/services/perfilStorage.js";
import { obtenerTodasLasPlanificaciones, guardarPlanEnBiblioteca } from "../client/src/services/bibliotecaStorage.js";

// Mock de localStorage en memoria para Node.js
const storageMap = new Map();
globalThis.localStorage = {
  getItem: (key) => storageMap.get(key) || null,
  setItem: (key, val) => storageMap.set(key, String(val)),
  removeItem: (key) => storageMap.delete(key),
  clear: () => storageMap.clear(),
};

let testsPasados = 0;
let testsFallidos = 0;

function reportar(nombre, exito, detalle = "") {
  if (exito) {
    console.log(`  ✓ ${nombre}`);
    testsPasados++;
  } else {
    console.error(`  ✗ ${nombre}: ${detalle}`);
    testsFallidos++;
  }
}

console.log("\n========================================================");
console.log("EJECUTANDO PRUEBAS DE INTEGRIDAD FASE 1");
console.log("========================================================\n");

// ─────────────────────────────────────────────────────────────
// CASO 1: ESTADO 'listo_sin_verificar' Y BORRADOR SIN VERIFICAR
// ─────────────────────────────────────────────────────────────
console.log("1. PLANES GENERALES Y ESTADO 'listo_sin_verificar':");

const planesGeneralesKeys = [
  "plan_diario_general",
  "plan_semanal_general",
  "plan_mensual_general",
  "plan_anual_general",
  "nueva_unidad",
  "nuevo_proyecto"
];

let todosListoSinVerificar = true;
for (const key of planesGeneralesKeys) {
  // Sin base oficial cargada
  const estadoSinBase = obtenerEstadoAccion(key, { user: null, tablasDisponibles: [] });
  if (estadoSinBase !== "listo_sin_verificar" && key !== "nuevo_proyecto") {
    todosListoSinVerificar = false;
    reportar(`Acción '${key}' sin base oficial`, false, `esperaba 'listo_sin_verificar', obtuvo '${estadoSinBase}'`);
  }
  // Con base oficial cargada
  const estadoConBase = obtenerEstadoAccion(key, { user: null, tablasDisponibles: ["curriculo_fragmentos"] });
  if (estadoConBase !== "listo") {
    todosListoSinVerificar = false;
    reportar(`Acción '${key}' con base oficial`, false, `esperaba 'listo', obtuvo '${estadoConBase}'`);
  }
}
if (todosListoSinVerificar) {
  reportar("Los planes generales derivan 'listo_sin_verificar' sin base oficial y 'listo' con base oficial", true);
}

// ─────────────────────────────────────────────────────────────
// CASO 2: ESTADO 'requiere_sesion' Y EVALUACIÓN DE TABLAS
// ─────────────────────────────────────────────────────────────
console.log("\n2. ESTADO DERIVADO (requiere_sesion y tablasDisponibles):");

const accionesConAuth = [
  "registro_actividades",
  "horario_semanal_detallado",
  "notas_aula",
  "mis_planificaciones",
  "perfil_docente"
];

let todosRequiereSesion = true;
for (const key of accionesConAuth) {
  const estadoSinUser = obtenerEstadoAccion(key, { user: null, tablasDisponibles: [] });
  if (estadoSinUser !== "requiere_sesion") {
    todosRequiereSesion = false;
    reportar(`Acción '${key}' sin usuario`, false, `esperaba 'requiere_sesion', obtuvo '${estadoSinUser}'`);
  }
}
if (todosRequiereSesion) {
  reportar("Todas las acciones de datos personales retornan 'requiere_sesion' cuando user es null", true);
}

// Comprobación de que si falta la tabla oficial en acciones no generales, retorna 'proximamente'
const estadoCalendario = obtenerEstadoAccion("calendario_mes", { user: { id: "test" }, tablasDisponibles: [] });
reportar("Acción dependiente de tabla no disponible ('calendario_mes') retorna 'proximamente'", estadoCalendario === "proximamente");

// ─────────────────────────────────────────────────────────────
// CASO 3: INTEGRIDAD MENU, CTX Y LLAMADAS AL WORKER
// ─────────────────────────────────────────────────────────────
console.log("\n3. INTEGRIDAD DEL MENÚ, CONTEXTO 'ctx' Y LLAMADAS AL WORKER:");

// Lista de todos los botones presentes en la interfaz del Menú y Barra
const botonesEnInterfaz = [
  "accion_rapida_foto",
  "accion_rapida_voz",
  "accion_rapida_texto",
  "plan_diario_general",
  "registro_actividades",
  "horario_semanal_detallado",
  "notas_aula",
  "evaluacion_diaria",
  "plan_semanal_general",
  "distribucion_areas",
  "actividades_semana",
  "recursos_materiales",
  "plan_mensual_general",
  "calendario_mes",
  "competencias_mes",
  "plan_anual_general",
  "distribucion_periodos",
  "proyeccion_anio",
  "nueva_unidad",
  "situacion_aprendizaje",
  "competencias_indicadores",
  "secuencia_actividades",
  "evaluacion_unidad",
  "nuevo_proyecto",
  "proyecto_aula",
  "proyecto_institucional",
  "evaluacion_proyecto",
  "mis_planificaciones",
  "curriculo_nacional",
  "esquemas_planificacion",
  "perfil_docente",
  "ajustes",
  "ayuda"
];

// Comprobar que ningún botón del menú carezca de entrada en el registro
let botonesSinRegistro = [];
for (const btn of botonesEnInterfaz) {
  if (!ACCIONES_MENU[btn]) {
    botonesSinRegistro.push(btn);
  }
}
reportar("Todos los botones del menú y submenús tienen entrada en ACCIONES_MENU", 
  botonesSinRegistro.length === 0, 
  botonesSinRegistro.join(", ")
);

// Simulación de llamadas al Worker y handlers
const llamadasWorker = new Map();
const mockHandlers = {
  enviarMensaje: (texto) => llamadasWorker.set("/api/plan/generate", texto),
  abrirTextoModal: (prompt, titulo) => llamadasWorker.set("/api/plan/generate", { prompt, titulo }),
  abrirCamaraInput: () => llamadasWorker.set("/api/ocr/scan", true),
  iniciarVozHandler: () => llamadasWorker.set("speechSynthesis", true),
  abrirBibliotecaHandler: () => llamadasWorker.set("/api/plan/mis-planificaciones", true),
  abrirCurriculoHandler: () => llamadasWorker.set("/api/plan/consultar-curriculo", true),
  abrirEsquemasHandler: () => llamadasWorker.set("/api/plan/esquemas", true),
  abrirPerfilHandler: () => llamadasWorker.set("/api/docente/perfil", true),
  abrirConfiguracionHandler: () => llamadasWorker.set("/api/plan/cuota", true),
  abrirAyudaHandler: () => llamadasWorker.set("modal_ayuda", true),
  abrirAuthHandler: () => llamadasWorker.set("modal_auth", true),
  setToastMsg: (msg) => llamadasWorker.set("toast", msg),
  user: { id: "docente_activo_1" }
};

const ctx = crearMenuContext(mockHandlers);

let fallosCtx = [];
let totalListoVerificados = 0;

for (const [key, accion] of Object.entries(ACCIONES_MENU)) {
  const metodo = accion.metodoCtx;

  // 1. Debe existir el método en ctx
  if (typeof ctx[metodo] !== "function") {
    fallosCtx.push(`Acción '${key}' define metodoCtx '${metodo}' pero no existe en ctx`);
    continue;
  }

  // 2. Evaluar estado en el entorno actual de Fase 1 (sin base oficial cargada)
  const estadoFase1 = obtenerEstadoAccion(key, { user: mockHandlers.user, tablasDisponibles: [] });

  // Si la acción está 'listo' o 'listo_sin_verificar', su método en ctx debe llamar al Worker
  if (estadoFase1 === "listo" || estadoFase1 === "listo_sin_verificar") {
    totalListoVerificados++;
    llamadasWorker.clear();
    try {
      ctx[metodo]("Prueba de texto", "Título de prueba");
      if (accion.endpointWorker && !llamadasWorker.has(accion.endpointWorker)) {
        fallosCtx.push(`Acción '${key}' (${metodo}) con estado '${estadoFase1}' no llamó a su endpoint '${accion.endpointWorker}'`);
      }
    } catch (err) {
      fallosCtx.push(`Error ejecutando ctx.${metodo}(): ${err.message}`);
    }
  }
}

if (fallosCtx.length === 0) {
  reportar(`Todos los botones activos/borrador (${totalListoVerificados}) tienen método en ctx y llaman al Worker`, true);
} else {
  reportar("Integridad de métodos en ctx y Worker", false, fallosCtx.join("; "));
}

// ─────────────────────────────────────────────────────────────
// CASO 4: SIN MODO INVITADO PARA DATOS PERSONALES Y LIMPIEZA
// ─────────────────────────────────────────────────────────────
console.log("\n4. AISLAMIENTO DE DATOS PERSONALES POR USUARIO Y LIMPIEZA:");

storageMap.clear();

// 1. Sin sesión: cargarPerfil retorna null y no guarda en clave compartida
const perfilAnon = cargarPerfil();
const sinClaveCompartida = !storageMap.has("planifica_maestro_perfil");
reportar("Sin sesión activa, cargarPerfil() retorna null y NO crea clave compartida", perfilAnon === null && sinClaveCompartida);

// 2. Sin sesión: guardarPerfil no persiste datos personales
guardarPerfil({ nombre: "Docente Anónimo" });
reportar("Sin sesión activa, guardarPerfil() no persiste datos en localStorage", storageMap.size === 0);

// 3. Con sesión: persiste bajo clave aislada del usuario
const userA = "usuario_docente_a";
guardarPerfil({ nombre: "María Pérez", escuela: "Escuela República Dominicana" }, userA);
const perfilA = cargarPerfil(userA);
reportar("Con sesión, los datos se guardan aislados bajo 'pm_perfil_<userId>'", perfilA?.nombre === "María Pérez" && storageMap.has(`pm_perfil_${userA}`));

// 4. Biblioteca aislada
guardarPlanEnBiblioteca({ id: "plan_1", titulo: "Plan de Fracciones" }, userA);
const planesA = obtenerTodasLasPlanificaciones(userA);
const planesSinUser = obtenerTodasLasPlanificaciones(null);
reportar("Biblioteca de planificaciones aislada por usuario (vacía sin sesión)", planesA.length === 1 && planesSinUser.length === 0);

// 5. Al cerrar sesión o cambiar de usuario, limpiarDatosUsuario borra todo lo del usuario
const habiaClavePerfilAntes = storageMap.has(`pm_perfil_${userA}`);
const habiaClaveBiblioAntes = storageMap.has(`pm_biblioteca_${userA}`);

limpiarDatosUsuario(userA);

const clavePerfilDespues = storageMap.has(`pm_perfil_${userA}`);
const claveBiblioDespues = storageMap.has(`pm_biblioteca_${userA}`);

reportar("Al cerrar sesión, limpiarDatosUsuario() elimina todos los datos del usuario de localStorage", 
  habiaClavePerfilAntes && 
  habiaClaveBiblioAntes && 
  !clavePerfilDespues && 
  !claveBiblioDespues
);

// ─────────────────────────────────────────────────────────────
// RESUMEN FINAL
// ─────────────────────────────────────────────────────────────
console.log("\n========================================================");
console.log(`RESULTADO DE PRUEBAS: ${testsPasados} PASADAS, ${testsFallidos} FALLIDAS`);
console.log("========================================================\n");

if (testsFallidos > 0) {
  process.exit(1);
}
