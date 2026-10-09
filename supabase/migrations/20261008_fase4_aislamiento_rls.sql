-- =============================================================================
-- MIGRACIÓN FASE 4: AISLAMIENTO MULTIUSUARIO CON ROW LEVEL SECURITY (RLS)
-- Tablas: perfil_docente, planes_guardados, uso_docentes
-- =============================================================================
-- REGLAS DE SEGURIDAD Y PRIVACIDAD ESTRICTAS:
-- 1. Aislamiento por usuario autenticado: Cada registro pertenece a auth.users(id).
-- 2. Sin acceso anónimo (NO anon): Todas las políticas son exclusivamente TO authenticated.
-- 3. Cero visibilidad cruzada: Un docente jamás puede consultar, actualizar o borrar
--    registros pertenecientes a otro docente ((auth.uid() = user_id) / (auth.uid() = docente_id)).
-- 4. Disparador updated_at automático en cada tabla para auditoría de modificaciones.
-- 5. Índices optimizados por (user_id, created_at DESC) y (docente_id, periodo).
-- =============================================================================

-- Función para actualizar columna updated_at automáticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- -----------------------------------------------------------------------------
-- 1. TABLA: perfil_docente (Perfil Institucional del Docente)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.perfil_docente (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nombre VARCHAR(255) NOT NULL,
  centro_educativo VARCHAR(255),
  tanda VARCHAR(100),
  seccion VARCHAR(50),
  regional VARCHAR(100),
  distrito VARCHAR(100),
  grado VARCHAR(50),
  materias TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.perfil_docente ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Perfil docente: CRUD exclusivo del propietario" ON public.perfil_docente;
CREATE POLICY "Perfil docente: CRUD exclusivo del propietario"
  ON public.perfil_docente
  FOR ALL
  TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

DROP TRIGGER IF EXISTS trg_perfil_docente_updated_at ON public.perfil_docente;
CREATE TRIGGER trg_perfil_docente_updated_at
  BEFORE UPDATE ON public.perfil_docente
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- -----------------------------------------------------------------------------
-- 2. TABLA: planes_guardados (Biblioteca de Planificaciones del Docente)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.planes_guardados (
  id VARCHAR(100) PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  titulo VARCHAR(255) NOT NULL,
  nivel VARCHAR(50) NOT NULL,
  periodo VARCHAR(50) NOT NULL,
  area VARCHAR(100),
  grado VARCHAR(50),
  esquema_label VARCHAR(100),
  datos_planificacion JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.planes_guardados ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Planes guardados: CRUD exclusivo del propietario" ON public.planes_guardados;
CREATE POLICY "Planes guardados: CRUD exclusivo del propietario"
  ON public.planes_guardados
  FOR ALL
  TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

DROP TRIGGER IF EXISTS trg_planes_guardados_updated_at ON public.planes_guardados;
CREATE TRIGGER trg_planes_guardados_updated_at
  BEFORE UPDATE ON public.planes_guardados
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_planes_user_created ON public.planes_guardados (user_id, created_at DESC);

-- -----------------------------------------------------------------------------
-- 3. TABLA: uso_docentes (Control de Cuota Mensual Multi-Dispositivo)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.uso_docentes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  docente_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  periodo VARCHAR(7) NOT NULL, -- Formato YYYY-MM (ej. '2026-10')
  usadas INTEGER NOT NULL DEFAULT 0,
  limite INTEGER NOT NULL DEFAULT 20,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_docente_periodo UNIQUE (docente_id, periodo)
);

ALTER TABLE public.uso_docentes ENABLE ROW LEVEL SECURITY;

-- Los docentes SOLO pueden leer su propio contador.
-- NUNCA pueden insertar, modificar ni borrar cuotas desde el navegador.
-- La escritura y actualización de cuotas está reservada exclusivamente al servidor (service_role).
DROP POLICY IF EXISTS "Uso docentes: inserción propia" ON public.uso_docentes;
DROP POLICY IF EXISTS "Uso docentes: actualización propia" ON public.uso_docentes;
DROP POLICY IF EXISTS "Uso docentes: eliminación propia" ON public.uso_docentes;

DROP POLICY IF EXISTS "Uso docentes: lectura propia" ON public.uso_docentes;
CREATE POLICY "Uso docentes: lectura propia"
  ON public.uso_docentes
  FOR SELECT
  TO authenticated
  USING ((select auth.uid()) = docente_id);

DROP TRIGGER IF EXISTS trg_uso_docentes_updated_at ON public.uso_docentes;
CREATE TRIGGER trg_uso_docentes_updated_at
  BEFORE UPDATE ON public.uso_docentes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_uso_docentes_lookup ON public.uso_docentes (docente_id, periodo);

-- -----------------------------------------------------------------------------
-- 4. PRIVILEGIOS Y BLINDAJE DEFENSIVO (REVOKE / GRANT)
-- -----------------------------------------------------------------------------
-- Revocación total de acceso a PUBLIC y al rol anónimo (anon)
REVOKE ALL ON public.perfil_docente FROM PUBLIC, anon;
REVOKE ALL ON public.planes_guardados FROM PUBLIC, anon;
REVOKE ALL ON public.uso_docentes FROM PUBLIC, anon;

-- Privilegios controlados para usuarios autenticados (sujetos a RLS)
GRANT SELECT, INSERT, UPDATE, DELETE ON public.perfil_docente TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.planes_guardados TO authenticated;
REVOKE ALL ON public.uso_docentes FROM authenticated;
GRANT SELECT ON public.uso_docentes TO authenticated;

-- El rol del servidor (service_role) mantiene administración completa
GRANT ALL ON public.perfil_docente TO service_role;
GRANT ALL ON public.planes_guardados TO service_role;
GRANT ALL ON public.uso_docentes TO service_role;
