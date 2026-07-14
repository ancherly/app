from dotenv import load_dotenv
load_dotenv()

from fastapi import FastAPI, APIRouter, HTTPException, Request, Response, Depends
from starlette.middleware.cors import CORSMiddleware
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update, delete, and_
import os
import logging
import bcrypt
import jwt
from datetime import datetime, timezone, timedelta, date as date_type
from pathlib import Path
from pydantic import BaseModel
from typing import Optional
import math
import pytz
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from calendar import monthrange

from database import AsyncSessionLocal, get_db
from models import User, Punch, GymSettings

ROOT_DIR = Path(__file__).parent

JWT_ALGORITHM = "HS256"
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)


# ---- Helpers ----

def get_jwt_secret() -> str:
    return os.environ["JWT_SECRET"]

def hash_password(password: str) -> str:
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(password.encode("utf-8"), salt).decode("utf-8")

def verify_password(plain: str, hashed: str) -> bool:
    return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))

def create_access_token(user_id: str, email: str) -> str:
    payload = {"sub": user_id, "email": email, "exp": datetime.now(timezone.utc) + timedelta(hours=8), "type": "access"}
    return jwt.encode(payload, get_jwt_secret(), algorithm=JWT_ALGORITHM)

def create_refresh_token(user_id: str) -> str:
    payload = {"sub": user_id, "exp": datetime.now(timezone.utc) + timedelta(days=7), "type": "refresh"}
    return jwt.encode(payload, get_jwt_secret(), algorithm=JWT_ALGORITHM)

def haversine_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    R = 6371000
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lon2 - lon1)
    a = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlambda / 2) ** 2
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


# ---- Serializers ----

def serialize_user(u: User) -> dict:
    return {
        "id": str(u.id),
        "email": u.email,
        "full_name": u.full_name,
        "role": u.role,
        "active": u.active,
        "created_at": u.created_at.isoformat() if u.created_at else None
    }

def serialize_punch(p: Punch) -> dict:
    return {
        "id": str(p.id),
        "user_id": str(p.user_id),
        "work_date": p.work_date.isoformat() if p.work_date else None,
        "check_in_at": p.check_in_at.isoformat() if p.check_in_at else None,
        "check_in_lat": p.check_in_lat,
        "check_in_lng": p.check_in_lng,
        "check_in_note": p.check_in_note,
        "check_out_at": p.check_out_at.isoformat() if p.check_out_at else None,
        "check_out_lat": p.check_out_lat,
        "check_out_lng": p.check_out_lng,
        "check_out_note": p.check_out_note,
        "status": p.status,
        "edited_by_admin": p.edited_by_admin,
        "edited_by": str(p.edited_by) if p.edited_by else None,
        "edited_at": p.edited_at.isoformat() if p.edited_at else None,
        "created_at": p.created_at.isoformat() if p.created_at else None,
        "updated_at": p.updated_at.isoformat() if p.updated_at else None
    }

def serialize_settings(s: GymSettings) -> dict:
    return {
        "latitude": s.latitude,
        "longitude": s.longitude,
        "radius_meters": s.radius_meters,
        "timezone": s.timezone
    }


# ---- Auth helpers ----

async def get_current_user(request: Request) -> dict:
    token = request.cookies.get("access_token")
    if not token:
        auth_header = request.headers.get("Authorization", "")
        if auth_header.startswith("Bearer "):
            token = auth_header[7:]
    if not token:
        raise HTTPException(status_code=401, detail="No autenticado")
    try:
        payload = jwt.decode(token, get_jwt_secret(), algorithms=[JWT_ALGORITHM])
        if payload.get("type") != "access":
            raise HTTPException(status_code=401, detail="Tipo de token inválido")
        user_id = payload["sub"]
        async with AsyncSessionLocal() as db:
            result = await db.execute(select(User).where(User.id == user_id))
            user = result.scalar_one_or_none()
        if not user:
            raise HTTPException(status_code=401, detail="Usuario no encontrado")
        if not user.active:
            raise HTTPException(status_code=403, detail="Cuenta desactivada")
        return {"id": str(user.id), "email": user.email, "full_name": user.full_name, "role": user.role, "active": user.active}
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expirado")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Token inválido")

async def require_admin(request: Request) -> dict:
    user = await get_current_user(request)
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Acceso denegado. Se requiere rol de administrador")
    return user


