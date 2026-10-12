-- =============================================================================
-- MIGRACIÓN FASE 12: MODO MULTIUSUARIO INSTITUCIONAL Y SUPERVISIÓN MINERD
-- Tablas: escuelas, usuarios, supervisiones_area_minerd, planificaciones, revisiones_coordinador
-- Basado en especificación oficial de README.md (Fase 12)
-- =============================================================================

BEGIN;

-- 1. TABLA: escuelas (Centros Educativos Registrados en MINERD)
CREATE TABLE IF NOT EXISTS public.escuelas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    codigo_minerd VARCHAR(20) UNIQUE NOT NULL,
    nombre VARCHAR(150) NOT NULL,
    regional_educativa VARCHAR(10),
    distrito_educativo VARCHAR(10),
    tanda VARCHAR(30) CHECK (tanda IN ('matutina', 'vespertina', 'jornada_extendida')),
    telefono VARCHAR(20),
    activo BOOLEAN DEFAULT true,
    creado_en TIMESTAMPTZ DEFAULT now()
);

-- 2. TABLA: usuarios (Docentes, Coordinadores, Directores)
CREATE TABLE IF NOT EXISTS public.usuarios (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    escuela_id UUID REFERENCES public.escuelas(id) ON DELETE SET NULL,
    nombre_completo VARCHAR(120) NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    rol VARCHAR(30) NOT NULL DEFAULT 'docente' CHECK (rol IN ('docente', 'coordinador_area', 'director', 'admin')),
    nivel_educativo VARCHAR(30) DEFAULT 'todos',
    areas_especialidad JSONB DEFAULT '[]'::jsonb,
    grados_asignados JSONB DEFAULT '[]'::jsonb,
    creado_en TIMESTAMPTZ DEFAULT now()
);

-- 3. TABLA: supervisiones_area_minerd (Vínculo Coordinador - Docente / Área)
CREATE TABLE IF NOT EXISTS public.supervisiones_area_minerd (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    escuela_id UUID NOT NULL REFERENCES public.escuelas(id) ON DELETE CASCADE,
    coordinador_id UUID NOT NULL REFERENCES public.usuarios(id) ON DELETE CASCADE,
    docente_id UUID REFERENCES public.usuarios(id) ON DELETE CASCADE,
    area_curricular VARCHAR(80) NOT NULL,
    nivel VARCHAR(40),
    activo BOOLEAN DEFAULT true,
    creado_en TIMESTAMPTZ DEFAULT now()
);

-- 4. TABLA: planificaciones (Núcleo Curricular Multiusuario)
CREATE TABLE IF NOT EXISTS public.planificaciones (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    escuela_id UUID REFERENCES public.escuelas(id) ON DELETE SET NULL,
    docente_id UUID NOT NULL REFERENCES public.usuarios(id) ON DELETE CASCADE,
    titulo VARCHAR(200) NOT NULL,
    nivel VARCHAR(40) NOT NULL,
    grado VARCHAR(60) NOT NULL,
    area VARCHAR(80) NOT NULL,
    periodo VARCHAR(40) NOT NULL,
    esquema_id VARCHAR(50) NOT NULL,
    datos_planificacion JSONB NOT NULL DEFAULT '{}'::jsonb,
    ajustes_manuales JSONB DEFAULT '{}'::jsonb,
    estado VARCHAR(30) NOT NULL DEFAULT 'borrador' CHECK (estado IN ('borrador', 'enviada_revision', 'aprobada', 'observada')),
    creado_en TIMESTAMPTZ DEFAULT now(),
    actualizado_en TIMESTAMPTZ DEFAULT now()
);

-- 5. TABLA: revisiones_coordinador (Acompañamiento y Retroalimentación Pedagógica)
CREATE TABLE IF NOT EXISTS public.revisiones_coordinador (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    planificacion_id UUID NOT NULL REFERENCES public.planificaciones(id) ON DELETE CASCADE,
    coordinador_id UUID NOT NULL REFERENCES public.usuarios(id) ON DELETE CASCADE,
    estado_revision VARCHAR(30) NOT NULL CHECK (estado_revision IN ('aprobada', 'requiere_ajustes', 'sugerencias')),
    comentarios_generales TEXT,
    bloques_observados JSONB DEFAULT '{}'::jsonb,
    fecha_revision TIMESTAMPTZ DEFAULT now()
);

