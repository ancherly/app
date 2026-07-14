from dotenv import load_dotenv
load_dotenv()

from fastapi import FastAPI, APIRouter, HTTPException, Request, Response
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from bson import ObjectId
import os
import logging
import bcrypt
import jwt
from datetime import datetime, timezone, timedelta
from pathlib import Path
from pydantic import BaseModel
from typing import Optional
import math
import pytz
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from calendar import monthrange

ROOT_DIR = Path(__file__).parent

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

JWT_ALGORITHM = "HS256"
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)


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

def serialize_doc(doc: dict) -> dict:
    result = {}
    for k, v in doc.items():
        if k == "_id":
            result["id"] = str(v)
        elif isinstance(v, ObjectId):
            result[k] = str(v)
        elif isinstance(v, datetime):
            result[k] = v.isoformat()
        else:
            result[k] = v
    return result

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
        user = await db.users.find_one({"_id": ObjectId(payload["sub"])})
        if not user:
            raise HTTPException(status_code=401, detail="Usuario no encontrado")
        user["_id"] = str(user["_id"])
        user.pop("password_hash", None)
        user["id"] = user["_id"]
        return user
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expirado")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Token inválido")

async def require_admin(request: Request) -> dict:
    user = await get_current_user(request)
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Acceso denegado. Se requiere rol de administrador")
    return user


# ---- Models ----

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


# ---- Scheduler ----

async def auto_close_punches():
    madrid_tz = pytz.timezone('Europe/Madrid')
    now_madrid = datetime.now(madrid_tz)
    today_str = now_madrid.strftime("%Y-%m-%d")
    close_naive = datetime.combine(now_madrid.date(), datetime.strptime("23:59:59", "%H:%M:%S").time())
    close_time = madrid_tz.localize(close_naive)
    result = await db.punches.update_many(
        {"check_out_at": None, "work_date": {"$lte": today_str}},
        {"$set": {
            "check_out_at": close_time,
            "check_out_note": "Cierre automático por el sistema",
            "status": "closed_auto",
            "updated_at": datetime.now(timezone.utc)
        }}
    )
    logger.info(f"Auto-close: {result.modified_count} fichajes cerrados")


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
    await db.users.create_index("email", unique=True)
    await db.punches.create_index([("user_id", 1), ("work_date", -1)])

    # Seed admin
    admin_email = os.environ.get("ADMIN_EMAIL", "admin@gimnasio.es")
    admin_password = os.environ.get("ADMIN_PASSWORD", "Admin1234!")
    existing = await db.users.find_one({"email": admin_email})
    if existing is None:
        await db.users.insert_one({
            "email": admin_email,
            "password_hash": hash_password(admin_password),
            "full_name": "Administrador",
            "role": "admin",
            "active": True,
            "created_at": datetime.now(timezone.utc)
        })
        logger.info(f"Admin creado: {admin_email}")
    elif not verify_password(admin_password, existing["password_hash"]):
        await db.users.update_one({"email": admin_email}, {"$set": {"password_hash": hash_password(admin_password)}})

    # Seed gym settings
    if not await db.gym_settings.find_one({}):
        await db.gym_settings.insert_one({
            "latitude": 40.416775,
            "longitude": -3.703790,
            "radius_meters": 100,
            "timezone": "Europe/Madrid"
        })

    # Seed test employee
    test_email = "empleado@gimnasio.es"
    if not await db.users.find_one({"email": test_email}):
        await db.users.insert_one({
            "email": test_email,
            "password_hash": hash_password("Empleado123!"),
            "full_name": "María García",
            "role": "employee",
            "active": True,
            "created_at": datetime.now(timezone.utc)
        })
        logger.info("Empleado de prueba creado")

    # Start scheduler
    scheduler = AsyncIOScheduler()
    scheduler.add_job(auto_close_punches, CronTrigger(hour=23, minute=59, timezone=pytz.timezone('Europe/Madrid')))
    scheduler.start()
    logger.info("Scheduler iniciado")


@app.on_event("shutdown")
async def shutdown():
    client.close()


# ---- Auth ----

@api_router.get("/")
async def root():
    return {"message": "Gym Fichaje API v1.0"}

