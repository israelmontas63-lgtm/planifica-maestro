# RUNBOOK: Procedimiento de Despliegue Seguro (Staging y Producción)

Este documento establece el protocolo operativo obligatorio y seguro para el despliegue de **Planifica Maestro**.
Prevalece la regla de máxima seguridad: **Cero impacto en producción y verificación progresiva verificada con evidencia.**

---

## ⚠️ Reglas Inmutables de Operaciones
1. **PROHIBIDO desplegar a producción sin la orden explícita e inequívoca del Dueño ("sí").**
2. **Supabase de STAGING es un proyecto completamente separado e independiente de Producción.**
3. **NUNCA ejecutar SQL manual directo ni migraciones no probadas contra la base de Producción.**
4. **El despliegue a producción debe ejecutarse obligatoriamente con la bandera `--keep-vars` para preservar variables de entorno del dashboard de Cloudflare.**
5. **Estandarización de URL:** Se utiliza exclusivamente `VITE_API_URL` como la única variable de entorno para la URL base en todos los scripts y clientes (sin duplicidad con `BASE_URL`).

---

## 1. Orden de Entornos y Migraciones de Supabase

El despliegue debe seguir estrictamente este orden secuencial:
1. **Supabase Staging:** Aplicar las migraciones canónicas en el orden definido en D2:
   - **Paso 1.1:** `supabase/migrations/20261014140000_curriculo_secuencias.sql` (fuente única de verdad del esquema, RLS, FTS ponderado y función RPC canónica).
   - **Paso 1.2:** `supabase/migrations/20261016_buscar_curriculo_secuencias.sql` (redefine `buscar_curriculo_secuencias` con ILIKE, devolviendo 0 filas ante frases conversacionales, e inserta 3 filas semilla con estado 'validado' cuyo tomo y página no están verificados).
   - **Paso 1.3:** `supabase/migrations/20261018010000_restaurar_fts_buscar_curriculo.sql` (restaura la función FTS canónica, obligatorio después del 1.2).
2. **Verificación de Base de Datos en Staging:** Ejecutar verificación automatizada previa a cualquier despliegue del worker.

---

---

## 2. Configuración de Secretos en Staging (Cloudflare Workers)

El worker de Cloudflare requiere credenciales del servidor inyectadas de forma segura.
Verificadas en código (`git grep -n "env\." -- worker`), las variables exactas leídas son:

### Secretos Principales (Obligatorios):
- **`SUPABASE_URL`**: URL HTTPS del proyecto Supabase de staging (ej: `https://<id-staging>.supabase.co`).
- **`SUPABASE_SERVICE_ROLE_KEY`**: Llave de servicio institucional para saltar RLS en operaciones administrativas del servidor y consultas de cuota.
- **`SUPABASE_ANON_KEY`**: Clave pública para consultas curriculares autenticadas vía RLS.
- **`GEMINI_API_KEY`**: Clave de Google AI Studio / Gemini para generación curricular y chat.
- **`APP_ACCESS_KEY`**: Clave institucional obligatoria en cabecera HTTP (`x-app-key`) para autenticar peticiones y evitar 500 Fail-Closed.
- **`OWNER_MASTER_KEY`**: Clave maestra para autenticar operaciones del Dueño mediante comparación en tiempo constante (`timingSafeEqualStr`).

### Secretos de Proveedores Adicionales (Opcionales):
- **`GROQ_API_KEY`**: Clave del proveedor Groq para inferencia y transcripción acelerada (`worker/index.js:3254`).
- **`TAVILY_API_KEY`**: Clave de búsqueda web externa (`worker/index.js:1733`).
- **`ELEVENLABS_API_KEY`**: Clave para síntesis de voz en `worker/services/voiceProvider.js:33`.

### Banderas de Configuración y Variables de Entorno:
- **`PROMPT_SISTEMA_V2`**: (`"true"` | `"false"`) Activa el prompt pedagógico V2 estructurado.
- **`HERRAMIENTAS_V2`**: (`"true"` | `"false"`) Activa el ciclo de tool-calling curricular previo al streaming.
- **`STREAMING_PROGRESIVO`**: (`"true"` | `"false"`) Habilita streaming token a token.
- **`HABILITAR_TRAZA_CAPAS`**: (`"true"` | `"false"`) Activa la auditoría interna de capas (apagada por defecto en producción).
- **`TURNOS_CONVERSACION_MAX`**: Límite de turnos conversacionales en memoria (por defecto `"6"`).
- **`GEMINI_MODEL`**: Modelo Gemini principal (por defecto `"gemini-3.1-flash-lite"`).

