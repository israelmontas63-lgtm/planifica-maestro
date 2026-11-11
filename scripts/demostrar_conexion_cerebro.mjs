import worker from '../worker/index.js';
import dotenv from 'dotenv';
dotenv.config();

const env = {
  ...process.env,
  GEMINI_API_KEY: process.env.GEMINI_API_KEY || "fake_key_for_test",
  SUPABASE_URL: process.env.SUPABASE_URL || "https://obcjdxearmmvtihfmtaa.supabase.co",
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY || "",
  SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY || "",
  MODO_PRUEBA: "false"
};

console.log("================================================================================");
console.log(" DEMOSTRACIÓN RIGUROSA DE CONEXIÓN TOTAL DEL CEREBRO DE PLANIFICA MAESTRO");
console.log("================================================================================\n");

async function probarRuta(nombrePrueba, payload) {
  console.log(`\n>>> TEST: ${nombrePrueba}`);
  const req = new Request("https://planifica-maestro.israelmontas65.workers.dev/api/plan/generate", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-owner-key": process.env.OWNER_MASTER_KEY || "test"
    },
    body: JSON.stringify(payload)
  });

  const ctx = {
    waitUntil: (promesa) => {
      promesa.catch(e => console.warn("Background task error:", e?.message || e));
    }
  };

  const t0 = performance.now();
  const res = await worker.fetch(req, env, ctx);
  const duracion = Math.round(performance.now() - t0);
  const status = res.status;
  const json = await res.json();

  console.log(`Status HTTP: ${status} (${duracion}ms)`);
  return json;
}

async function ejecutarDemostracion() {
  // TURNO 1: Saludo básico
  console.log("--------------------------------------------------------------------------------");
  console.log("PASO 1: Comprobar Modo Conversacional y Conexión de Identidad");
  console.log("--------------------------------------------------------------------------------");
  const t1 = await probarRuta("Turno 1: Saludo", {
    messages: [{ role: "user", text: "¡Hola! ¿Quién te creó y cuál es tu contexto docente?" }]
  });
  console.log("Respuesta Chat:\n", t1.mensaje_chat || t1.texto || t1.text || JSON.stringify(t1).slice(0, 300));

  // TURNO 2: Petición abierta (Smart Defaults + Memoria Docente)
  console.log("\n--------------------------------------------------------------------------------");
  console.log("PASO 2: Comprobar Smart Defaults Multigrado y Cero Bloqueo DATOS_INCOMPLETOS");
  console.log("--------------------------------------------------------------------------------");
  const t2 = await probarRuta("Turno 2: Petición Abierta", {
    messages: [{ role: "user", text: "muéstrame una planificación" }]
  });
  console.log("Plan Completado?:", t2.plan_completado);
  console.log("Bloqueo DATOS_INCOMPLETOS activado?:", t2.codigoError === "DATOS_INCOMPLETOS" ? "SÍ (FALLO)" : "NO (CORRECTO)");
  if (t2.datos_planificacion) {
    console.log("Grado inferido:", t2.datos_planificacion.datos_generales?.grado || t2.datos_planificacion.grado);
    console.log("Área inferida:", t2.datos_planificacion.datos_generales?.area || t2.datos_planificacion.area);
    console.log("Tema inferido:", t2.datos_planificacion.datos_generales?.tema || t2.datos_planificacion.tema);
  } else {
    console.log("Respuesta parcial/chat:", (t2.mensaje_chat || JSON.stringify(t2)).slice(0, 200));
  }

  // TURNO 3: Planificación explícita con entrega de JSON
  console.log("\n--------------------------------------------------------------------------------");
  console.log("PASO 3: Planificación Didáctica Multigrado Entregada al Docente");
  console.log("--------------------------------------------------------------------------------");
  const planSimulado = {
    datos_generales: {
      docente: "Israel Montás",
      centro: "Escuela Primaria Batey Pinos",
      grado: "1.º y 2.º Primaria (Multigrado)",
      area: "Lengua Española",
      tema: "La tarjeta de identidad y el nombre propio",
      duracion: "45 minutos"
    },
    intencion_pedagogica: "Reconocer las letras de su propio nombre y comparar longitudes de nombres en primero y segundo grado.",
    momentos: {
      inicio: "Dinámica 'El tren de los nombres': cada estudiante coloca su tarjeta.",
      desarrollo: "1.º grado modela con plastilina la letra inicial; 2.º grado escribe su nombre y apellido en el cuaderno.",
      cierre: "Metacognición en círculo: ¿Qué aprendimos hoy sobre nuestro nombre?"
    }
  };

  // TURNO 4: Pregunta sobre el turno anterior (Eliminación de la amnesia)
  console.log("\n--------------------------------------------------------------------------------");
  console.log("PASO 4: Eliminar Amnesia Entre Turnos (Envío de datosGenerados)");
  console.log("--------------------------------------------------------------------------------");
  const historialConAmnesiaCurada = [
    { role: "user", text: "Planifica una clase de Lengua Española para primero y segundo grado multigrado sobre la tarjeta de identidad" },
    {
      role: "assistant",
      text: "¡Hola, colega Israel! Aquí tienes la planificación estructurada para tu aula multigrado en la Escuela Primaria Batey Pinos.",
      datosGenerados: planSimulado,
      datos_planificacion: planSimulado
    },
    { role: "user", text: "¿Qué planificamos hace un momento? Dime el tema exacto y qué actividad hace segundo grado." }
  ];

  const t4 = await probarRuta("Turno 4: Verificación de Memoria Entre Turnos", {
    messages: historialConAmnesiaCurada
  });

  console.log("Respuesta Chat del Asistente a la memoria de turno previo:\n", t4.mensaje_chat || t4.texto || t4.text || JSON.stringify(t4));
}

ejecutarDemostracion().catch(err => {
  console.error("Error en la demostración:", err);
});