@api_router.post("/auth/login")
async def login(request_data: LoginRequest, response: Response):
    email = request_data.email.lower().strip()
    user = await db.users.find_one({"email": email})
    if not user or not verify_password(request_data.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Email o contraseña incorrectos")
    if not user.get("active", True):
        raise HTTPException(status_code=403, detail="Cuenta desactivada. Contacta con el administrador")

    user_id = str(user["_id"])
    access_token = create_access_token(user_id, email)
    refresh_token = create_refresh_token(user_id)

    is_secure = os.environ.get("APP_URL", "http://").startswith("https")
    response.set_cookie("access_token", access_token, httponly=True, secure=is_secure, samesite="lax", max_age=28800, path="/")
    response.set_cookie("refresh_token", refresh_token, httponly=True, secure=is_secure, samesite="lax", max_age=604800, path="/")

    return {"id": user_id, "email": email, "full_name": user.get("full_name", ""), "role": user.get("role", "employee"), "active": user.get("active", True)}

@api_router.post("/auth/logout")
async def logout(response: Response):
    response.delete_cookie("access_token", path="/")
    response.delete_cookie("refresh_token", path="/")
    return {"ok": True}

@api_router.get("/auth/me")
async def me(request: Request):
    return await get_current_user(request)

@api_router.post("/auth/refresh")
async def refresh(request: Request, response: Response):
    token = request.cookies.get("refresh_token")
    if not token:
        raise HTTPException(status_code=401, detail="No hay refresh token")
    try:
        payload = jwt.decode(token, get_jwt_secret(), algorithms=[JWT_ALGORITHM])
        if payload.get("type") != "refresh":
            raise HTTPException(status_code=401, detail="Token inválido")
        user = await db.users.find_one({"_id": ObjectId(payload["sub"])})
        if not user:
            raise HTTPException(status_code=401, detail="Usuario no encontrado")
        user_id = str(user["_id"])
        access_token = create_access_token(user_id, user["email"])
        is_secure = os.environ.get("APP_URL", "http://").startswith("https")
        response.set_cookie("access_token", access_token, httponly=True, secure=is_secure, samesite="lax", max_age=28800, path="/")
        return {"ok": True}
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Refresh token expirado")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Refresh token inválido")


# ---- Settings ----

@api_router.get("/settings")
async def get_settings(request: Request):
    await get_current_user(request)
    settings = await db.gym_settings.find_one({}, {"_id": 0})
    return settings or {"latitude": None, "longitude": None, "radius_meters": 100, "timezone": "Europe/Madrid"}

@api_router.put("/settings")
async def update_settings(data: GymSettingsRequest, request: Request):
    await require_admin(request)
    doc = {"latitude": data.latitude, "longitude": data.longitude, "radius_meters": data.radius_meters, "timezone": "Europe/Madrid"}
    await db.gym_settings.update_one({}, {"$set": doc}, upsert=True)
    return doc


# ---- Admin Users ----

@api_router.get("/admin/users")
async def get_users(request: Request):
    await require_admin(request)
    users = await db.users.find({}, {"password_hash": 0}).to_list(1000)
    return [serialize_doc(u) for u in users]

@api_router.post("/admin/users")
async def create_user(data: CreateUserRequest, request: Request):
    await require_admin(request)
    email = data.email.lower().strip()
    if await db.users.find_one({"email": email}):
        raise HTTPException(status_code=400, detail="Ya existe un usuario con este email")
    doc = {
        "email": email,
        "password_hash": hash_password(data.password),
        "full_name": data.full_name,
        "role": data.role if data.role in ["admin", "employee"] else "employee",
        "active": True,
        "created_at": datetime.now(timezone.utc)
    }
    result = await db.users.insert_one(doc)
    doc["_id"] = result.inserted_id
    doc.pop("password_hash")
    return serialize_doc(doc)

@api_router.put("/admin/users/{user_id}")
async def update_user(user_id: str, data: UpdateUserRequest, request: Request):
    await require_admin(request)
    update = {k: v for k, v in data.model_dump().items() if v is not None}
    if not update:
        raise HTTPException(status_code=400, detail="Sin datos para actualizar")
    if "email" in update:
        update["email"] = update["email"].lower().strip()
    await db.users.update_one({"_id": ObjectId(user_id)}, {"$set": update})
    user = await db.users.find_one({"_id": ObjectId(user_id)}, {"password_hash": 0})
    return serialize_doc(user)

