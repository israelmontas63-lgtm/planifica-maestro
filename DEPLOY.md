# DEPLOY.md - Planifica Maestro

Procedimiento verificado para desplegar en Cloudflare Workers.
Ejecutar desde la raíz del repo (`planifica-maestro/`).

---

## 1. Autenticar Wrangler

```bash
npx wrangler login
```

Abre el navegador para autorizar la cuenta de Cloudflare.
Alternativa: configurar `CLOUDFLARE_API_TOKEN` como variable de entorno del sistema.

---

## 2. Ver secretos existentes

```bash
npx wrangler secret list
```

Compara la lista con los nombres del paso 3.

---

## 3. Configurar secretos faltantes

Nombres de secretos que usa `worker/index.js`.
Comando de verificación (ejecutado 2026-09-21):

```bash
node -e "const t=require('fs').readFileSync('worker/index.js','utf8');const m=t.match(/env\.([A-Z_]+)/g);console.log([...new Set(m)].join('\n'));"
```

Salida real:
```
env.SUPABASE_URL
env.SUPABASE_SERVICE_ROLE_KEY
env.GEMINI_API_KEY
env.APP_ACCESS_KEY
env.OWNER_MASTER_KEY
env.ASSETS
```

`env.ASSETS` es el binding de `wrangler.toml`, NO es un secreto.
Configurar los 5 secretos (solo si no aparecen en `secret list`):

```bash
npx wrangler secret put GEMINI_API_KEY
npx wrangler secret put SUPABASE_URL
npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY
npx wrangler secret put APP_ACCESS_KEY
npx wrangler secret put OWNER_MASTER_KEY
```

Wrangler pide el valor de forma interactiva.

---

## 4. Build y deploy

```bash
npm run deploy
```

Ejecuta: `npm run build && wrangler deploy`
- `npm run build` compila `client/` a `client/dist/`
- `wrangler.toml` NO tiene sección `[build]` (eliminada en Fase 1, evita doble compilación)

---

## 5. Verificar cabeceras y health en producción

Sustituir `<URL>` por la URL `*.workers.dev` que reporte `wrangler deploy`.

```bash
curl -I https://<URL>/sw.js
curl -I https://<URL>/index.html
curl -I https://<URL>/manifest.webmanifest
curl -I https://<URL>/assets/index-<HASH>.js
curl    https://<URL>/api/health
curl -I https://<URL>/planificacion
```

Cabeceras esperadas (verificadas con wrangler dev local, 2026-09-21):

- `/` -> `no-cache, no-store, must-revalidate`
- `/sw.js` -> `no-cache, no-store, must-revalidate`
- `/manifest.webmanifest` -> `no-cache, no-store, must-revalidate`
- `/planificacion` (SPA) -> `no-cache, no-store, must-revalidate`
- `/assets/*` -> `public, max-age=31536000, immutable`

---

## 6. Instalar PWA y probar banner de actualización

1. Abrir `https://<URL>` en Chrome/Edge (Android o escritorio).
2. Aceptar el aviso de instalación del navegador.
3. Para forzar el banner:
   a) Subir cambio de código y ejecutar `npm run deploy`.
   b) Abrir la PWA ya instalada.
   c) Nueva versión detectada vía:
      - `visibilitychange`: al volver a la app
      - `online`: al recuperar conexión a internet
      - `setInterval`: cada 30 minutos (`main.jsx` línea 71)
   d) Aparece banner: `Hay una nueva versión disponible [Actualizar]`
   e) Pulsar Actualizar => `updateSW(true)` => SW nuevo activo => recarga.

El banner NO aparece sin un deploy previo con nuevo contenido.

---

## Fase 2: pendientes (SOLO referencia, no ejecutar)

Hechos comprobados en auditoria Fase 1, tarea 1.6.

### (a) Worker tiene copias propias; no importa de server/

`worker/index.js` líneas 1-3:

```javascript
import { LEVELS } from './levels.js';
import { obtenerContextoConBase } from './contextoConBase.js';
import { getAiProvider, getGeminiModels, fetchGeminiWithRetry } from './services/aiProvider.js';
```

Módulos duplicados entre `worker/` y `server/`:
- `levels.js` -> copias independientes
- `contextoConBase.js` -> copias con ~530 bytes de diferencia (ver c)
- Cuotas -> inline en worker vs `server/curriculum/quotaManager.js`
- Auth -> inline en worker vs `server/routes/auth.js`

### (b) server/services/aiProvider.js NO existe

`server/services/` contiene solo: `wikipedia.js` (re-exporta de `worker/services/`)
`aiProvider.js` real: `worker/services/aiProvider.js` (8977 bytes).

### (c) contextoConBase.js difiere ~530 bytes

Diff real ejecutado con Node.js (2026-09-21):

```
worker/contextoConBase.js            : 261 líneas, 117978 bytes
server/curriculum/contextoConBase.js : 254 líneas, 117448 bytes
Líneas distintas: 258 de 261
```

Diferencias en cabecera (L2-L12):
- L2 worker : `MUESTRA REFERENCIAL LOCAL (NO VERIFICADA)`
- L2 server : `CONTEXTO OFICIAL VERIFICADO (MINERD / UNICEF)`
- L4 worker : `TRAZABILIDAD Y PROCEDENCIA:`
- L4 server : `Extraído directamente de las Guías Didácticas Oficiales`
- L5-L12 worker : 7 líneas de advertencias NO VERIFICADO (más líneas totales)
- L5-L12 server : Citas bibliográficas y descripción de cobertura (menos líneas)

`worker/` = borrador referencial.
`server/curriculum/` = afirma ser contenido oficial verificado.
No corregido en Fase 1 (R2: tarea 1.6 es de solo lectura).