### Comandos exactos para registrar secretos en Staging:
```bash
# 1. Conexión con Supabase Staging
npx wrangler secret put SUPABASE_URL --env staging
npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY --env staging
npx wrangler secret put SUPABASE_ANON_KEY --env staging

# 2. Proveedores de Inteligencia Artificial
npx wrangler secret put GEMINI_API_KEY --env staging
npx wrangler secret put GROQ_API_KEY --env staging
npx wrangler secret put TAVILY_API_KEY --env staging
npx wrangler secret put ELEVENLABS_API_KEY --env staging

# 3. Acceso Institucional y Clave Maestra
npx wrangler secret put APP_ACCESS_KEY --env staging
npx wrangler secret put OWNER_MASTER_KEY --env staging
```

---

## 3. Ingesta Curricular y Verificaciones Previas Obligatorias

### 3.0 Ingesta de Datos Curriculares Oficiales
- **Estado de Ingesta:** NO EXISTE LOADER EJECUTABLE PARA curriculo_secuencias en scripts de Node.js (el archivo `scripts/curriculo/insertar_fragmentos_supabase.mjs` valida y normaliza estructuras en modo `--dry-run`, pero la inserción remota está detenida con aviso de no autorización en esta fase).
- **Semilla SQL de Carga:** Para poblar inicialmente la tabla `public.curriculo_secuencias` en staging, se ejecuta el script SQL semilla:
```bash
# Vía Supabase SQL Editor o psql:
# scripts/ingesta_curriculo_semilla.sql
```

### 3.1 Verificación de Supabase (`scripts/verificar_supabase.mjs`)
Usa clave **ANON** y valida que la tabla `curriculo_secuencias` tenga al menos 1 registro (falla si tiene 0 filas e informa el desglose por nivel y área):
```powershell
$env:SUPABASE_URL = "https://tu-proyecto-staging.supabase.co"
$env:SUPABASE_ANON_KEY = "tu-anon-key"
node scripts/verificar_supabase.mjs
```
*(EJEMPLO DE SALIDA ESPERADA EN STAGING TRAS INGESTA)*:
```
================================================================================
VERIFICACIÓN DE CONEXIÓN A SUPABASE Y TABLA curriculo_secuencias (CLAVE ANON)
================================================================================

[Conexión]: OK (35 ms)
[Tabla curriculo_secuencias]: OK (45 ms)
[Distribución Curricular]: 3 secuencias encontradas
   * Primario - Lengua Española: 2 secuencias
   * Primario - Matemática: 1 secuencias
[RPC buscar_curriculo_secuencias]: OK (38 ms)
[Registros RPC 2do Primaria Lengua Española]: 1

================================================================================
RESULTADO FINAL: ✅ TODO CORRECTO
================================================================================
```

### 3.2 Prueba Real de Gemini y Currículo (`scripts/prueba_real_gemini.mjs`)
Comando:
```powershell
$env:GEMINI_API_KEY = "tu-api-key"
$env:SUPABASE_URL = "https://tu-proyecto-staging.supabase.co"
node scripts/prueba_real_gemini.mjs
```
*(EJEMPLO DE SALIDA ESPERADA)*: Conexión con modelo Gemini OK, extracción estructurada OK y validación contra esquema curricular OK.

### 3.3 Verificación de la Guardia de Integridad y Pruebas
Comando:
```bash
npm.cmd run test:sin-guardia
```
Ejecutar y registrar el resultado real; no copiar cifras de ejecuciones anteriores.

---

## 4. Despliegue Progresivo a Staging y Encendido de Feature Flags

> [!IMPORTANT]
> El encendido de Feature Flags se realiza **SIN modificar `wrangler.toml`**, utilizando el parámetro oficial de Cloudflare:
> `npx wrangler deploy --env staging --keep-vars --var NOMBRE:valor`
> Esto previene mutaciones accidentales en el archivo bajo control de versiones.

### Paso 4.1: Despliegue inicial con banderas en `false`
```bash
npm run build
npx wrangler deploy --env staging --keep-vars --var PROMPT_SISTEMA_V2:false --var HERRAMIENTAS_V2:false --var STREAMING_PROGRESIVO:false
```
*(EJEMPLO DE SALIDA ESPERADA)*: `Deployed planifica-maestro-staging to https://planifica-maestro-staging.<subdominio>.workers.dev`