-- -----------------------------------------------------------------------------
-- ÍNDICES DE RENDIMIENTO Y CONSULTA
-- -----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_usuarios_escuela_rol ON public.usuarios(escuela_id, rol);
CREATE INDEX IF NOT EXISTS idx_supervisiones_coordinador ON public.supervisiones_area_minerd(coordinador_id, escuela_id);
CREATE INDEX IF NOT EXISTS idx_planificaciones_escuela_estado ON public.planificaciones(escuela_id, estado, creado_en DESC);
CREATE INDEX IF NOT EXISTS idx_planificaciones_docente ON public.planificaciones(docente_id, creado_en DESC);
CREATE INDEX IF NOT EXISTS idx_revisiones_planificacion ON public.revisiones_coordinador(planificacion_id, fecha_revision DESC);

-- -----------------------------------------------------------------------------
-- HABILITACIÓN DE ROW LEVEL SECURITY (RLS)
-- -----------------------------------------------------------------------------
ALTER TABLE public.escuelas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usuarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.supervisiones_area_minerd ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.planificaciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.revisiones_coordinador ENABLE ROW LEVEL SECURITY;

-- -----------------------------------------------------------------------------
-- POLÍTICAS RLS ESTRICTAS
-- -----------------------------------------------------------------------------

DROP POLICY IF EXISTS escuelas_select_miembros ON public.escuelas;
CREATE POLICY escuelas_select_miembros ON public.escuelas
    FOR SELECT TO authenticated
    USING (
        id IN (SELECT escuela_id FROM public.usuarios WHERE id = (select auth.uid()))
    );

DROP POLICY IF EXISTS usuarios_select_misma_escuela ON public.usuarios;
CREATE POLICY usuarios_select_misma_escuela ON public.usuarios
    FOR SELECT TO authenticated
    USING (
        id = (select auth.uid()) OR
        escuela_id IN (SELECT escuela_id FROM public.usuarios WHERE id = (select auth.uid()))
    );

DROP POLICY IF EXISTS usuarios_update_propio ON public.usuarios;
CREATE POLICY usuarios_update_propio ON public.usuarios
    FOR UPDATE TO authenticated
    USING (id = (select auth.uid()))
    WITH CHECK (id = (select auth.uid()));

DROP POLICY IF EXISTS planificaciones_docente_propio ON public.planificaciones;
CREATE POLICY planificaciones_docente_propio ON public.planificaciones
    FOR ALL TO authenticated
    USING (docente_id = (select auth.uid()))
    WITH CHECK (docente_id = (select auth.uid()));

DROP POLICY IF EXISTS planificaciones_supervision_lectura ON public.planificaciones;
CREATE POLICY planificaciones_supervision_lectura ON public.planificaciones
    FOR SELECT TO authenticated
    USING (
        estado IN ('enviada_revision', 'aprobada', 'observada') AND
        escuela_id IN (
            SELECT escuela_id FROM public.usuarios 
            WHERE id = (select auth.uid()) AND rol IN ('coordinador_area', 'director', 'admin')
        )
    );

DROP POLICY IF EXISTS revisiones_lectura_participantes ON public.revisiones_coordinador;
CREATE POLICY revisiones_lectura_participantes ON public.revisiones_coordinador
    FOR SELECT TO authenticated
    USING (
        coordinador_id = (select auth.uid()) OR
        planificacion_id IN (SELECT id FROM public.planificaciones WHERE docente_id = (select auth.uid()))
    );

DROP POLICY IF EXISTS revisiones_escritura_coordinadores ON public.revisiones_coordinador;
CREATE POLICY revisiones_escritura_coordinadores ON public.revisiones_coordinador
    FOR ALL TO authenticated
    USING (
        coordinador_id = (select auth.uid()) AND
        EXISTS (
            SELECT 1 FROM public.usuarios 
            WHERE id = (select auth.uid()) AND rol IN ('coordinador_area', 'director', 'admin')
        )
    )
    WITH CHECK (
        coordinador_id = (select auth.uid())
    );

COMMIT;
