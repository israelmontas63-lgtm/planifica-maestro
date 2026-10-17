# RUNBOOK: Verificación y Conexión de Supabase (Currículo MINERD)

Este documento detalla el procedimiento para conectar y verificar la base de datos de Supabase con el esquema curricular oficial de Planifica Maestro.

---

## 1. Aplicación de las Migraciones SQL

Supabase requiere la aplicación de las migraciones en el siguiente orden estricto (ambas son 100% idempotentes):

1. **Migración Base (Esquema, FTS, RLS, Triggers):**
   - Archivo: `supabase/migrations/20261014140000_curriculo_secuencias.sql`
   - Acción: Abre el **SQL Editor** en Supabase Dashboard, pega el contenido y pulsa **Run**.
2. **Migración RPC y Datos Semilla Canónicos:**
   - Archivo: `supabase/migrations/20261016_buscar_curriculo_secuencias.sql`
   - Acción: Pega el script en el SQL Editor y pulsa **Run**. Instala la RPC `buscar_curriculo_secuencias` y los registros oficiales de 2do de Primaria (Lengua Española y Matemática).

---

## 2. Ejecución del Script de Verificación

El script `scripts/verificar_supabase.mjs` prueba la conexión HTTPS, la existencia de la función RPC y la presencia de registros reales sin exponer claves ni secretos en la salida.
> [!NOTE]
> Para el Worker de producción y staging se utiliza **`SUPABASE_SERVICE_ROLE_KEY`**. Para la verificación local o diagnóstica puedes utilizar indistintamente `SUPABASE_SERVICE_ROLE_KEY` o `SUPABASE_ANON_KEY`.

### En Windows (PowerShell):
```powershell
$env:SUPABASE_URL = "https://tu-proyecto.supabase.co"
$env:SUPABASE_SERVICE_ROLE_KEY = "tu-service-role-key-aqui"
node scripts/verificar_supabase.mjs
```

### En Linux / macOS (Bash):
```bash
export SUPABASE_URL="https://tu-proyecto.supabase.co"
export SUPABASE_ANON_KEY="tu-anon-key-aqui"
node scripts/verificar_supabase.mjs
```

---

## 3. Salida Esperada

Una verificación exitosa reporta:
```
[Conexión]: OK (120 ms)
[RPC buscar_curriculo_secuencias]: OK (145 ms)
[Registros 2do Primaria Lengua Española]: 2
   Ejemplo: "La Noticia" (Fuente: Adecuación Curricular Nivel Primario (MINERD))
================================================================================
RESULTADO FINAL: ✅ TODO CORRECTO
================================================================================
```

---

## 4. Reglas de Seguridad
- **NO** subas archivos `.env` con credenciales reales al repositorio.
- Las credenciales deben residir exclusivamente en tus variables de entorno locales o en las variables secretas de Cloudflare Workers (`wrangler secret put SUPABASE_ANON_KEY`).
