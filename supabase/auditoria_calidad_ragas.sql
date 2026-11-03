CREATE TABLE IF NOT EXISTS public.auditoria_calidad_ragas (
    id BIGSERIAL PRIMARY KEY,
    sesion_id UUID,
    grado SMALLINT,
    area TEXT,
    tema TEXT,
    faithfulness_score NUMERIC(4,3) NOT NULL,
    relevance_score NUMERIC(4,3) NOT NULL,
    context_precision NUMERIC(4,3) NOT NULL,
    estado_alerta TEXT DEFAULT 'OPTIMO' CHECK (estado_alerta IN ('OPTIMO', 'ADVERTENCIA', 'CRITICO')),
    detalles_auditoria JSONB DEFAULT '{}'::jsonb,
    creado_en TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_auditoria_alerta 
ON public.auditoria_calidad_ragas (estado_alerta, creado_en DESC);
