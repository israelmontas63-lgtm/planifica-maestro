/**
 * server/ia/correctorTexto.js (CommonJS)
 * 
 * Fachada para Node.js delegando en shared/correctorTexto.js
 * con soporte para Capa Contextual con enrutadorIA.
 */

const shared = require("../../shared/correctorTexto.js");
const { enrutarPeticion } = require("./enrutadorIA.js");
const { puedeRealizarConsulta } = require("./gestorGasto.js");

// ── CAPA CONTEXTUAL CON ENRUTADOR IA (Solo cuando hay ambigüedad real) ──

async function corregirTextoPedagogico({ texto = "", usarIA = false, env = process.env, signal = null }) {
  const resLocal = shared.corregirTextoPedagogicoLocal(texto);

  if (!usarIA || !puedeRealizarConsulta(300) || resLocal.textoCorregido.length < 8) {
    return resLocal;
  }

  try {
    const promptCorreccion = `Eres el módulo de corrección ortográfica y fonética pedagógica de Planifica Maestro (República Dominicana).
Corrige el siguiente texto dictado o escrito por un docente.
Reglas estrictas:
1. Aplica tildes y concordancia gramatical correcta en español.
2. Normaliza términos MINERD y grados escolares (ej: "3.º de Primaria").
3. NUNCA cambies nombres propios de próceres dominicanos, educadores ni nombres de escuelas.
4. Responde ÚNICAMENTE con el texto corregido, sin explicaciones ni saludos.

Texto: "${resLocal.textoCorregido}"`;

    const respuestaIA = await enrutarPeticion({
      tema: "Corrección fonética y ortográfica",
      prompt: promptCorreccion,
      env,
      signal
    });

    if (respuestaIA && !respuestaIA.error && respuestaIA.texto) {
      const textoIA = respuestaIA.texto.replace(/^["']|["']$/g, "").trim();
      if (textoIA && textoIA !== resLocal.textoCorregido) {
        const cambioSignificadoIA = shared.normalizarSinTildesNiMayusculas(resLocal.textoOriginal) !== shared.normalizarSinTildesNiMayusculas(textoIA);
        return {
          ...resLocal,
          textoCorregido: textoIA,
          cambios: [
            ...resLocal.cambios,
            { antes: resLocal.textoCorregido, despues: textoIA, tipo: "contextual_ia" }
          ],
          huboCambios: true,
          cambioSignificado: cambioSignificadoIA,
          corregidoConIA: true
        };
      }
    }
  } catch (err) {}

  return resLocal;
}

module.exports = {
  corregirTextoPedagogicoLocal: shared.corregirTextoPedagogicoLocal,
  corregirTextoPedagogico,
  distanciaLevenshtein: shared.distanciaLevenshtein,
  esNombreOFraseProtegida: shared.esNombreOFraseProtegida,
  corregirHomofonosDeVoz: shared.corregirHomofonosDeVoz,
  normalizarGradosHablados: shared.normalizarGradosHablados,
  VOCABULARIO_MINERD: shared.VOCABULARIO_MINERD,
  PROCERES_Y_EDUCADORES: shared.PROCERES_Y_EDUCADORES,
  SIGLAS_PROTEGIDAS: shared.SIGLAS_PROTEGIDAS,
  normalizarSinTildesNiMayusculas: shared.normalizarSinTildesNiMayusculas
};
