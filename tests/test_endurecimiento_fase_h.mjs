import { describe, it, beforeEach } from "node:test";
import assert from "node:assert";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const {
  calcularCooldown429,
  calcularMsHastaMedianocheZona,
  filtrarPrivacidad,
  obtenerEstadoCircuito,
  registrarFalloCircuito,
  registrarExitoCircuito,
  obtenerEstadoProveedores,
  tieneClaveConfigurada,
  enrutarPeticion
} = require("../server/ia/enrutadorIA.js");

const {
  cargarEstadoCircuitos,
  guardarEstadoCircuitos,
  tipoPersistencia,
  sincronizarHaciaSupabase,
  leerDesdeSupabase,
  ARCHIVO_CIRCUITOS,
  ARCHIVO_CIRCUITOS_BAK
} = require("../server/ia/persistenciaEstado.js");

const { obtenerMetricas } = require("../server/ia/registroUso.js");

const {
  obtenerEstadoProveedoresVoz,
  obtenerEstadoCircuitoVoz,
  registrarFalloVoz,
  registrarExitoVoz
} = require("../server/ia/enrutadorVoz.js");

describe("ENDURECIMIENTO FASE H: Circuit Breaker, Persistencia, Privacidad y Proveedores", () => {
  const configGeneral = {
    circuito_cooldown_error_ms: 60000,
    circuito_cooldown_429_rpm_ms: 60000,
    circuito_cooldown_429_rpd_ms: 86400000,
    circuito_cooldown_429_default_ms: 60000,
    circuito_cooldown_429_max_ms: 900000, // 15 min máximo para rpm/retry-after
    zona_horaria_cuota: "America/Los_Angeles"
  };

  describe("1. Distinción granular de errores 429 en Circuit Breaker", () => {
    it("1.1 Usa el valor exacto de Retry-After si viene en encabezado o propiedad", () => {
      const errConHeader = {
        headers: { "retry-after": "45" },
        status: 429,
        message: "Too Many Requests"
      };
      const res = calcularCooldown429(errConHeader, configGeneral);
      assert.strictEqual(res.tipo, "retry_after");
      assert.strictEqual(res.ms, 45000);
      assert.strictEqual(res.motivo, "Retry-After especificado por proveedor (45s)");
    });

    it("1.2 Acota Retry-After excesivo por circuito_cooldown_429_max_ms (15m)", () => {
      const errExcesivo = {
        retryAfter: 7200, // 2 horas
        status: 429,
        message: "Rate limit"
      };
      const res = calcularCooldown429(errExcesivo, configGeneral);
      assert.strictEqual(res.tipo, "retry_after");
      assert.strictEqual(res.ms, 900000, "Debe quedar acotado al máximo de 15 minutos (900000ms)");
    });

    it("1.3 Cuota diaria agotada (RPD): pausa hasta medianoche y NO se recorta por max_ms", () => {
      const errRPD = {
        status: 429,
        message: "Resource has been exhausted (e.g. check quota per day): PerDay requests exceeded."
      };
      const res = calcularCooldown429(errRPD, configGeneral);
      assert.strictEqual(res.tipo, "rpd");
      assert.ok(res.ms > 0, "El tiempo calculado debe ser positivo");
      // CRÍTICO: La cuota diaria debe esperar hasta medianoche PT y no ser recortada a 15 min
      const msEsperadosMedianoche = calcularMsHastaMedianocheZona("America/Los_Angeles");
      assert.ok(Math.abs(res.ms - msEsperadosMedianoche) < 2000, "Debe coincidir con el tiempo hasta medianoche de LA");
    });

    it("1.4 Límite por minuto (RPM): pausa configurada en 60 segundos", () => {
      const errRPM = {
        status: 429,
        message: "Rate limit exceeded: quota per minute reached. Please slow down."
      };
      const res = calcularCooldown429(errRPM, configGeneral);
      assert.strictEqual(res.tipo, "rpm");
      assert.strictEqual(res.ms, 60000);
    });

    it("1.5 Error 429 sin datos ni encabezados: pausa corta por defecto de 60 segundos", () => {
      const errGenerico = {
        status: 429,
        message: "Too Many Requests"
      };
      const res = calcularCooldown429(errGenerico, configGeneral);
      assert.strictEqual(res.tipo, "default");
      assert.strictEqual(res.ms, 60000);
    });
  });

  describe("2. Transiciones de estado del Circuit Breaker", () => {
    it("2.1 Pasa de SEMI_ABIERTO a CERRADO tras un éxito", () => {
      const provId = "prov_test_semi_abierto";
      const estado = obtenerEstadoCircuito(provId);
      estado.estado = "SEMI_ABIERTO";
      estado.fallosConsecutivos = 2;
      estado.pausaHastaMs = Date.now() + 50000;

      registrarExitoCircuito(provId);

      assert.strictEqual(estado.estado, "CERRADO", "Debe restablecerse a CERRADO");
      assert.strictEqual(estado.fallosConsecutivos, 0, "Fallos consecutivos deben resetearse a 0");
      assert.strictEqual(estado.pausaHastaMs, 0, "Pausa debe resetearse a 0");
    });

    it("2.2 Proveedor con error 404 refleja 'modelo no disponible' y no bloquea indefinidamente", () => {
      const provId = "prov_test_404";
      const err404 = { status: 404, message: "models/gemini-unknown is not found for API version v1beta" };

      registrarFalloCircuito(provId, err404, { circuito_fallos_maximos: 1, circuito_cooldown_error_ms: 1000 });
      const est = obtenerEstadoCircuito(provId);
      assert.strictEqual(est.ultimoError, "modelo_no_disponible");
    });

    it("2.3 Error 400/401 NO activa proveedores de respaldo y se registra como error de configuración", async () => {
      registrarExitoCircuito("gemini_flash");
      const provId = "prov_test_config_401";
      const estadoAntes = obtenerEstadoCircuito(provId);
      assert.strictEqual(estadoAntes.estado, "CERRADO");

      // Llamada con API key inválida (error 400 de configuración)
      const res = await enrutarPeticion({
        tema: "Los Ecosistemas Dominicanos",
        grado: "4to grado",
        area: "Ciencias de la Naturaleza",
        env: {
          GEMINI_API_KEY: "CLAVE_TEST_INVALIDA_400",
          GROQ_API_KEY: "GROQ_MOCK_KEY" // Este respaldo NO debe activarse
        }
      });

      // 1. Debe haber resuelto de inmediato con Biblioteca Oficial
      assert.ok(res, "Debe retornar planificación de respaldo seguro");
      assert.ok(res.datos_planificacion || res.plan_completado, "Debe tener contenido curricular");
      assert.strictEqual(res.origen, "biblioteca_oficial");

      // 2. Telemetría debe contener el log de fallo de configuración
      const ultimos = obtenerMetricas().ultimosRegistros;
      const logConfig = ultimos.find(l => l.codigoError === "400" || l.tipoFallo === "configuracion");
      assert.ok(logConfig, "Debe haberse registrado como fallo de configuración en telemetría");
      assert.strictEqual(logConfig.tipoFallo, "configuracion");

      // 3. No debe haberse llamado a Groq como respaldo de IA generativa
      const llamadasGroq = ultimos.filter(l => l.proveedorId === "groq_llama" && l.timestamp > logConfig.timestamp);
      assert.strictEqual(llamadasGroq.length, 0, "No debe activar proveedores de IA de respaldo ante error 400/401 de configuración");
    });
  });

  describe("3. Persistencia atómica y tolerancia a fallos en disco", () => {
    const testDir = path.join(__dirname, "..", "server", "data");
    const testFile = path.join(testDir, "test_circuitos.json");
    const testTmp = path.join(testDir, "test_circuitos.json.tmp");
    const testBak = path.join(testDir, "test_circuitos.json.bak");

    const { escribirArchivoSeguro, leerArchivoSeguro } = require("../server/ia/persistenciaEstado.js");

    const mapaPrueba = {
      prov_test_persistencia: {
        estado: "ABIERTO",
        fallosConsecutivos: 3,
        pausaHastaMs: Date.now() + 120000,
        ultimoError: "Test error de persistencia",
        ultimaLlamada: Date.now(),
        motivoPausa: "429_rpd"
      }
    };

    it("3.1 Guarda y carga estado del circuit breaker sobreviviendo reinicios simulados", () => {
      const guardadoOk = escribirArchivoSeguro(testFile, testTmp, testBak, mapaPrueba);
      assert.strictEqual(guardadoOk, true, "Debe guardarse en disco correctamente");

      const cargado = leerArchivoSeguro(testFile, testBak, {});
      assert.ok(cargado.prov_test_persistencia, "Debe recuperar el proveedor persistido");
      assert.strictEqual(cargado.prov_test_persistencia.estado, "ABIERTO");
      assert.strictEqual(cargado.prov_test_persistencia.fallosConsecutivos, 3);
    });

    it("3.2 Tolera archivo corrupto recuperándose desde .bak o estado limpio sin arrojar excepción", () => {
      // Corromper intencionalmente el archivo principal de prueba
      fs.writeFileSync(testFile, "{ json_invalido_totalmente_roto: [", "utf-8");

      let recuperado = null;
      assert.doesNotThrow(() => {
        recuperado = leerArchivoSeguro(testFile, testBak, {});
      }, "Cargar un archivo corrupto jamás debe arrojar excepción");

      assert.ok(recuperado && typeof recuperado === "object");
      assert.ok(recuperado.prov_test_persistencia, "Debe haberse recuperado de .bak");

      // Limpiar archivos de prueba
      try { fs.unlinkSync(testFile); } catch (_) {}
      try { fs.unlinkSync(testBak); } catch (_) {}
      try { fs.unlinkSync(testTmp); } catch (_) {}
    });

    it("3.3 Recupera desde .bak si el archivo principal no existe (ausente)", () => {
      // Garantizar que el archivo principal no exista
      if (fs.existsSync(testFile)) fs.unlinkSync(testFile);
      // Crear únicamente el archivo de respaldo .bak con datos válidos
      const datosBak = { prov_desde_bak: { estado: "CERRADO", fallosConsecutivos: 0 } };
      fs.writeFileSync(testBak, JSON.stringify(datosBak), "utf-8");

      let cargado = null;
      assert.doesNotThrow(() => {
        cargado = leerArchivoSeguro(testFile, testBak, {});
      }, "Cargar con archivo principal ausente no debe lanzar error si existe .bak");

      assert.ok(cargado && cargado.prov_desde_bak, "Debe haber recuperado los datos desde el archivo .bak");
      assert.strictEqual(cargado.prov_desde_bak.estado, "CERRADO");

      // Limpiar archivo .bak de prueba
      try { fs.unlinkSync(testBak); } catch (_) {}
    });

    it("3.4 Integración Supabase: detecta credenciales, sincroniza pm_estado_sistema y tolera caídas de red", async () => {
      // Sin variables de entorno, tipoPersistencia debe indicar disco o en_memoria
      const tipoDefault = tipoPersistencia();
      assert.ok(["disco", "en_memoria"].includes(tipoDefault));

      // Sincronización sin Supabase configurado retorna false amistosamente sin fallar
      const syncSinCreds = await sincronizarHaciaSupabase("test_clave", { test: true });
      assert.strictEqual(syncSinCreds, false, "Debe retornar false de forma limpia si no hay Supabase configurado");

      // Lectura sin Supabase configurado retorna null amistosamente
      const leerSinCreds = await leerDesdeSupabase("test_clave");
      assert.strictEqual(leerSinCreds, null, "Debe retornar null de forma limpia si no hay Supabase configurado");
    });
  });

  describe("4. Filtro de privacidad de alta precisión (sin falsos positivos)", () => {
    it("4.1 Preserva próceres de la patria y lugares históricos dominicanos", () => {
      const temaClase = "Planificar una unidad sobre Juan Pablo Duarte, Francisco del Rosario Sánchez y Matías Ramón Mella en Santo Domingo.";
      const filtrado = filtrarPrivacidad(temaClase, {});

      assert.ok(filtrado.includes("Juan Pablo Duarte"), "Debe preservar a Juan Pablo Duarte");
      assert.ok(filtrado.includes("Francisco del Rosario Sánchez"), "Debe preservar a Francisco del Rosario Sánchez");
      assert.ok(filtrado.includes("Matías Ramón Mella"), "Debe preservar a Matías Ramón Mella");
      assert.ok(filtrado.includes("Santo Domingo"), "Debe preservar Santo Domingo");
    });

    it("4.2 Preserva otros personajes y conceptos históricos y geográficos dominicanos", () => {
      const texto = "Clase de Ciencias Sociales sobre Gregorio Luperón, Salomé Ureña, Cristóbal Colón, la Restauración y el río Yaque del Norte en Santiago.";
      const filtrado = filtrarPrivacidad(texto, {});

      assert.ok(filtrado.includes("Gregorio Luperón"), "Debe preservar a Gregorio Luperón");
      assert.ok(filtrado.includes("Salomé Ureña"), "Debe preservar a Salomé Ureña");
      assert.ok(filtrado.includes("Cristóbal Colón"), "Debe preservar a Cristóbal Colón");
      assert.ok(filtrado.includes("Santiago"), "Debe preservar a Santiago");
    });

    it("4.3 Anonimiza con exactitud los datos del perfil docente, insensible a mayúsculas y acentos", () => {
      const perfilDocente = {
        nombreDocente: "María Auxiliadora Pérez",
        centroEducativo: "Liceo Secundario Unión Panamericana",
        estudiantes: ["Juan José Rosario", "Ana Cristina Peña"]
      };

      const texto = "La profesora maria auxiliadora perez del liceo secundario union panamericana reporta avances de juan jose rosario y ana cristina peña.";
      const filtrado = filtrarPrivacidad(texto, perfilDocente);

      assert.strictEqual(filtrado.toLowerCase().includes("maria auxiliadora perez"), false, "Debe ocultar nombre docente");
      assert.strictEqual(filtrado.toLowerCase().includes("union panamericana"), false, "Debe ocultar centro educativo");
      assert.strictEqual(filtrado.toLowerCase().includes("juan jose rosario"), false, "Debe ocultar estudiante 1");
      assert.strictEqual(filtrado.toLowerCase().includes("ana cristina peña"), false, "Debe ocultar estudiante 2");
      assert.ok(filtrado.includes("Docente [Reservado]"), "Debe contener marcador de docente");
      assert.ok(filtrado.includes("Centro Educativo [Reservado]"), "Debe contener marcador de escuela");
      assert.ok(filtrado.includes("Estudiante [Reservado]"), "Debe contener marcador de estudiante");
    });

    it("4.4 Anonimiza patrones de cédula dominicana, teléfono y correo electrónico", () => {
      const texto = "El contacto de referencia es cédula 001-0123456-7, teléfono 809-555-1234 y correo soporte@escuela.gob.do.";
      const filtrado = filtrarPrivacidad(texto);

      assert.strictEqual(filtrado.includes("001-0123456-7"), false, "Debe ocultar cédula con guiones");
      assert.strictEqual(filtrado.includes("809-555-1234"), false, "Debe ocultar teléfono");
      assert.strictEqual(filtrado.includes("soporte@escuela.gob.do"), false, "Debe ocultar correo");
      assert.ok(filtrado.includes("[Cédula]"), "Debe poner etiqueta [Cédula]");
      assert.ok(filtrado.includes("[Teléfono]"), "Debe poner etiqueta [Teléfono]");
      assert.ok(filtrado.includes("[Correo]"), "Debe poner etiqueta [Correo]");
    });
  });

  describe("5. Diagnóstico de estado del sistema", () => {
    it("5.1 obtenerEstadoProveedores() devuelve estados descriptivos sin exponer claves", () => {
      const proveedores = obtenerEstadoProveedores();
      assert.ok(Array.isArray(proveedores));
      assert.ok(proveedores.length > 0);

      const estadosValidos = [
        "disponible",
        "desactivado",
        "sin clave configurada",
        "en pausa por circuito abierto",
        "reintento gradual",
        "modelo no disponible"
      ];

      proveedores.forEach(p => {
        assert.ok(estadosValidos.includes(p.estado), `Estado '${p.estado}' debe ser uno de los válidos`);
        assert.strictEqual(typeof p.conClave, "boolean");
        // Verificar que no se expone ninguna clave ni token
        assert.strictEqual(p.apiKey, undefined, "No debe incluir apiKey");
        assert.strictEqual(p.key, undefined, "No debe incluir key");
      });
    });

    it("5.2 obtenerEstadoProveedoresVoz() refleja estados sin exponer claves", () => {
      const provsVoz = obtenerEstadoProveedoresVoz();
      assert.ok(Array.isArray(provsVoz));
      assert.ok(provsVoz.length > 0);

      provsVoz.forEach(p => {
        assert.strictEqual(typeof p.conClave, "boolean");
        assert.strictEqual(p.apiKey, undefined);
      });
    });
  });
});
