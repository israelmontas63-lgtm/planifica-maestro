-- =============================================================================
-- PARTE 1: ESQUEMA, TABLA, INDICES, RLS Y FUNCIONES RPC MINERD
-- Proyecto: obcjdxearmmvtihfmtaa (Planifica Maestro)
-- =============================================================================

-- 1. MIGRACION CANONICA: ESQUEMA, TABLA, INDICES, RLS Y FUNCIONES
-- =============================================================================
-- MIGRACIÓN CANÓNICA: CURRÍCULO SECUENCIAS MINERD (DISEÑO A)
-- Tabla public.curriculo_secuencias y función public.buscar_curriculo_secuencias
-- Idempotente: puede ejecutarse repetidas veces sin error.
-- =============================================================================

-- 0. Verificación previa de seguridad
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'curriculo_secuencias'
    ) THEN
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_schema = 'public' 
              AND table_name = 'curriculo_secuencias' 
              AND column_name = 'source_id'
        ) THEN
            RAISE EXCEPTION 'La tabla public.curriculo_secuencias ya existe pero con una estructura incompatible (falta columna source_id). Abortando.';
        END IF;
    END IF;
END $$;

-- 1. Habilitar extensión unaccent y configuración es_sin_tildes
CREATE EXTENSION IF NOT EXISTS unaccent;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_ts_config WHERE cfgname = 'es_sin_tildes') THEN
        CREATE TEXT SEARCH CONFIGURATION es_sin_tildes (COPY = spanish);
    END IF;
END $$;

ALTER TEXT SEARCH CONFIGURATION es_sin_tildes
    ALTER MAPPING FOR word, hword, hword_part
    WITH unaccent, spanish_stem;


-- 2. Función inmutable para convertir arreglo JSONB a texto en FTS
CREATE OR REPLACE FUNCTION public.jsonb_array_to_text(arr jsonb)
RETURNS text
LANGUAGE sql IMMUTABLE PARALLEL SAFE
SET search_path = ''
AS $$
    SELECT coalesce(string_agg(elem, ' '), '')
    FROM (
        SELECT jsonb_array_elements_text(arr) AS elem
    ) s
$$;

-- 3. Función trigger para actualizado_en
CREATE OR REPLACE FUNCTION public.trg_actualizado_en_curriculo_secuencias()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
    NEW.actualizado_en = now();
    RETURN NEW;
END;
$$;

-- 4. Tabla canónica public.curriculo_secuencias
CREATE TABLE IF NOT EXISTS public.curriculo_secuencias (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_id TEXT NOT NULL,
    nivel TEXT NOT NULL CHECK (nivel IN ('Inicial', 'Primario', 'Secundario')),
    ciclo TEXT NOT NULL CHECK (ciclo IN ('Primer Ciclo', 'Segundo Ciclo')),
    grado_num SMALLINT NOT NULL CHECK (grado_num BETWEEN 1 AND 6),
    area TEXT NOT NULL,
    tema TEXT NOT NULL,
    bloque_guia TEXT,
    competencias_especificas TEXT NOT NULL,
    contenidos_texto_original TEXT,
    indicadores_logro JSONB NOT NULL CHECK (jsonb_typeof(indicadores_logro) = 'array'),
    fuente_documento TEXT NOT NULL,
    version_curricular TEXT NOT NULL,
    pagina TEXT,
    url_fuente TEXT,
    estado_validacion TEXT NOT NULL CHECK (estado_validacion IN ('pendiente_validacion', 'requiere_revision_fuente', 'validado')),
    vigente BOOLEAN NOT NULL DEFAULT true,
    huella TEXT NOT NULL,
    creado_en TIMESTAMPTZ NOT NULL DEFAULT now(),
    actualizado_en TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_curriculo_secuencias_source_id UNIQUE (source_id),
    CONSTRAINT chk_coherencia_primaria CHECK (
        nivel <> 'Primario' 
        OR (ciclo = 'Primer Ciclo' AND grado_num BETWEEN 1 AND 3) 
        OR (ciclo = 'Segundo Ciclo' AND grado_num BETWEEN 4 AND 6)
    )
);

-- Columna generada de búsqueda FTS ponderada sin tildes (es_sin_tildes)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
          AND table_name = 'curriculo_secuencias' 
          AND column_name = 'fts_vector'
    ) THEN
        ALTER TABLE public.curriculo_secuencias 
        ADD COLUMN fts_vector TSVECTOR GENERATED ALWAYS AS (
            setweight(to_tsvector('es_sin_tildes', coalesce(tema, '')), 'A') ||
            setweight(to_tsvector('es_sin_tildes', coalesce(competencias_especificas, '') || ' ' || public.jsonb_array_to_text(indicadores_logro)), 'B') ||
            setweight(to_tsvector('es_sin_tildes', coalesce(contenidos_texto_original, '')), 'C')
        ) STORED;
    END IF;
END $$;

-- 5. Índices
CREATE INDEX IF NOT EXISTS idx_curriculo_secuencias_fts 
    ON public.curriculo_secuencias USING gin (fts_vector);

