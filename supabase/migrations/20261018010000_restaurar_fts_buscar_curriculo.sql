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