# ---- Scheduler ----

async def auto_close_punches():
    madrid_tz = pytz.timezone('Europe/Madrid')
    now_madrid = datetime.now(madrid_tz)
    today = now_madrid.date()
    close_naive = datetime.combine(today, datetime.strptime("23:59:59", "%H:%M:%S").time())
    close_time = madrid_tz.localize(close_naive)
    async with AsyncSessionLocal() as db:
        result = await db.execute(
            update(Punch)
            .where(Punch.check_out_at == None, Punch.work_date <= today)
            .values(
                check_out_at=close_time,
                check_out_note="Cierre automático por el sistema",
                status="closed_auto",
                updated_at=datetime.now(timezone.utc)
            )
        )
        await db.commit()
        logger.info(f"Auto-close: {result.rowcount} fichajes cerrados")


# ---- App ----

app = FastAPI()
api_router = APIRouter(prefix="/api")

cors_origins = os.environ.get('CORS_ORIGINS', 'http://localhost:3000').split(',')
app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def startup():
    admin_email = os.environ.get("ADMIN_EMAIL", "admin@gimnasio.es")
    admin_password = os.environ.get("ADMIN_PASSWORD", "Admin1234!")

    async with AsyncSessionLocal() as db:
        # Seed admin
        result = await db.execute(select(User).where(User.email == admin_email))
        existing_admin = result.scalar_one_or_none()
        if existing_admin is None:
            now = datetime.now(timezone.utc)
            db.add(User(email=admin_email, password_hash=hash_password(admin_password),
                        full_name="Administrador", role="admin", active=True, created_at=now))
            await db.commit()
            logger.info(f"Admin creado: {admin_email}")
        elif not verify_password(admin_password, existing_admin.password_hash):
            await db.execute(update(User).where(User.email == admin_email)
                             .values(password_hash=hash_password(admin_password)))
            await db.commit()

        # Seed gym_settings
        result = await db.execute(select(GymSettings).limit(1))
        if not result.scalar_one_or_none():
            db.add(GymSettings())
            await db.commit()
            logger.info("Gym settings creados")

        # Seed test employee
        test_email = "empleado@gimnasio.es"
        result = await db.execute(select(User).where(User.email == test_email))
        if not result.scalar_one_or_none():
            now = datetime.now(timezone.utc)
            db.add(User(email=test_email, password_hash=hash_password("Empleado123!"),
                        full_name="María García", role="employee", active=True, created_at=now))
            await db.commit()
            logger.info("Empleado de prueba creado")

    # Scheduler
    scheduler = AsyncIOScheduler()
    scheduler.add_job(auto_close_punches, CronTrigger(hour=23, minute=59, timezone=pytz.timezone('Europe/Madrid')))
    scheduler.start()
    logger.info("Scheduler iniciado")


@app.on_event("shutdown")
async def shutdown():
    pass  # El pool de conexiones SQLAlchemy se limpia automáticamente


# ---- Modelos Pydantic ----

class LoginRequest(BaseModel):
    email: str
    password: str

class CreateUserRequest(BaseModel):
    email: str
    password: str
    full_name: str
    role: str = "employee"

class UpdateUserRequest(BaseModel):
    full_name: Optional[str] = None
    email: Optional[str] = None

class ResetPasswordRequest(BaseModel):
    new_password: str

class GymSettingsRequest(BaseModel):
    latitude: float
    longitude: float
    radius_meters: int = 100

class CheckInRequest(BaseModel):
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    note: Optional[str] = None

class CheckOutRequest(BaseModel):
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    note: Optional[str] = None

class CreatePunchRequest(BaseModel):
    user_id: str
    work_date: str
    check_in_at: str
    check_out_at: Optional[str] = None
    check_in_note: Optional[str] = None
    check_out_note: Optional[str] = None

class UpdatePunchRequest(BaseModel):
    check_in_at: Optional[str] = None
    check_out_at: Optional[str] = None
    check_in_note: Optional[str] = None
    check_out_note: Optional[str] = None


# ---- Auth ----

@api_router.get("/")
async def root():
    return {"message": "Gym Fichaje API v2.0 — Supabase"}