@api_router.patch("/admin/users/{user_id}/toggle-active")
async def toggle_active(user_id: str, request: Request):
    await require_admin(request)
    user = await db.users.find_one({"_id": ObjectId(user_id)})
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    new_active = not user.get("active", True)
    await db.users.update_one({"_id": ObjectId(user_id)}, {"$set": {"active": new_active}})
    return {"active": new_active}

@api_router.post("/admin/users/{user_id}/reset-password")
async def reset_user_password(user_id: str, data: ResetPasswordRequest, request: Request):
    await require_admin(request)
    await db.users.update_one({"_id": ObjectId(user_id)}, {"$set": {"password_hash": hash_password(data.new_password)}})
    return {"ok": True}


# ---- Employee Punches ----

@api_router.get("/punches")
async def get_punches(request: Request, year: Optional[int] = None, month: Optional[int] = None):
    user = await get_current_user(request)
    query = {"user_id": user["id"]}
    if year and month:
        first_day = f"{year}-{month:02d}-01"
        last_day = f"{year}-{month:02d}-{monthrange(year, month)[1]:02d}"
        query["work_date"] = {"$gte": first_day, "$lte": last_day}
    punches = await db.punches.find(query).sort("work_date", -1).to_list(1000)
    return [serialize_doc(p) for p in punches]

@api_router.post("/punches/checkin")
async def checkin(data: CheckInRequest, request: Request):
    user = await get_current_user(request)
    settings = await db.gym_settings.find_one({}, {"_id": 0})

    # Geofence check
    if (settings and settings.get("latitude") and settings.get("longitude")
            and data.latitude is not None and data.longitude is not None):
        dist = haversine_distance(settings["latitude"], settings["longitude"], data.latitude, data.longitude)
        if dist > settings["radius_meters"]:
            raise HTTPException(
                status_code=400,
                detail=f"Fuera del radio del gimnasio ({dist:.0f}m, máximo {settings['radius_meters']}m)"
            )

    madrid_tz = pytz.timezone('Europe/Madrid')
    today_str = datetime.now(madrid_tz).strftime("%Y-%m-%d")

    existing = await db.punches.find({"user_id": user["id"], "work_date": today_str}).to_list(100)
    open_punches = [p for p in existing if p.get("check_out_at") is None]
    closed_pairs = sum(1 for p in existing if p.get("check_out_at") is not None)

    if open_punches:
        raise HTTPException(status_code=400, detail="Ya tienes un fichaje abierto. Cierra la sesión actual primero")
    if closed_pairs >= 3:
        raise HTTPException(status_code=400, detail="Has alcanzado el máximo de 3 pares de fichaje por día")

    now = datetime.now(timezone.utc)
    doc = {
        "user_id": user["id"],
        "work_date": today_str,
        "check_in_at": now,
        "check_in_lat": data.latitude,
        "check_in_lng": data.longitude,
        "check_in_note": data.note,
        "check_out_at": None,
        "check_out_lat": None,
        "check_out_lng": None,
        "check_out_note": None,
        "status": "open",
        "edited_by_admin": False,
        "edited_by": None,
        "edited_at": None,
        "created_at": now,
        "updated_at": now
    }
    result = await db.punches.insert_one(doc)
    doc["_id"] = result.inserted_id
    return serialize_doc(doc)

