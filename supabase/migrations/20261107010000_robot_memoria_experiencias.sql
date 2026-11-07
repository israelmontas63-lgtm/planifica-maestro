-- Migration: 20261107010000_robot_memoria_experiencias.sql
-- Tabla de Memoria a Largo Plazo y Caché Semántica con embeddings vectoriales

-- Habilitar extensión vectorial si no está activa
CREATE EXTENSION IF NOT EXISTS vector;

-- Tabla de Memoria a Largo Plazo y Caché Semántica
CREATE TABLE IF NOT EXISTS public.robot_memoria_experiencias (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    docente_id TEXT NOT NULL DEFAULT 'Israel Montás',
    grado_nivel TEXT NOT NULL,
    area_curricular TEXT NOT NULL,
    tema_consulta TEXT NOT NULL,
    embedding vector(768), -- Vector de Gemini text-embedding-004
    planificacion_salida TEXT NOT NULL,
    paginas_minerd_citadas INT[] DEFAULT '{}',
    calificacion_calidad INT DEFAULT 5, -- 1 a 5 (Saber si está bien o mal)
    validado_por_auditor BOOLEAN DEFAULT TRUE,
    total_reutilizaciones INT DEFAULT 0,
    creado_en TIMESTAMPTZ DEFAULT NOW(),
    actualizado_en TIMESTAMPTZ DEFAULT NOW()
);

-- Índice vectorial para búsqueda semántica instantánea
CREATE INDEX IF NOT EXISTS idx_memoria_embedding 
ON public.robot_memoria_experiencias 
USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);

-- Función RPC para consultar la memoria antes de llamar al modelo
CREATE OR REPLACE FUNCTION public.consultar_memoria_robot(
    p_embedding vector(768),
    p_umbral_similitud FLOAT DEFAULT 0.92,
    p_limite INT DEFAULT 1
)
RETURNS TABLE (
    id UUID,
    tema_consulta TEXT,
    planificacion_salida TEXT,
    similitud FLOAT
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        m.id,
        m.tema_consulta,
        m.planificacion_salida,
        1 - (m.embedding <=> p_embedding) AS similitud
    FROM public.robot_memoria_experiencias m
    WHERE m.validado_por_auditor = TRUE 
      AND m.calificacion_calidad >= 4
      AND (1 - (m.embedding <=> p_embedding)) >= p_umbral_similitud
    ORDER BY similitud DESC
    LIMIT p_limite;
END;
$$;

-- RLS y Permisos
ALTER TABLE public.robot_memoria_experiencias ENABLE ROW LEVEL SECURITY;
GRANT ALL ON TABLE public.robot_memoria_experiencias TO service_role;
GRANT SELECT ON TABLE public.robot_memoria_experiencias TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.consultar_memoria_robot(vector(768), FLOAT, INT) TO service_role, authenticated, anon;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'robot_memoria_experiencias' 
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
