-- =============================================================================
-- ROLLBACK FASE 12: MODO MULTIUSUARIO INSTITUCIONAL Y SUPERVISIÓN MINERD
-- Revierte: revisiones_coordinador, planificaciones, supervisiones_area_minerd, usuarios, escuelas
-- =============================================================================

BEGIN;

DROP TABLE IF EXISTS public.revisiones_coordinador CASCADE;
DROP TABLE IF EXISTS public.planificaciones CASCADE;
DROP TABLE IF EXISTS public.supervisiones_area_minerd CASCADE;
DROP TABLE IF EXISTS public.usuarios CASCADE;
DROP TABLE IF EXISTS public.escuelas CASCADE;

COMMIT;
