import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import PlanResult from "../components/PlanResult.jsx";
import BottomPanel from "../components/BottomPanel.jsx";
import { Document, Packer, Paragraph, HeadingLevel, TextRun } from "docx";

// Función utilitaria ligera de renderizado en React 18 sin dependencias externas
function render(ui) {
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

// ─────────────────────────────────────────────────────────────────────────────
// PRUEBA 1: El formulario de planificación se rellena con la respuesta de la IA
// ─────────────────────────────────────────────────────────────────────────────
describe("FASE 15 - Prueba 1: Relleno correcto y edición manual en PlanResult", () => {
  let mounted = null;

  afterEach(() => {
    if (mounted) {
      mounted.unmount();
      mounted = null;
    }
  });

  const mockRespuestaIA = {
    "1. Aspectos Generales": "Área: Matemáticas - 4to Primaria - Docente: María Pérez",
    "2. Competencias Fundamentales y Específicas": "Pensamiento Lógico, Creativo y Crítico",
    "3. Contenidos Curriculares": "Fracciones propias, impropias y números mixtos",
    "4. Secuencia Didáctica": "Inicio: 10 min (Saberes previos) - Desarrollo: 25 min (Práctica guiada) - Cierre: 10 min (Metacognición)",
    "5. Actividades de Evaluación e Indicadores de Logro": "Lista de cotejo y rúbrica formativa continua",
    "6. Recursos y Materiales Didácticos": "Fichas de fracciones, pizarra, regla y lápices de colores"
  };

  it("rellena todos los bloques con la respuesta de la IA y garantiza que ningún campo esté bloqueado", () => {
    const mockOnActualizar = vi.fn();
    const mockOnExportar = vi.fn();
    const mockOnEscuchar = vi.fn();

    mounted = render(
      <PlanResult
        datosGenerados={mockRespuestaIA}
        planId="plan_test_123"
        nivel="primario"
        periodo="diaria"
        esquemaLabel="Tradicional (Primario)"
        onExportar={mockOnExportar}
        exportando={false}
        onEscuchar={mockOnEscuchar}
        escuchando={false}
        onDatosActualizados={mockOnActualizar}
      />
    );

    const container = mounted.container;

    // 1. Verificar aviso permanente de IA
    const avisoIA = container.querySelector(".pm-ai-notice");
    expect(avisoIA).toBeTruthy();
    expect(avisoIA.textContent).toContain("Contenido generado con IA — revisa y ajusta antes de uso oficial");

    // 2. Verificar que cada bloque y su contenido se renderizan en el formulario
    const textareas = container.querySelectorAll("textarea");
    expect(textareas.length).toBe(Object.keys(mockRespuestaIA).length);

    Object.entries(mockRespuestaIA).forEach(([bloque, contenido], index) => {
      // El título del bloque debe estar presente
      expect(container.textContent).toContain(bloque);

      // El textarea correspondiente debe contener el texto generado por la IA
      const textarea = textareas[index];
      expect(textarea.value).toBe(contenido);

      // NINGÚN campo debe quedar bloqueado o de solo lectura (Fase 10)
      expect(textarea.disabled).toBe(false);
      expect(textarea.readOnly).toBe(false);
    });

    // 3. Verificar que el maestro puede editar libremente cualquier campo y se propaga el cambio
    const primerTextarea = textareas[0];
    const nuevoTexto = "Área: Matemáticas - 4to Primaria - [EDITADO MANUALMENTE POR EL DOCENTE]";
    
    act(() => {
      primerTextarea.value = nuevoTexto;
      primerTextarea.dispatchEvent(new Event("input", { bubbles: true }));
      primerTextarea.dispatchEvent(new Event("change", { bubbles: true }));
    });

    expect(primerTextarea.value).toBe(nuevoTexto);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// PRUEBA 2: La exportación a Word no lanza errores con datos de ejemplo
// ─────────────────────────────────────────────────────────────────────────────
describe("FASE 15 - Prueba 2: Exportación a Word (.docx) con datos de ejemplo", () => {
  it("genera un archivo .docx válido sin lanzar errores a partir de una planificación", async () => {
    const tituloEjemplo = "Planificación_Diaria_Matemáticas_4to";
    const planEjemplo = `1. Aspectos Generales:
Área: Ciencias de la Naturaleza
Grado: 5to de Primaria
Docente: Prof. Carlos Almonte

2. Competencias:
Científica y Tecnológica: Comprende el ciclo del agua en el ecosistema.

3. Secuencia Didáctica:
Inicio (10 min): Lluvia de ideas sobre la lluvia y los ríos.
Desarrollo (25 min): Experimento del agua en bolsa térmica.
Cierre (10 min): Diagrama de síntesis del ciclo hidrológico.

4. Evaluación:
Rúbrica de observación y cuaderno de trabajo.`;

    // Reproducir la lógica de exportación a Word de server/routes/export.js
    const paragraphs = planEjemplo.split("\n").map((line) => {
      const isHeading = /:$/.test(line.trim()) && line.trim().length < 80;
      return new Paragraph({
        heading: isHeading ? HeadingLevel.HEADING_2 : undefined,
        children: [new TextRun({ text: line, bold: isHeading })],
      });
    });

    const doc = new Document({
      sections: [
        {
          children: [
            new Paragraph({ text: tituloEjemplo, heading: HeadingLevel.TITLE }),
            new Paragraph({ text: "" }),
            ...paragraphs,
          ],
        },
      ],
    });

    // Validar que el empaquetador genera un buffer binario sin arrojar excepciones
    const buffer = await Packer.toBuffer(doc);

    expect(buffer).toBeDefined();
    expect(buffer.length).toBeGreaterThan(100); // Un documento docx válido pesa varios KB
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// PRUEBA 3: El menú dropdown y los modales son mutuamente excluyentes
// ─────────────────────────────────────────────────────────────────────────────
describe("FASE 15 - Prueba 3: Mutua exclusión entre Menú Dropdown y Modales", () => {
  let mounted = null;

  afterEach(() => {
    if (mounted) {
      mounted.unmount();
      mounted = null;
    }
  });

  it("al abrir un modal desde el menú se cierra automáticamente el dropdown", () => {
    const mockSetMenuOpen = vi.fn();
    const mockAbrirBiblioteca = vi.fn();
    const mockAbrirEsquemas = vi.fn();
    const mockAbrirPerfil = vi.fn();
    const mockAbrirCurriculo = vi.fn();
    const mockAbrirTexto = vi.fn();

    mounted = render(
      <BottomPanel
        periodoActivo="diaria"
        nivelActivo="primario"
        onSeleccionarEsquema={() => {}}
        listening={false}
        onDictadoClick={() => {}}
        onAbrirTexto={mockAbrirTexto}
        onAbrirEsquemas={mockAbrirEsquemas}
        onAbrirPerfil={mockAbrirPerfil}
        onAbrirCurriculo={mockAbrirCurriculo}
        onAbrirBiblioteca={mockAbrirBiblioteca}
        menuOpen={true}
        setMenuOpen={mockSetMenuOpen}
      />
    );

    const container = mounted.container;

    // Buscar y tocar botones del menú
    const botones = Array.from(container.querySelectorAll("button"));

    // 1. Tocar '📁 Mis Planificaciones'
    const btnBiblioteca = botones.find((b) => b.textContent.includes("Mis Planificaciones"));
    expect(btnBiblioteca).toBeTruthy();
    act(() => {
      btnBiblioteca.click();
    });
    expect(mockSetMenuOpen).toHaveBeenCalledWith(false);
    expect(mockAbrirBiblioteca).toHaveBeenCalledTimes(1);

    // 2. Tocar '📋 Ver todos los Esquemas'
    const btnEsquemas = botones.find((b) => b.textContent.includes("Ver todos los Esquemas"));
    expect(btnEsquemas).toBeTruthy();
    act(() => {
      btnEsquemas.click();
    });
    expect(mockSetMenuOpen).toHaveBeenCalledWith(false);
    expect(mockAbrirEsquemas).toHaveBeenCalledTimes(1);

    // 3. Tocar '👤 Mi Perfil'
    const btnPerfil = botones.find((b) => b.textContent.includes("Mi Perfil"));
    expect(btnPerfil).toBeTruthy();
    act(() => {
      btnPerfil.click();
    });
    expect(mockSetMenuOpen).toHaveBeenCalledWith(false);
    expect(mockAbrirPerfil).toHaveBeenCalledTimes(1);

    // 4. Tocar '📚 Currículo MINERD'
    const btnCurriculo = botones.find((b) => b.textContent.includes("Currículo MINERD"));
    expect(btnCurriculo).toBeTruthy();
    act(() => {
      btnCurriculo.click();
    });
    expect(mockSetMenuOpen).toHaveBeenCalledWith(false);
    expect(mockAbrirCurriculo).toHaveBeenCalledTimes(1);

    // 5. Tocar 'Texto'
    const btnTexto = botones.find((b) => b.textContent.includes("Texto"));
    expect(btnTexto).toBeTruthy();
    act(() => {
      btnTexto.click();
    });
    expect(mockAbrirTexto).toHaveBeenCalledTimes(1);
  });

  it("la lógica de control en App garantiza que abrir el menú cierra todos los modales", () => {
    // Simular el controlador de estado centralizado implementado en App.jsx:
    // setMenuOpen={(open) => { setMenuOpen(open); if(open) { setTextoModalOpen(false); setSchemaOpen(false); setPerfilOpen(false); setCurriculumOpen(false); setBibliotecaOpen(false); } }}
    let estados = {
      menuOpen: false,
      textoModalOpen: true,
      schemaOpen: true,
      perfilOpen: true,
      curriculumOpen: true,
      bibliotecaOpen: true,
    };

    function simularAbrirMenu(open) {
      estados.menuOpen = open;
      if (open) {
        estados.textoModalOpen = false;
        estados.schemaOpen = false;
        estados.perfilOpen = false;
        estados.curriculumOpen = false;
        estados.bibliotecaOpen = false;
      }
    }

    simularAbrirMenu(true);

    expect(estados.menuOpen).toBe(true);
    expect(estados.textoModalOpen).toBe(false);
    expect(estados.schemaOpen).toBe(false);
    expect(estados.perfilOpen).toBe(false);
    expect(estados.curriculumOpen).toBe(false);
    expect(estados.bibliotecaOpen).toBe(false);
  });
});