@api_router.post("/auth/login")
async def login(request_data: LoginRequest, response: Response, db: AsyncSession = Depends(get_db)):
    email = request_data.email.lower().strip()
    result = await db.execute(select(User).where(User.email == email))
    user = result.scalar_one_or_none()
    if not user or not verify_password(request_data.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Email o contraseña incorrectos")
    if not user.active:
        raise HTTPException(status_code=403, detail="Cuenta desactivada. Contacta con el administrador")

    user_id = str(user.id)
    access_token = create_access_token(user_id, email)
    refresh_token = create_refresh_token(user_id)

    is_secure = os.environ.get("APP_URL", "http://").startswith("https")
    response.set_cookie("access_token", access_token, httponly=True, secure=is_secure, samesite="lax", max_age=28800, path="/")
    response.set_cookie("refresh_token", refresh_token, httponly=True, secure=is_secure, samesite="lax", max_age=604800, path="/")

    return {"id": user_id, "email": email, "full_name": user.full_name, "role": user.role, "active": user.active}

@api_router.post("/auth/logout")
async def logout(response: Response):
    response.delete_cookie("access_token", path="/")
    response.delete_cookie("refresh_token", path="/")
    return {"ok": True}

@api_router.get("/auth/me")
async def me(request: Request):
    return await get_current_user(request)

@api_router.post("/auth/refresh")
async def refresh_token_endpoint(request: Request, response: Response):
    token = request.cookies.get("refresh_token")
    if not token:
        raise HTTPException(status_code=401, detail="No hay refresh token")
    try:
        payload = jwt.decode(token, get_jwt_secret(), algorithms=[JWT_ALGORITHM])
        if payload.get("type") != "refresh":
            raise HTTPException(status_code=401, detail="Token inválido")
        user_id = payload["sub"]
        async with AsyncSessionLocal() as db:
            result = await db.execute(select(User).where(User.id == user_id))
            user = result.scalar_one_or_none()
        if not user:
            raise HTTPException(status_code=401, detail="Usuario no encontrado")
        access_token = create_access_token(str(user.id), user.email)
        is_secure = os.environ.get("APP_URL", "http://").startswith("https")
        response.set_cookie("access_token", access_token, httponly=True, secure=is_secure, samesite="lax", max_age=28800, path="/")
        return {"ok": True}
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Refresh token expirado")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Refresh token inválido")


# ---- Settings ----

@api_router.get("/settings")
async def get_settings(request: Request, db: AsyncSession = Depends(get_db)):
    await get_current_user(request)
    result = await db.execute(select(GymSettings).limit(1))
    settings = result.scalar_one_or_none()
    if not settings:
        return {"latitude": None, "longitude": None, "radius_meters": 100, "timezone": "Europe/Madrid"}
    return serialize_settings(settings)

@api_router.put("/settings")
async def update_settings(data: GymSettingsRequest, request: Request, db: AsyncSession = Depends(get_db)):
    await require_admin(request)
    result = await db.execute(select(GymSettings).limit(1))
    settings = result.scalar_one_or_none()
    if settings:
        await db.execute(
            update(GymSettings).where(GymSettings.id == settings.id)
            .values(latitude=data.latitude, longitude=data.longitude, radius_meters=data.radius_meters)
        )
    else:
        db.add(GymSettings(latitude=data.latitude, longitude=data.longitude, radius_meters=data.radius_meters))
    await db.commit()
    return {"latitude": data.latitude, "longitude": data.longitude, "radius_meters": data.radius_meters, "timezone": "Europe/Madrid"}


# ---- Admin: Usuarios ----

@api_router.get("/admin/users")
async def get_users(request: Request, db: AsyncSession = Depends(get_db)):
    await require_admin(request)
    result = await db.execute(select(User))
    users = result.scalars().all()
    return [serialize_user(u) for u in users]

@api_router.post("/admin/users")
async def create_user(data: CreateUserRequest, request: Request, db: AsyncSession = Depends(get_db)):
    await require_admin(request)
    email = data.email.lower().strip()
    result = await db.execute(select(User).where(User.email == email))
    if result.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Ya existe un usuario con este email")
    now = datetime.now(timezone.utc)
    new_user = User(
        email=email,
        password_hash=hash_password(data.password),
        full_name=data.full_name,
        role=data.role if data.role in ["admin", "employee"] else "employee",
        active=True,
        created_at=now
    )
    db.add(new_user)
    await db.commit()
    await db.refresh(new_user)
    return serialize_user(new_user)

