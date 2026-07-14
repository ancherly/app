# PRD — GymFichaje PWA

## Descripción del proyecto
Web App (PWA instalable en móvil) para control horario de gimnasio con roles Admin/Empleado, geolocalización con geofencing, historial mensual con código de colores y cierre automático a medianoche.

---

## Arquitectura (Actual — Serverless)

### Tech Stack
- **Frontend:** Angular 18+ (Standalone Components, Signals, provideRouter)
- **PWA:** @angular/service-worker (Service Worker, manifest, offline shell)
- **Estado:** Signals puros + computed + effect
- **Backend:** ELIMINADO — Arquitectura serverless
- **Base de datos:** Supabase PostgreSQL (cloud)
- **Auth:** Supabase Auth (signInWithPassword, JWT gestionado por SDK)
- **Seguridad:** Row Level Security (RLS) en PostgreSQL
- **Edge Functions:** Supabase Edge Functions (Deno) para operaciones admin
- **Scheduler:** pg_cron en Supabase para cierre automático medianoche

### Estructura de archivos
```
/app/
├── frontend/
│   └── src/app/
│       ├── core/services/
│       │   ├── supabase.service.ts     # Cliente singleton Supabase
│       │   ├── auth.service.ts         # Supabase Auth (signInWithPassword)
│       │   ├── punch.service.ts        # CRUD fichajes + geofencing client-side
│       │   ├── user.service.ts         # CRUD usuarios (admin + Edge Functions)
│       │   ├── gym-settings.service.ts # Configuración gym
│       │   └── geo.service.ts          # navigator.geolocation (sin cambios)
│       ├── features/
│       │   ├── auth/login.component.ts
│       │   ├── employee/dashboard.component.ts
│       │   ├── employee/history.component.ts
│       │   └── admin/ (users, employee-detail, settings)
│       └── app.config.ts              # Sin HttpClient, APP_INITIALIZER activo
├── supabase/
│   ├── functions/
│   │   ├── create-user/index.ts       # Edge Function: crear usuario
│   │   └── reset-user-password/index.ts # Edge Function: resetear contraseña
│   ├── migrations/001_rls_setup.sql   # RLS + funciones SQL
│   └── SETUP_INSTRUCTIONS.md          # Instrucciones de configuración Supabase
└── backend/                            # FastAPI — PENDIENTE DE ELIMINAR
```

---

## Supabase Config
- **URL:** https://urmdglvrqnhzlhtprfuc.supabase.co
- **Anon Key:** en environment.ts (pública, protegida por RLS)
- **Service Role Key:** SOLO en Edge Functions (nunca en frontend)

---

## DB Schema (Supabase PostgreSQL)

### public.users
```sql
{ id UUID (= auth.users.id), email, password_hash (placeholder), full_name, role, active, created_at }
```

### public.punches
```sql
{ id UUID, user_id UUID→users.id, work_date DATE, check_in_at TIMESTAMPTZ,
  check_in_lat/lng, check_in_note, check_out_at, check_out_lat/lng, check_out_note,
  status, edited_by_admin, edited_by, edited_at, created_at, updated_at }
```

### public.gym_settings
```sql
{ id UUID, latitude FLOAT, longitude FLOAT, radius_meters INT, timezone TEXT }
```

---

## User Personas
- **Admin:** Gerente del gimnasio. Gestiona empleados, ve historial, edita fichajes, configura geofencing.
- **Empleado:** Monitor, recepcionista. Ficha entrada/salida desde el gym.

---

## Core Requirements (MVP — Implementado ✅)

### Auth & Roles
- [x] Login con Supabase Auth (signInWithPassword)
- [x] Roles admin y employee (tabla public.users)
- [x] Guards: authGuard, adminGuard
- [x] Auto-login al cargar la app (APP_INITIALIZER + getSession)
- [x] Logout con signOut
- [x] Mensajes de error en español

### Panel Empleado
- [x] Reloj en tiempo real
- [x] Botón FICHAR ENTRADA / SALIDA alternante
- [x] Máx. 3 pares entrada/salida por día
- [x] Geofencing client-side (haversine)
- [x] Observaciones opcionales en fichaje
- [x] Historial mensual con calendario
- [x] Código de colores por estado
- [x] Resumen mensual

### Panel Admin
- [x] CRUD usuarios (via Edge Functions para crear/resetear)
- [x] Ver historial de cualquier empleado
- [x] Editar/crear/eliminar fichajes
- [x] Configurar coordenadas GPS + radio geofencing
- [x] RLS protege acceso a datos

### Seguridad (RLS)
- [x] Empleados solo ven sus propios fichajes
- [x] Admins ven todo
- [x] Tabla gym_settings: read para todos, write solo admins
- [x] Edge Functions verifican token + rol antes de ejecutar

---

## Backlog

### P0 — En progreso
- [ ] Ejecutar SQL de RLS en Supabase Dashboard (usuario pendiente)
- [ ] Crear auth users demo en Supabase (admin@gimnasio.es, empleado@gimnasio.es)
- [ ] Desplegar Edge Functions (supabase functions deploy)
- [ ] Eliminar backend FastAPI + actualizar supervisord

### P1 — Próximo
- [ ] pg_cron para cierre automático medianoche
- [ ] Exportación CSV/PDF del historial mensual
- [ ] Iconos PWA personalizados

### P2 — Futuro
- [ ] Notificaciones push
- [ ] Modo offline (IndexedDB + sync)
- [ ] Múltiples sedes
- [ ] Reporting con gráficos

---

## Historial de implementación

### Julio 2026 — Sesión 1
- MVP Angular 18 PWA con FastAPI + MongoDB
- 100% tests pasados

### Julio 2026 — Sesión 2
- PrimeNG v17.18.11 + SCSS architecture
- Demo users en login
- Configuración Mother Location mejorada

### Julio 2026 — Sesión 3 (actual)
- Migración DB: MongoDB → Supabase PostgreSQL
- Reescritura servicios Angular: HttpClient → @supabase/supabase-js
- Implementación Supabase Auth (signInWithPassword)
- RLS SQL script listo
- Edge Functions creadas (pendiente deploy)
- Geofencing movido a client-side
- Backend FastAPI marcado para eliminación
