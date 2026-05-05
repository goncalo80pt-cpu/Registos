from fastapi import FastAPI, APIRouter, HTTPException, Request, Response, Header, Query
from fastapi.responses import StreamingResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import io
import csv
import logging
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional, Any
import uuid
import requests
from datetime import datetime, timezone, timedelta


ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

ADMIN_EMAIL = os.environ.get('ADMIN_EMAIL', 'admin@instituicao.pt')
ADMIN_PASSWORD = os.environ.get('ADMIN_PASSWORD', 'admin123')

# Administradores fixos (Nome + Palavra-passe + permissões)
# scopes: "all" para super-admin, ou lista de locais que pode ver/gerir
ADMIN_USERS = [
    {"name": "Erpi Sede", "password": "sede123", "scopes": ["erpi_sede", "secretaria_sede"]},
    {"name": "Erpi Parais", "password": "paraiso123", "scopes": ["erpi_parais", "secretaria_paraiso"]},
    {"name": "Lar Residencial", "password": "larresidencial123", "scopes": ["lar_residencial"]},
    {"name": "Admin", "password": "admin2026", "scopes": "all"},
]

# Locais de visita (substitui o antigo 'instituicao' creche/lar)
VALID_LOCATIONS = {
    "erpi_sede": "Erpi Sede",
    "erpi_parais": "Erpi Parais",
    "lar_residencial": "Lar Residencial",
    "secretaria_sede": "Secretaria Sede",
    "secretaria_paraiso": "Secretaria Paraíso",
}

app = FastAPI()
api_router = APIRouter(prefix="/api")

# ----------------- Models -----------------
class User(BaseModel):
    user_id: str
    email: str
    name: str
    picture: Optional[str] = None
    is_admin: bool = False
    auth_provider: str = "google"  # "google" or "admin"
    scopes: Optional[Any] = None  # "all" or list[str] of allowed location keys
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class AdminLogin(BaseModel):
    name: str
    password: str


class VisitCreate(BaseModel):
    instituicao: str  # one of VALID_LOCATIONS keys
    visitante_nome: str
    documento: Optional[str] = None
    telefone: Optional[str] = None
    pessoa_visitada: str
    motivo: str
    observacoes: Optional[str] = None
    utente_id: Optional[str] = None


class BookingCreate(BaseModel):
    visitante_nome: str
    telefone: Optional[str] = None
    pessoa_visitada: str
    local: str  # one of VALID_LOCATIONS keys
    data_hora: datetime
    observacoes: Optional[str] = None
    utente_id: Optional[str] = None


class Booking(BaseModel):
    booking_id: str
    visitante_nome: str
    telefone: Optional[str] = None
    pessoa_visitada: str
    local: str
    data_hora: datetime
    observacoes: Optional[str] = None
    status: str = "marcada"  # marcada | concluida | cancelada
    created_at: datetime


class UtenteCreate(BaseModel):
    nome: str
    local: str  # one of VALID_LOCATIONS keys


class Utente(BaseModel):
    utente_id: str
    nome: str
    local: str
    created_at: datetime


class SaidaCreate(BaseModel):
    utente_id: str
    saida_prevista: datetime
    regresso_previsto: datetime
    motivo: str  # "Consulta médica" | "Visita familiar" | "Passeio" | etc
    responsavel_nome: Optional[str] = None
    responsavel_telefone: Optional[str] = None
    observacoes: Optional[str] = None


class SaidaProgramada(BaseModel):
    saida_id: str
    utente_id: str
    utente_nome: str
    local: str
    saida_prevista: datetime
    regresso_previsto: datetime
    motivo: str
    responsavel_nome: Optional[str] = None
    responsavel_telefone: Optional[str] = None
    observacoes: Optional[str] = None
    status: str = "agendada"  # agendada | em_curso | concluida | cancelada
    saida_real: Optional[datetime] = None
    regresso_real: Optional[datetime] = None
    created_at: datetime


class Visit(BaseModel):
    visit_id: str
    instituicao: str
    visitante_nome: str
    documento: Optional[str] = None
    telefone: Optional[str] = None
    pessoa_visitada: str
    motivo: str
    observacoes: Optional[str] = None
    entrada: datetime
    saida: Optional[datetime] = None


# ----------------- Auth helpers -----------------
async def get_current_user(request: Request, authorization: Optional[str] = Header(None)) -> User:
    token = request.cookies.get("session_token")
    if not token and authorization and authorization.lower().startswith("bearer "):
        token = authorization.split(" ", 1)[1].strip()
    if not token:
        raise HTTPException(status_code=401, detail="Não autenticado")

    session = await db.user_sessions.find_one({"session_token": token}, {"_id": 0})
    if not session:
        raise HTTPException(status_code=401, detail="Sessão inválida")

    expires_at = session.get("expires_at")
    if isinstance(expires_at, str):
        expires_at = datetime.fromisoformat(expires_at)
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    if expires_at < datetime.now(timezone.utc):
        raise HTTPException(status_code=401, detail="Sessão expirada")

    user_doc = await db.users.find_one({"user_id": session["user_id"]}, {"_id": 0})
    if not user_doc:
        raise HTTPException(status_code=401, detail="Utilizador não encontrado")
    return User(**user_doc)


