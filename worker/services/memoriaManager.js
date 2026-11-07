/**
 * worker/services/memoriaManager.js
 * Gestor de Memoria Multimodal y Persistencia en Supabase
 * Soporta almacenamiento frío con metadatos adjuntos y resúmenes visuales densos
 */
export class MemoriaManager {
  constructor(supabaseUrl, serviceRoleKey) {
    this.url = supabaseUrl ? supabaseUrl.replace(/\/+$/, '') : '';
    this.key = serviceRoleKey;
  }

  async obtenerHistorial(sesionId, limite = 10) {
    const endpoint = `${this.url}/rest/v1/conversaciones_mensajes?sesion_id=eq.${sesionId}&order=creado_en.asc&limit=${limite}`;
    const res = await fetch(endpoint, {
      method: 'GET',
      headers: {
        'apikey': this.key,
        'Authorization': `Bearer ${this.key}`
      }
    });

    if (!res.ok) return [];
    const filas = await res.json();

    // Formatear al estándar Gemini / LLM Content Parts con optimización de tokens
    return filas.map(f => {
      const parts = [];
      const adjunto = f.metadatos?.metadatos_adjunto || f.metadatos;

      // Si existe binario inline sin procesar
      if (f.imagen_url && f.imagen_url.startsWith('data:image')) {
        const [meta, data] = f.imagen_url.split(',');
        const mimeType = (meta && meta.match(/:(.*?);/)?.[1]) || 'image/jpeg';
        parts.push({ inlineData: { mimeType, data } });
      }

      // Si tiene resumen visual denso (columna dedicada o en metadatos), se inyecta en el texto para turnos posteriores
      let texto = f.contenido;
      const resumen = f.resumen_visual || adjunto?.resumen_visual;
      if (resumen) {
        texto = `[Contexto visual previo: ${resumen}]\n${texto}`;
      }

      parts.push({ text: texto });
      return { role: f.rol === 'model' ? 'model' : 'user', parts };
    });
  }

  async guardarMensaje({
    sesionId,
    rol,
    contenido,
    imagenBase64 = null,
    archivoId = null,
    archivoUrl = null,
    resumenVisual = null,
    metadatos = {}
  }) {
    const endpoint = `${this.url}/rest/v1/conversaciones_mensajes`;
    const adjunto = metadatos?.metadatos_adjunto || metadatos;
    const resolvedArchivoId = archivoId || adjunto?.id_archivo || adjunto?.archivo_id || null;
    const resolvedArchivoUrl = archivoUrl || adjunto?.url_descarga || adjunto?.archivo_url || null;
    const resolvedResumenVisual = resumenVisual || adjunto?.resumen_visual || null;
    const tieneImagen = Boolean(imagenBase64 || resolvedArchivoId || resolvedArchivoUrl || f_tiene_img(metadatos));

    return await fetch(endpoint, {
      method: 'POST',
      headers: {
        'apikey': this.key,
        'Authorization': `Bearer ${this.key}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal'
      },
      body: JSON.stringify({
        sesion_id: sesionId,
        rol: rol,
        contenido: contenido,
        tiene_imagen: tieneImagen,
        archivo_id: resolvedArchivoId,
        archivo_url: resolvedArchivoUrl,
        resumen_visual: resolvedResumenVisual,
        imagen_url: imagenBase64 ? imagenBase64.substring(0, 500) + '...[truncated]' : (resolvedArchivoUrl || null),
        metadatos: metadatos
      })
    });
  }
}

function f_tiene_img(m) {
  return m && (m.tiene_imagen || m.tipo === 'imagen');
}
