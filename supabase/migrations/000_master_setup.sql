-- ================================================================
-- GYMFICHAJE — MASTER SETUP SCRIPT
-- ================================================================
-- Propósito : Configuración completa desde cero para cualquier
--             proyecto Supabase nuevo.
-- Cómo usar : Dashboard → SQL Editor → New Query → Pegar y ejecutar.
-- Orden     : Ejecutar todos los bloques de arriba hacia abajo.
-- Versión   : 2.0 (Supabase Auth + RLS + Edge Functions)
-- ================================================================

-- ----------------------------------------------------------------
-- SECCIÓN 0 — LIMPIEZA (opcional, solo si vas a reinstalar)
-- ----------------------------------------------------------------
-- ADVERTENCIA: Estas líneas eliminan TODOS los datos existentes.
-- Descoméntalas SOLO si quieres empezar desde cero en un proyecto
-- que ya tenía tablas de una versión anterior.

-- DROP TABLE IF EXISTS public.punches CASCADE;
-- DROP TABLE IF EXISTS public.users CASCADE;
-- DROP TABLE IF EXISTS public.gym_settings CASCADE;
-- DROP FUNCTION IF EXISTS public.is_admin();
-- DROP FUNCTION IF EXISTS public.close_open_punches();


-- ================================================================
-- SECCIÓN 1 — TABLAS
-- ================================================================
-- Crea las tres tablas principales de la aplicación.
-- Nota: No se usa password_hash para la autenticación real;
--       Supabase Auth gestiona las contraseñas. El campo
--       password_hash queda como legado con valor placeholder.