@api_router.put("/admin/users/{user_id}")
async def update_user(user_id: str, data: UpdateUserRequest, request: Request, db: AsyncSession = Depends(get_db)):
    await require_admin(request)
    update_data = {k: v for k, v in data.model_dump().items() if v is not None}
    if not update_data:
        raise HTTPException(status_code=400, detail="Sin datos para actualizar")
    if "email" in update_data:
        update_data["email"] = update_data["email"].lower().strip()
    await db.execute(update(User).where(User.id == user_id).values(**update_data))
    await db.commit()
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    return serialize_user(user)

@api_router.patch("/admin/users/{user_id}/toggle-active")
async def toggle_active(user_id: str, request: Request, db: AsyncSession = Depends(get_db)):
    await require_admin(request)
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    new_active = not user.active
    await db.execute(update(User).where(User.id == user_id).values(active=new_active))
    await db.commit()
    return {"active": new_active}

@api_router.post("/admin/users/{user_id}/reset-password")
async def reset_user_password(user_id: str, data: ResetPasswordRequest, request: Request, db: AsyncSession = Depends(get_db)):
    await require_admin(request)
    await db.execute(update(User).where(User.id == user_id).values(password_hash=hash_password(data.new_password)))
    await db.commit()
    return {"ok": True}


# ---- Empleado: Fichajes ----

@api_router.get("/punches")
async def get_punches(request: Request, year: Optional[int] = None, month: Optional[int] = None, db: AsyncSession = Depends(get_db)):
    user = await get_current_user(request)
    query = select(Punch).where(Punch.user_id == user["id"])
    if year and month:
        first_day = date_type(year, month, 1)
        last_day = date_type(year, month, monthrange(year, month)[1])
        query = query.where(Punch.work_date.between(first_day, last_day))
    query = query.order_by(Punch.work_date.desc())
    result = await db.execute(query)
    punches = result.scalars().all()
    return [serialize_punch(p) for p in punches]

@api_router.post("/punches/checkin")
async def checkin(data: CheckInRequest, request: Request, db: AsyncSession = Depends(get_db)):
    user = await get_current_user(request)

    # Geofencing
    result = await db.execute(select(GymSettings).limit(1))
    settings = result.scalar_one_or_none()
    if (settings and settings.latitude and settings.longitude
            and data.latitude is not None and data.longitude is not None):
        dist = haversine_distance(settings.latitude, settings.longitude, data.latitude, data.longitude)
        if dist > settings.radius_meters:
            raise HTTPException(status_code=400,
                detail=f"Fuera del radio del gimnasio ({dist:.0f}m, máximo {settings.radius_meters}m)")

    madrid_tz = pytz.timezone('Europe/Madrid')
    today = datetime.now(madrid_tz).date()

    result = await db.execute(select(Punch).where(and_(Punch.user_id == user["id"], Punch.work_date == today)))
    punches_today = result.scalars().all()

    open_punches = [p for p in punches_today if p.check_out_at is None]
    closed_pairs = sum(1 for p in punches_today if p.check_out_at is not None)

    if open_punches:
        raise HTTPException(status_code=400, detail="Ya tienes un fichaje abierto. Cierra la sesión actual primero")
    if closed_pairs >= 3:
        raise HTTPException(status_code=400, detail="Has alcanzado el máximo de 3 pares de fichaje por día")

    now = datetime.now(timezone.utc)
    punch = Punch(
        user_id=user["id"],
        work_date=today,
        check_in_at=now,
        check_in_lat=data.latitude,
        check_in_lng=data.longitude,
        check_in_note=data.note,
        status="open",
        edited_by_admin=False,
        created_at=now,
        updated_at=now
    )
    db.add(punch)
    await db.commit()
    await db.refresh(punch)
    return serialize_punch(punch)