CREATE INDEX IF NOT EXISTS idx_curriculo_secuencias_filtros 
    ON public.curriculo_secuencias (nivel, grado_num, area) 
    WHERE vigente;

CREATE INDEX IF NOT EXISTS idx_curriculo_secuencias_source_id 
    ON public.curriculo_secuencias (source_id);

-- 6. Trigger actualizado_en con WHEN (OLD.* IS DISTINCT FROM NEW.*)
DROP TRIGGER IF EXISTS set_actualizado_en_curriculo_secuencias ON public.curriculo_secuencias;
CREATE TRIGGER set_actualizado_en_curriculo_secuencias
    BEFORE UPDATE ON public.curriculo_secuencias
    FOR EACH ROW
    EXECUTE FUNCTION public.trg_actualizado_en_curriculo_secuencias();

-- 7. RLS y Permisos
ALTER TABLE public.curriculo_secuencias ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "curriculo_secuencias_select_public" ON public.curriculo_secuencias;
CREATE POLICY "curriculo_secuencias_select_public"
    ON public.curriculo_secuencias
    FOR SELECT TO anon, authenticated
    USING (vigente);

GRANT SELECT ON public.curriculo_secuencias TO anon, authenticated;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.curriculo_secuencias FROM anon, authenticated;

-- 8. Función RPC canónica de búsqueda
CREATE OR REPLACE FUNCTION public.buscar_curriculo_secuencias(
    p_nivel TEXT,
    p_grado SMALLINT,
    p_area TEXT,
    p_consulta TEXT,
    p_limite INT DEFAULT 5
)
RETURNS TABLE (
    source_id TEXT,
    tema TEXT,
    grado_num SMALLINT,
    area TEXT,
    bloque_guia TEXT,
    competencias_especificas TEXT,
    contenidos_texto_original TEXT,
    indicadores_logro JSONB,
    fuente_documento TEXT,
    version_curricular TEXT,
    pagina TEXT,
    estado_validacion TEXT,
    coincide_tema BOOLEAN,
    relevancia REAL
)
LANGUAGE sql STABLE
SECURITY INVOKER
SET search_path = public AS $$
    WITH raw_q AS (
        SELECT plainto_tsquery('es_sin_tildes', coalesce(p_consulta, ''))::text AS q_text
    ),
    q AS (
        SELECT 
            CASE 
                WHEN q_text IS NOT NULL AND trim(q_text) <> '' THEN 
                    replace(q_text, '&', '|')::tsquery 
                ELSE NULL 
            END AS tsq
        FROM raw_q
    ),
    evaluados AS (
        SELECT 
            f.source_id,
            f.tema,
            f.grado_num,
            f.area,
            f.bloque_guia,
            f.competencias_especificas,
            f.contenidos_texto_original,
            f.indicadores_logro,
            f.fuente_documento,
            f.version_curricular,
            f.pagina,
            f.estado_validacion,
            CASE 
                WHEN (SELECT tsq FROM q) IS NOT NULL AND f.fts_vector @@ (SELECT tsq FROM q) THEN true
                ELSE false
            END AS coincide_tema,
            CASE 
                WHEN (SELECT tsq FROM q) IS NOT NULL AND f.fts_vector @@ (SELECT tsq FROM q) THEN ts_rank_cd(f.fts_vector, (SELECT tsq FROM q))
                ELSE 0.0::REAL
            END AS relevancia
        FROM public.curriculo_secuencias f
        WHERE f.vigente
          AND f.nivel = p_nivel
          AND f.grado_num = p_grado
          AND f.area = p_area
    )
    SELECT 
        e.source_id,
        e.tema,
        e.grado_num,
        e.area,
        e.bloque_guia,
        e.competencias_especificas,
        e.contenidos_texto_original,
        e.indicadores_logro,
        e.fuente_documento,
        e.version_curricular,
        e.pagina,
        e.estado_validacion,
        e.coincide_tema,
        e.relevancia
    FROM evaluados e
    ORDER BY e.coincide_tema DESC, e.relevancia DESC, e.source_id ASC
    LIMIT least(greatest(p_limite, 1), 5);
$$;

GRANT EXECUTE ON FUNCTION public.buscar_curriculo_secuencias(TEXT, SMALLINT, TEXT, TEXT, INT) TO anon, authenticated;

-- 9. Alias retrocompatible buscar_curriculo para clientes existentes
CREATE OR REPLACE FUNCTION public.buscar_curriculo(
    p_nivel TEXT,
    p_grado SMALLINT,
    p_area TEXT,
    p_consulta TEXT,
    p_limite INT DEFAULT 5
)
RETURNS TABLE (
    source_id TEXT,
    tema TEXT,
    grado_num SMALLINT,
    area TEXT,
    bloque_guia TEXT,
    competencias_especificas TEXT,
    contenidos_texto_original TEXT,
    indicadores_logro JSONB,
    fuente_documento TEXT,
    version_curricular TEXT,
    pagina TEXT,
    estado_validacion TEXT,
    coincide_tema BOOLEAN,
    relevancia REAL
)
LANGUAGE sql STABLE
SECURITY INVOKER
SET search_path = public AS $$
    SELECT * FROM public.buscar_curriculo_secuencias(p_nivel, p_grado, p_area, p_consulta, p_limite);
