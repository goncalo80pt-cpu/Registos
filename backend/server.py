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
from typing import List, Optional
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
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class AdminLogin(BaseModel):
    email: str
    password: str


class VisitCreate(BaseModel):
    instituicao: str  # "creche" | "lar"
    visitante_nome: str
    documento: Optional[str] = None
    telefone: Optional[str] = None
    pessoa_visitada: str  # nome da criança / idoso
    motivo: str
    observacoes: Optional[str] = None


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
    if payload.email.lower() != ADMIN_EMAIL.lower() or payload.password != ADMIN_PASSWORD:
        raise HTTPException(status_code=401, detail="Credenciais inválidas")

    user = await db.users.find_one({"email": ADMIN_EMAIL.lower()}, {"_id": 0})
    if not user:
        user_id = f"user_{uuid.uuid4().hex[:12]}"
        user = {
            "user_id": user_id,
            "email": ADMIN_EMAIL.lower(),
            "name": "Administrador",
            "picture": None,
            "is_admin": True,
            "auth_provider": "admin",
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
        await db.users.insert_one(user.copy())
    else:
        user_id = user["user_id"]
        if not user.get("is_admin"):
            await db.users.update_one({"user_id": user_id}, {"$set": {"is_admin": True}})
            user["is_admin"] = True

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
    if payload.instituicao not in ("creche", "lar"):
        raise HTTPException(status_code=400, detail="instituicao deve ser 'creche' ou 'lar'")
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
    if instituicao in ("creche", "lar"):
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
    if instituicao in ("creche", "lar"):
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
    await require_admin(request, authorization)
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    total = await db.visits.count_documents({})
    dentro = await db.visits.count_documents({"saida": None})
    hoje = await db.visits.count_documents({"entrada": {"$gte": today, "$lt": today + "T23:59:59"}})
    creche_dentro = await db.visits.count_documents({"saida": None, "instituicao": "creche"})
    lar_dentro = await db.visits.count_documents({"saida": None, "instituicao": "lar"})

    # average time (minutes) for completed visits
    pipeline = [
        {"$match": {"saida": {"$ne": None}}},
        {"$project": {"dur": {"$subtract": [{"$toDate": "$saida"}, {"$toDate": "$entrada"}]}}},
        {"$group": {"_id": None, "avg": {"$avg": "$dur"}}},
    ]
    agg = await db.visits.aggregate(pipeline).to_list(1)
    avg_minutes = 0
    if agg and agg[0].get("avg"):
        avg_minutes = round(agg[0]["avg"] / 60000, 1)

    # Last 7 days
    last7 = []
    now = datetime.now(timezone.utc)
    for i in range(6, -1, -1):
        d = (now - timedelta(days=i)).strftime("%Y-%m-%d")
        c = await db.visits.count_documents({"entrada": {"$gte": d, "$lt": d + "T23:59:59"}})
        last7.append({"dia": d, "total": c})

    return {
        "total": total,
        "dentro": dentro,
        "hoje": hoje,
        "creche_dentro": creche_dentro,
        "lar_dentro": lar_dentro,
        "tempo_medio_min": avg_minutes,
        "ultimos_7_dias": last7,
    }


@api_router.get("/visits/export")
async def export_csv(request: Request, authorization: Optional[str] = Header(None)):
    await require_admin(request, authorization)
    # Export ALL records - history is permanent
    docs = await db.visits.find({}, {"_id": 0}).sort("entrada", -1).to_list(length=None)

    buf = io.StringIO()
    writer = csv.writer(buf, delimiter=";")
    writer.writerow([
        "ID", "Instituição", "Visitante", "Documento", "Telefone",
        "Pessoa Visitada", "Motivo", "Observações", "Entrada", "Saída",
    ])
    for d in docs:
        writer.writerow([
            d.get("visit_id", ""),
            "Creche" if d.get("instituicao") == "creche" else "Lar de Idosos",
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
    except Exception as e:
        logger.warning(f"Failed to create TTL index: {e}")
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


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