@api_router.post("/punches/checkout/{punch_id}")
async def checkout(punch_id: str, data: CheckOutRequest, request: Request, db: AsyncSession = Depends(get_db)):
    user = await get_current_user(request)

    result = await db.execute(select(Punch).where(and_(Punch.id == punch_id, Punch.user_id == user["id"])))
    punch = result.scalar_one_or_none()
    if not punch:
        raise HTTPException(status_code=404, detail="Fichaje no encontrado")
    if punch.check_out_at:
        raise HTTPException(status_code=400, detail="Este fichaje ya está cerrado")

    result = await db.execute(select(GymSettings).limit(1))
    settings = result.scalar_one_or_none()
    if (settings and settings.latitude and settings.longitude
            and data.latitude is not None and data.longitude is not None):
        dist = haversine_distance(settings.latitude, settings.longitude, data.latitude, data.longitude)
        if dist > settings.radius_meters:
            raise HTTPException(status_code=400,
                detail=f"Fuera del radio del gimnasio ({dist:.0f}m, máximo {settings.radius_meters}m)")

    now = datetime.now(timezone.utc)
    await db.execute(
        update(Punch).where(Punch.id == punch_id)
        .values(check_out_at=now, check_out_lat=data.latitude, check_out_lng=data.longitude,
                check_out_note=data.note, status="closed_manual", updated_at=now)
    )
    await db.commit()
    result = await db.execute(select(Punch).where(Punch.id == punch_id))
    punch = result.scalar_one_or_none()
    return serialize_punch(punch)


# ---- Admin: Fichajes ----

@api_router.get("/admin/punches")
async def admin_get_punches(request: Request, user_id: Optional[str] = None, year: Optional[int] = None, month: Optional[int] = None, db: AsyncSession = Depends(get_db)):
    await require_admin(request)
    query = select(Punch)
    if user_id:
        query = query.where(Punch.user_id == user_id)
    if year and month:
        first_day = date_type(year, month, 1)
        last_day = date_type(year, month, monthrange(year, month)[1])
        query = query.where(Punch.work_date.between(first_day, last_day))
    query = query.order_by(Punch.work_date.desc())
    result = await db.execute(query)
    punches = result.scalars().all()
    return [serialize_punch(p) for p in punches]

@api_router.post("/admin/punches")
async def admin_create_punch(data: CreatePunchRequest, request: Request, db: AsyncSession = Depends(get_db)):
    admin = await require_admin(request)
    now = datetime.now(timezone.utc)

    def parse_dt(s):
        if not s: return None
        return datetime.fromisoformat(s.replace("Z", "+00:00"))

    punch = Punch(
        user_id=data.user_id,
        work_date=date_type.fromisoformat(data.work_date),
        check_in_at=parse_dt(data.check_in_at),
        check_in_note=data.check_in_note or "Creado por administrador",
        check_out_at=parse_dt(data.check_out_at),
        check_out_note=data.check_out_note,
        status="edited_admin",
        edited_by_admin=True,
        edited_by=admin["id"],
        edited_at=now,
        created_at=now,
        updated_at=now
    )
    db.add(punch)
    await db.commit()
    await db.refresh(punch)
    return serialize_punch(punch)

@api_router.put("/admin/punches/{punch_id}")
async def admin_update_punch(punch_id: str, data: UpdatePunchRequest, request: Request, db: AsyncSession = Depends(get_db)):
    admin = await require_admin(request)
    result = await db.execute(select(Punch).where(Punch.id == punch_id))
    punch = result.scalar_one_or_none()
    if not punch:
        raise HTTPException(status_code=404, detail="Fichaje no encontrado")

    def parse_dt(s):
        if not s: return None
        return datetime.fromisoformat(s.replace("Z", "+00:00"))

    now = datetime.now(timezone.utc)
    vals = {"status": "edited_admin", "edited_by_admin": True, "edited_by": admin["id"], "edited_at": now, "updated_at": now}
    if data.check_in_at:  vals["check_in_at"]   = parse_dt(data.check_in_at)
    if data.check_out_at: vals["check_out_at"]  = parse_dt(data.check_out_at)
    if data.check_in_note  is not None: vals["check_in_note"]  = data.check_in_note
    if data.check_out_note is not None: vals["check_out_note"] = data.check_out_note

    await db.execute(update(Punch).where(Punch.id == punch_id).values(**vals))
    await db.commit()
    result = await db.execute(select(Punch).where(Punch.id == punch_id))
    return serialize_punch(result.scalar_one_or_none())

@api_router.delete("/admin/punches/{punch_id}")
async def admin_delete_punch(punch_id: str, request: Request, db: AsyncSession = Depends(get_db)):
    await require_admin(request)
    await db.execute(delete(Punch).where(Punch.id == punch_id))
    await db.commit()
    return {"ok": True}


app.include_router(api_router)