Verificar salud en staging:
```bash
curl -s https://planifica-maestro-staging.<subdominio>.workers.dev/api/health
```
*(EJEMPLO DE SALIDA ESPERADA)*:
```json
{
  "status": "healthy",
  "database": "ok",
  "auth": "activa"
}
```

### Paso 4.2: Encendido de Bandera 1 — `PROMPT_SISTEMA_V2`
Ejecutar despliegue con bandera `--var`:
```bash
npx wrangler deploy --env staging --keep-vars --var PROMPT_SISTEMA_V2:true
```
Verificar con URL única `VITE_API_URL`:
```powershell
$env:VITE_API_URL = "https://planifica-maestro-staging.<subdominio>.workers.dev"
node scripts/verificar_cerebro.mjs
```
*(EJEMPLO DE SALIDA ESPERADA)*: 11 capas verificadas con éxito.

**Plan de Reversa (Rollback):**
```bash
npx wrangler deploy --env staging --keep-vars --var PROMPT_SISTEMA_V2:false
# O rollback inmediato:
npx wrangler rollback --env staging
```

### Paso 4.3: Encendido de Bandera 2 — `HERRAMIENTAS_V2`
Ejecutar despliegue con bandera `--var`:
```bash
npx wrangler deploy --env staging --keep-vars --var HERRAMIENTAS_V2:true
```
Verificar con URL única `VITE_API_URL`:
```powershell
$env:VITE_API_URL = "https://planifica-maestro-staging.<subdominio>.workers.dev"
node scripts/verificar_cerebro.mjs
```
*(EJEMPLO DE SALIDA ESPERADA)*: Tool-calling curricular verificado y 0 fallos.

**Plan de Reversa (Rollback):**
```bash
npx wrangler deploy --env staging --keep-vars --var HERRAMIENTAS_V2:false
```

---

## 5. Despliegue a Producción (Exclusivo con Autorización del Dueño)

Solo cuando Staging haya sido verificado íntegramente y el Dueño haya otorgado su "sí" expreso:

1. **Migraciones en Supabase Producción:**
   Las migraciones solo se aplican en producción por el Dueño, con su "sí" expreso, tras verificar en staging y comprobar con SQL de solo lectura qué versión de la función está viva y qué filas semilla existen:
   ```sql
   select source_id, estado_validacion, pagina from public.curriculo_secuencias order by 1;
   select pg_get_functiondef('public.buscar_curriculo_secuencias(text,smallint,text,text,integer)'::regprocedure) ilike '%ts_rank%' as usa_fts;
   ```
   Las 3 filas semilla con estado 'validado' no verificadas (`SEC-PRI-2-ESP-001`, `SEC-PRI-2-ESP-002`, `SEC-PRI-2-MAT-001`) no deben quedar en producción sin verificar su fuente oficial (tomo y página). Si se aplican migraciones, seguir el orden estricto (1.1, 1.2 y obligatoriamente 1.3 para restaurar FTS).
2. **Secretos de Producción:**
   ```bash
   npx wrangler secret put SUPABASE_URL
   npx wrangler secret put SUPABASE_ANON_KEY
   npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY
   npx wrangler secret put GEMINI_API_KEY
   npx wrangler secret put APP_ACCESS_KEY
   ```
   > [!NOTE]
   > `SUPABASE_ANON_KEY` es obligatoria: el worker la exige para consultar el currículo (`worker/index.js: env.SUPABASE_URL && env.SUPABASE_ANON_KEY`); sin ella la consulta curricular se omite.
3. **Despliegue con `--keep-vars`:**
   > [!IMPORTANT]
   > El parámetro `--keep-vars` es OBLIGATORIO para no borrar variables o configuraciones añadidas directamente desde el Dashboard de Cloudflare.
   ```bash
   npm run build
   npx wrangler deploy --keep-vars
   ```
4. **Verificación Post-Despliegue:**
   ```powershell
   $env:VITE_API_URL = "https://planifica-maestro.<subdominio>.workers.dev"
   curl -s "$env:VITE_API_URL/api/health"
   node scripts/verificar_cerebro.mjs
   ```

---

## 6. Banderas del cerebro

- **`PROMPT_SISTEMA_V2`**, **`HERRAMIENTAS_V2`** y **`STREAMING_PROGRESIVO`**: están definidas solo en staging; sin ellas producción usa el prompt viejo y no usa el ciclo de herramientas.
- **`CACHE_KV` / `CURRICULO_KV`**: no están definidos (la caché es solo memoria del worker).
- **Consulta Curricular Directa**: solo requiere `SUPABASE_URL` y `SUPABASE_ANON_KEY`.


