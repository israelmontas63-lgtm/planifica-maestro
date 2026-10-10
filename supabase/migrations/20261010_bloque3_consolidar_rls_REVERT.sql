-- Script de reversión de la consolidación de RLS (Bloque 3)
-- Eliminar las políticas consolidadas
DROP POLICY IF EXISTS "calendario_escolar_oficial_select" ON public.calendario_escolar_oficial;
DROP POLICY IF EXISTS "planes_guardados_crud" ON public.planes_guardados;
DROP POLICY IF EXISTS "perfil_docente_crud" ON public.perfil_docente;
DROP POLICY IF EXISTS "docente_eventos_crud" ON public.docente_eventos;
DROP POLICY IF EXISTS "docente_recordatorios_crud" ON public.docente_recordatorios;
DROP POLICY IF EXISTS "conversaciones_crud" ON public.conversaciones;
DROP POLICY IF EXISTS "tareas_investigacion_crud" ON public.tareas_investigacion;
DROP POLICY IF EXISTS "docente_horarios_crud" ON public.docente_horarios;
DROP POLICY IF EXISTS "docente_actividades_crud" ON public.docente_actividades;
DROP POLICY IF EXISTS "docente_notas_crud" ON public.docente_notas;
DROP POLICY IF EXISTS "uso_docentes_crud" ON public.uso_docentes;

-- Restaurar políticas anteriores (extraídas de 20260920_fase2_tablas_docente.sql y 20261008_fase4_aislamiento_rls.sql)
CREATE POLICY "Lectura calendario oficial para autenticados" ON public.calendario_escolar_oficial FOR SELECT TO authenticated USING (true);
CREATE POLICY "Escritura calendario oficial denegada clientes" ON public.calendario_escolar_oficial FOR ALL TO authenticated USING (false) WITH CHECK (false);
CREATE POLICY "Planes guardados: CRUD propio" ON public.planes_guardados FOR ALL TO authenticated USING ((select auth.uid()) = user_id) WITH CHECK ((select auth.uid()) = user_id);
CREATE POLICY "Perfil docente: CRUD propio" ON public.perfil_docente FOR ALL TO authenticated USING ((select auth.uid()) = user_id) WITH CHECK ((select auth.uid()) = user_id);
CREATE POLICY "Docente eventos: CRUD propio" ON public.docente_eventos FOR ALL TO authenticated USING ((select auth.uid()) = user_id) WITH CHECK ((select auth.uid()) = user_id);
CREATE POLICY "Docente recordatorios: CRUD propio" ON public.docente_recordatorios FOR ALL TO authenticated USING ((select auth.uid()) = user_id) WITH CHECK ((select auth.uid()) = user_id);
CREATE POLICY "Conversaciones: CRUD propio" ON public.conversaciones FOR ALL TO authenticated USING ((select auth.uid()) = user_id) WITH CHECK ((select auth.uid()) = user_id);
CREATE POLICY "Tareas investigacion: CRUD propio" ON public.tareas_investigacion FOR ALL TO authenticated USING ((select auth.uid()) = user_id) WITH CHECK ((select auth.uid()) = user_id);
CREATE POLICY "Docente horarios: CRUD propio" ON public.docente_horarios FOR ALL TO authenticated USING ((select auth.uid()) = user_id) WITH CHECK ((select auth.uid()) = user_id);
CREATE POLICY "Docente actividades: CRUD propio" ON public.docente_actividades FOR ALL TO authenticated USING ((select auth.uid()) = user_id) WITH CHECK ((select auth.uid()) = user_id);
CREATE POLICY "Docente notas: CRUD propio" ON public.docente_notas FOR ALL TO authenticated USING ((select auth.uid()) = user_id) WITH CHECK ((select auth.uid()) = user_id);
CREATE POLICY "Perfil docente: CRUD exclusivo del propietario" ON public.perfil_docente FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Planes guardados: CRUD exclusivo del propietario" ON public.planes_guardados FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Uso docentes: lectura propia" ON public.uso_docentes FOR SELECT USING (auth.uid() = docente_id);
