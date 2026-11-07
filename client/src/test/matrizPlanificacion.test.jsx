import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import MatrizPlanificacion from "../components/MatrizPlanificacion.jsx";
import { parsearMatrizPlanificacion, planificarClaseCerebro } from "../services/planificacionCerebroService.js";
import { exportarDocxNativo } from "../services/exportadorDocxNativo.js";

const PLAN_EJEMPLO = `**PLANIFICACIÓN DE CLASE MULTIGRADO (1.° Y 2.° GRADO)**

**Docente:** Lic. María Mercedes Peña
**Centro Educativo:** Escuela Básica República de Colombia
**Área:** Lengua Española
**Tema:** La fábula y los valores
**Tiempo:** 45 minutos

---

### Inicio (10 min)
* Activación con adivinanza de animales.
* Presentación del propósito de la clase.

---

### Desarrollo (25 min)

**Tramo 1 (Minutos 1-12): Mediación directa (1.° grado) / Trabajo autónomo (2.° grado):**
* 1.° Grado: Lectura compartida y conciencia fonológica con palmadas.
* 2.° Grado: Subrayar personajes y moraleja en ficha de trabajo.

**Tramo 2 (Minutos 13-20): Acompañamiento (2.° grado) / Consolidación (1.° grado):**
* 2.° Grado: Identificación de inicio, nudo y desenlace.
* 1.° Grado: Formar palabras con letras móviles.

**Tramo 3 (Minutos 21-25): Punto de encuentro colectivo:**
* Círculo de diálogo y puesta en común de la enseñanza.

---

### Cierre (10 min)
* Juego formativo "El dado de los valores".
* Preguntas de metacognición: ¿Qué aprendimos hoy?

---
> 💡 **Nota del Asesor Pedagógico (Pausa Activa / Dinamización):** Profe, recuerda integrar una dinámica de estiramiento.
`;

function renderHelper(ui) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => {
    root.render(ui);
  });
  return {
    container,
    unmount: () => {
      act(() => root.unmount());
      container.remove();
    }
  };
}

describe("MatrizPlanificacion & Conexión HTTP Backend", () => {
  let mounted = null;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    if (mounted) {
      mounted.unmount();
      mounted = null;
    }
  });

  it("1. parsearMatrizPlanificacion extrae metadatos, 3 momentos y tramos CON BASE", () => {
    const matriz = parsearMatrizPlanificacion(PLAN_EJEMPLO);

    expect(matriz.metadatos.docente).toBe("Lic. María Mercedes Peña");
    expect(matriz.metadatos.area).toBe("Lengua Española");
    expect(matriz.metadatos.tema).toBe("La fábula y los valores");

    // Inicio
    expect(matriz.inicio.tiempo).toBe("10 min");
    expect(matriz.inicio.puntos.length).toBeGreaterThanOrEqual(2);

    // Desarrollo y Tramos CON BASE
    expect(matriz.desarrollo.tiempo).toBe("25 min");
    expect(matriz.desarrollo.tramos).toHaveLength(3);
    expect(matriz.desarrollo.tramos[0].badgeTipo).toBe("mediacion");
    expect(matriz.desarrollo.tramos[0].badgeEtiqueta).toContain("Mediación Directa");
    expect(matriz.desarrollo.tramos[1].badgeTipo).toBe("autonomo");
    expect(matriz.desarrollo.tramos[2].badgeTipo).toBe("encuentro");

    // Cierre
    expect(matriz.cierre.tiempo).toBe("10 min");
    expect(matriz.cierre.puntos.length).toBeGreaterThanOrEqual(2);

    // Asesor
    expect(matriz.asesorNotas.length).toBeGreaterThanOrEqual(1);
  });

  it("2. planificarClaseCerebro despacha petición POST /api/planificar con payload adecuado", async () => {
    const mockRespuesta = {
      exito: true,
      sistema: "Planifica Maestro — Sistema de Gestión y Planificación Docente",
      auditoria: {
        aprobado: true,
        dictamen: "CERTIFICADO: Planificación validada contra fuentes oficiales MINERD/CON BASE."
      },
      planificacion: PLAN_EJEMPLO,
      evidencias: [{ documento_titulo: "Diseño Curricular Primaria", numero_pagina: 45 }]
    };

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockRespuesta
    });

    const resultado = await planificarClaseCerebro({
      prompt: "Secuencia de la fábula para 1.° y 2.° grado",
      historial: ["Tema previo de suma"],
      nivel: "primario",
      grado: 1
    });

    expect(global.fetch).toHaveBeenCalledWith("/api/planificar", expect.objectContaining({
      method: "POST",
      headers: expect.objectContaining({ "Content-Type": "application/json" })
    }));

    expect(resultado.exito).toBe(true);
    expect(resultado.auditoria.aprobado).toBe(true);
    expect(resultado.matriz.desarrollo.tramos).toHaveLength(3);
  });

  it("3. Renderiza MatrizPlanificacion con los 3 momentos y badges CON BASE", () => {
    const matriz = parsearMatrizPlanificacion(PLAN_EJEMPLO);
    const auditoria = {
      aprobado: true,
      dictamen: "CERTIFICADO: Planificación validada contra fuentes oficiales MINERD/CON BASE."
    };

    mounted = renderHelper(
      <MatrizPlanificacion
        matriz={matriz}
        auditoria={auditoria}
        evidencias={[{ documento_titulo: "Guía CON BASE", numero_pagina: 12 }]}
      />
    );

    const txt = mounted.container.textContent;

    // Título y metadatos
    expect(txt).toContain("La fábula y los valores");
    expect(txt).toContain("Lic. María Mercedes Peña");
    expect(txt).toContain("MINERD Certificado");

    // 3 Momentos
    expect(txt).toContain("Inicio");
    expect(txt).toContain("Desarrollo (Secuencia Didáctica)");
    expect(txt).toContain("Cierre");

    // Badges CON BASE
    expect(txt).toContain("Tramo 1: Mediación Directa");
    expect(txt).toContain("Tramo 2: Trabajo Autónomo");
    expect(txt).toContain("Tramo 3: Encuentro Colectivo");

    // Evidencias
    expect(txt).toContain("Guía CON BASE");
    expect(txt).toContain("Pág. 12");
  });

  it("4. Renderiza alerta del Asesor Pedagógico cuando existe sugerencia o redundancia", () => {
    const matriz = parsearMatrizPlanificacion(PLAN_EJEMPLO);
    const asesor = {
      redundancia: {
        esRedundante: true,
        sugerenciaPausaActiva: "Profe, ya realizamos una clase similar. Tómate una pausa activa de 2 minutos."
      }
    };

    mounted = renderHelper(<MatrizPlanificacion matriz={matriz} asesor={asesor} />);

    const alertEl = mounted.container.querySelector('[role="alert"]');
    expect(alertEl).toBeTruthy();
    expect(alertEl.textContent).toContain("pausa activa de 2 minutos");
  });

  it("5. Dispara la exportación nativa a Word (.docx) al presionar el botón de descarga", async () => {
    const matriz = parsearMatrizPlanificacion(PLAN_EJEMPLO);
    const mockExportar = vi.fn().mockResolvedValue(true);

    mounted = renderHelper(<MatrizPlanificacion matriz={matriz} onExportar={mockExportar} />);

    const btnDocx = mounted.container.querySelector('button[title="Descargar plantilla oficial en formato Word"]');
    expect(btnDocx).toBeTruthy();

    await act(async () => {
      btnDocx.click();
    });

    expect(mockExportar).toHaveBeenCalledWith(matriz);
  });
});
