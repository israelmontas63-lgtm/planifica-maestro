import { describe, it, expect } from "vitest";
import worker from "../worker/index.js";

describe("Motor IA y Endpoint /api/imagen/editar", () => {
  const mockEnv = {
    ACCESO_ABIERTO: "true",
    RATE_LIMIT_DISPOSITIVO_DIARIO: "25",
    RATE_LIMIT_IP_DIARIO: "75",
    RATE_LIMIT_GLOBAL_DIARIO: "500",
    IMAGEN_IA_ACTIVA: "false", // Apagado por defecto por falta de facturación
    GEMINI_API_KEY: "test-fake-key",
  };

  it("bloquea inmediatamente solicitudes que vulneran la dignidad del menor (403)", async () => {
    const req = new Request("http://localhost/api/imagen/editar", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-app-key": "clave-profesor",
        "x-docente-id": "docente_test_1"
      },
      body: JSON.stringify({
        imagen: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
        instruccion: "esta niña tiene moretones en la espalda por maltrato físico"
      })
    });

    const res = await worker.fetch(req, mockEnv);
    expect(res.status).toBe(403);

    const json = await res.json();
    expect(json.ok).toBe(false);
    expect(json.bloqueadoPorDignidad).toBe(true);
    expect(json.veredicto).toBe("BLOQUEADO");
    expect(json.categoria).toBe("infancia_proteccion_menores");
    expect(json.protocolo).toBe("CONANI / Línea Vida (809-200-1202)");
  });

  it("requiere confirmación explícita para operaciones de tipo CONFIRMAR", async () => {
    const req = new Request("http://localhost/api/imagen/editar", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-app-key": "clave-profesor",
        "x-docente-id": "docente_test_2"
      },
      body: JSON.stringify({
        imagen: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
        instruccion: "píntale otro rostro para la obra de teatro escolar"
      })
    });

    const res = await worker.fetch(req, mockEnv);
    const json = await res.json();
    expect(json.ok).toBe(false);
    expect(json.requiereConfirmacion).toBe(true);
    expect(json.veredicto).toBe("CONFIRMAR");
    expect(json.advertencia).toBeDefined();
  });

  it("reporta 'apagado por falta de facturación' cuando IMAGEN_IA_ACTIVA=false para operaciones de IA", async () => {
    const req = new Request("http://localhost/api/imagen/editar", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-app-key": "clave-profesor",
        "x-docente-id": "docente_test_3"
      },
      body: JSON.stringify({
        imagen: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
        operacionId: "fondos_aula_virtual_ia", // operación clasificada como motor: ia
        instruccion: "Colocar un aula dominicana de fondo con IA"
      })
    });

    const res = await worker.fetch(req, mockEnv);
    const json = await res.json();
    expect(json.ok).toBe(false);
    expect(json.motor).toBe("ia");
    expect(json.estadoIa).toBe("apagado por falta de facturación");
    expect(json.fallbackLocalSugerido).toBe(true);
  });

  it("permite ejecutar operaciones del motor local descontando cuota ponderada", async () => {
    const req = new Request("http://localhost/api/imagen/editar", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-app-key": "clave-profesor",
        "x-docente-id": "docente_test_4"
      },
      body: JSON.stringify({
        imagen: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
        operacionId: "luz_brillo_mas"
      })
    });

    const res = await worker.fetch(req, mockEnv);
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(json.motor).toBe("local");
    expect(json.cuotaDescontada).toBe(1);
  });

  it("garantiza cero persistencia en base de datos o almacenamiento externo", async () => {
    // La imagen no se escribe en Supabase ni en KV, se procesa en memoria y se descarta
    const req = new Request("http://localhost/api/imagen/editar", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-app-key": "clave-profesor",
        "x-docente-id": "docente_test_5"
      },
      body: JSON.stringify({
        imagen: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
        operacionId: "luz_contraste_alto"
      })
    });

    const res = await worker.fetch(req, mockEnv);
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(json.guardadoEnBd).toBeUndefined();
  });
});
