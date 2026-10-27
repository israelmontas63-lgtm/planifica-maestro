import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import React from "react";
import { render, screen, fireEvent, waitFor, renderHook, act } from "@testing-library/react";
import App from "../App.jsx";
import Header from "../components/Header.jsx";
import BottomNavFlotante from "../components/BottomNavFlotante.jsx";
import MenuSheetModal from "../components/MenuSheetModal.jsx";
import { useTema } from "../hooks/useTema.js";

describe("BLOQUE 1: Pruebas con Componentes Reales (Vitest + Testing Library)", () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute("data-theme");
    window.scrollTo = vi.fn();
    Element.prototype.scrollTo = vi.fn();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 1. BottomNavFlotante: Versión real vs Versión no disponible
  // ───────────────────────────────────────────────────────────────────────────
  it("1. BottomNavFlotante muestra commit real cuando /version.json responde con éxito", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ commit: "0e9aea2", cache_version: "planifica-maestro-v4" }),
    });

    render(
      <BottomNavFlotante
        onFoto={() => {}}
        onDictar={() => {}}
        listening={false}
        duracionTexto=""
        onHistorial={() => {}}
        onAcerca={() => {}}
      />
    );

    // Debe esperar a que el efecto de fetch resuelva y actualice el botón de versión
    await waitFor(() => {
      const btnVersion = screen.getByRole("button", { name: /toca para buscar actualización/i });
      expect(btnVersion.textContent).toContain("0e9aea2");
      expect(btnVersion.textContent).toContain("Versión 0e9aea2");
    });

    expect(globalThis.fetch).toHaveBeenCalledWith("/version.json", { cache: "no-store" });
  });

  it("2. BottomNavFlotante muestra 'Versión no disponible' cuando /version.json falla", async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error("Network connection failed"));

    render(
      <BottomNavFlotante
        onFoto={() => {}}
        onDictar={() => {}}
        listening={false}
        duracionTexto=""
        onHistorial={() => {}}
        onAcerca={() => {}}
      />
    );

    await waitFor(() => {
      const btnVersion = document.getElementById("ver");
      expect(btnVersion).not.toBeNull();
      expect(btnVersion.textContent).toBe("Versión no disponible");
      expect(btnVersion.textContent).not.toContain("0e9aea2");
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 2. BottomNavFlotante: Botón Dictar NUNCA llama a la API
  // ───────────────────────────────────────────────────────────────────────────
  it("3. BottomNavFlotante: Botón Dictar invoca onDictar y NUNCA despacha peticiones a la API", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ commit: "0e9aea2" }),
    });

    const onDictarMock = vi.fn();

    render(
      <BottomNavFlotante
        onFoto={() => {}}
        onDictar={onDictarMock}
        listening={false}
        duracionTexto=""
        onHistorial={() => {}}
        onAcerca={() => {}}
      />
    );

    const btnMic = document.getElementById("nMic");
    expect(btnMic).not.toBeNull();

    // Hacemos clic en el botón central de dictar
    fireEvent.click(btnMic);

    // Esperar a que la promesa de versión termine para no dejar actualizaciones pendientes
    await waitFor(() => {
      expect(document.getElementById("ver")).not.toBeNull();
    });

    // Verifica que se invocó el callback del componente
    expect(onDictarMock).toHaveBeenCalledTimes(1);

    // Verifica que NUNCA se hizo un fetch a /api/plan/generate ni a ninguna ruta API
    const llamadasApi = globalThis.fetch.mock.calls.filter(([url]) =>
      String(url).includes("/api/")
    );
    expect(llamadasApi).toHaveLength(0);
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 3. vistaNueva: Valor por defecto, persistencia y comportamiento del avatar
  // ───────────────────────────────────────────────────────────────────────────
  it("4. App: vistaNueva por defecto es false (clásica) y se activa con pm_vista_nueva='true'", async () => {
    window.scrollTo = vi.fn();
    const { unmount } = render(<App />);
    // En vista clásica se renderiza el BottomPanel clásico (no la barra flotante)
    expect(document.querySelector(".pm-nav-flotante")).toBeNull();
    unmount();

    // Con pm_vista_nueva = 'true' en localStorage se activa la vista nueva diferida
    localStorage.setItem("pm_vista_nueva", "true");
    const { unmount: unmountNueva } = render(<App />);
    await waitFor(() => {
      expect(document.querySelector(".pm-nav-flotante")).not.toBeNull();
    });
    unmountNueva();
  });

  it("5. Avatar en vista clásica: abre el menú original del Header", () => {
    window.scrollTo = vi.fn();
    const { unmount } = render(<App />);

    const avatarBtn = document.querySelector(".pm-avatar-btn");
    expect(avatarBtn).not.toBeNull();

    // Al hacer clic en el avatar en vista clásica, abre el dropdown original del Header
    fireEvent.click(avatarBtn);
    expect(document.querySelector(".pm-profile-menu-dropdown")).not.toBeNull();

    // MenuSheetModal NO debe estar abierto
    expect(document.querySelector(".pm-sheet-modal")).toBeNull();
    unmount();
  });

  it("6. Avatar en vista nueva: abre MenuSheetModal y permite alternar a clásica persistiendo en localStorage", async () => {
    window.scrollTo = vi.fn();
    localStorage.setItem("pm_vista_nueva", "true");
    const { unmount } = render(<App />);

    const avatarBtn = document.querySelector(".pm-avatar-btn");
    expect(avatarBtn).not.toBeNull();

    // En vista nueva, al hacer clic en el avatar abre MenuSheetModal
    fireEvent.click(avatarBtn);
    await waitFor(() => {
      expect(document.querySelector(".pm-sheet-modal")).not.toBeNull();
    });

    // Menú dropdown clásico NO debe estar abierto
    expect(document.querySelector(".pm-profile-menu-dropdown")).toBeNull();

    // El botón de rollback conmuta la vista a clásica y persiste en localStorage
    const btnRollback = screen.getByText(/Cambiar a Clásica/i).closest("button");
    expect(btnRollback).not.toBeNull();

    fireEvent.click(btnRollback);
    expect(localStorage.getItem("pm_vista_nueva")).toBe("false");
    unmount();
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 4. MenuSheetModal: Interruptor de Rollback (Unitario)
  // ───────────────────────────────────────────────────────────────────────────
  it("7. MenuSheetModal: interruptor de rollback conmuta la vista e invoca onClose", () => {
    const onToggleVistaMock = vi.fn();
    const onCloseMock = vi.fn();

    render(
      <MenuSheetModal
        isOpen={true}
        onClose={onCloseMock}
        modoTema="auto"
        onCambiarTema={() => {}}
        onAbrirAcerca={() => {}}
        vistaNueva={true}
        onToggleVista={onToggleVistaMock}
      />
    );

    // El botón muestra "Cambiar a Clásica" cuando vistaNueva es true
    const btnRollback = screen.getByText(/Cambiar a Clásica/i).closest("button");
    expect(btnRollback).not.toBeNull();

    fireEvent.click(btnRollback);

    expect(onToggleVistaMock).toHaveBeenCalledTimes(1);
    expect(onCloseMock).toHaveBeenCalledTimes(1);
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 5. useTema con renderHook (comportamiento real sin mocks)
  // ───────────────────────────────────────────────────────────────────────────
  it("8. useTema inicializa con 'auto' y remueve data-theme cuando localStorage está vacío", () => {
    const { result } = renderHook(() => useTema());
    expect(result.current.modoTema).toBe("auto");
    expect(document.documentElement.getAttribute("data-theme")).toBeNull();
  });

  it("9. useTema inicializa respetando el valor persistido en localStorage", () => {
    localStorage.setItem("pm_tema", "dark");
    const { result } = renderHook(() => useTema());
    expect(result.current.modoTema).toBe("dark");
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
  });

  it("10. useTema: aplicarTema conmuta entre dark, light y auto actualizando el DOM y localStorage", () => {
    const { result } = renderHook(() => useTema());

    // Cambiar a dark
    act(() => {
      result.current.aplicarTema("dark");
    });
    expect(result.current.modoTema).toBe("dark");
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
    expect(localStorage.getItem("pm_tema")).toBe("dark");

    // Cambiar a light
    act(() => {
      result.current.aplicarTema("light");
    });
    expect(result.current.modoTema).toBe("light");
    expect(document.documentElement.getAttribute("data-theme")).toBe("light");
    expect(localStorage.getItem("pm_tema")).toBe("light");

    // Cambiar a auto
    act(() => {
      result.current.aplicarTema("auto");
    });
    expect(result.current.modoTema).toBe("auto");
    expect(document.documentElement.getAttribute("data-theme")).toBeNull();
    expect(localStorage.getItem("pm_tema")).toBe("auto");
  });

  it("11. MenuSheetModal funciona directamente conectado al hook real useTema sin mocks", () => {
    function ComponenteConector() {
      const { modoTema, aplicarTema } = useTema();
      return (
        <MenuSheetModal
          isOpen={true}
          onClose={() => {}}
          modoTema={modoTema}
          onCambiarTema={aplicarTema}
          onAbrirAcerca={() => {}}
          vistaNueva={true}
          onToggleVista={() => {}}
        />
      );
    }

    render(<ComponenteConector />);
    const select = screen.getByLabelText(/seleccionar tema visual/i);

    // Cambiar a dark mediante la interacción real de UI
    fireEvent.change(select, { target: { value: "dark" } });
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
    expect(localStorage.getItem("pm_tema")).toBe("dark");

    // Cambiar a auto mediante la interacción real de UI
    fireEvent.change(select, { target: { value: "auto" } });
    expect(document.documentElement.getAttribute("data-theme")).toBeNull();
    expect(localStorage.getItem("pm_tema")).toBe("auto");
  });

  it("12. MenuSheetModal: oculta la fila de rollback cuando DEV es falso (simulación de producción)", () => {
    vi.stubEnv("DEV", false);
    render(
      <MenuSheetModal
        isOpen={true}
        onClose={() => {}}
        modoTema="auto"
        onCambiarTema={() => {}}
        onAbrirAcerca={() => {}}
        vistaNueva={true}
        onToggleVista={() => {}}
      />
    );
    expect(screen.queryByText(/Interfaz de inicio/i)).toBeNull();
    vi.unstubAllEnvs();
  });
});

