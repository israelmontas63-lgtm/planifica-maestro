# RUNBOOK: Procedimiento de Despliegue (Staging y Producción)

Este documento describe la política y el protocolo estricto de despliegue para **Planifica Maestro**.

---

## ⚠️ Regla Inmutable de Operaciones
> **PROHIBIDO desplegar a producción sin la autorización explícita e inequívoca del Dueño.**
> Todo cambio debe verificarse previamente en local (`npm test`, `npm run guardia`) y opcionalmente en el entorno de `staging`.

---

## 1. Configuración de Secretos en Staging

Antes del primer despliegue a Staging, configura las credenciales requeridas en Cloudflare Workers.
> [!IMPORTANT]
> El Worker opera del lado servidor y requiere **`SUPABASE_SERVICE_ROLE_KEY`** (no la `anon key`) para ejecutar la función RPC curricular `buscar_curriculo_secuencias` y consultar `curriculo_secuencias` sin bloqueos de RLS. Asimismo, requiere **`APP_ACCESS_KEY`** para autorizar las solicitudes institucionales vía cabeceras HTTP.

```bash
# 1. Clave del proveedor de IA (Google Gemini)
npx wrangler secret put GEMINI_API_KEY --env staging

# 2. Conexión con Supabase (Currículo MINERD)
npx wrangler secret put SUPABASE_URL --env staging
npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY --env staging

# 3. Clave de acceso institucional / API
npx wrangler secret put APP_ACCESS_KEY --env staging

# 4. (Opcional) Proveedor de búsqueda web externa
npx wrangler secret put TAVILY_API_KEY --env staging
```

---

## 2. Orden de Encendido de Banderas de Funcionalidad (Feature Flags)

Para garantizar un encendido progresivo y seguro sin degradaciones en el servicio:
1. **Fase 1 - Base Curricular y Prompt:** `PROMPT_SISTEMA_V2 = "true"` (establece el tono pedagógico dominicano y los 11 esquemas oficiales; seguro sin dependencias de base de datos).
2. **Fase 2 - Herramientas Curriculares (Tool-Calling):** `HERRAMIENTAS_V2 = "true"` (activa el ciclo de `consultar_base_datos` previo al streaming; requiere Supabase verificado con `node scripts/verificar_supabase.mjs`).
3. **Fase 3 - Streaming Progresivo:** `STREAMING_PROGRESIVO = "true"` (activa SSE chunk a chunk con contratos blindados y sanitización de citas).
4. **Fase 4 - Visión Multimodal:** `OJO_DIGITAL = "true"` (activa captura y procesamiento de imágenes con rotación de modelos `GEMINI_VISION_MODELS`).

---

## 3. Comparación y Orden de Migraciones SQL

Supabase cuenta con dos archivos de migración en `supabase/migrations/`:
- **`20261014140000_curriculo_secuencias.sql`**: Migración base que define la estructura canónica completa (`public.curriculo_secuencias`), extensiones (`unaccent`, `es_sin_tildes`), índices de búsqueda de texto completo (FTS), triggers de auditoría y políticas de seguridad RLS.
- **`20261016_buscar_curriculo_secuencias.sql`**: Actualización canónica que asegura la función RPC `buscar_curriculo_secuencias` e inserta los datos semilla oficiales para 2.° Grado de Primaria (Lengua Española y Matemática).

**Orden de aplicación:**
1. Aplicar primero `20261014140000_curriculo_secuencias.sql`.
2. Aplicar después `20261016_buscar_curriculo_secuencias.sql`.

Ambas migraciones son **100% idempotentes** (`CREATE TABLE IF NOT EXISTS`, `CREATE EXTENSION IF NOT EXISTS`, `CREATE OR REPLACE FUNCTION`, `ON CONFLICT DO NOTHING`), por lo que pueden reejecutarse sin riesgo de error ni corrupción de datos.

---

## 4. Compilación y Despliegue a Staging

El entorno de staging está definido en `wrangler.toml` bajo `[env.staging]` como `planifica-maestro-staging`.

1. Construir la aplicación cliente (PWA):
   ```bash
   npm run build
   ```

2. Ejecutar la guardia y las pruebas locales:
   ```bash
   npm test
   npm run guardia
   ```

3. Desplegar a Staging:
   ```bash
   npx wrangler deploy --env staging
   ```

---

## 5. Protocolo de Validación en Staging

Una vez desplegado en Staging:
1. Probar salud del endpoint:
   ```bash
   curl -s https://planifica-maestro-staging.<tu-subdominio>.workers.dev/api/health
   ```
2. Ejecutar el script de verificación con la URL de Staging:
   ```bash
   $env:VITE_API_URL = "https://planifica-maestro-staging.<tu-subdominio>.workers.dev"
   node scripts/verificar_cerebro.mjs --real
   ```
3. Verificar manualmente en navegador la instalación de la PWA y la respuesta del asistente pedagógico.

---

## 6. Despliegue a Producción (Solo con Aprobación del Dueño)

Cuando el Dueño emita la orden de despliegue:

```bash
# 1. Asegurar integridad 100% verde
npm run guardia

# 2. Desplegar worker y assets a producción
npx wrangler deploy
```
