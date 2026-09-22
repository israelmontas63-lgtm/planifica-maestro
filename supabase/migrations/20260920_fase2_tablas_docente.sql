-- =============================================================================
-- MIGRACIÓN FASE 2: TABLAS DE DATOS DEL DOCENTE Y CALENDARIO OFICIAL
-- ARCHIVO DE DISEÑO SOLAMENTE (NO APLICAR A SUPABASE HASTA APROBACIÓN EXPLÍCITA)
-- =============================================================================
-- Reglas de Seguridad y Privacidad:
-- 1. Aislamiento estricto por usuario: Todas las tablas personales usan user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE.
-- 2. Sin acceso anónimo (NO anon): Todas las políticas son TO authenticated con (select auth.uid()) = user_id.
-- 3. Calendario oficial en 2 capas:
--    - Capa Oficial: 'calendario_escolar_oficial' (Solo lectura para authenticated, escritura solo por script/service_role).
--    - Capa Personal: 'docente_eventos' (Lectura/escritura exclusiva del docente propietario).
-- 4. Validaciones CHECK:
--    - Horarios: CHECK (hora_fin > hora_inicio)
--    - Grados: Lista cerrada oficial MINERD
--    - Áreas: Lista cerrada oficial MINERD
-- 5. Disparador updated_at automático en cada tabla.
-- 6. Índices por (user_id, fecha) para consultas eficientes.
-- =============================================================================

