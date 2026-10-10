BEGIN;

-- 1. Habilitar RLS en todas las tablas
ALTER TABLE public.calendario_escolar_oficial ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.planes_guardados ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.perfil_docente ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.docente_eventos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.docente_recordatorios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversaciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tareas_investigacion ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.docente_horarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.docente_actividades ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.docente_notas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.uso_docentes ENABLE ROW LEVEL SECURITY;

-- 2. Eliminar TODAS las políticas antiguas para evitar solapamientos
DROP POLICY IF EXISTS "Lectura calendario oficial para autenticados" ON public.calendario_escolar_oficial;
DROP POLICY IF EXISTS "Escritura calendario oficial denegada clientes" ON public.calendario_escolar_oficial;
DROP POLICY IF EXISTS "Planes guardados: CRUD propio" ON public.planes_guardados;
DROP POLICY IF EXISTS "Planes guardados: CRUD exclusivo del propietario" ON public.planes_guardados;
DROP POLICY IF EXISTS "Perfil docente: CRUD propio" ON public.perfil_docente;
DROP POLICY IF EXISTS "Perfil docente: CRUD exclusivo del propietario" ON public.perfil_docente;
DROP POLICY IF EXISTS "Docente eventos: CRUD propio" ON public.docente_eventos;
DROP POLICY IF EXISTS "Docente recordatorios: CRUD propio" ON public.docente_recordatorios;
DROP POLICY IF EXISTS "Conversaciones: CRUD propio" ON public.conversaciones;
DROP POLICY IF EXISTS "Tareas investigacion: CRUD propio" ON public.tareas_investigacion;
DROP POLICY IF EXISTS "Docente horarios: CRUD propio" ON public.docente_horarios;
DROP POLICY IF EXISTS "Docente actividades: CRUD propio" ON public.docente_actividades;
DROP POLICY IF EXISTS "Docente notas: CRUD propio" ON public.docente_notas;
DROP POLICY IF EXISTS "Uso docentes: lectura propia" ON public.uso_docentes;

-- 3. Crear políticas únicas, estrictas y seguras ((select auth.uid()) = user_id/docente_id)

-- Calendario (Solo lectura para autenticados)
DROP POLICY IF EXISTS "calendario_escolar_oficial_select" ON public.calendario_escolar_oficial;
CREATE POLICY "calendario_escolar_oficial_select"
    ON public.calendario_escolar_oficial FOR SELECT
    TO authenticated USING (true);

-- Planes guardados
DROP POLICY IF EXISTS "planes_guardados_crud" ON public.planes_guardados;
CREATE POLICY "planes_guardados_crud"
    ON public.planes_guardados FOR ALL TO authenticated
    USING ((select auth.uid()) = user_id)
    WITH CHECK ((select auth.uid()) = user_id);

-- Perfil docente
DROP POLICY IF EXISTS "perfil_docente_crud" ON public.perfil_docente;
CREATE POLICY "perfil_docente_crud"
    ON public.perfil_docente FOR ALL TO authenticated
    USING ((select auth.uid()) = user_id)
    WITH CHECK ((select auth.uid()) = user_id);

-- Docente eventos
DROP POLICY IF EXISTS "docente_eventos_crud" ON public.docente_eventos;
CREATE POLICY "docente_eventos_crud"
    ON public.docente_eventos FOR ALL TO authenticated
    USING ((select auth.uid()) = user_id)
    WITH CHECK ((select auth.uid()) = user_id);

-- Docente recordatorios
DROP POLICY IF EXISTS "docente_recordatorios_crud" ON public.docente_recordatorios;
CREATE POLICY "docente_recordatorios_crud"
    ON public.docente_recordatorios FOR ALL TO authenticated
    USING ((select auth.uid()) = user_id)
    WITH CHECK ((select auth.uid()) = user_id);

-- Conversaciones
DROP POLICY IF EXISTS "conversaciones_crud" ON public.conversaciones;
CREATE POLICY "conversaciones_crud"
    ON public.conversaciones FOR ALL TO authenticated
    USING ((select auth.uid()) = user_id)
    WITH CHECK ((select auth.uid()) = user_id);

-- Tareas investigacion
DROP POLICY IF EXISTS "tareas_investigacion_crud" ON public.tareas_investigacion;
CREATE POLICY "tareas_investigacion_crud"
    ON public.tareas_investigacion FOR ALL TO authenticated
    USING ((select auth.uid()) = user_id)
    WITH CHECK ((select auth.uid()) = user_id);

-- Docente horarios
DROP POLICY IF EXISTS "docente_horarios_crud" ON public.docente_horarios;
CREATE POLICY "docente_horarios_crud"
    ON public.docente_horarios FOR ALL TO authenticated
    USING ((select auth.uid()) = user_id)
    WITH CHECK ((select auth.uid()) = user_id);

-- Docente actividades
DROP POLICY IF EXISTS "docente_actividades_crud" ON public.docente_actividades;
CREATE POLICY "docente_actividades_crud"
    ON public.docente_actividades FOR ALL TO authenticated
    USING ((select auth.uid()) = user_id)
    WITH CHECK ((select auth.uid()) = user_id);

-- Docente notas
DROP POLICY IF EXISTS "docente_notas_crud" ON public.docente_notas;
CREATE POLICY "docente_notas_crud"
    ON public.docente_notas FOR ALL TO authenticated
    USING ((select auth.uid()) = user_id)
    WITH CHECK ((select auth.uid()) = user_id);

-- Uso docentes (docente_id)
DROP POLICY IF EXISTS "uso_docentes_crud" ON public.uso_docentes;
CREATE POLICY "uso_docentes_crud"
    ON public.uso_docentes FOR SELECT TO authenticated
    USING ((select auth.uid()) = docente_id);

COMMIT;