async def require_admin(request: Request, authorization: Optional[str] = Header(None)) -> User:
    user = await get_current_user(request, authorization)
    if not user.is_admin:
        raise HTTPException(status_code=403, detail="Acesso apenas para administradores")
    return user


def _user_scopes(user: User) -> Any:
    """Return list of allowed location keys, or 'all' for super-admin."""
    s = getattr(user, "scopes", None)
    return s if s else "all"


def _check_scope(user: User, local: str):
    """Raise 403 if user is not allowed to operate on the given location."""
    s = _user_scopes(user)
    if s == "all":
        return
    if local not in s:
        raise HTTPException(status_code=403, detail="Sem permissão para este local")


def _scope_query(user: User, field: str = "local") -> dict:
    """Mongo filter snippet that restricts the given field to the user's scope."""
    s = _user_scopes(user)
    if s == "all":
        return {}
    return {field: {"$in": s}}


def _set_session_cookie(response: Response, token: str):
    response.set_cookie(
        key="session_token",
        value=token,
        max_age=7 * 24 * 60 * 60,
        path="/",
        httponly=True,
        secure=True,
        samesite="none",
    )


# ----------------- Auth endpoints -----------------
@api_router.post("/auth/session")
async def auth_session(response: Response, x_session_id: Optional[str] = Header(None, alias="X-Session-ID")):
    if not x_session_id:
        raise HTTPException(status_code=400, detail="X-Session-ID em falta")

    try:
        r = requests.get(
            "https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data",
            headers={"X-Session-ID": x_session_id},
            timeout=10,
        )
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Falha ao contactar serviço de auth: {e}")

    if r.status_code != 200:
        raise HTTPException(status_code=401, detail="Sessão Google inválida")
    data = r.json()

    email = data["email"]
    existing = await db.users.find_one({"email": email}, {"_id": 0})
    if existing:
        user_id = existing["user_id"]
        await db.users.update_one(
            {"user_id": user_id},
            {"$set": {"name": data.get("name", existing["name"]), "picture": data.get("picture")}},
        )
    else:
        user_id = f"user_{uuid.uuid4().hex[:12]}"
        await db.users.insert_one({
            "user_id": user_id,
            "email": email,
            "name": data.get("name", email),
            "picture": data.get("picture"),
            "is_admin": email.lower() == ADMIN_EMAIL.lower(),
            "auth_provider": "google",
            "created_at": datetime.now(timezone.utc).isoformat(),
        })

    session_token = data.get("session_token") or f"sess_{uuid.uuid4().hex}"
    expires_at = datetime.now(timezone.utc) + timedelta(days=7)
    await db.user_sessions.insert_one({
        "user_id": user_id,
        "session_token": session_token,
        "expires_at": expires_at.isoformat(),
        "created_at": datetime.now(timezone.utc).isoformat(),
    })

    _set_session_cookie(response, session_token)
    user_doc = await db.users.find_one({"user_id": user_id}, {"_id": 0})
    return {"user": user_doc, "session_token": session_token}


