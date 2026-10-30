const norm = (s) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ").trim();
// Un tema es válido si tiene forma de título: empieza con mayúscula o dígito y tiene al menos 4 caracteres.
// Descarta fragmentos sueltos de líneas cortadas del PDF (ej.: "naturales como mínimo").
export function esTemaValido(tema) {
  if (typeof tema !== "string") return false;
  const t = tema.trim();
  if (t.length < 4) return false;
  return /^[A-ZÁÉÍÓÚÑ0-9¿¡"«(]/.test(t);
}
export function filtrarTemas(temas) {
  const vistos = new Set();
  const salida = [];
  for (const t of Array.isArray(temas) ? temas : []) {
    if (!esTemaValido(t)) continue;
    const k = norm(t);
    if (vistos.has(k)) continue;
    vistos.add(k);
    salida.push(t.trim());
  }
  return salida;
}
