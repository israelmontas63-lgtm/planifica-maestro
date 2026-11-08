-- Migration: 20261107020000_crear_cola_revision_y_cache_investigacion.sql
-- Tablas aditivas para cola_revision y cache_investigacion usadas por investigadorService.js

-- 1. Tabla cola_revision
CREATE TABLE IF NOT EXISTS public.cola_revision (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    consulta TEXT NOT NULL,
    dato_extraido TEXT,
    cita_textual TEXT,
    url_fuente TEXT,
    institucion TEXT DEFAULT 'MINERD',
    anio INT,
    nivel TEXT,
    grado TEXT,
    area TEXT,
    nivel_confianza TEXT DEFAULT 'media',
    estado_revision TEXT DEFAULT 'pendiente',
    creado_en TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.cola_revision ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.cola_revision FROM anon;
GRANT ALL ON public.cola_revision TO service_role;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'cola_revision' 
        AND policyname = 'service_role_all_cola_revision'
    ) THEN
        CREATE POLICY service_role_all_cola_revision 
        ON public.cola_revision 
        FOR ALL 
        TO service_role 
        USING (true) 
        WITH CHECK (true);
    END IF;
END $$;

-- 2. Tabla cache_investigacion
CREATE TABLE IF NOT EXISTS public.cache_investigacion (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    hash_consulta TEXT UNIQUE NOT NULL,
    resultado JSONB NOT NULL,
    fuentes JSONB DEFAULT '[]'::jsonb,
    nivel_confianza TEXT DEFAULT 'media',
    expira_at TIMESTAMPTZ NOT NULL,
    creado_en TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cache_investigacion_hash_expira 
ON public.cache_investigacion (hash_consulta, expira_at);

ALTER TABLE public.cache_investigacion ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.cache_investigacion TO anon;
GRANT ALL ON public.cache_investigacion TO service_role;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'cache_investigacion' 
        AND policyname = 'anon_select_cache_investigacion'
    ) THEN
        CREATE POLICY anon_select_cache_investigacion 
        ON public.cache_investigacion 
        FOR SELECT 
        TO anon 
        USING (expira_at > now());
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'cache_investigacion' 
        AND policyname = 'service_role_all_cache_investigacion'
    ) THEN
        CREATE POLICY service_role_all_cache_investigacion 
        ON public.cache_investigacion 
        FOR ALL 
        TO service_role 
        USING (true) 
        WITH CHECK (true);
    END IF;
END $$;

-- Recargar caché de esquema en PostgREST
NOTIFY pgrst, 'reload schema';
