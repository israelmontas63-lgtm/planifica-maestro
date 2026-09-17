import { obtenerDocenteId } from "../components/PerfilDocente.jsx";
import { obtenerAuthToken } from "../components/AccessGate.jsx";

const BASE = "/api";

export function obtenerOwnerKey() {
  try {
    return localStorage.getItem("pm_owner_key") || null;
  } catch (e) {
    return null;
  }
}

function getAuthHeaders(customHeaders = {}) {
  const token = obtenerAuthToken();
  const ownerKey = obtenerOwnerKey();
  const headers = { ...customHeaders };
  if (token) {
    headers["x-app-key"] = token;
  }
  if (ownerKey) {
    headers["x-owner-key"] = ownerKey;
  }
  return headers;
}

export async function verificarLlaveMaestra(key) {
  const res = await fetch(`${BASE}/auth/owner-verify`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ key }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || "Llave maestra incorrecta.");
  }
  return data;
}

export async function obtenerOwnerStats() {
  const res = await fetch(`${BASE}/auth/owner-stats`, {
    headers: getAuthHeaders(),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || "No se pudieron obtener las métricas del sistema.");
  }
  return data.stats;
}

export async function generarPlanificacion({ messages, nivel, periodo }) {
  const docenteId = obtenerDocenteId();
  const res = await fetch(`${BASE}/plan/generate`, {
    method: "POST",
    headers: getAuthHeaders({ 
      "Content-Type": "application/json",
      "x-docente-id": docenteId
    }),
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
    headers: getAuthHeaders({ "x-docente-id": docenteId })
  });
  if (!res.ok) {
    throw new Error("No se pudo obtener la cuota del docente");
  }
  return res.json();
}

export async function exportarWord({ titulo, plan }) {
  const res = await fetch(`${BASE}/export/docx`, {
    method: "POST",
    headers: getAuthHeaders({ "Content-Type": "application/json" }),
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
    headers: getAuthHeaders({ "Content-Type": "application/json" }),
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
    headers: getAuthHeaders({ "Content-Type": "application/json" }),
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
    headers: getAuthHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({ planId, datosAjustados }),
  });
  if (!res.ok) return null;
  return res.json();
}

export async function obtenerPatronesDocente({ area, nivel } = {}) {
  const params = new URLSearchParams();
  if (area) params.append("area", area);
  if (nivel) params.append("nivel", nivel);
  const res = await fetch(`${BASE}/plan/patrones-docente?${params.toString()}`, {
    headers: getAuthHeaders()
  });
  if (!res.ok) return null;
  return res.json();
}
