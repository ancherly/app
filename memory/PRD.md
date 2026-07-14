# PRD — GymFichaje PWA

## Descripción del proyecto
Web App (PWA instalable en móvil) para control horario de gimnasio con roles Admin/Empleado, geolocalización con geofencing, historial mensual con código de colores y cierre automático a medianoche.

**Fecha de inicio:** Julio 2026

---

## Arquitectura

### Tech Stack
- **Frontend:** Angular 18+ (Standalone Components, Signals, provideRouter, provideHttpClient)
- **PWA:** @angular/service-worker (Service Worker, manifest, offline shell)
- **Estado:** Signals puros + computed + effect
- **Backend:** FastAPI (Python)
- **Base de datos:** MongoDB (Motor async driver)
- **Scheduler:** APScheduler (cierre automático medianoche)
- **Auth:** JWT con httpOnly cookies + bcrypt

### Estructura de archivos
```
/app/backend/server.py          # Backend completo (FastAPI + Auth + API)
/app/frontend/src/
  app/
    app.component.ts            # Root component con loading state
    app.config.ts               # Providers (router, http, APP_INITIALIZER)
    app.routes.ts               # Lazy loading por feature
    core/
      services/
        auth.service.ts         # Signals: currentUser, isAdmin, isLoading
        punch.service.ts        # CRUD fichajes
        user.service.ts         # CRUD usuarios (admin)
        gym-settings.service.ts # Configuración gymnasio
        geo.service.ts          # Geolocalización navigator.geolocation
      guards/
        auth.guard.ts           # Requiere sesión activa
        admin.guard.ts          # Requiere rol admin
      interceptors/
        auth.interceptor.ts     # withCredentials: true en todas las requests
    features/
      auth/login.component.ts
      employee/
        dashboard.component.ts  # Reloj + botón fichar + fichajes hoy
        history.component.ts    # Calendario + lista diaria + resumen mensual
      admin/
        users.component.ts      # CRUD usuarios
        employee-detail.component.ts  # Historial empleado + editar fichajes
        settings.component.ts   # Coordenadas gym + radio geofencing
    layout/
      main-layout.component.ts  # Sidebar + router-outlet
  environments/environment.ts
  styles.scss                   # Dark tactical theme CSS variables
```

---

## User Personas
- **Admin:** Gerente del gimnasio. Gestiona empleados, ve historial, edita fichajes, configura geofencing.
- **Empleado:** Monitor, recepcionista, mantenimiento. Ficha entrada/salida desde el gym.

---

## Core Requirements (MVP - Implementado ✅)

### Auth & Roles
- [x] Login email + password con JWT httpOnly cookies
- [x] Roles admin y employee
- [x] Guards: authGuard (requiere sesión), adminGuard (requiere admin)
- [x] Auto-login al cargar la app (APP_INITIALIZER + /api/auth/me)
- [x] Logout con limpieza de cookies

### Panel Empleado
- [x] Reloj en tiempo real (Signals + setInterval)
- [x] Botón "FICHAR ENTRADA" / "FICHAR SALIDA" alternante
- [x] Máx. 3 pares entrada/salida por día (validado en backend)
- [x] Captura automática GPS (navigator.geolocation)
- [x] Validación geofencing (haversine en backend) — BLOQUEA si fuera de radio
- [x] Observación de texto opcional en cada fichaje
- [x] Historial mensual con calendario
- [x] Código de colores: 🟢 Verde (manual), 🔴 Rojo (auto), 🟡 Amarillo (admin), 🔵 Azul (abierto)
- [x] Resumen mensual (días trabajados, horas estimadas, cierres auto)

### Panel Admin
- [x] CRUD de usuarios (crear, editar nombre/email, activar/desactivar, resetear password)
- [x] Ver historial de cualquier empleado
- [x] Editar fichajes → se marca status=edited_admin (amarillo)
- [x] Crear fichajes desde cero (olvidé fichar)
- [x] Eliminar fichajes
- [x] Configurar coordenadas GPS del gimnasio + radio de geofencing (50-2000m)
- [x] "Usar mi ubicación" para configurar gym desde el navegador

### Cierre automático (Midnight Reset)
- [x] APScheduler con CronTrigger a las 23:59 Europe/Madrid
- [x] Cierra todos los fichajes abiertos con status=closed_auto
- [x] Nota "Cierre automático por el sistema"

### PWA
- [x] Service Worker configurado (ngsw-config.json)
- [x] manifest.webmanifest con theme-color, standalone display
- [x] Proxy config para dev (ng serve proxia /api/* → localhost:8001)

---

## Database Models (MongoDB)

### users
```json
{ "_id": ObjectId, "email": str, "password_hash": str, "full_name": str,
  "role": "admin"|"employee", "active": bool, "created_at": datetime }
```

### gym_settings
```json
{ "latitude": float, "longitude": float, "radius_meters": int, "timezone": "Europe/Madrid" }
```

### punches
```json
{ "_id": ObjectId, "user_id": str, "work_date": "YYYY-MM-DD",
  "check_in_at": datetime, "check_in_lat": float, "check_in_lng": float, "check_in_note": str,
  "check_out_at": datetime|null, "check_out_lat": float, "check_out_lng": float, "check_out_note": str,
  "status": "open"|"closed_manual"|"closed_auto"|"edited_admin",
  "edited_by_admin": bool, "edited_by": str|null, "edited_at": datetime|null }
```

---

## API Endpoints Implementados

| Method | Endpoint | Auth | Descripción |
|--------|----------|------|-------------|
| POST | /api/auth/login | - | Login con cookies |
| POST | /api/auth/logout | ✓ | Limpia cookies |
| GET | /api/auth/me | ✓ | Usuario actual |
| POST | /api/auth/refresh | cookie | Renueva access token |
| GET | /api/settings | ✓ | Configuración gym |
| PUT | /api/settings | admin | Actualizar config |
| GET | /api/punches | ✓ | Mis fichajes (filtro mes) |
| POST | /api/punches/checkin | ✓ | Fichar entrada |
| POST | /api/punches/checkout/{id} | ✓ | Fichar salida |
| GET | /api/admin/users | admin | Lista usuarios |
| POST | /api/admin/users | admin | Crear usuario |
| PUT | /api/admin/users/{id} | admin | Editar usuario |
| PATCH | /api/admin/users/{id}/toggle-active | admin | Activar/desactivar |
| POST | /api/admin/users/{id}/reset-password | admin | Resetear contraseña |
| GET | /api/admin/punches | admin | Fichajes cualquier empleado |
| POST | /api/admin/punches | admin | Crear fichaje manual |
| PUT | /api/admin/punches/{id} | admin | Editar fichaje |
| DELETE | /api/admin/punches/{id} | admin | Eliminar fichaje |

---

## Credenciales de Prueba
Ver /app/memory/test_credentials.md

---

## Backlog (Fases 2-4)

### P0 — Próxima sesión
- [ ] Conectar con Supabase (cuando el usuario esté listo)
- [ ] Icono PWA dumbbell (mejorar SVG del brand icon)

### P1 — Fase 3
- [ ] Exportación CSV/PDF del historial mensual
- [ ] Iconos PWA personalizados (512x512, 192x192)

### P2 — Fase 4
- [ ] Notificaciones push (Web Push API)
- [ ] Modo offline con cola de fichajes (IndexedDB + sync)
- [ ] Múltiples sedes
- [ ] Turnos planificados vs fichado
- [ ] Reporting con gráficos (Recharts/Chart.js)

---

## Implementado: Julio 2026
- MVP completo Angular 18 PWA con FastAPI+MongoDB
- 100% tests pasados (backend + frontend)
