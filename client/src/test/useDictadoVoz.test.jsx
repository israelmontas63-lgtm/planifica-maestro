import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { useDictadoVoz } from "../hooks/useDictadoVoz.js";

// Componente auxiliar para probar el hook
function TestComponent({ onTexto, onFin, hookRef }) {
  const dictado = useDictadoVoz({ alCambiarTexto: onTexto, alFinalizar: onFin });
  hookRef.current = dictado;
  return (
    <div>
      <span data-testid="estado">{dictado.escuchando ? "escuchando" : "inactivo"}</span>
      <button data-testid="btn-iniciar" onClick={dictado.iniciar}>Iniciar</button>
      <button data-testid="btn-detener" onClick={dictado.detener}>Detener</button>
    </div>
  );
}

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

describe("Hook useDictadoVoz - Web Speech API en Tiempo Real", () => {
  let mounted = null;
  let mockRecognitionInstance = null;
  const originalSpeechRecognition = window.SpeechRecognition;
  const originalWebkitSpeechRecognition = window.webkitSpeechRecognition;

  beforeEach(() => {
    mockRecognitionInstance = {
      continuous: false,
      interimResults: false,
      lang: "",
      start: vi.fn(),
      stop: vi.fn(),
      abort: vi.fn(),
      onresult: null,
      onerror: null,
      onend: null
    };

    window.SpeechRecognition = vi.fn(() => mockRecognitionInstance);
    window.webkitSpeechRecognition = undefined;
  });

  afterEach(() => {
    if (mounted) {
      mounted.unmount();
      mounted = null;
    }
    window.SpeechRecognition = originalSpeechRecognition;
    window.webkitSpeechRecognition = originalWebkitSpeechRecognition;
  });

  it("configura SpeechRecognition para español dominicano continuo con interimResults", () => {
    const hookRef = { current: null };
    mounted = render(<TestComponent onTexto={vi.fn()} onFin={vi.fn()} hookRef={hookRef} />);

    expect(window.SpeechRecognition).toHaveBeenCalled();
    expect(mockRecognitionInstance.continuous).toBe(true);
    expect(mockRecognitionInstance.interimResults).toBe(true);
    expect(mockRecognitionInstance.lang).toBe("es-DO");
    expect(hookRef.current.escuchando).toBe(false);
  });

  it("inicia y detiene la grabación actualizando el estado reactivo", () => {
    const hookRef = { current: null };
    mounted = render(<TestComponent onTexto={vi.fn()} onFin={vi.fn()} hookRef={hookRef} />);

    // Iniciar
    act(() => {
      hookRef.current.iniciar();
    });
    expect(mockRecognitionInstance.start).toHaveBeenCalledTimes(1);
    expect(hookRef.current.escuchando).toBe(true);

    // Detener
    act(() => {
      hookRef.current.detener();
    });
    expect(mockRecognitionInstance.stop).toHaveBeenCalledTimes(1);
    expect(hookRef.current.escuchando).toBe(false);
  });

  it("despacha la transcripción final e interina acumulada vía alCambiarTexto", () => {
    const mockOnTexto = vi.fn();
    const hookRef = { current: null };
    mounted = render(<TestComponent onTexto={mockOnTexto} onFin={vi.fn()} hookRef={hookRef} />);

    act(() => {
      hookRef.current.iniciar();
    });

    // Simular evento onresult con partes finales e interinas
    act(() => {
      mockRecognitionInstance.onresult({
        resultIndex: 0,
        results: [
          [{ transcript: "Planificación de matemáticas" }],
          [{ transcript: " para segundo grado" }]
        ]
      });
      // El primer resultado como final y el segundo como interino
      mockRecognitionInstance.results = [
        [{ transcript: "Planificación de matemáticas" }],
        [{ transcript: " para segundo grado" }]
      ];
      mockRecognitionInstance.results[0].isFinal = true;
      mockRecognitionInstance.results[1].isFinal = false;

      mockRecognitionInstance.onresult({
        resultIndex: 0,
        results: mockRecognitionInstance.results
      });
    });

    expect(mockOnTexto).toHaveBeenCalledWith("Planificación de matemáticas para segundo grado");
  });

  it("maneja onend y onerror restableciendo escuchando a false e invocando alFinalizar", () => {
    const mockOnFin = vi.fn();
    const hookRef = { current: null };
    mounted = render(<TestComponent onTexto={vi.fn()} onFin={mockOnFin} hookRef={hookRef} />);

    act(() => {
      hookRef.current.iniciar();
    });
    expect(hookRef.current.escuchando).toBe(true);

    // Simular error
    act(() => {
      mockRecognitionInstance.onerror();
    });
    expect(hookRef.current.escuchando).toBe(false);

    // Iniciar de nuevo y simular fin
    act(() => {
      hookRef.current.iniciar();
    });
    expect(hookRef.current.escuchando).toBe(true);

    act(() => {
      mockRecognitionInstance.onend();
    });
    expect(hookRef.current.escuchando).toBe(false);
    expect(mockOnFin).toHaveBeenCalledTimes(1);
  });
});
