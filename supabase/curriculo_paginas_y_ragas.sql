-- =============================================================================
-- TABLAS CANÓNICAS: CURRÍCULO PÁGINAS (RAG) Y AUDITORÍA DE CALIDAD RAGAS
-- Idempotente: puede ejecutarse repetidas veces sin error en el SQL Editor.
-- =============================================================================

-- 1. Tabla curriculo_paginas: Almacenamiento granular por página para BM25 y Reranker
CREATE TABLE IF NOT EXISTS public.curriculo_paginas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_id TEXT NOT NULL UNIQUE,
    documento_id TEXT NOT NULL,
    fuente_documento TEXT NOT NULL,
    pagina INTEGER NOT NULL,
    grado_num SMALLINT CHECK (grado_num BETWEEN 1 AND 6),
    area TEXT,
    nivel TEXT NOT NULL DEFAULT 'Primario',
    texto TEXT NOT NULL,
    creado_en TIMESTAMPTZ NOT NULL DEFAULT now(),
    actualizado_en TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índices de búsqueda para curriculo_paginas
CREATE INDEX IF NOT EXISTS idx_curriculo_paginas_source_id 
    ON public.curriculo_paginas (source_id);

CREATE INDEX IF NOT EXISTS idx_curriculo_paginas_filtros 
    ON public.curriculo_paginas (grado_num, area, nivel);

-- 2. Tabla auditoria_calidad_ragas: Telemetría y monitoreo de calidad RAGAS
CREATE TABLE IF NOT EXISTS public.auditoria_calidad_ragas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sesion_id TEXT,
    grado TEXT,
    area TEXT,
    tema TEXT,
    faithfulness_score NUMERIC(5, 3) NOT NULL,
    relevance_score NUMERIC(5, 3) NOT NULL,
    context_precision NUMERIC(5, 3) DEFAULT 1.0,
    estado_alerta TEXT NOT NULL CHECK (estado_alerta IN ('OPTIMO', 'ADVERTENCIA', 'CRITICO')),
    detalles_auditoria JSONB DEFAULT '{}'::jsonb,
    creado_en TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_auditoria_ragas_sesion 
    ON public.auditoria_calidad_ragas (sesion_id);

CREATE INDEX IF NOT EXISTS idx_auditoria_ragas_alerta 
    ON public.auditoria_calidad_ragas (estado_alerta);

-- Habilitar RLS
ALTER TABLE public.curriculo_paginas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.auditoria_calidad_ragas ENABLE ROW LEVEL SECURITY;

-- Políticas de lectura anónima y escritura de servicio
DO $$
BEGIN
    DROP POLICY IF EXISTS "Lectura pública de páginas curriculares" ON public.curriculo_paginas;
    CREATE POLICY "Lectura pública de páginas curriculares"
        ON public.curriculo_paginas FOR SELECT
        USING (true);

    DROP POLICY IF EXISTS "Escritura de páginas curriculares service_role" ON public.curriculo_paginas;
    CREATE POLICY "Escritura de páginas curriculares service_role"
        ON public.curriculo_paginas FOR ALL
        TO service_role
        USING (true)
        WITH CHECK (true);

    DROP POLICY IF EXISTS "Escritura de auditoría ragas service_role" ON public.auditoria_calidad_ragas;
    CREATE POLICY "Escritura de auditoría ragas service_role"
        ON public.auditoria_calidad_ragas FOR ALL
        TO service_role
        USING (true)
        WITH CHECK (true);
END $$;
