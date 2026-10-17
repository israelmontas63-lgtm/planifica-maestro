# RUNBOOK: Verificación y Conexión de Supabase (Currículo MINERD)

Este documento detalla el procedimiento para conectar y verificar la base de datos de Supabase con el esquema curricular oficial de Planifica Maestro.

---

## 1. Aplicación de la Migración SQL

Si la tabla `public.curriculo_secuencias` o la RPC `public.buscar_curriculo_secuencias` no existen en tu proyecto de Supabase:

1. Abre el panel de control de tu proyecto en [Supabase Dashboard](https://supabase.com/dashboard).
2. Dirígete a la sección **SQL Editor**.
3. Abre o copia el contenido del archivo:
   `supabase/migrations/20261016_buscar_curriculo_secuencias.sql`
4. Pega el script en el editor y haz clic en **Run**.
5. El script creará la tabla, la RPC `buscar_curriculo_secuencias` e insertará registros canónicos iniciales para **2do de Primaria (Lengua Española y Matemática)**.

---

## 2. Ejecución del Script de Verificación

El script `scripts/verificar_supabase.mjs` prueba la conexión HTTPS, la existencia de la función RPC y la presencia de registros reales sin exponer claves ni secretos en la salida.

### En Windows (PowerShell):
```powershell
$env:SUPABASE_URL = "https://tu-proyecto.supabase.co"
$env:SUPABASE_ANON_KEY = "tu-anon-key-aqui"
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
