-- =============================================================================
-- MIGRACIÓN CANÓNICA COMPLETA: CURRÍCULO SECUENCIAS MINERD (2026-10-16)
-- Tabla public.curriculo_secuencias, RPC buscar_curriculo_secuencias y datos semilla
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS unaccent;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_ts_config WHERE cfgname = 'es_sin_tildes') THEN
        CREATE TEXT SEARCH CONFIGURATION es_sin_tildes (COPY = spanish);
        ALTER TEXT SEARCH CONFIGURATION es_sin_tildes
            ALTER MAPPING FOR word, hword, hword_part
            WITH unaccent, spanish_stem;
    END IF;
END $$;

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
    CONSTRAINT uq_curriculo_secuencias_source_id UNIQUE (source_id)
);

-- RPC buscar_curriculo_secuencias
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
        true AS coincide_tema,
        1.0::REAL AS relevancia
    FROM public.curriculo_secuencias f
    WHERE f.vigente
      AND f.nivel = p_nivel
      AND f.grado_num = p_grado
      AND f.area = p_area
      AND (p_consulta IS NULL OR p_consulta = '' OR f.tema ILIKE '%' || p_consulta || '%' OR f.competencias_especificas ILIKE '%' || p_consulta || '%')
    ORDER BY f.source_id ASC
    LIMIT least(greatest(p_limite, 1), 5);
$$;

GRANT EXECUTE ON FUNCTION public.buscar_curriculo_secuencias(TEXT, SMALLINT, TEXT, TEXT, INT) TO anon, authenticated;

-- DATOS SEMILLA CANÓNICOS: 2DO DE PRIMARIA (Lengua Española y Matemática)
INSERT INTO public.curriculo_secuencias (
    source_id, nivel, ciclo, grado_num, area, tema, bloque_guia, competencias_especificas,
    contenidos_texto_original, indicadores_logro, fuente_documento, version_curricular, pagina, estado_validacion, huella
) VALUES 
(
    'SEC-PRI-2-ESP-001', 'Primario', 'Primer Ciclo', 2, 'Lengua Española',
    'La Noticia', 'Secuencia 1',
    'Comprende noticias sencillas que escucha sobre acontecimientos escolares y comunitarios.',
    'Estructura de la noticia: titular, cuerpo, fecha y lugar.',
    '["Identifica el hecho ocurrido en la noticia escuchada.", "Distingue la fecha y lugar del acontecimiento."]'::jsonb,
    'Adecuación Curricular Nivel Primario (MINERD)', '2023', '75', 'validado', 'huella-sec-pri-2-esp-001'
),
(
    'SEC-PRI-2-ESP-002', 'Primario', 'Primer Ciclo', 2, 'Lengua Española',
    'El Documento de Identidad', 'Secuencia 2',
    'Produce de forma escrita su documento de identidad con sus nombres, apellidos y fecha de nacimiento.',
    'Uso de mayúsculas en nombres propios y función de la tarjeta de identidad.',
    '["Escribe sus nombres y apellidos correctamente.", "Reconoce los datos personales en la tarjeta de identidad."]'::jsonb,
    'Adecuación Curricular Nivel Primario (MINERD)', '2023', '78', 'validado', 'huella-sec-pri-2-esp-002'
),
(
    'SEC-PRI-2-MAT-001', 'Primario', 'Primer Ciclo', 2, 'Matemática',
    'Adición de números naturales', 'Bloque 1',
    'Resuelve problemas cotidianos utilizando adiciones con números naturales de hasta tres dígitos.',
    'Algoritmo de la suma con y sin reagrupación.',
    '["Aplica el algoritmo estándar de la adición.", "Modela sumas con material concreto y en la recta numérica."]'::jsonb,
    'Adecuación Curricular Nivel Primario (MINERD)', '2023', '118', 'validado', 'huella-sec-pri-2-mat-001'
)
ON CONFLICT (source_id) DO NOTHING;
