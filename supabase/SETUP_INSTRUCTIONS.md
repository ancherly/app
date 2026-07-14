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

### Opción B — Crear el perfil en public.users con los UUIDs correctos

Después de crear los auth users, ejecuta el siguiente SQL en el **SQL Editor** (reemplaza los UUIDs reales):

```sql
-- Obtener los UUIDs de los usuarios en auth.users
SELECT id, email FROM auth.users WHERE email IN ('admin@gimnasio.es', 'empleado@gimnasio.es');
```

Luego, si ya tienes filas en `public.users` con esos emails (del agente anterior), actualiza sus IDs para que coincidan con los de Supabase Auth:

```sql
-- Actualizar IDs para que coincidan con Supabase Auth
UPDATE public.users
SET id = (SELECT id FROM auth.users WHERE email = 'admin@gimnasio.es')
WHERE email = 'admin@gimnasio.es';

UPDATE public.users
SET id = (SELECT id FROM auth.users WHERE email = 'empleado@gimnasio.es')
WHERE email = 'empleado@gimnasio.es';
```

Si NO tienes filas previas en `public.users`, insértalas con los UUIDs correctos:

```sql
INSERT INTO public.users (id, email, full_name, role, active, password_hash)
VALUES
  ((SELECT id FROM auth.users WHERE email = 'admin@gimnasio.es'),
   'admin@gimnasio.es', 'Administrador', 'admin', true, 'managed_by_supabase_auth'),
  ((SELECT id FROM auth.users WHERE email = 'empleado@gimnasio.es'),
   'empleado@gimnasio.es', 'María García', 'employee', true, 'managed_by_supabase_auth');
```

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