-- Función para actualizar columna updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- -----------------------------------------------------------------------------
-- 1. CALENDARIO ESCOLAR OFICIAL (Capa Oficial - Solo lectura)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS calendario_escolar_oficial (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fecha DATE NOT NULL,
  anio_escolar VARCHAR(20) NOT NULL,
  titulo VARCHAR(255) NOT NULL,
  tipo VARCHAR(50) NOT NULL CHECK (tipo IN ('efemeride', 'conmemoracion', 'reunion_docente', 'periodo_evaluacion', 'feriado', 'institucional')),
  documento_fuente VARCHAR(255) NOT NULL,
  url_fuente VARCHAR(500) NOT NULL,
  pagina INT NOT NULL,
  version VARCHAR(50) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE calendario_escolar_oficial ENABLE ROW LEVEL SECURITY;

-- Lectura solo para usuarios autenticados; sin valor por defecto en fuentes
CREATE POLICY "Lectura calendario oficial para autenticados"
  ON calendario_escolar_oficial FOR SELECT
  TO authenticated
  USING (true);

-- Escritura denegada para clientes (solo service_role mediante script de carga)
CREATE POLICY "Escritura calendario oficial denegada clientes"
  ON calendario_escolar_oficial FOR ALL
  TO authenticated
  USING (false);

CREATE INDEX IF NOT EXISTS idx_calendario_oficial_fecha ON calendario_escolar_oficial (fecha);
CREATE INDEX IF NOT EXISTS idx_calendario_oficial_anio ON calendario_escolar_oficial (anio_escolar);

-- -----------------------------------------------------------------------------
-- 2. PLANES GUARDADOS (Mis Planificaciones)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS planes_guardados (
  id VARCHAR(100) PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  titulo VARCHAR(255) NOT NULL,
  nivel VARCHAR(50) NOT NULL,
  periodo VARCHAR(50) NOT NULL,
  area VARCHAR(100) NOT NULL CHECK (area IN (
    'Lengua Española', 'Matemática', 'Ciencias Sociales', 'Ciencias de la Naturaleza',
    'Educación Artística', 'Educación Física', 'Formación Integral Humana y Religiosa',
    'Lenguas Extranjeras (Inglés)', 'Lenguas Extranjeras (Francés)', 'Integral', 'General'
  )),
  grado VARCHAR(50) NOT NULL CHECK (grado IN (
    'Párvulo', 'Pre-Kínder', 'Kínder', 'Pre-Primario',
    '1ro Primaria', '2do Primaria', '3ro Primaria', '4to Primaria', '5to Primaria', '6to Primaria',
    '1ro Secundaria', '2do Secundaria', '3ro Secundaria', '4to Secundaria', '5to Secundaria', '6to Secundaria',
    'General'
  )),
  esquema_label VARCHAR(100),
  datos_planificacion JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE planes_guardados ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Planes guardados: CRUD propio"
  ON planes_guardados FOR ALL
  TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

CREATE TRIGGER trg_planes_guardados_updated_at
  BEFORE UPDATE ON planes_guardados
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_planes_user_fecha ON planes_guardados (user_id, created_at DESC);

-- -----------------------------------------------------------------------------
-- 3. PERFIL DOCENTE
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS perfil_docente (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nombre VARCHAR(255) NOT NULL,
  centro_educativo VARCHAR(255),
  tanda VARCHAR(50) CHECK (tanda IN ('Matutina', 'Vespertina', 'Jornada Escolar Extendida', 'Nocturna')),
  materias TEXT[] DEFAULT '{}',
  grado VARCHAR(50) CHECK (grado IN (
    'Párvulo', 'Pre-Kínder', 'Kínder', 'Pre-Primario',
    '1ro Primaria', '2do Primaria', '3ro Primaria', '4to Primaria', '5to Primaria', '6to Primaria',
    '1ro Secundaria', '2do Secundaria', '3ro Secundaria', '4to Secundaria', '5to Secundaria', '6to Secundaria'
  )),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE perfil_docente ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Perfil docente: CRUD propio"
  ON perfil_docente FOR ALL
  TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

CREATE TRIGGER trg_perfil_docente_updated_at
  BEFORE UPDATE ON perfil_docente
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- -----------------------------------------------------------------------------
-- 4. DOCENTE EVENTOS (Capa Personal de Calendario)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS docente_eventos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  fecha DATE NOT NULL,
  hora_inicio TIME NOT NULL,
  hora_fin TIME NOT NULL,
  titulo VARCHAR(255) NOT NULL,
  descripcion VARCHAR(2000),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_hora_evento CHECK (hora_fin > hora_inicio)
);

ALTER TABLE docente_eventos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Docente eventos: CRUD propio"
  ON docente_eventos FOR ALL
  TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

CREATE TRIGGER trg_docente_eventos_updated_at
  BEFORE UPDATE ON docente_eventos
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_docente_eventos_user_fecha ON docente_eventos (user_id, fecha);

-- -----------------------------------------------------------------------------
-- 5. DOCENTE RECORDATORIOS
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS docente_recordatorios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  fecha DATE NOT NULL,
  recordatorio VARCHAR(1000) NOT NULL,
  completado BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE docente_recordatorios ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Docente recordatorios: CRUD propio"
  ON docente_recordatorios FOR ALL
  TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

CREATE TRIGGER trg_docente_recordatorios_updated_at
  BEFORE UPDATE ON docente_recordatorios
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_docente_recordatorios_user_fecha ON docente_recordatorios (user_id, fecha);

-- -----------------------------------------------------------------------------
-- 6. CONVERSACIONES (Historial de Asistente)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS conversaciones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  sesion_id VARCHAR(100) NOT NULL,
  mensajes JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE conversaciones ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Conversaciones: CRUD propio"
  ON conversaciones FOR ALL
  TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

CREATE TRIGGER trg_conversaciones_updated_at
  BEFORE UPDATE ON conversaciones
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_conversaciones_user_sesion ON conversaciones (user_id, sesion_id);

-- -----------------------------------------------------------------------------
-- 7. TAREAS INVESTIGACIÓN (RAG e Investigador Web)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS tareas_investigacion (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  consulta VARCHAR(500) NOT NULL,
  fuentes JSONB NOT NULL DEFAULT '[]',
  resultado TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE tareas_investigacion ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tareas investigacion: CRUD propio"
  ON tareas_investigacion FOR ALL
  TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

CREATE TRIGGER trg_tareas_investigacion_updated_at
  BEFORE UPDATE ON tareas_investigacion
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_tareas_investigacion_user ON tareas_investigacion (user_id, created_at DESC);

-- -----------------------------------------------------------------------------
-- 8. DOCENTE HORARIOS (Horario Semanal)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS docente_horarios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  dia_semana INT NOT NULL CHECK (dia_semana BETWEEN 1 AND 5), -- 1=Lunes, 5=Viernes
  hora_inicio TIME NOT NULL,
  hora_fin TIME NOT NULL,
  area VARCHAR(100) NOT NULL CHECK (area IN (
    'Lengua Española', 'Matemática', 'Ciencias Sociales', 'Ciencias de la Naturaleza',
    'Educación Artística', 'Educación Física', 'Formación Integral Humana y Religiosa',
    'Lenguas Extranjeras (Inglés)', 'Lenguas Extranjeras (Francés)', 'Integral'
  )),
  grado VARCHAR(50) NOT NULL CHECK (grado IN (
    'Párvulo', 'Pre-Kínder', 'Kínder', 'Pre-Primario',
    '1ro Primaria', '2do Primaria', '3ro Primaria', '4to Primaria', '5to Primaria', '6to Primaria',
    '1ro Secundaria', '2do Secundaria', '3ro Secundaria', '4to Secundaria', '5to Secundaria', '6to Secundaria'
  )),
  aula VARCHAR(50),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_hora_horario CHECK (hora_fin > hora_inicio)
);

ALTER TABLE docente_horarios ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Docente horarios: CRUD propio"
  ON docente_horarios FOR ALL
  TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

CREATE TRIGGER trg_docente_horarios_updated_at
  BEFORE UPDATE ON docente_horarios
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_docente_horarios_user_dia ON docente_horarios (user_id, dia_semana);

-- -----------------------------------------------------------------------------
-- 9. DOCENTE ACTIVIDADES (Registro de Actividades - Aviso Privacidad Estudiantes)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS docente_actividades (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  fecha DATE NOT NULL,
  grado VARCHAR(50) NOT NULL CHECK (grado IN (
    'Párvulo', 'Pre-Kínder', 'Kínder', 'Pre-Primario',
    '1ro Primaria', '2do Primaria', '3ro Primaria', '4to Primaria', '5to Primaria', '6to Primaria',
    '1ro Secundaria', '2do Secundaria', '3ro Secundaria', '4to Secundaria', '5to Secundaria', '6to Secundaria'
  )),
  area VARCHAR(100) NOT NULL CHECK (area IN (
    'Lengua Española', 'Matemática', 'Ciencias Sociales', 'Ciencias de la Naturaleza',
    'Educación Artística', 'Educación Física', 'Formación Integral Humana y Religiosa',
    'Lenguas Extranjeras (Inglés)', 'Lenguas Extranjeras (Francés)', 'Integral'
  )),
  momento VARCHAR(50) CHECK (momento IN ('Inicio', 'Desarrollo', 'Cierre', 'General')),
  actividad_realizada VARCHAR(2000) NOT NULL,
  recursos VARCHAR(1000),
  observaciones VARCHAR(2000),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE docente_actividades ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Docente actividades: CRUD propio"
  ON docente_actividades FOR ALL
  TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

CREATE TRIGGER trg_docente_actividades_updated_at
  BEFORE UPDATE ON docente_actividades
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_docente_actividades_user_fecha ON docente_actividades (user_id, fecha);

-- -----------------------------------------------------------------------------
-- 10. DOCENTE NOTAS (Notas de Aula - Aviso Privacidad Estudiantes)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS docente_notas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  fecha DATE NOT NULL,
  tipo VARCHAR(50) NOT NULL CHECK (tipo IN ('observacion', 'dua_adaptacion', 'incidencia', 'general')),
  nota VARCHAR(2000) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE docente_notas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Docente notas: CRUD propio"
  ON docente_notas FOR ALL
  TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

CREATE TRIGGER trg_docente_notas_updated_at
  BEFORE UPDATE ON docente_notas
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_docente_notas_user_fecha ON docente_notas (user_id, fecha);
