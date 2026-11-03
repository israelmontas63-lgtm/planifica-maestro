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

CREATE OR REPLACE FUNCTION public.consultar_cache_planificacion(p_clave_hash TEXT)
RETURNS TABLE (plan_json JSONB, fuentes_utilizadas JSONB) AS $$ 
BEGIN 
    RETURN QUERY 
    UPDATE public.curriculo_cache_semantica 
    SET hits_contador = hits_contador + 1, actualizado_en = NOW() 
    WHERE clave_hash = p_clave_hash 
    RETURNING curriculo_cache_semantica.plan_json, curriculo_cache_semantica.fuentes_utilizadas; 
END; 
$$ LANGUAGE plpgsql SECURITY DEFINER;