$$;

GRANT EXECUTE ON FUNCTION public.buscar_curriculo(TEXT, SMALLINT, TEXT, TEXT, INT) TO anon, authenticated;



-- 2. RESTAURACION DE FUNCION CANONICA FTS CON RANKING
-- =============================================================================
-- RESTAURACIÓN DE FUNCIÓN CANÓNICA FTS: buscar_curriculo_secuencias (2026-10-18)
-- Motivo: 20261016 redefine la función con ILIKE degradando la búsqueda curricular.
-- Esta migración restaura la versión FTS canónica con ranking ts_rank_cd.
-- Idempotente: debe aplicarse siempre después de 20261016.
-- =============================================================================
CREATE OR REPLACE FUNCTION public.buscar_curriculo_secuencias(
    p_nivel TEXT,
    p_grado SMALLINT,
    p_area TEXT,
    p_consulta TEXT,
    p_limite INT DEFAULT 5
)
RETURNS TABLE (
    source_id TEXT,
    tema TEXT,
    grado_num SMALLINT,
    area TEXT,
    bloque_guia TEXT,
    competencias_especificas TEXT,
    contenidos_texto_original TEXT,
    indicadores_logro JSONB,
    fuente_documento TEXT,
    version_curricular TEXT,
    pagina TEXT,
    estado_validacion TEXT,
    coincide_tema BOOLEAN,
    relevancia REAL
)
LANGUAGE sql STABLE
SECURITY INVOKER
SET search_path = public AS $$
    WITH raw_q AS (
        SELECT plainto_tsquery('es_sin_tildes', coalesce(p_consulta, ''))::text AS q_text
    ),
    q AS (
        SELECT 
            CASE 
                WHEN q_text IS NOT NULL AND trim(q_text) <> '' THEN 
                    replace(q_text, '&', '|')::tsquery 
                ELSE NULL 
            END AS tsq
        FROM raw_q
    ),
    evaluados AS (
        SELECT 
            f.source_id,
            f.tema,
            f.grado_num,
            f.area,
            f.bloque_guia,
            f.competencias_especificas,
            f.contenidos_texto_original,
            f.indicadores_logro,
            f.fuente_documento,
            f.version_curricular,
            f.pagina,
            f.estado_validacion,
            CASE 
                WHEN (SELECT tsq FROM q) IS NOT NULL AND f.fts_vector @@ (SELECT tsq FROM q) THEN true
                ELSE false
            END AS coincide_tema,
            CASE 
                WHEN (SELECT tsq FROM q) IS NOT NULL AND f.fts_vector @@ (SELECT tsq FROM q) THEN ts_rank_cd(f.fts_vector, (SELECT tsq FROM q))
                ELSE 0.0::REAL
            END AS relevancia
        FROM public.curriculo_secuencias f
        WHERE f.vigente
          AND f.nivel = p_nivel
          AND f.grado_num = p_grado
          AND f.area = p_area
    )
    SELECT 
        e.source_id,
        e.tema,
        e.grado_num,
        e.area,
        e.bloque_guia,
        e.competencias_especificas,
        e.contenidos_texto_original,
        e.indicadores_logro,
        e.fuente_documento,
        e.version_curricular,
        e.pagina,
        e.estado_validacion,
        e.coincide_tema,
        e.relevancia
    FROM evaluados e
    ORDER BY e.coincide_tema DESC, e.relevancia DESC, e.source_id ASC
    LIMIT least(greatest(p_limite, 1), 5);
$$;

GRANT EXECUTE ON FUNCTION public.buscar_curriculo_secuencias(TEXT, SMALLINT, TEXT, TEXT, INT) TO anon, authenticated;



-- 4. PERMISOS Y RECARGA DE CATALOGO POSTGREST
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.curriculo_secuencias TO service_role;
GRANT SELECT ON TABLE public.curriculo_secuencias TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.buscar_curriculo_secuencias(TEXT, SMALLINT, TEXT, TEXT, INT) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.buscar_curriculo(TEXT, SMALLINT, TEXT, TEXT, INT) TO anon, authenticated, service_role;

NOTIFY pgrst, 'reload schema';


-- 5. AUTOVERIFICACION DE ESQUEMA Y PERMISOS
SELECT 
  EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'curriculo_secuencias') AS tabla_existe,
  EXISTS (SELECT 1 FROM information_schema.routines WHERE routine_schema = 'public' AND routine_name = 'buscar_curriculo_secuencias') AS rpc_existe,
  has_table_privilege('anon', 'public.curriculo_secuencias', 'SELECT') AS grant_anon_select,
  coalesce((
    SELECT bool_or(has_function_privilege('anon', p.oid, 'EXECUTE'))
    FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public' AND p.proname = 'buscar_curriculo_secuencias'
  ), false) AS grant_anon_rpc;

-- select e.extname, n.nspname from pg_extension e join pg_namespace n on n.oid = e.extnamespace where e.extname = 'unaccent';

