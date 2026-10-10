-- PRUEBA DE POLÍTICAS RLS (Bloque 3)
-- Ejecutar en editor SQL de prueba simulando distintos roles.

BEGIN;
-- Simulamos ser Anónimo (anon)
SET ROLE anon;
-- Esto debe fallar o devolver 0 filas:
SELECT * FROM public.perfil_docente;
-- Esto debe dar error de permisos:
INSERT INTO public.perfil_docente (user_id, nombre) VALUES ('00000000-0000-0000-0000-000000000000', 'Anon');

-- Simulamos ser Docente A
SET ROLE authenticated;
-- NOTA: En la consola de Supabase se debe settear request.jwt.claim.sub para simular a nivel JWT, ej:
-- SET request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
-- Debería poder insertar su propio perfil:
-- INSERT INTO public.perfil_docente (user_id, nombre) VALUES ('11111111-1111-1111-1111-111111111111', 'Docente A');

-- Debería FALLAR al intentar borrar o ver lo de B ('2222...')
-- DELETE FROM public.perfil_docente WHERE user_id = '22222222-2222-2222-2222-222222222222';
ROLLBACK;
