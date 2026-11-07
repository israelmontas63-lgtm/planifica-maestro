-- Migration: 20261107000000_registro_planes_aula.sql
-- Tabla para almacenar el historial de planificaciones de aula

CREATE TABLE IF NOT EXISTS public.registro_planes_aula (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    docente_id TEXT NOT NULL DEFAULT 'Israel Montás',
    centro_educativo TEXT NOT NULL DEFAULT 'Escuela Primaria Batey Pinos',
    titulo TEXT NOT NULL,
    modalidad TEXT NOT NULL DEFAULT 'Multigrado (1.° y 2.°)',
    paginas_citadas INT[] DEFAULT '{}',
    contenido_markdown TEXT NOT NULL,
    creado_en TIMESTAMPTZ DEFAULT NOW()
);

-- RLS y permisos
ALTER TABLE public.registro_planes_aula ENABLE ROW LEVEL SECURITY;
GRANT ALL ON TABLE public.registro_planes_aula TO service_role;

-- Política de lectura para service_role y docentes autenticados
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'registro_planes_aula' 
        AND policyname = 'service_role_all_registro_planes_aula'
    ) THEN
        CREATE POLICY service_role_all_registro_planes_aula 
        ON public.registro_planes_aula 
        FOR ALL 
        TO service_role 
        USING (true) 
        WITH CHECK (true);
    END IF;
END $$;
