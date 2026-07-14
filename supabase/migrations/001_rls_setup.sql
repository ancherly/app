-- ============================================================
-- GymFichaje — Supabase Setup SQL
-- Ejecuta este script en: Dashboard → SQL Editor → New Query
-- ============================================================

-- 1. HABILITAR RLS EN TODAS LAS TABLAS
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.punches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gym_settings ENABLE ROW LEVEL SECURITY;

-- 2. FUNCIÓN HELPER: verificar si el usuario actual es admin
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
      AND role = 'admin'
      AND active = true
  );
$$;

-- 3. POLÍTICAS PARA public.users
-- Los usuarios pueden leer su propio perfil
DROP POLICY IF EXISTS "users_select_own" ON public.users;
CREATE POLICY "users_select_own" ON public.users
  FOR SELECT USING (auth.uid() = id);

-- Los admins pueden leer todos los usuarios
DROP POLICY IF EXISTS "users_admin_select_all" ON public.users;
CREATE POLICY "users_admin_select_all" ON public.users
  FOR SELECT USING (public.is_admin());

-- Los admins pueden actualizar cualquier usuario (activar/desactivar, editar)
DROP POLICY IF EXISTS "users_admin_update" ON public.users;
CREATE POLICY "users_admin_update" ON public.users
  FOR UPDATE USING (public.is_admin());

-- Los admins pueden insertar (para upsert de configuración propia vía Edge Function)
DROP POLICY IF EXISTS "users_admin_insert" ON public.users;
CREATE POLICY "users_admin_insert" ON public.users
  FOR INSERT WITH CHECK (public.is_admin());

-- 4. POLÍTICAS PARA public.punches
-- Empleados: ver solo sus propios fichajes
DROP POLICY IF EXISTS "punches_select_own" ON public.punches;
CREATE POLICY "punches_select_own" ON public.punches
  FOR SELECT USING (auth.uid() = user_id);

-- Admins: ver todos los fichajes
DROP POLICY IF EXISTS "punches_admin_select_all" ON public.punches;
CREATE POLICY "punches_admin_select_all" ON public.punches
  FOR SELECT USING (public.is_admin());

-- Empleados: insertar solo sus propios fichajes
DROP POLICY IF EXISTS "punches_insert_own" ON public.punches;
CREATE POLICY "punches_insert_own" ON public.punches
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Empleados: actualizar solo sus propios fichajes abiertos (para checkout)
DROP POLICY IF EXISTS "punches_update_own" ON public.punches;
CREATE POLICY "punches_update_own" ON public.punches
  FOR UPDATE USING (auth.uid() = user_id);

-- Admins: insertar fichajes para cualquier empleado
DROP POLICY IF EXISTS "punches_admin_insert" ON public.punches;
CREATE POLICY "punches_admin_insert" ON public.punches
  FOR INSERT WITH CHECK (public.is_admin());

-- Admins: actualizar cualquier fichaje
DROP POLICY IF EXISTS "punches_admin_update" ON public.punches;
CREATE POLICY "punches_admin_update" ON public.punches
  FOR UPDATE USING (public.is_admin());

-- Admins: eliminar cualquier fichaje
DROP POLICY IF EXISTS "punches_admin_delete" ON public.punches;
CREATE POLICY "punches_admin_delete" ON public.punches
  FOR DELETE USING (public.is_admin());

-- 5. POLÍTICAS PARA public.gym_settings
-- Cualquier usuario autenticado puede leer la configuración
DROP POLICY IF EXISTS "settings_select" ON public.gym_settings;
CREATE POLICY "settings_select" ON public.gym_settings
  FOR SELECT USING (auth.role() = 'authenticated');

-- Solo los admins pueden modificar la configuración
DROP POLICY IF EXISTS "settings_admin_insert" ON public.gym_settings;
CREATE POLICY "settings_admin_insert" ON public.gym_settings
  FOR INSERT WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "settings_admin_update" ON public.gym_settings;
CREATE POLICY "settings_admin_update" ON public.gym_settings
  FOR UPDATE USING (public.is_admin());

-- 6. FUNCIÓN DE CIERRE AUTOMÁTICO MEDIANOCHE
CREATE OR REPLACE FUNCTION public.close_open_punches()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.punches
  SET
    check_out_at = NOW() AT TIME ZONE 'Europe/Madrid',
    status = 'closed_auto',
    check_out_note = 'Cierre automático por el sistema',
    updated_at = NOW()
  WHERE
    check_out_at IS NULL
    AND status = 'open';
END;
$$;

-- 7. PROGRAMAR CIERRE AUTOMÁTICO CON pg_cron
-- (Requiere activar la extensión pg_cron en Supabase Dashboard → Database → Extensions → pg_cron)
-- Después de activarla, ejecuta SOLO esta línea:
-- SELECT cron.schedule('gymfichaje-midnight-close', '59 23 * * *', 'SELECT public.close_open_punches()');

-- ============================================================
-- PASO SIGUIENTE: Crear los usuarios demo en Supabase Auth
-- (ver instrucciones en /app/supabase/SETUP_INSTRUCTIONS.md)
-- ============================================================
