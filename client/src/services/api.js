import { obtenerDocenteId } from "../components/PerfilDocente.jsx";

const BASE = "/api";

export async function generarPlanificacion({ messages, nivel, periodo }) {
  const docenteId = obtenerDocenteId();
  const res = await fetch(`${BASE}/plan/generate`, {
    method: "POST",
    headers: { 
      "Content-Type": "application/json",
      "x-docente-id": docenteId
    },
    body: JSON.stringify({ messages, nivel, periodo, docenteId, permitirBusquedaWeb: true }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const error = new Error(data.error || "Error generando plan");
    error.status = res.status;
    error.cuota = data.cuota;
    error.limiteAlcanzado = data.limiteAlcanzado;
    error.agotado = data.agotado;
    throw error;
  }
  return data;
}

export async function obtenerCuotaDocente() {
  const docenteId = obtenerDocenteId();
  const res = await fetch(`${BASE}/plan/cuota?docenteId=${encodeURIComponent(docenteId)}`, {
    headers: { "x-docente-id": docenteId }
  });
  if (!res.ok) {
    throw new Error("No se pudo obtener la cuota del docente");
  }
  return res.json();
}

export async function exportarWord({ titulo, plan }) {
  const res = await fetch(`${BASE}/export/docx`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ titulo, plan }),
  });
  if (!res.ok) throw new Error("Error exportando a Word");
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${titulo.replace(/\s+/g, "_")}.docx`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export async function generarVoz(text) {
  const res = await fetch(`${BASE}/voice/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || errorData.detail || "Error generando voz");
  }
  const blob = await res.blob();
  return URL.createObjectURL(blob);
}

export async function consultarCurriculo({ nivel, grado, area, tema, esquemaActivo, periodoActivo }) {
  const res = await fetch(`${BASE}/plan/consultar-curriculo`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ nivel, grado, area, tema, esquemaActivo, periodoActivo }),
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || errorData.detail || "Error al consultar currículo con IA");
  }
  return res.json();
}

export async function guardarAjustesPlan({ planId, datosAjustados }) {
  const res = await fetch(`${BASE}/plan/ajustes-manuales`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ planId, datosAjustados }),
  });
  if (!res.ok) return null;
  return res.json();
}

export async function obtenerPatronesDocente({ area, nivel } = {}) {
  const params = new URLSearchParams();
  if (area) params.append("area", area);
  if (nivel) params.append("nivel", nivel);
  const res = await fetch(`${BASE}/plan/patrones-docente?${params.toString()}`);
  if (!res.ok) return null;
  return res.json();
}


