-- Migration: 20261112000000_sincronizar_memoria_1024_y_cache_semantica.sql
-- Sincroniza el esquema versionado con la arquitectura vigente (@cf/baai/bge-m3, 1024 dimensiones)
-- y versiona public.curriculo_cache_semantica sin reescribir migraciones históricas.
-- Regla de umbral en consultar_memoria_robot:
--   - Default SQL = 0.85 (recuperación amplia para consultas exploratorias).
--   - El Worker productivo aplica umbral >= 0.95 para reutilización directa sin llamar al LLM.

CREATE EXTENSION IF NOT EXISTS vector;

-- 1. Asegurar tabla robot_memoria_experiencias con vector(1024) de forma segura e idempotente
CREATE TABLE IF NOT EXISTS public.robot_memoria_experiencias (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    docente_id TEXT NOT NULL DEFAULT 'Israel Montás',
    grado_nivel TEXT NOT NULL,
    area_curricular TEXT NOT NULL,
    tema_consulta TEXT NOT NULL,
    embedding vector(1024),
    planificacion_salida TEXT NOT NULL,
    paginas_minerd_citadas INT[] DEFAULT '{}',
    calificacion_calidad INT DEFAULT 5,
    validado_por_auditor BOOLEAN DEFAULT TRUE,
    total_reutilizaciones INT DEFAULT 0,
    creado_en TIMESTAMPTZ DEFAULT NOW(),
    actualizado_en TIMESTAMPTZ DEFAULT NOW()
);

DO $$
DECLARE
    v_tipo TEXT;
    v_filas BIGINT;
BEGIN
    SELECT format_type(a.atttypid, a.atttypmod)
      INTO v_tipo
      FROM pg_attribute a
     WHERE a.attrelid = 'public.robot_memoria_experiencias'::regclass
       AND a.attname = 'embedding'
       AND NOT a.attisdropped;

    IF v_tipo IS NOT NULL AND v_tipo <> 'vector(1024)' THEN
        SELECT COUNT(*) INTO v_filas FROM public.robot_memoria_experiencias WHERE embedding IS NOT NULL;
        IF v_filas > 0 THEN
            RAISE EXCEPTION 'robot_memoria_experiencias.embedding tiene tipo % con % filas no nulas; requiere reindexación explícita antes de convertir a vector(1024).', v_tipo, v_filas;
        END IF;
        DROP INDEX IF EXISTS public.idx_memoria_embedding;
        ALTER TABLE public.robot_memoria_experiencias ALTER COLUMN embedding TYPE vector(1024);
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_memoria_embedding
ON public.robot_memoria_experiencias
USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);

-- 2. Reemplazar firma ambigua/768 por firma canónica vector(1024) manteniendo SECURITY INVOKER
DROP FUNCTION IF EXISTS public.consultar_memoria_robot(vector(768), FLOAT, INT);
DROP FUNCTION IF EXISTS public.consultar_memoria_robot(vector, DOUBLE PRECISION, INT);

CREATE OR REPLACE FUNCTION public.consultar_memoria_robot(
    p_embedding vector(1024),
    p_umbral_similitud DOUBLE PRECISION DEFAULT 0.85,
    p_limite INT DEFAULT 1
)
RETURNS TABLE (
    id UUID,
    tema_consulta TEXT,
    planificacion_salida TEXT,
    similitud DOUBLE PRECISION
)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, extensions
AS $$
BEGIN
    RETURN QUERY
    SELECT
        m.id,
        m.tema_consulta,
        m.planificacion_salida,
        (1 - (m.embedding <=> p_embedding))::DOUBLE PRECISION AS similitud
    FROM public.robot_memoria_experiencias m
    WHERE m.embedding IS NOT NULL
      AND m.validado_por_auditor = TRUE
      AND m.calificacion_calidad >= 4
      AND (1 - (m.embedding <=> p_embedding)) >= p_umbral_similitud
    ORDER BY m.embedding <=> p_embedding
    LIMIT p_limite;
END;
$$;

ALTER TABLE public.robot_memoria_experiencias ENABLE ROW LEVEL SECURITY;
GRANT ALL ON TABLE public.robot_memoria_experiencias TO service_role;
GRANT EXECUTE ON FUNCTION public.consultar_memoria_robot(vector(1024), DOUBLE PRECISION, INT) TO service_role, authenticated, anon;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename = 'robot_memoria_experiencias'
          AND policyname = 'service_role_all_robot_memoria'
    ) THEN
        CREATE POLICY service_role_all_robot_memoria
        ON public.robot_memoria_experiencias
        FOR ALL
        TO service_role
        USING (true)
        WITH CHECK (true);
    END IF;
END $$;

-- 3. Versionar public.curriculo_cache_semantica y su RPC
CREATE TABLE IF NOT EXISTS public.curriculo_cache_semantica (
    id BIGSERIAL PRIMARY KEY,
    clave_hash TEXT NOT NULL UNIQUE,
    grado SMALLINT NOT NULL,
    area TEXT NOT NULL,
    tema_consulta TEXT NOT NULL,
    plan_json JSONB NOT NULL,
    fuentes_utilizadas JSONB DEFAULT '[]'::jsonb,
    hits_contador INT DEFAULT 1,
    creado_en TIMESTAMPTZ DEFAULT NOW(),
    actualizado_en TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cache_clave_hash
ON public.curriculo_cache_semantica (clave_hash);

ALTER TABLE public.curriculo_cache_semantica ENABLE ROW LEVEL SECURITY;
GRANT ALL ON TABLE public.curriculo_cache_semantica TO service_role;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename = 'curriculo_cache_semantica'
          AND policyname = 'service_role_all_cache_semantica'
    ) THEN
        CREATE POLICY service_role_all_cache_semantica
        ON public.curriculo_cache_semantica
        FOR ALL
        TO service_role
        USING (true)
        WITH CHECK (true);
    END IF;
END $$;

CREATE OR REPLACE FUNCTION public.consultar_cache_planificacion(p_clave_hash TEXT)
RETURNS TABLE (plan_json JSONB, fuentes_utilizadas JSONB)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, extensions
AS $$
BEGIN
    RETURN QUERY
    UPDATE public.curriculo_cache_semantica
    SET hits_contador = hits_contador + 1, actualizado_en = NOW()
    WHERE clave_hash = p_clave_hash
    RETURNING curriculo_cache_semantica.plan_json, curriculo_cache_semantica.fuentes_utilizadas;
END;
$$;

REVOKE ALL ON FUNCTION public.consultar_cache_planificacion(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.consultar_cache_planificacion(TEXT) TO service_role;