@api_router.post("/punches/checkout/{punch_id}")
async def checkout(punch_id: str, data: CheckOutRequest, request: Request):
    user = await get_current_user(request)
    punch = await db.punches.find_one({"_id": ObjectId(punch_id), "user_id": user["id"]})
    if not punch:
        raise HTTPException(status_code=404, detail="Fichaje no encontrado")
    if punch.get("check_out_at"):
        raise HTTPException(status_code=400, detail="Este fichaje ya está cerrado")

    settings = await db.gym_settings.find_one({}, {"_id": 0})
    if (settings and settings.get("latitude") and settings.get("longitude")
            and data.latitude is not None and data.longitude is not None):
        dist = haversine_distance(settings["latitude"], settings["longitude"], data.latitude, data.longitude)
        if dist > settings["radius_meters"]:
            raise HTTPException(
                status_code=400,
                detail=f"Fuera del radio del gimnasio ({dist:.0f}m, máximo {settings['radius_meters']}m)"
            )

    now = datetime.now(timezone.utc)
    await db.punches.update_one(
        {"_id": ObjectId(punch_id)},
        {"$set": {
            "check_out_at": now,
            "check_out_lat": data.latitude,
            "check_out_lng": data.longitude,
            "check_out_note": data.note,
            "status": "closed_manual",
            "updated_at": now
        }}
    )
    punch = await db.punches.find_one({"_id": ObjectId(punch_id)})
    return serialize_doc(punch)


# ---- Admin Punches ----

@api_router.get("/admin/punches")
async def admin_get_punches(request: Request, user_id: Optional[str] = None, year: Optional[int] = None, month: Optional[int] = None):
    await require_admin(request)
    query = {}
    if user_id:
        query["user_id"] = user_id
    if year and month:
        first_day = f"{year}-{month:02d}-01"
        last_day = f"{year}-{month:02d}-{monthrange(year, month)[1]:02d}"
        query["work_date"] = {"$gte": first_day, "$lte": last_day}
    punches = await db.punches.find(query).sort("work_date", -1).to_list(1000)
    return [serialize_doc(p) for p in punches]

@api_router.post("/admin/punches")
async def admin_create_punch(data: CreatePunchRequest, request: Request):
    admin = await require_admin(request)
    now = datetime.now(timezone.utc)

    def parse_dt(s):
        if not s:
            return None
        return datetime.fromisoformat(s.replace("Z", "+00:00"))

    check_in_at = parse_dt(data.check_in_at)
    check_out_at = parse_dt(data.check_out_at)

    doc = {
        "user_id": data.user_id,
        "work_date": data.work_date,
        "check_in_at": check_in_at,
        "check_in_lat": None,
        "check_in_lng": None,
        "check_in_note": data.check_in_note or "Creado por administrador",
        "check_out_at": check_out_at,
        "check_out_lat": None,
        "check_out_lng": None,
        "check_out_note": data.check_out_note,
        "status": "edited_admin",
        "edited_by_admin": True,
        "edited_by": admin["id"],
        "edited_at": now,
        "created_at": now,
        "updated_at": now
    }
    result = await db.punches.insert_one(doc)
    doc["_id"] = result.inserted_id
    return serialize_doc(doc)

@api_router.put("/admin/punches/{punch_id}")
async def admin_update_punch(punch_id: str, data: UpdatePunchRequest, request: Request):
    admin = await require_admin(request)
    punch = await db.punches.find_one({"_id": ObjectId(punch_id)})
    if not punch:
        raise HTTPException(status_code=404, detail="Fichaje no encontrado")

    def parse_dt(s):
        if not s:
            return None
        return datetime.fromisoformat(s.replace("Z", "+00:00"))

    now = datetime.now(timezone.utc)
    update = {
        "status": "edited_admin",
        "edited_by_admin": True,
        "edited_by": admin["id"],
        "edited_at": now,
        "updated_at": now
    }
    if data.check_in_at:
        update["check_in_at"] = parse_dt(data.check_in_at)
    if data.check_out_at:
        update["check_out_at"] = parse_dt(data.check_out_at)
    if data.check_in_note is not None:
        update["check_in_note"] = data.check_in_note
    if data.check_out_note is not None:
        update["check_out_note"] = data.check_out_note

    await db.punches.update_one({"_id": ObjectId(punch_id)}, {"$set": update})
    punch = await db.punches.find_one({"_id": ObjectId(punch_id)})
    return serialize_doc(punch)

@api_router.delete("/admin/punches/{punch_id}")
async def admin_delete_punch(punch_id: str, request: Request):
    await require_admin(request)
    await db.punches.delete_one({"_id": ObjectId(punch_id)})
    return {"ok": True}


app.include_router(api_router)
