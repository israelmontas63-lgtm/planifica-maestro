// Combina la señal del cliente (opcional) con un tiempo límite por intento.
export function senalConLimite(senalCliente, ms) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(new Error("TIMEOUT_INTENTO:" + ms + "ms")), ms);
  const alAbortar = () => ctrl.abort(senalCliente.reason);
  if (senalCliente) {
    if (senalCliente.aborted) ctrl.abort(senalCliente.reason);
    else senalCliente.addEventListener("abort", alAbortar, { once: true });
  }
  const limpiar = () => { clearTimeout(t); if (senalCliente) senalCliente.removeEventListener("abort", alAbortar); };
  return { signal: ctrl.signal, limpiar };
}
export async function fetchConLimite(url, options = {}, ms = 25000) {
  const { signal, limpiar } = senalConLimite(options.signal, ms);
  try { return await fetch(url, { ...options, signal }); }
  finally { limpiar(); }
}
export const esTimeoutIntento = (e) => /TIMEOUT_INTENTO/.test(String((e && e.message) || e)) || (e && e.cause && /TIMEOUT_INTENTO/.test(String(e.cause.message)));
