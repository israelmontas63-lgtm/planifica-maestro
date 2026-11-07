import { Buffer } from 'node:buffer';

/**
 * Gestor de Archivos y Metadatos de Visión - Planifica Maestro
 * Soporte de almacenamiento frío en Supabase Storage Bucket
 */
export class GestorArchivos {
  constructor(env = {}) {
    this.env = env || {};
    this.supabaseUrl = (this.env.SUPABASE_URL || `https://${this.env.SUPABASE_PROJECT_REF || 'obcjdxearmmvtihfmtaa'}.supabase.co`).replace(/\/+$/, '');
    this.serviceKey = this.env.SUPABASE_SERVICE_ROLE_KEY || '';
    this.bucketName = 'capturas_asistente';
  }

  async subirImagenBase64(base64Data, mimeType = 'image/jpeg') {
    if (!base64Data) {
      return { archivoId: null, archivoUrl: null };
    }

    const rawClean = base64Data.replace(/^data:image\/\w+;base64,/, '');
    const buffer = typeof Buffer !== 'undefined'
      ? Buffer.from(rawClean, 'base64')
      : Uint8Array.from(atob(rawClean), c => c.charCodeAt(0));

    const extension = mimeType.split('/')[1] || 'jpg';
    const archivoId = `img_${Date.now()}_${Math.random().toString(36).substring(2, 8)}.${extension}`;

    const urlUpload = `${this.supabaseUrl}/storage/v1/object/${this.bucketName}/${archivoId}`;

    const res = await fetch(urlUpload, {
      method: 'POST',
      headers: {
        'apikey': this.serviceKey,
        'Authorization': `Bearer ${this.serviceKey}`,
        'Content-Type': mimeType
      },
      body: buffer
    });

    if (!res.ok) {
      // Si el bucket aún no estuviera listo o falla la red, no frenamos la app; devolvemos el ID local
      return { archivoId, archivoUrl: null };
    }

    const archivoUrl = `${this.supabaseUrl}/storage/v1/object/public/${this.bucketName}/${archivoId}`;
    return { archivoId, archivoUrl };
  }
}