-- 1.1 Tabla de usuarios (perfiles públicos)
-- El campo `id` DEBE coincidir con el UUID de auth.users
-- para que RLS funcione correctamente con auth.uid().
CREATE TABLE IF NOT EXISTS public.users (
  id            UUID        PRIMARY KEY,       -- = auth.users.id
  email         TEXT        NOT NULL UNIQUE,
  password_hash TEXT        NOT NULL DEFAULT 'managed_by_supabase_auth',
  full_name     TEXT        NOT NULL,
  role          TEXT        NOT NULL CHECK (role IN ('admin', 'employee')),
  active        BOOLEAN     NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.users IS
  'Perfiles de usuario. id = auth.users.id (Supabase Auth gestiona las contraseñas).';


-- 1.2 Tabla de fichajes
CREATE TABLE IF NOT EXISTS public.punches (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  work_date        DATE        NOT NULL,
  check_in_at      TIMESTAMPTZ NOT NULL,
  check_in_lat     FLOAT,
  check_in_lng     FLOAT,
  check_in_note    TEXT,
  check_out_at     TIMESTAMPTZ,
  check_out_lat    FLOAT,
  check_out_lng    FLOAT,
  check_out_note   TEXT,
  status           TEXT        NOT NULL DEFAULT 'open'
                     CHECK (status IN ('open','closed_manual','closed_auto','edited_admin')),
  edited_by_admin  BOOLEAN     NOT NULL DEFAULT false,
  edited_by        UUID        REFERENCES public.users(id),
  edited_at        TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.punches IS
  'Registro de fichajes (entrada/salida) de cada empleado por jornada.';

-- Índice para consultas frecuentes por usuario y mes
CREATE INDEX IF NOT EXISTS idx_punches_user_date
  ON public.punches (user_id, work_date);

CREATE INDEX IF NOT EXISTS idx_punches_status
  ON public.punches (status) WHERE status = 'open';


-- 1.3 Tabla de configuración del gimnasio
-- Solo debe existir UNA fila (la ubicación/radio del gimnasio).
CREATE TABLE IF NOT EXISTS public.gym_settings (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  latitude       FLOAT,
  longitude      FLOAT,
  radius_meters  INTEGER     NOT NULL DEFAULT 200,
  timezone       TEXT        NOT NULL DEFAULT 'Europe/Madrid',
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.gym_settings IS
  'Configuración de geofencing: una sola fila con lat/lng y radio del gimnasio.';


-- ================================================================
-- SECCIÓN 2 — ROW LEVEL SECURITY (RLS)
-- ================================================================
-- Habilita RLS en todas las tablas. Sin esto, cualquier cliente
-- con la anon key podría leer/escribir todos los datos.

ALTER TABLE public.users        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.punches      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gym_settings ENABLE ROW LEVEL SECURITY;


-- ================================================================
-- SECCIÓN 3 — FUNCIÓN HELPER DE ADMINISTRADOR
-- ================================================================
-- Usada internamente por las políticas RLS para verificar si el
-- usuario autenticado tiene rol 'admin' en la tabla public.users.
-- SECURITY DEFINER → se ejecuta con permisos del propietario
-- (postgres), evitando recursión en las políticas.

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users
    WHERE id     = auth.uid()
      AND role   = 'admin'
      AND active = true
  );
$$;

COMMENT ON FUNCTION public.is_admin() IS
  'Devuelve true si el usuario autenticado es admin activo. Usada en políticas RLS.';


-- ================================================================
-- SECCIÓN 4 — POLÍTICAS RLS PARA public.users
-- ================================================================

-- Empleado/Admin: leer su propio perfil
DROP POLICY IF EXISTS "users_select_own"       ON public.users;
CREATE POLICY "users_select_own" ON public.users
  FOR SELECT USING (auth.uid() = id);

-- Admin: leer todos los perfiles
DROP POLICY IF EXISTS "users_admin_select_all" ON public.users;
CREATE POLICY "users_admin_select_all" ON public.users
  FOR SELECT USING (public.is_admin());

-- Admin: actualizar cualquier perfil (activar/desactivar, editar nombre)
DROP POLICY IF EXISTS "users_admin_update"     ON public.users;
CREATE POLICY "users_admin_update" ON public.users
  FOR UPDATE USING (public.is_admin());

-- Admin: insertar perfiles (usado por la Edge Function create-user)
DROP POLICY IF EXISTS "users_admin_insert"     ON public.users;
CREATE POLICY "users_admin_insert" ON public.users
  FOR INSERT WITH CHECK (public.is_admin());


-- ================================================================
-- SECCIÓN 5 — POLÍTICAS RLS PARA public.punches
-- ================================================================

-- Empleado: ver solo sus fichajes
DROP POLICY IF EXISTS "punches_select_own"        ON public.punches;
CREATE POLICY "punches_select_own" ON public.punches
  FOR SELECT USING (auth.uid() = user_id);

-- Admin: ver todos los fichajes
DROP POLICY IF EXISTS "punches_admin_select_all"  ON public.punches;
CREATE POLICY "punches_admin_select_all" ON public.punches
  FOR SELECT USING (public.is_admin());

-- Empleado: insertar sus propios fichajes (check-in)
DROP POLICY IF EXISTS "punches_insert_own"        ON public.punches;
CREATE POLICY "punches_insert_own" ON public.punches
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Empleado: actualizar sus propios fichajes (check-out)
DROP POLICY IF EXISTS "punches_update_own"        ON public.punches;
CREATE POLICY "punches_update_own" ON public.punches
  FOR UPDATE USING (auth.uid() = user_id);

-- Admin: insertar fichajes para cualquier empleado
DROP POLICY IF EXISTS "punches_admin_insert"      ON public.punches;
CREATE POLICY "punches_admin_insert" ON public.punches
  FOR INSERT WITH CHECK (public.is_admin());

-- Admin: actualizar cualquier fichaje
DROP POLICY IF EXISTS "punches_admin_update"      ON public.punches;
CREATE POLICY "punches_admin_update" ON public.punches
  FOR UPDATE USING (public.is_admin());

-- Admin: eliminar cualquier fichaje
DROP POLICY IF EXISTS "punches_admin_delete"      ON public.punches;
CREATE POLICY "punches_admin_delete" ON public.punches
  FOR DELETE USING (public.is_admin());


-- ================================================================
-- SECCIÓN 6 — POLÍTICAS RLS PARA public.gym_settings
-- ================================================================

-- Cualquier usuario autenticado puede leer la configuración
DROP POLICY IF EXISTS "settings_select"       ON public.gym_settings;
CREATE POLICY "settings_select" ON public.gym_settings
  FOR SELECT USING (auth.role() = 'authenticated');

-- Solo admin puede insertar/actualizar configuración
DROP POLICY IF EXISTS "settings_admin_insert" ON public.gym_settings;
CREATE POLICY "settings_admin_insert" ON public.gym_settings
  FOR INSERT WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "settings_admin_update" ON public.gym_settings;
CREATE POLICY "settings_admin_update" ON public.gym_settings
  FOR UPDATE USING (public.is_admin());


-- ================================================================
-- SECCIÓN 7 — FUNCIÓN DE CIERRE AUTOMÁTICO A MEDIANOCHE
-- ================================================================
-- Cierra todos los fichajes abiertos (sin check_out_at) al final
-- del día. Pensada para ser invocada por pg_cron a las 23:59.

CREATE OR REPLACE FUNCTION public.close_open_punches()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.punches
  SET
    check_out_at   = NOW() AT TIME ZONE 'Europe/Madrid',
    status         = 'closed_auto',
    check_out_note = 'Cierre automático por el sistema',
    updated_at     = NOW()
  WHERE
    check_out_at IS NULL
    AND status = 'open';
END;
$$;

COMMENT ON FUNCTION public.close_open_punches() IS
  'Cierra todos los fichajes abiertos. Llamar a las 23:59 mediante pg_cron.';


-- ================================================================
-- SECCIÓN 8 — CONFIGURAR pg_cron (OPCIONAL)
-- ================================================================
-- REQUISITO: Activar la extensión pg_cron en:
--   Supabase Dashboard → Database → Extensions → buscar "pg_cron" → Enable
--
-- Después de activarla, ejecutar SOLO estas líneas:
--
-- Programar el cierre automático a las 23:59 (hora UTC = 22:59 España invierno)
-- SELECT cron.schedule(
--   'gymfichaje-midnight-close',
--   '59 23 * * *',
--   'SELECT public.close_open_punches()'
-- );
--
-- Para verificar que está programado:
-- SELECT * FROM cron.job;
--
-- Para eliminar el trabajo programado:
-- SELECT cron.unschedule('gymfichaje-midnight-close');


-- ================================================================
-- SECCIÓN 9 — DATOS DEMO (OPCIONAL)
-- ================================================================
-- IMPORTANTE: Ejecutar SOLO después de crear los usuarios en
-- Supabase Auth (Authentication → Users → Add User) y obtener
-- sus UUIDs. Sustituye los UUID de ejemplo por los reales.
--
-- Paso 1: Comprueba los UUIDs reales de tus auth users:
-- SELECT id, email FROM auth.users WHERE email IN ('admin@gimnasio.es', 'empleado@gimnasio.es');
--
-- Paso 2: Elimina perfiles viejos si los hay:
-- DELETE FROM public.users WHERE email IN ('admin@gimnasio.es', 'empleado@gimnasio.es');
--
-- Paso 3: Inserta los perfiles vinculados a Supabase Auth:
-- INSERT INTO public.users (id, email, full_name, role, active, password_hash)
-- SELECT
--   a.id,
--   a.email,
--   CASE a.email
--     WHEN 'admin@gimnasio.es'    THEN 'Administrador'
--     WHEN 'empleado@gimnasio.es' THEN 'María García'
--     ELSE a.email
--   END AS full_name,
--   CASE a.email
--     WHEN 'admin@gimnasio.es' THEN 'admin'
--     ELSE 'employee'
--   END AS role,
--   true AS active,
--   'managed_by_supabase_auth' AS password_hash
-- FROM auth.users a
-- WHERE a.email IN ('admin@gimnasio.es', 'empleado@gimnasio.es');
--
-- Paso 4: Inserta configuración inicial del gimnasio (ajusta las coordenadas):
-- INSERT INTO public.gym_settings (latitude, longitude, radius_meters, timezone)
-- VALUES (40.4168, -3.7038, 200, 'Europe/Madrid')  -- Madrid por defecto
-- ON CONFLICT DO NOTHING;
--
-- Paso 5: Verifica que todo está correcto:
-- SELECT id, email, full_name, role, active FROM public.users;
-- SELECT * FROM public.gym_settings;


-- ================================================================
-- FIN DEL SCRIPT
-- ================================================================
-- Resumen de lo ejecutado:
--   ✓ 3 tablas creadas (users, punches, gym_settings)
--   ✓ 2 índices en punches para rendimiento
--   ✓ RLS habilitado en las 3 tablas
--   ✓ Función helper is_admin() creada
--   ✓ 4 políticas para users
--   ✓ 7 políticas para punches
--   ✓ 3 políticas para gym_settings
--   ✓ Función close_open_punches() lista para pg_cron
--   ○ pg_cron: pendiente (descomenta Sección 8)
--   ○ Datos demo: pendiente (descomenta Sección 9)
-- ================================================================
