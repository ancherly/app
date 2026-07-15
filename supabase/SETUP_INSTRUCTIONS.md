# Instrucciones de Configuración — Supabase

## 1. Ejecutar el script RLS

Ve a tu proyecto Supabase → **SQL Editor** → **New Query** y pega el contenido de `migrations/001_rls_setup.sql`. Ejecuta todo.

---

## 2. Crear usuarios demo en Supabase Auth

Los usuarios de autenticación deben crearse en **Authentication → Users** del Dashboard de Supabase (o vía la Edge Function de admin).

### Opción A — Desde el Dashboard (recomendado para el inicio)

1. Ve a **Authentication → Users → Add User → Create New User**
2. Crea:
   - Email: `admin@gimnasio.es` / Password: `Admin1234!`
   - Email: `empleado@gimnasio.es` / Password: `Empleado123!`
3. Anota los **UUID** de cada usuario creado.

### Opción B — Vincular perfiles en public.users con los UUIDs de Supabase Auth

Después de crear los auth users, ejecuta el siguiente SQL en el **SQL Editor**.

> ⚠️ **No uses UPDATE sobre el ID** (clave primaria). Usa DELETE + INSERT para reemplazar las filas antiguas:

```sql
-- 1. Verificar que los auth users existen
SELECT id, email FROM auth.users WHERE email IN ('admin@gimnasio.es', 'empleado@gimnasio.es');

-- 2. Eliminar perfiles viejos (con UUIDs incorrectos del sistema anterior)
DELETE FROM public.users WHERE email IN ('admin@gimnasio.es', 'empleado@gimnasio.es');

-- 3. Re-insertar con los UUIDs correctos de Supabase Auth
INSERT INTO public.users (id, email, full_name, role, active, password_hash)
SELECT
  a.id,
  a.email,
  CASE a.email
    WHEN 'admin@gimnasio.es'    THEN 'Administrador'
    WHEN 'empleado@gimnasio.es' THEN 'María García'
    ELSE a.email
  END AS full_name,
  CASE a.email
    WHEN 'admin@gimnasio.es' THEN 'admin'
    ELSE 'employee'
  END AS role,
  true AS active,
  'managed_by_supabase_auth' AS password_hash
FROM auth.users a
WHERE a.email IN ('admin@gimnasio.es', 'empleado@gimnasio.es');

-- 4. Verificar el resultado
SELECT id, email, full_name, role, active FROM public.users;
```

**Por qué no funciona el UPDATE anterior:**
El `id` es la clave primaria. No se puede cambiar directamente a otro valor. En su lugar, eliminamos la fila antigua y la recreamos con el UUID correcto de Supabase Auth.

---

## 3. Desplegar las Edge Functions

Necesitas la [Supabase CLI](https://supabase.com/docs/guides/cli) instalada:

```bash
# Desde la raíz del proyecto /app
supabase login
supabase link --project-ref urmdglvrqnhzlhtprfuc
supabase functions deploy create-user
supabase functions deploy reset-user-password
```

Las funciones usarán automáticamente las variables de entorno `SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY` disponibles en el runtime de Supabase.

---

## 4. Activar pg_cron para el cierre automático (opcional)

1. Ve a **Database → Extensions** y busca `pg_cron`. Actívalo.
2. En el SQL Editor, ejecuta:

```sql
SELECT cron.schedule('gymfichaje-midnight-close', '59 23 * * *', 'SELECT public.close_open_punches()');
```

Para verificar que está programado:
```sql
SELECT * FROM cron.job;
```

---

## 5. Credenciales para testing

| Rol       | Email                  | Contraseña    |
|-----------|------------------------|---------------|
| Admin     | admin@gimnasio.es      | Admin1234!    |
| Empleado  | empleado@gimnasio.es   | Empleado123!  |
