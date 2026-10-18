# RUNBOOK: Configuración y Verificación de Supabase (Currículo MINERD)

Este documento detalla el procedimiento oficial y seguro para conectar y verificar la base de datos de Supabase con el esquema curricular oficial de **Planifica Maestro**.

---

## ⚠️ Reglas Operativas Obligatorias
1. **Aislamiento de Staging:** Staging DEBE configurarse en un proyecto Supabase completamente independiente y separado de Producción.
2. **Prohibición en Producción:** NUNCA ejecutar scripts de prueba, datos semilla experimentales ni migraciones manuales en el proyecto de Producción.
3. **Fuente Única de Verdad:** Las migraciones deben aplicarse estrictamente en el orden canónico establecido en D2.

---

## 1. Orden Canónico de Aplicación de Migraciones SQL

Supabase requiere la aplicación de las migraciones en el siguiente orden estricto (ambas 100% idempotentes):

### Paso 1: Migración Base Canónica (Fuente de Verdad del Esquema)
- **Archivo:** `supabase/migrations/20261014140000_curriculo_secuencias.sql`
- **Contenido:**
  - Extensión `unaccent` y configuración de búsqueda en español sin tildes (`es_sin_tildes`).
  - Tabla canónica `public.curriculo_secuencias` con restricciones de integridad curricular (`chk_coherencia_primaria`, `source_id` único).
  - Columna TSVECTOR generada (`fts_vector`) ponderada en 3 niveles (A: tema, B: competencias e indicadores, C: contenidos).
  - Índices GIN y B-tree de optimización.
  - Trigger automático de auditoría `actualizado_en`.
  - **Seguridad RLS activada:** `ENABLE ROW LEVEL SECURITY`.
  - Política de lectura pública `curriculo_secuencias_select_public` para roles `anon` y `authenticated` restringida a `vigente = true`.
  - Permisos explícitos: `GRANT SELECT` a `anon, authenticated`, y `REVOKE INSERT, UPDATE, DELETE, TRUNCATE` de `anon, authenticated`.
  - Función RPC canónica `buscar_curriculo_secuencias` con coincidencia de tema y ranking FTS `ts_rank_cd`.
  - Alias retrocompatible `buscar_curriculo`.
- **Acción:** Abrir el **SQL Editor** en Supabase Dashboard del proyecto de Staging, pegar el script y pulsar **Run**.

### Paso 2: Migración Histórica 20261016 (Advertencia de Sobreescritura)
- **Archivo:** `supabase/migrations/20261016_buscar_curriculo_secuencias.sql`
- **Contenido Real (NO es un no-op):**
  - Crea la tabla `public.curriculo_secuencias` si no existe (`CREATE TABLE IF NOT EXISTS`).
  - Redefine la función RPC `buscar_curriculo_secuencias` mediante `CREATE OR REPLACE FUNCTION` con lógica basada en `ILIKE`.
  - Inserta filas semilla con `ON CONFLICT (source_id) DO NOTHING`.
- **Efecto Crítico:** Aplicada después de la canónica `20261014140000`, degrada la búsqueda curricular a coincidencia literal por `ILIKE` (devolviendo 0 filas ante frases conversacionales) e inserta 3 filas semilla (`SEC-PRI-2-ESP-001`, `SEC-PRI-2-ESP-002`, `SEC-PRI-2-MAT-001`; páginas 75, 78 y 118) con estado `validado` cuyo tomo y página no están verificados.
- **Advertencia de Producción:** Esas 3 filas semilla con estado `validado` no deben estar en producción sin verificar su fuente oficial (tomo y página).

### Paso 2b: Restauración de Función FTS Canónica
- **Archivo:** `supabase/migrations/20261018010000_restaurar_fts_buscar_curriculo.sql`
- **Propósito:** Restaura la función FTS canónica `buscar_curriculo_secuencias` con ranking `ts_rank_cd` y coincidencia disyuntiva de tema.
- **Acción Obligatoria:** Debe aplicarse inmediatamente después de `20261016` para neutralizar cualquier degradación por `ILIKE` y garantizar el comportamiento curricular oficial.

### Paso 3: Ingesta de Datos Curriculares Oficiales
- **Estado de Ingesta:** NO EXISTE LOADER EJECUTABLE PARA curriculo_secuencias en Node.js (el script `scripts/curriculo/insertar_fragmentos_supabase.mjs` valida estructuras en dry-run sin inserción remota).
- **Semilla SQL Disponible:** Para poblar la tabla en staging, aplicar el script SQL semilla: `scripts/ingesta_curriculo_semilla.sql`.
- **Nota:** La base de datos debe contener secuencias oficiales validadas antes de dar por buena la verificación (si tiene 0 filas, `verificar_supabase.mjs` fallará con código 1).

---

## 2. Ejecución del Script de Verificación Automatizada

El script `scripts/verificar_supabase.mjs` utiliza la clave pública **`SUPABASE_ANON_KEY`** para comprobar:
1. Conexión HTTPS básica a la API REST.
2. Lectura directa a `public.curriculo_secuencias` protegida por RLS. **Falla si la tabla tiene 0 filas** e informa la distribución de secuencias agrupadas por nivel y área.
3. Ejecución del RPC canónico `buscar_curriculo_secuencias`.

### En Windows (PowerShell):
```powershell
$env:SUPABASE_URL = "https://tu-proyecto-staging.supabase.co"
$env:SUPABASE_ANON_KEY = "tu-anon-key"
node scripts/verificar_supabase.mjs
```

### En Linux / macOS (Bash):
```bash
export SUPABASE_URL="https://tu-proyecto-staging.supabase.co"
export SUPABASE_ANON_KEY="tu-anon-key"
node scripts/verificar_supabase.mjs
```

---

## 3. Resultado Esperado de la Verificación

*(EJEMPLO DE SALIDA ESPERADA EN PROYECTO CON DATOS OFICIALES CARGADOS)*:
```
================================================================================
VERIFICACIÓN DE CONEXIÓN A SUPABASE Y TABLA curriculo_secuencias (CLAVE ANON)
================================================================================

[Conexión]: OK (35 ms)
[Tabla curriculo_secuencias]: OK (42 ms)
[Distribución Curricular]: 3 registros encontrados
   * Primario - Lengua Española: 2 secuencias
   * Primario - Matemática: 1 secuencias
[RPC buscar_curriculo_secuencias]: OK (45 ms)
[Registros RPC 2do Primaria Lengua Española]: 1

================================================================================
RESULTADO FINAL: ✅ TODO CORRECTO
================================================================================
```

---

## 4. Auditoría de Seguridad y Permisos RLS
Para confirmar el blindaje de seguridad en Supabase, ejecute en SQL Editor:
```sql
-- 1. Verificar que RLS esté activo
SELECT relname, relrowsecurity 
FROM pg_class 
WHERE relname = 'curriculo_secuencias';
-- Resultado esperado: relrowsecurity = true

-- 2. Verificar políticas activas
SELECT policyname, permissive, roles, cmd, qual 
FROM pg_policies 
WHERE tablename = 'curriculo_secuencias';
-- Resultado esperado: curriculo_secuencias_select_public
```