@api_router.post("/auth/admin-login")
async def admin_login(payload: AdminLogin, response: Response):
    name_in = (payload.name or "").strip()
    password_in = (payload.password or "").strip()
    matched = next(
        (
            a for a in ADMIN_USERS
            if a["name"].lower() == name_in.lower()
            and (a["password"] == password_in or a["password"].lower() == password_in.lower())
        ),
        None,
    )
    if not matched:
        raise HTTPException(status_code=401, detail="Nome ou palavra-passe incorrectos")

    fake_email = matched["name"].lower().replace(" ", "_") + "@admin.local"
    scopes = matched.get("scopes", "all")
    user = await db.users.find_one({"email": fake_email}, {"_id": 0})
    if not user:
        user_id = f"user_{uuid.uuid4().hex[:12]}"
        user = {
            "user_id": user_id,
            "email": fake_email,
            "name": matched["name"],
            "picture": None,
            "is_admin": True,
            "auth_provider": "admin",
            "scopes": scopes,
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
        await db.users.insert_one(user.copy())
    else:
        user_id = user["user_id"]
        update = {"is_admin": True, "scopes": scopes}
        await db.users.update_one({"user_id": user_id}, {"$set": update})
        user.update(update)

    session_token = f"admin_{uuid.uuid4().hex}"
    expires_at = datetime.now(timezone.utc) + timedelta(days=7)
    await db.user_sessions.insert_one({
        "user_id": user_id,
        "session_token": session_token,
        "expires_at": expires_at.isoformat(),
        "created_at": datetime.now(timezone.utc).isoformat(),
    })
    _set_session_cookie(response, session_token)
    user.pop("_id", None)
    return {"user": user, "session_token": session_token}


@api_router.get("/auth/me", response_model=User)
async def auth_me(request: Request, authorization: Optional[str] = Header(None)):
    return await get_current_user(request, authorization)


@api_router.post("/auth/logout")
async def auth_logout(request: Request, response: Response):
    token = request.cookies.get("session_token")
    if token:
        await db.user_sessions.delete_one({"session_token": token})
    response.delete_cookie("session_token", path="/")
    return {"ok": True}


# ----------------- Visit endpoints -----------------
def _visit_from_doc(doc: dict) -> Visit:
    for k in ("entrada", "saida"):
        v = doc.get(k)
        if isinstance(v, str):
            doc[k] = datetime.fromisoformat(v)
    return Visit(**doc)


@api_router.post("/visits/checkin", response_model=Visit)
async def checkin(payload: VisitCreate):
    if payload.instituicao not in VALID_LOCATIONS:
        raise HTTPException(status_code=400, detail=f"Local inválido. Escolha um de: {', '.join(VALID_LOCATIONS.keys())}")
    visit = Visit(
        visit_id=f"v_{uuid.uuid4().hex[:12]}",
        instituicao=payload.instituicao,
        visitante_nome=payload.visitante_nome.strip(),
        documento=(payload.documento or "").strip() or None,
        telefone=(payload.telefone or "").strip() or None,
        pessoa_visitada=payload.pessoa_visitada.strip(),
        motivo=payload.motivo.strip(),
        observacoes=(payload.observacoes or "").strip() or None,
        entrada=datetime.now(timezone.utc),
        saida=None,
    )
    doc = visit.model_dump()
    doc["entrada"] = doc["entrada"].isoformat()
    doc["saida"] = None
    if payload.utente_id:
        doc["utente_id"] = payload.utente_id
    # expires_at is a BSON Date used by MongoDB's TTL index to auto-delete after 1 year
    doc["expires_at"] = visit.entrada + timedelta(days=365)
    await db.visits.insert_one(doc)
    return visit


@api_router.post("/visits/{visit_id}/checkout", response_model=Visit)
async def checkout(visit_id: str):
    doc = await db.visits.find_one({"visit_id": visit_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Registo não encontrado")
    if doc.get("saida"):
        raise HTTPException(status_code=400, detail="Este visitante já fez saída")
    saida_dt = datetime.now(timezone.utc)
    await db.visits.update_one({"visit_id": visit_id}, {"$set": {"saida": saida_dt.isoformat()}})
    doc["saida"] = saida_dt.isoformat()
    return _visit_from_doc(doc)


@api_router.get("/visits/active", response_model=List[Visit])
async def active_visits(instituicao: Optional[str] = None):
    query = {"saida": None}
    if instituicao in VALID_LOCATIONS:
        query["instituicao"] = instituicao
    docs = await db.visits.find(query, {"_id": 0}).sort("entrada", -1).to_list(500)
    return [_visit_from_doc(d) for d in docs]


@api_router.get("/visits/history", response_model=List[Visit])
async def history(
    request: Request,
    authorization: Optional[str] = Header(None),
    nome: Optional[str] = None,
    instituicao: Optional[str] = None,
    data_inicio: Optional[str] = Query(None, description="ISO date (YYYY-MM-DD)"),
    data_fim: Optional[str] = Query(None, description="ISO date (YYYY-MM-DD)"),
):
    await require_admin(request, authorization)
    query: dict = {}
    if nome:
        query["visitante_nome"] = {"$regex": nome, "$options": "i"}
    if instituicao in VALID_LOCATIONS:
        query["instituicao"] = instituicao
    if data_inicio or data_fim:
        rng = {}
        if data_inicio:
            rng["$gte"] = data_inicio
        if data_fim:
            rng["$lte"] = data_fim + "T23:59:59"
        query["entrada"] = rng
    docs = await db.visits.find(query, {"_id": 0}).sort("entrada", -1).to_list(length=None)
    return [_visit_from_doc(d) for d in docs]


@api_router.get("/visits/stats")
async def stats(request: Request, authorization: Optional[str] = Header(None)):
    user = await require_admin(request, authorization)
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    scope = _scope_query(user, "instituicao")

    def _q(extra=None):
        q = dict(scope)
        if extra:
            q.update(extra)
        return q

    total = await db.visits.count_documents(_q())
    dentro = await db.visits.count_documents(_q({"saida": None}))
    hoje = await db.visits.count_documents(_q({"entrada": {"$gte": today, "$lt": today + "T23:59:59"}}))
    creche_dentro = 0  # legacy field, kept for compat
    lar_dentro = await db.visits.count_documents(_q({"saida": None}))

    # Per-location counts (filtered by user's scope)
    allowed_locations = VALID_LOCATIONS.keys() if _user_scopes(user) == "all" else [k for k in VALID_LOCATIONS if k in _user_scopes(user)]
    por_local = {}
    for key in allowed_locations:
        label = VALID_LOCATIONS[key]
        c = await db.visits.count_documents({"saida": None, "instituicao": key})
        por_local[key] = {"label": label, "dentro": c}

    # average time (minutes) for completed visits
    pipeline = [
        {"$match": _q({"saida": {"$ne": None}})},
        {"$project": {"dur": {"$subtract": [{"$toDate": "$saida"}, {"$toDate": "$entrada"}]}}},
        {"$group": {"_id": None, "avg": {"$avg": "$dur"}}},
    ]
    agg = await db.visits.aggregate(pipeline).to_list(1)
    avg_minutes = 0
    if agg and agg[0].get("avg"):
        avg_minutes = round(agg[0]["avg"] / 60000, 1)

    # Last 7 days (filtered by scope)
    last7 = []
    now = datetime.now(timezone.utc)
    for i in range(6, -1, -1):
        d = (now - timedelta(days=i)).strftime("%Y-%m-%d")
        c = await db.visits.count_documents(_q({"entrada": {"$gte": d, "$lt": d + "T23:59:59"}}))
        last7.append({"dia": d, "total": c})

    return {
        "total": total,
        "dentro": dentro,
        "hoje": hoje,
        "creche_dentro": creche_dentro,
        "lar_dentro": lar_dentro,
        "tempo_medio_min": avg_minutes,
        "ultimos_7_dias": last7,
        "por_local": por_local,
    }


@api_router.get("/visits/export")
async def export_csv(request: Request, authorization: Optional[str] = Header(None)):
    user = await require_admin(request, authorization)
    # Export ALL records within scope - history is permanent
    docs = await db.visits.find(_scope_query(user, "instituicao"), {"_id": 0}).sort("entrada", -1).to_list(length=None)

    buf = io.StringIO()
    writer = csv.writer(buf, delimiter=";")
    writer.writerow([
        "ID", "Instituição", "Visitante", "Documento", "Telefone",
        "Pessoa Visitada", "Motivo", "Observações", "Entrada", "Saída",
    ])
    for d in docs:
        loc_key = d.get("instituicao") or ""
        loc_label = VALID_LOCATIONS.get(loc_key, loc_key)
        writer.writerow([
            d.get("visit_id", ""),
            loc_label,
            d.get("visitante_nome", ""),
            d.get("documento", "") or "",
            d.get("telefone", "") or "",
            d.get("pessoa_visitada", ""),
            d.get("motivo", ""),
            d.get("observacoes", "") or "",
            d.get("entrada", ""),
            d.get("saida", "") or "",
        ])
    buf.seek(0)
    return StreamingResponse(
        iter([buf.getvalue()]),
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": "attachment; filename=historico_visitas.csv"},
    )


@api_router.get("/")
async def root():
    return {"message": "Registo de Visitas API"}


# ----------------- Bookings (Marcar Visita) -----------------
def _booking_from_doc(doc: dict) -> Booking:
    for k in ("data_hora", "created_at"):
        v = doc.get(k)
        if isinstance(v, str):
            try:
                doc[k] = datetime.fromisoformat(v)
            except Exception:
                pass
    return Booking(**doc)


# ----------------- Visit hours rules -----------------
# Slots de 30 minutos. Segunda (0) e Sexta (4) começam às 14:00. Outros dias começam às 10:00.
# Última visita começa às 16:00 (termina 16:30).
SLOT_MINUTES = 30
LAST_SLOT_HOUR = 16
LAST_SLOT_MIN = 0
AFTERNOON_ONLY_WEEKDAYS = {0, 4}  # Monday, Friday
AFTERNOON_START_HOUR = 14
NORMAL_START_HOUR = 10


def slots_for_date(date_obj):
    """Return list of (hour, minute) slot starts available for a given calendar date."""
    weekday = date_obj.weekday()
    if weekday in AFTERNOON_ONLY_WEEKDAYS:
        start_h = AFTERNOON_START_HOUR
    else:
        start_h = NORMAL_START_HOUR
    slots = []
    h, m = start_h, 0
    while (h, m) <= (LAST_SLOT_HOUR, LAST_SLOT_MIN):
        slots.append((h, m))
        m += SLOT_MINUTES
        if m >= 60:
            h += 1
            m = 0
    return slots


def _validate_slot_or_raise(dh):
    """Raise HTTPException if dh is not a valid bookable slot."""
    if dh.minute not in (0, 30) or dh.second != 0 or dh.microsecond != 0:
        raise HTTPException(status_code=400, detail="A hora deve ser certa (00 ou 30 minutos).")
    valid_starts = slots_for_date(dh.date())
    if (dh.hour, dh.minute) not in valid_starts:
        weekday = dh.weekday()
        if weekday in AFTERNOON_ONLY_WEEKDAYS:
            raise HTTPException(status_code=400, detail="À segunda e sexta-feira só há visitas das 14:00 às 16:30.")
        raise HTTPException(status_code=400, detail="Horário fora do período de visitas (10:00 às 16:30).")


@api_router.post("/bookings", response_model=Booking)
async def create_booking(payload: BookingCreate):
    if payload.local not in VALID_LOCATIONS:
        raise HTTPException(status_code=400, detail=f"Local inválido. Escolha um de: {', '.join(VALID_LOCATIONS.keys())}")
    if not payload.visitante_nome.strip() or not payload.pessoa_visitada.strip():
        raise HTTPException(status_code=400, detail="Nome do visitante e do idoso são obrigatórios")

    dh = payload.data_hora
    if dh.tzinfo is None:
        dh = dh.replace(tzinfo=timezone.utc)
    if dh < datetime.now(timezone.utc) - timedelta(minutes=5):
        raise HTTPException(status_code=400, detail="A data e hora da visita devem ser no futuro")

    _validate_slot_or_raise(dh)

    # Slot uniqueness: only 1 visit per slot per local (active = marcada)
    existing = await db.bookings.find_one({
        "local": payload.local,
        "data_hora": dh.isoformat(),
        "status": "marcada",
    }, {"_id": 0})
    if existing:
        raise HTTPException(status_code=409, detail="Esse horário já está ocupado neste local. Escolha outro slot.")

    booking = Booking(
        booking_id=f"b_{uuid.uuid4().hex[:12]}",
        visitante_nome=payload.visitante_nome.strip(),
        telefone=(payload.telefone or "").strip() or None,
        pessoa_visitada=payload.pessoa_visitada.strip(),
        local=payload.local,
        data_hora=dh,
        observacoes=(payload.observacoes or "").strip() or None,
        status="marcada",
        created_at=datetime.now(timezone.utc),
    )
    doc = booking.model_dump()
    doc["data_hora"] = doc["data_hora"].isoformat()
    doc["created_at"] = doc["created_at"].isoformat()
    if payload.utente_id:
        doc["utente_id"] = payload.utente_id
    doc["expires_at"] = booking.data_hora + timedelta(days=365)
    await db.bookings.insert_one(doc)
    return booking


@api_router.get("/bookings/availability")
async def get_availability(date: str, local: str):
    """Return slot availability for a given date and location.

    Query params:
      date: YYYY-MM-DD
      local: one of VALID_LOCATIONS keys
    """
    if local not in VALID_LOCATIONS:
        raise HTTPException(status_code=400, detail="Local inválido")
    try:
        date_obj = datetime.fromisoformat(date).date()
    except Exception:
        raise HTTPException(status_code=400, detail="Data inválida (use YYYY-MM-DD)")

    valid_slots = slots_for_date(date_obj)
    weekday = date_obj.weekday()

    # Find taken slots for this date+local with status=marcada
    day_start = datetime(date_obj.year, date_obj.month, date_obj.day, 0, 0, tzinfo=timezone.utc).isoformat()
    day_end = datetime(date_obj.year, date_obj.month, date_obj.day, 23, 59, 59, tzinfo=timezone.utc).isoformat()
    taken_cursor = db.bookings.find({
        "local": local,
        "status": "marcada",
        "data_hora": {"$gte": day_start, "$lte": day_end},
    }, {"_id": 0, "data_hora": 1})
    taken = set()
    async for doc in taken_cursor:
        try:
            d = datetime.fromisoformat(doc["data_hora"])
            taken.add((d.hour, d.minute))
        except Exception:
            pass

    now_utc = datetime.now(timezone.utc)
    slots_resp = []
    for (h, m) in valid_slots:
        slot_dt = datetime(date_obj.year, date_obj.month, date_obj.day, h, m, tzinfo=timezone.utc)
        is_past = slot_dt < now_utc - timedelta(minutes=5)
        slots_resp.append({
            "hora": f"{h:02d}:{m:02d}",
            "hora_fim": f"{(h if m+SLOT_MINUTES<60 else h+1):02d}:{((m+SLOT_MINUTES)%60):02d}",
            "ocupada": (h, m) in taken,
            "passada": is_past,
        })

    return {
        "date": date,
        "local": local,
        "weekday": weekday,
        "afternoon_only": weekday in AFTERNOON_ONLY_WEEKDAYS,
        "slots": slots_resp,
    }


@api_router.get("/bookings", response_model=List[Booking])
async def list_bookings(
    request: Request,
    authorization: Optional[str] = Header(None),
    status: Optional[str] = None,
    upcoming: bool = False,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
):
    user = await require_admin(request, authorization)
    query: dict = dict(_scope_query(user, "local"))
    if status in ("marcada", "concluida", "cancelada"):
        query["status"] = status
    if upcoming:
        query["data_hora"] = {"$gte": datetime.now(timezone.utc).isoformat()}
        query["status"] = "marcada"
    if date_from or date_to:
        rng: dict = query.get("data_hora", {})
        if date_from:
            rng["$gte"] = date_from + "T00:00:00+00:00"
        if date_to:
            rng["$lte"] = date_to + "T23:59:59+00:00"
        query["data_hora"] = rng
    docs = await db.bookings.find(query, {"_id": 0}).sort("data_hora", 1).to_list(length=None)
    return [_booking_from_doc(d) for d in docs]


@api_router.post("/bookings/{booking_id}/cancel", response_model=Booking)
async def cancel_booking(booking_id: str, request: Request, authorization: Optional[str] = Header(None)):
    user = await require_admin(request, authorization)
    doc = await db.bookings.find_one({"booking_id": booking_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Marcação não encontrada")
    _check_scope(user, doc.get("local", ""))
    await db.bookings.update_one({"booking_id": booking_id}, {"$set": {"status": "cancelada"}})
    doc["status"] = "cancelada"
    return _booking_from_doc(doc)


@api_router.post("/bookings/{booking_id}/conclude", response_model=Booking)
async def conclude_booking(booking_id: str, request: Request, authorization: Optional[str] = Header(None)):
    user = await require_admin(request, authorization)
    doc = await db.bookings.find_one({"booking_id": booking_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Marcação não encontrada")
    _check_scope(user, doc.get("local", ""))
    await db.bookings.update_one({"booking_id": booking_id}, {"$set": {"status": "concluida"}})
    doc["status"] = "concluida"
    return _booking_from_doc(doc)


@api_router.delete("/bookings/{booking_id}")
async def delete_booking(booking_id: str, request: Request, authorization: Optional[str] = Header(None)):
    user = await require_admin(request, authorization)
    doc = await db.bookings.find_one({"booking_id": booking_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Marcação não encontrada")
    _check_scope(user, doc.get("local", ""))
    await db.bookings.delete_one({"booking_id": booking_id})
    return {"ok": True}


@api_router.get("/locations")
async def get_locations():
    return [{"key": k, "label": v} for k, v in VALID_LOCATIONS.items()]


# ----------------- Saídas Programadas -----------------
def _saida_from_doc(doc: dict) -> SaidaProgramada:
    for k in ("saida_prevista", "regresso_previsto", "saida_real", "regresso_real", "created_at"):
        v = doc.get(k)
        if isinstance(v, str):
            try:
                doc[k] = datetime.fromisoformat(v)
            except Exception:
                pass
    return SaidaProgramada(**doc)


@api_router.post("/saidas", response_model=SaidaProgramada)
async def create_saida(payload: SaidaCreate, request: Request, authorization: Optional[str] = Header(None)):
    user = await require_admin(request, authorization)
    utente = await db.utentes.find_one({"utente_id": payload.utente_id}, {"_id": 0})
    if not utente:
        raise HTTPException(status_code=404, detail="Utente não encontrado")
    _check_scope(user, utente["local"])

    sp = payload.saida_prevista
    rp = payload.regresso_previsto
    if sp.tzinfo is None:
        sp = sp.replace(tzinfo=timezone.utc)
    if rp.tzinfo is None:
        rp = rp.replace(tzinfo=timezone.utc)
    if rp <= sp:
        raise HTTPException(status_code=400, detail="O regresso tem de ser depois da saída")
    if not payload.motivo.strip():
        raise HTTPException(status_code=400, detail="Indique o motivo")

    saida = SaidaProgramada(
        saida_id=f"s_{uuid.uuid4().hex[:12]}",
        utente_id=payload.utente_id,
        utente_nome=utente["nome"],
        local=utente["local"],
        saida_prevista=sp,
        regresso_previsto=rp,
        motivo=payload.motivo.strip(),
        responsavel_nome=(payload.responsavel_nome or "").strip() or None,
        responsavel_telefone=(payload.responsavel_telefone or "").strip() or None,
        observacoes=(payload.observacoes or "").strip() or None,
        status="agendada",
        created_at=datetime.now(timezone.utc),
    )
    doc = saida.model_dump()
    for k in ("saida_prevista", "regresso_previsto", "created_at"):
        doc[k] = doc[k].isoformat() if doc[k] else None
    doc["saida_real"] = None
    doc["regresso_real"] = None
    doc["expires_at"] = sp + timedelta(days=365)
    await db.saidas.insert_one(doc)
    return saida


@api_router.get("/saidas", response_model=List[SaidaProgramada])
async def list_saidas(
    request: Request,
    authorization: Optional[str] = Header(None),
    status: Optional[str] = None,
    upcoming: bool = False,
):
    user = await require_admin(request, authorization)
    query: dict = dict(_scope_query(user, "local"))
    if status in ("agendada", "em_curso", "concluida", "cancelada"):
        query["status"] = status
    if upcoming:
        query["saida_prevista"] = {"$gte": datetime.now(timezone.utc).isoformat()}
        query["status"] = {"$in": ["agendada", "em_curso"]}
    docs = await db.saidas.find(query, {"_id": 0}).sort("saida_prevista", 1).to_list(length=None)
    return [_saida_from_doc(d) for d in docs]


@api_router.post("/saidas/{saida_id}/iniciar", response_model=SaidaProgramada)
async def saida_iniciar(saida_id: str, request: Request, authorization: Optional[str] = Header(None)):
    user = await require_admin(request, authorization)
    doc = await db.saidas.find_one({"saida_id": saida_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Saída não encontrada")
    _check_scope(user, doc.get("local", ""))
    now_iso = datetime.now(timezone.utc).isoformat()
    await db.saidas.update_one({"saida_id": saida_id}, {"$set": {"status": "em_curso", "saida_real": now_iso}})
    doc.update({"status": "em_curso", "saida_real": now_iso})
    return _saida_from_doc(doc)


@api_router.post("/saidas/{saida_id}/regresso", response_model=SaidaProgramada)
async def saida_regresso(saida_id: str, request: Request, authorization: Optional[str] = Header(None)):
    user = await require_admin(request, authorization)
    doc = await db.saidas.find_one({"saida_id": saida_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Saída não encontrada")
    _check_scope(user, doc.get("local", ""))
    now_iso = datetime.now(timezone.utc).isoformat()
    await db.saidas.update_one({"saida_id": saida_id}, {"$set": {"status": "concluida", "regresso_real": now_iso}})
    doc.update({"status": "concluida", "regresso_real": now_iso})
    return _saida_from_doc(doc)


@api_router.post("/saidas/{saida_id}/cancel", response_model=SaidaProgramada)
async def saida_cancel(saida_id: str, request: Request, authorization: Optional[str] = Header(None)):
    user = await require_admin(request, authorization)
    doc = await db.saidas.find_one({"saida_id": saida_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Saída não encontrada")
    _check_scope(user, doc.get("local", ""))
    await db.saidas.update_one({"saida_id": saida_id}, {"$set": {"status": "cancelada"}})
    doc["status"] = "cancelada"
    return _saida_from_doc(doc)


@api_router.delete("/saidas/{saida_id}")
async def saida_delete(saida_id: str, request: Request, authorization: Optional[str] = Header(None)):
    user = await require_admin(request, authorization)
    doc = await db.saidas.find_one({"saida_id": saida_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Saída não encontrada")
    _check_scope(user, doc.get("local", ""))
    await db.saidas.delete_one({"saida_id": saida_id})
    return {"ok": True}


# ----------------- Utentes (residentes) -----------------
def _utente_from_doc(doc: dict) -> Utente:
    v = doc.get("created_at")
    if isinstance(v, str):
        try:
            doc["created_at"] = datetime.fromisoformat(v)
        except Exception:
            doc["created_at"] = datetime.now(timezone.utc)
    return Utente(**doc)


@api_router.get("/utentes/public", response_model=List[Utente])
async def list_utentes_public(local: str):
    """Lookup público: devolve utentes de um local específico (usado pelos formulários)."""
    if local not in VALID_LOCATIONS:
        raise HTTPException(status_code=400, detail="Local inválido")
    docs = await db.utentes.find({"local": local}, {"_id": 0}).sort("nome", 1).to_list(length=None)
    return [_utente_from_doc(d) for d in docs]


@api_router.get("/utentes", response_model=List[Utente])
async def list_utentes(
    request: Request,
    authorization: Optional[str] = Header(None),
    local: Optional[str] = None,
    nome: Optional[str] = None,
):
    user = await require_admin(request, authorization)
    query: dict = {}
    if local in VALID_LOCATIONS:
        _check_scope(user, local)
        query["local"] = local
    else:
        query.update(_scope_query(user, "local"))
    if nome:
        query["nome"] = {"$regex": nome, "$options": "i"}
    docs = await db.utentes.find(query, {"_id": 0}).sort("nome", 1).to_list(length=None)
    return [_utente_from_doc(d) for d in docs]


@api_router.post("/utentes", response_model=Utente)
async def create_utente(payload: UtenteCreate, request: Request, authorization: Optional[str] = Header(None)):
    user = await require_admin(request, authorization)
    if payload.local not in VALID_LOCATIONS:
        raise HTTPException(status_code=400, detail="Local inválido")
    _check_scope(user, payload.local)
    nome = (payload.nome or "").strip()
    if not nome:
        raise HTTPException(status_code=400, detail="Nome obrigatório")
    utente = {
        "utente_id": f"u_{uuid.uuid4().hex[:12]}",
        "nome": nome,
        "local": payload.local,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.utentes.insert_one(utente.copy())
    return _utente_from_doc(utente)


@api_router.put("/utentes/{utente_id}", response_model=Utente)
async def update_utente(utente_id: str, payload: UtenteCreate, request: Request, authorization: Optional[str] = Header(None)):
    user = await require_admin(request, authorization)
    if payload.local not in VALID_LOCATIONS:
        raise HTTPException(status_code=400, detail="Local inválido")
    _check_scope(user, payload.local)
    existing = await db.utentes.find_one({"utente_id": utente_id}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Utente não encontrado")
    _check_scope(user, existing["local"])  # ensure they can edit current local too
    nome = (payload.nome or "").strip()
    if not nome:
        raise HTTPException(status_code=400, detail="Nome obrigatório")
    await db.utentes.update_one(
        {"utente_id": utente_id},
        {"$set": {"nome": nome, "local": payload.local}},
    )
    doc = await db.utentes.find_one({"utente_id": utente_id}, {"_id": 0})
    return _utente_from_doc(doc)


@api_router.delete("/utentes/{utente_id}")
async def delete_utente(utente_id: str, request: Request, authorization: Optional[str] = Header(None)):
    user = await require_admin(request, authorization)
    existing = await db.utentes.find_one({"utente_id": utente_id}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Utente não encontrado")
    _check_scope(user, existing["local"])
    await db.utentes.delete_one({"utente_id": utente_id})
    return {"ok": True}


app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


@app.on_event("startup")
async def setup_indexes():
    # TTL index: MongoDB automatically deletes a visit when its `expires_at` is reached.
    # We set expires_at = entrada + 365 days, so records survive for 1 full year and are then purged.
    try:
        await db.visits.create_index("expires_at", expireAfterSeconds=0)
        await db.bookings.create_index("expires_at", expireAfterSeconds=0)
        await db.saidas.create_index("expires_at", expireAfterSeconds=0)
    except Exception as e:
        logger.warning(f"Failed to create TTL index: {e}")
    # Migrate legacy 'creche' / 'lar' values to the new location keys
    try:
        await db.visits.update_many({"instituicao": "creche"}, {"$set": {"instituicao": "secretaria_sede"}})
        await db.visits.update_many({"instituicao": "lar"}, {"$set": {"instituicao": "lar_residencial"}})
    except Exception as e:
        logger.warning(f"Failed to migrate legacy locations: {e}")
    # Backfill existing visits (created before this feature) so they also get auto-deleted 1 year after entrada
    try:
        cursor = db.visits.find({"expires_at": {"$exists": False}}, {"_id": 1, "visit_id": 1, "entrada": 1})
        async for d in cursor:
            entrada = d.get("entrada")
            if isinstance(entrada, str):
                try:
                    entrada_dt = datetime.fromisoformat(entrada)
                except Exception:
                    continue
            else:
                entrada_dt = entrada
            if entrada_dt and entrada_dt.tzinfo is None:
                entrada_dt = entrada_dt.replace(tzinfo=timezone.utc)
            if entrada_dt:
                await db.visits.update_one(
                    {"_id": d["_id"]},
                    {"$set": {"expires_at": entrada_dt + timedelta(days=365)}},
                )
    except Exception as e:
        logger.warning(f"Failed to backfill expires_at: {e}")
    # Seed utentes (residents) if collection empty
    try:
        from utentes_seed import UTENTES_SEED
        existing = await db.utentes.count_documents({})
        if existing == 0:
            now_iso = datetime.now(timezone.utc).isoformat()
            docs = []
            for local_key, names in UTENTES_SEED.items():
                for nome in names:
                    docs.append({
                        "utente_id": f"u_{uuid.uuid4().hex[:12]}",
                        "nome": nome,
                        "local": local_key,
                        "created_at": now_iso,
                    })
            if docs:
                await db.utentes.insert_many(docs)
                logger.info(f"Seeded {len(docs)} utentes.")
    except Exception as e:
        logger.warning(f"Failed to seed utentes: {e}")


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
