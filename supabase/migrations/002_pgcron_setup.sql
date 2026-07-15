-- ================================================================
-- GYMFICHAJE — ACTIVAR pg_cron (cierre automático a medianoche)
-- ================================================================
-- REQUISITO PREVIO: Activar extensión pg_cron en:
--   Supabase Dashboard → Database → Extensions → buscar "pg_cron" → Enable
--
-- Una vez activada la extensión, ejecuta ESTE script en SQL Editor.
-- ================================================================

-- 1. Verificar que la extensión está activa
SELECT * FROM pg_extension WHERE extname = 'pg_cron';

-- 2. Registrar el trabajo cron: cierre a las 23:59 hora UTC
--    (equivale a 00:59 hora España en invierno, 01:59 en verano)
--    Si prefieres exactamente medianoche en España, usa hora UTC apropiada
SELECT cron.schedule(
  'gymfichaje-midnight-close',  -- nombre único del trabajo
  '59 22 * * *',                -- 22:59 UTC = 23:59 España (invierno) / ajusta en verano a '59 21 * * *'
  'SELECT public.close_open_punches()'
);

-- 3. Verificar que el trabajo quedó programado
SELECT
  jobid,
  schedule,
  command,
  active
FROM cron.job
WHERE jobname = 'gymfichaje-midnight-close';

-- ================================================================
-- NOTAS:
--   - La función close_open_punches() ya fue creada en 000_master_setup.sql
--   - Para ver los últimos logs de ejecución:
--     SELECT * FROM cron.job_run_details ORDER BY start_time DESC LIMIT 10;
--   - Para desactivar sin borrar:
--     UPDATE cron.job SET active = false WHERE jobname = 'gymfichaje-midnight-close';
--   - Para eliminar completamente:
--     SELECT cron.unschedule('gymfichaje-midnight-close');
-- ================================================================
