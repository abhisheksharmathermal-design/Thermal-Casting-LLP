"""
Thermal Casting LLP — Enterprise Mobile Platform Backend
FastAPI + MongoDB + JWT Auth + Claude Sonnet 4.5 AI Assistant
"""
from fastapi import FastAPI, APIRouter, HTTPException, Depends, status, Query, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.responses import StreamingResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os, logging, uuid, json, asyncio
from pathlib import Path
from pydantic import BaseModel, Field, EmailStr
from typing import List, Optional, Literal
from datetime import datetime, timedelta, timezone
import jwt
from passlib.context import CryptContext
from wordpress_adapter import sync_pull_all, is_configured as wp_is_configured, push_product_to_wp, WP_BASE_URL

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# ============================================================
# CONFIG
# ============================================================
MONGO_URL = os.environ['MONGO_URL']
DB_NAME = os.environ['DB_NAME']
JWT_SECRET = os.environ['JWT_SECRET']
JWT_ALGORITHM = os.environ.get('JWT_ALGORITHM', 'HS256')
JWT_EXPIRE_MINUTES = int(os.environ.get('JWT_EXPIRE_MINUTES', 1440))
EMERGENT_LLM_KEY = os.environ.get('EMERGENT_LLM_KEY', '')
AI_ENABLED = os.environ.get("AI_ENABLED", "false").lower() == "true"
client = AsyncIOMotorClient(MONGO_URL)
db = client[DB_NAME]

pwd_ctx = CryptContext(schemes=["bcrypt"], deprecated="auto")
security = HTTPBearer(auto_error=False)

app = FastAPI(title="Thermal Casting LLP Enterprise API", version="1.0.0")
api = APIRouter(prefix="/api")
@app.get("/")
async def root():
    return {
        "status": "ok",
        "service": "Thermal Casting LLP API"
    }

@app.get("/health")
async def health():
    return {
        "status": "healthy"
    }
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger("thermal_casting")

def now_utc() -> datetime:
    return datetime.now(timezone.utc)

# ============================================================
# MODELS
# ============================================================
class UserRegister(BaseModel):
    email: EmailStr
    password: str = Field(min_length=6)
    full_name: str
    company: Optional[str] = None
    phone: Optional[str] = None

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class UserOut(BaseModel):
    id: str
    email: EmailStr
    full_name: str
    company: Optional[str] = None
    phone: Optional[str] = None
    role: Literal["super_admin", "admin", "sales_executive", "customer"]
    status: Literal["active", "disabled"] = "active"
    created_at: datetime

class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut

class Product(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    ref_no: str
    name: str
    category: str
    description: Optional[str] = None
    specs: Optional[dict] = None
    materials: Optional[str] = None
    applications: Optional[str] = None
    standards: Optional[str] = None
    image_url: Optional[str] = None
    featured: bool = False
    created_at: datetime = Field(default_factory=now_utc)

class MediaAsset(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    title: str
    description: Optional[str] = None
    category: str  # image | video | pdf | brochure | certificate | datasheet
    media_type: Literal["image", "video", "pdf", "brochure", "certificate", "datasheet"]
    url: str
    thumbnail_url: Optional[str] = None
    tags: List[str] = []
    product_id: Optional[str] = None
    featured: bool = False
    created_at: datetime = Field(default_factory=now_utc)

class RFQItem(BaseModel):
    product_id: Optional[str] = None
    product_name: str
    quantity: int = 1
    specifications: Optional[str] = None

class RFQCreate(BaseModel):
    company_name: str
    contact_person: str
    email: EmailStr
    phone: str
    industry: Optional[str] = None
    project_details: str
    items: List[RFQItem]
    target_delivery: Optional[str] = None

class RFQ(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    ref_no: str
    user_id: Optional[str] = None
    company_name: str
    contact_person: str
    email: EmailStr
    phone: str
    industry: Optional[str] = None
    project_details: str
    items: List[RFQItem]
    target_delivery: Optional[str] = None
    status: Literal["submitted", "under_review", "engineering_review", "quoted", "closed"] = "submitted"
    admin_notes: Optional[str] = None
    created_at: datetime = Field(default_factory=now_utc)
    updated_at: datetime = Field(default_factory=now_utc)

class RFQStatusUpdate(BaseModel):
    status: Literal["submitted", "under_review", "engineering_review", "quoted", "closed"]
    admin_notes: Optional[str] = None

class ChatMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str
    timestamp: datetime = Field(default_factory=now_utc)

class ChatRequest(BaseModel):
    session_id: str
    message: str

# ============================================================
# AUTH HELPERS
# ============================================================
def hash_pw(pw: str) -> str:
    return pwd_ctx.hash(pw)

def verify_pw(pw: str, hashed: str) -> bool:
    return pwd_ctx.verify(pw, hashed)

def create_token(user_id: str, role: str, session_id: str) -> str:
    payload = {
        "sub": user_id,
        "role": role,
        "sid": session_id,
        "exp": datetime.now(timezone.utc) + timedelta(minutes=JWT_EXPIRE_MINUTES),
        "iat": datetime.now(timezone.utc),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

async def get_current_user(cred: Optional[HTTPAuthorizationCredentials] = Depends(security)):
    if not cred:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        payload = jwt.decode(cred.credentials, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        user_id = payload.get("sub")
        session_id = payload.get("sid")
        if not user_id:
            raise HTTPException(status_code=401, detail="Invalid token")
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")
    user = await db.users.find_one({"id": user_id}, {"_id": 0, "password_hash": 0})
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    # If token has a session id, ensure it's still active
    if session_id:
        sess = await db.sessions.find_one({"id": session_id, "user_id": user_id, "revoked": False})
        if not sess:
            raise HTTPException(status_code=401, detail="Session revoked or expired")
        # Touch last_seen
        await db.sessions.update_one({"id": session_id}, {"$set": {"last_seen": now_utc()}})
    user["session_id"] = session_id
    return user

async def require_admin(user=Depends(get_current_user)):
    """Any staff role (super_admin, admin, sales_executive)."""
    if user.get("role") not in ("super_admin", "admin", "sales_executive"):
        raise HTTPException(status_code=403, detail="Admin access required")
    return user

async def require_super_admin(user=Depends(get_current_user)):
    if user.get("role") != "super_admin":
        raise HTTPException(status_code=403, detail="Super Admin only")
    return user

async def require_admin_or_super(user=Depends(get_current_user)):
    if user.get("role") not in ("super_admin", "admin"):
        raise HTTPException(status_code=403, detail="Admin required")
    return user

async def audit_log(actor: dict, action: str, entity: str, entity_id: str | None = None, meta: dict | None = None):
    await db.audit_logs.insert_one({
        "id": str(uuid.uuid4()),
        "actor_id": actor.get("id") if actor else None,
        "actor_email": actor.get("email") if actor else None,
        "actor_role": actor.get("role") if actor else None,
        "action": action,
        "entity": entity,
        "entity_id": entity_id,
        "meta": meta or {},
        "timestamp": now_utc(),
    })

async def optional_user(cred: Optional[HTTPAuthorizationCredentials] = Depends(security)):
    if not cred:
        return None
    try:
        payload = jwt.decode(cred.credentials, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        uid = payload.get("sub")
        return await db.users.find_one({"id": uid}, {"_id": 0, "password_hash": 0})
    except Exception:
        return None

# ============================================================
# AUTH ROUTES
# ============================================================
MAX_ACTIVE_SESSIONS = 10

async def _prune_and_create_session(user_id: str, ua: str = "unknown", ip: str = "") -> str:
    """Enforce max active sessions. Purge expired first, then oldest."""
    now = now_utc()
    # Revoke sessions past absolute expiry
    await db.sessions.update_many(
        {"user_id": user_id, "revoked": False, "expires_at": {"$lt": now}},
        {"$set": {"revoked": True, "revoked_reason": "expired"}},
    )
    # Count active
    active = await db.sessions.count_documents({"user_id": user_id, "revoked": False})
    while active >= MAX_ACTIVE_SESSIONS:
        oldest = await db.sessions.find_one({"user_id": user_id, "revoked": False}, sort=[("last_seen", 1)])
        if not oldest:
            break
        await db.sessions.update_one({"id": oldest["id"]}, {"$set": {"revoked": True, "revoked_reason": "session_limit"}})
        active -= 1
    sid = str(uuid.uuid4())
    await db.sessions.insert_one({
        "id": sid,
        "user_id": user_id,
        "created_at": now,
        "last_seen": now,
        "expires_at": now + timedelta(minutes=JWT_EXPIRE_MINUTES),
        "user_agent": ua[:200] if ua else "unknown",
        "ip": ip[:64] if ip else "",
        "revoked": False,
    })
    return sid


@api.post("/auth/register", response_model=TokenOut)
async def register(payload: UserRegister):
    existing = await db.users.find_one({"email": payload.email.lower()})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    user_id = str(uuid.uuid4())
    doc = {
        "id": user_id,
        "email": payload.email.lower(),
        "full_name": payload.full_name,
        "company": payload.company,
        "phone": payload.phone,
        "role": "customer",
        "status": "active",
        "password_hash": hash_pw(payload.password),
        "created_at": now_utc(),
    }
    await db.users.insert_one(doc)
    sid = await _prune_and_create_session(user_id)
    token = create_token(user_id, "customer", sid)
    return TokenOut(access_token=token, user=UserOut(**{k: v for k, v in doc.items() if k != "password_hash"}))

@api.post("/auth/login", response_model=TokenOut)
async def login(payload: UserLogin, request: Request):
    user = await db.users.find_one({"email": payload.email.lower()})
    if not user or not verify_pw(payload.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    if user.get("status") == "disabled":
        raise HTTPException(status_code=403, detail="Account disabled")
    ua = request.headers.get("user-agent", "unknown")
    ip = request.client.host if request.client else ""
    sid = await _prune_and_create_session(user["id"], ua=ua, ip=ip)
    token = create_token(user["id"], user["role"], sid)
    user.pop("_id", None)
    user.pop("password_hash", None)
    return TokenOut(access_token=token, user=UserOut(**user))

@api.get("/auth/me", response_model=UserOut)
async def me(user=Depends(get_current_user)):
    user_copy = {k: v for k, v in user.items() if k != "session_id"}
    return UserOut(**user_copy)

class ChangePasswordPayload(BaseModel):
    current_password: str
    new_password: str = Field(min_length=8)
    confirm_password: str

@api.post("/auth/change-password")
async def change_password(payload: ChangePasswordPayload, user=Depends(get_current_user)):
    if payload.new_password != payload.confirm_password:
        raise HTTPException(status_code=400, detail="Passwords do not match")
    if payload.current_password == payload.new_password:
        raise HTTPException(status_code=400, detail="New password must differ from current")
    doc = await db.users.find_one({"id": user["id"]})
    if not doc or not verify_pw(payload.current_password, doc["password_hash"]):
        raise HTTPException(status_code=401, detail="Current password incorrect")
    await db.users.update_one({"id": user["id"]}, {"$set": {"password_hash": hash_pw(payload.new_password)}})
    current_sid = user.get("session_id")
    await db.sessions.update_many(
        {"user_id": user["id"], "revoked": False, "id": {"$ne": current_sid}},
        {"$set": {"revoked": True, "revoked_reason": "password_change"}},
    )
    await audit_log(user, "auth.password_change", "user", user["id"])
    return {"status": "ok", "message": "Password updated. Other sessions signed out."}


@api.get("/auth/sessions")
async def list_sessions(user=Depends(get_current_user)):
    docs = await db.sessions.find(
        {"user_id": user["id"], "revoked": False},
        {"_id": 0, "user_id": 0},
    ).sort("last_seen", -1).to_list(50)
    current_sid = user.get("session_id")
    for d in docs:
        d["current"] = (d.get("id") == current_sid)
    return docs


@api.delete("/auth/sessions/{sid}")
async def revoke_session(sid: str, user=Depends(get_current_user)):
    r = await db.sessions.update_one(
        {"id": sid, "user_id": user["id"], "revoked": False},
        {"$set": {"revoked": True, "revoked_reason": "user_logout"}},
    )
    if r.matched_count == 0:
        raise HTTPException(status_code=404, detail="Session not found")
    return {"status": "revoked"}


@api.post("/auth/sessions/logout-others")
async def logout_others(user=Depends(get_current_user)):
    current_sid = user.get("session_id")
    r = await db.sessions.update_many(
        {"user_id": user["id"], "revoked": False, "id": {"$ne": current_sid}},
        {"$set": {"revoked": True, "revoked_reason": "logout_others"}},
    )
    return {"revoked_count": r.modified_count}


@api.post("/auth/logout")
async def logout(user=Depends(get_current_user)):
    sid = user.get("session_id")
    if sid:
        await db.sessions.update_one({"id": sid}, {"$set": {"revoked": True, "revoked_reason": "user_logout"}})
    return {"status": "ok"}


# ============================================================
# FILE UPLOAD (local filesystem — no external services)
# ============================================================
UPLOAD_DIR = ROOT_DIR / "uploads"
UPLOAD_DIR.mkdir(exist_ok=True)
ALLOWED_MIME = {
    "image/jpeg", "image/png", "image/webp", "image/gif",
    "application/pdf",
    "video/mp4", "video/webm", "video/quicktime",
}
MAX_IMAGE_BYTES = 20 * 1024 * 1024   # 20 MB — images/PDFs
MAX_VIDEO_BYTES = 100 * 1024 * 1024  # 100 MB — videos (matches admin UI cap)



# ============================================================
# COMPANY INFO
# ============================================================
@api.get("/company")
async def company_info():
    doc = await db.company.find_one({"key": "profile"}, {"_id": 0})
    return doc or {}

# ============================================================
# PRODUCTS
# ============================================================
@api.get("/products")
async def list_products(category: Optional[str] = None, search: Optional[str] = None, featured: Optional[bool] = None):
    q = {}
    if category and category != "All":
        # match case/whitespace-insensitively against products.category
        norm = _norm_cat_name(category)
        # escape regex meta chars
        esc = re.escape(norm)
        q["category"] = {"$regex": f"^\\s*{esc}\\s*$", "$options": "i"}
    if featured is not None:
        q["featured"] = featured
    if search:
        q["$or"] = [
            {"name": {"$regex": search, "$options": "i"}},
            {"description": {"$regex": search, "$options": "i"}},
            {"category": {"$regex": search, "$options": "i"}},
            {"ref_no": {"$regex": search, "$options": "i"}},
        ]
    docs = await db.products.find(q, {"_id": 0}).sort("created_at", -1).to_list(500)
    return docs

import re

def _norm_cat_name(name: str) -> str:
    """Normalize category name: trim + collapse internal whitespace. Preserves original case."""
    if not name:
        return ""
    return re.sub(r"\s+", " ", name).strip()

def _norm_cat_key(name: str) -> str:
    """Case-insensitive key for duplicate detection."""
    return _norm_cat_name(name).lower()


@api.get("/products/categories")
async def product_categories():
    """DEPRECATED shape retained for compatibility — now sourced from db.categories (enabled only)."""
    cats = await db.categories.find({"enabled": True}, {"_id": 0, "name": 1}).sort("display_order", 1).to_list(500)
    return sorted({c["name"] for c in cats})

@api.get("/products/{product_id}")
async def get_product(product_id: str):
    doc = await db.products.find_one({"id": product_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Product not found")
    # attach media
    doc["media"] = await db.media.find({"product_id": product_id}, {"_id": 0}).to_list(50)
    return doc

# ============================================================
# MEDIA
# ============================================================
@api.get("/media")
async def list_media(media_type: Optional[str] = None, category: Optional[str] = None, product_id: Optional[str] = None, search: Optional[str] = None):
    q = {}
    if media_type and media_type != "All":
        q["media_type"] = media_type
    if category:
        q["category"] = category
    if product_id:
        q["product_id"] = product_id
    if search:
        q["$or"] = [
            {"title": {"$regex": search, "$options": "i"}},
            {"description": {"$regex": search, "$options": "i"}},
        ]
    docs = await db.media.find(q, {"_id": 0}).sort("created_at", -1).to_list(500)
    return docs

@api.get("/media/videos")
async def list_videos():
    docs = await db.media.find({"media_type": "video"}, {"_id": 0}).sort("created_at", -1).to_list(200)
    return docs

# ============================================================
# RFQ
# ============================================================
async def _next_rfq_ref() -> str:
    year = datetime.now(timezone.utc).year
    count = await db.rfqs.count_documents({}) + 1
    return f"RFQ-{year}-{count:05d}"

@api.post("/rfq", response_model=RFQ)
async def create_rfq(payload: RFQCreate, user=Depends(optional_user)):
    rfq = RFQ(
        ref_no=await _next_rfq_ref(),
        user_id=user["id"] if user else None,
        **payload.model_dump(),
    )
    await db.rfqs.insert_one(rfq.model_dump())
    return rfq

@api.get("/rfq/my", response_model=List[RFQ])
async def my_rfqs(user=Depends(get_current_user)):
    docs = await db.rfqs.find({"user_id": user["id"]}, {"_id": 0}).sort("created_at", -1).to_list(200)
    return docs

@api.get("/rfq/all", response_model=List[RFQ])
async def all_rfqs(user=Depends(require_admin)):
    docs = await db.rfqs.find({}, {"_id": 0}).sort("created_at", -1).to_list(1000)
    return docs

@api.get("/rfq/{rfq_id}", response_model=RFQ)
async def get_rfq(rfq_id: str, user=Depends(get_current_user)):
    doc = await db.rfqs.find_one({"id": rfq_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="RFQ not found")
    if user["role"] != "admin" and doc.get("user_id") != user["id"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    return doc

@api.patch("/rfq/{rfq_id}", response_model=RFQ)
async def update_rfq(rfq_id: str, payload: RFQStatusUpdate, user=Depends(require_admin)):
    upd = {"status": payload.status, "updated_at": now_utc()}
    if payload.admin_notes is not None:
        upd["admin_notes"] = payload.admin_notes
    result = await db.rfqs.update_one({"id": rfq_id}, {"$set": upd})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="RFQ not found")
    doc = await db.rfqs.find_one({"id": rfq_id}, {"_id": 0})
    return doc

# ============================================================
# AI ASSISTANT (Claude Sonnet 4.5 via Emergent LLM key)
# ============================================================
SYSTEM_PROMPT_TEMPLATE = """You are the Thermal Casting LLP Knowledge Assistant — a professional, precise, technical B2B AI advisor for a heavy-engineering foundry.

You represent Thermal Casting LLP (Sharda Alloys Group / SAPL Steel LLP), an ISO 9001:2015 certified alloy steel casting manufacturer located at Plot No. 13-17, Shrey Industrial Park, Dhamatvan-Undrel Road, Ahmedabad, Gujarat, India.

Company facts you MUST use as grounding:
- Established venture merging Laxmi Foundry (1975), Reclamation (1985), SAPL Steel (2013), Thermal Casting LLP (2019).
- Certifications: ISO 9001:2015, Well Known Foundry under Indian Boiler Regulations 1950 (Cert No. 543, valid until April 17, 2030), BHEL Approved Vendor (Bhopal & Varanasi).
- Facility: 7000 sq.m foundry with induction melting + No Bake Sand Moulding; 2000 sq.m fabrication shop; single-piece casting up to 8 MT.
- Melting furnaces: 2×2.5 MT, 1×5.0 MT, 1×250 KG induction.
- Materials: Alloy Cast Steel, Cast Iron, S G Iron, Copper Alloy, Nickel Alloy, Stainless Steel.
- Industries served: Valves, Rolls for Steel Mills, Pumps, Mining, Aluminum Smelting, Oil & Gas, General Engineering, Steel Plants.
- Testing: Optical spectrometer (ARL), UT, MPI, Dye penetrant, Tensile 60T, Hardness, Sand lab, Hitachi mold-flow simulation.
- Contact: +91-9898662888, sales@thermalcasting.com, arun@thermalcasting.com, www.thermalcasting.com.

Products catalogue context (partial): {product_context}

Rules:
1. Answer ONLY using approved company knowledge above and the product catalogue provided. Never invent products, prices, or delivery timelines.
2. If asked for a quotation, DO NOT quote — instruct the user to submit an RFQ via the app's "Request Quotation" flow.
3. Cite the product name / reference when discussing catalogue items.
4. Keep responses concise, technical, and in a professional B2B tone. Use bullet points for specs.
5. If the question is outside company/product scope, politely redirect to sales@thermalcasting.com.
6. Never hallucinate certifications, capacities, or grades not listed above.
"""

async def build_product_context() -> str:
    prods = await db.products.find({}, {"_id": 0, "name": 1, "category": 1, "description": 1, "specs": 1, "materials": 1, "ref_no": 1}).to_list(200)
    lines = []
    for p in prods[:80]:
        parts = [f"[{p.get('ref_no','')}] {p.get('name','')} ({p.get('category','')})"]
        if p.get("description"):
            parts.append(f"— {p['description']}")
        if p.get("materials"):
            parts.append(f"Materials: {p['materials']}")
        if p.get("specs"):
            parts.append(f"Specs: {p['specs']}")
        lines.append(" ".join(parts))
    return "\n".join(lines)

@api.post("/ai/chat")
async def ai_chat(req: ChatRequest, user=Depends(optional_user)):
    """AI chat is disabled unless explicitly configured."""

    if not AI_ENABLED:
        raise HTTPException(
            status_code=503,
            detail="AI assistant is currently disabled",
        )

    if not EMERGENT_LLM_KEY:
        raise HTTPException(
            status_code=503,
            detail="AI provider is not configured",
        )

    try:
        from emergentintegrations.llm.chat import LlmChat, UserMessage
    except ImportError:
        raise HTTPException(
            status_code=503,
            detail="AI integration package is not installed",
        )

    # persist user msg
    user_msg = {
        "session_id": req.session_id,
        "user_id": user["id"] if user else None,
        "role": "user",
        "content": req.message,
        "timestamp": now_utc(),
    }
    await db.chat_messages.insert_one(user_msg)

    product_ctx = await build_product_context()
    extra_kb = await get_extra_ai_knowledge()
    system_msg = SYSTEM_PROMPT_TEMPLATE.format(product_context=product_ctx) + extra_kb

    # load prior history for this session
    history = await db.chat_messages.find(
        {"session_id": req.session_id}, {"_id": 0, "role": 1, "content": 1}
    ).sort("timestamp", 1).to_list(30)

    chat = LlmChat(
        api_key=EMERGENT_LLM_KEY,
        session_id=req.session_id,
        system_message=system_msg,
    ).with_model("anthropic", "claude-sonnet-4-5-20250929")

    try:
        response = await chat.send_message(UserMessage(text=req.message))
        reply_text = response if isinstance(response, str) else str(response)
    except Exception as e:
        logger.exception("AI chat error")
        raise HTTPException(status_code=502, detail=f"AI service error: {e}")

    assistant_msg = {
        "session_id": req.session_id,
        "user_id": user["id"] if user else None,
        "role": "assistant",
        "content": reply_text,
        "timestamp": now_utc(),
    }
    await db.chat_messages.insert_one(assistant_msg)

    return {"reply": reply_text, "session_id": req.session_id}

@api.get("/ai/history/{session_id}")
async def chat_history(session_id: str):
    docs = await db.chat_messages.find(
        {"session_id": session_id}, {"_id": 0, "role": 1, "content": 1, "timestamp": 1}
    ).sort("timestamp", 1).to_list(200)
    return docs

# ============================================================
# ADMIN — Products & Media Management
# ============================================================
class ProductCreate(BaseModel):
    name: str
    category: str
    description: Optional[str] = None
    specs: Optional[dict] = None
    materials: Optional[str] = None
    applications: Optional[str] = None
    standards: Optional[str] = None
    image_url: Optional[str] = None
    featured: bool = False

@api.post("/admin/products", response_model=Product)
async def admin_create_product(payload: ProductCreate, user=Depends(require_admin)):
    count = await db.products.count_documents({}) + 1
    prod = Product(ref_no=f"TC-{count:05d}", **payload.model_dump())
    await db.products.insert_one(prod.model_dump())
    return prod

class MediaCreate(BaseModel):
    title: str
    description: Optional[str] = None
    category: str = "General"
    media_type: Literal["image", "video", "pdf", "brochure", "certificate", "datasheet"]
    url: str
    thumbnail_url: Optional[str] = None
    tags: List[str] = []
    product_id: Optional[str] = None
    featured: bool = False

@api.post("/admin/media", response_model=MediaAsset)
async def admin_create_media(payload: MediaCreate, user=Depends(require_admin_or_super)):
    m = MediaAsset(**payload.model_dump())
    await db.media.insert_one(m.model_dump())
    await audit_log(user, "media.create", "media", m.id, {"title": m.title})
    return m

# ============================================================
# WORDPRESS SYNC (pluggable adapter)
# ============================================================
@api.get("/admin/wp/status")
async def wp_status(user=Depends(require_admin)):
    last = await db.wp_sync_log.find({}, {"_id": 0}).sort("started_at", -1).to_list(5)
    return {
        "configured": wp_is_configured(),
        "wp_url": WP_BASE_URL or None,
        "recent_syncs": last,
    }

@api.post("/admin/wp/sync")
async def wp_sync(user=Depends(require_admin)):
    """Pull products + media from WordPress. Idempotent."""
    counts = await sync_pull_all(db)
    return {"status": "ok" if "error" not in counts else "error", "counts": counts}

@api.post("/admin/wp/push/{product_id}")
async def wp_push_product(product_id: str, user=Depends(require_admin)):
    p = await db.products.find_one({"id": product_id}, {"_id": 0})
    if not p:
        raise HTTPException(status_code=404, detail="Product not found")
    result = await push_product_to_wp(p)
    if not result:
        raise HTTPException(status_code=502, detail="WordPress push failed or credentials missing")
    await db.products.update_one({"id": product_id}, {"$set": {"wp_id": result.get("id"), "wp_link": result.get("link")}})
    return {"status": "pushed", "wp_id": result.get("id"), "wp_link": result.get("link")}

@api.get("/admin/stats")
async def admin_stats(user=Depends(require_admin)):
    return {
        "products": await db.products.count_documents({}),
        "media": await db.media.count_documents({}),
        "rfqs": await db.rfqs.count_documents({}),
        "customers": await db.users.count_documents({"role": "customer"}),
        "ai_enabled": AI_ENABLED,
        "rfqs_by_status": {
            s: await db.rfqs.count_documents({"status": s})
            for s in ["submitted", "under_review", "engineering_review", "quoted", "closed"]
        },
    }

# ============================================================
# PHASE 2 — ENTERPRISE ADMIN CMS
# ============================================================
import io, csv, hashlib, mimetypes
from fastapi import UploadFile, File, Form
from fastapi.staticfiles import StaticFiles

# ---------- Extended Product model (backward compatible) ----------
class ProductFullCreate(BaseModel):
    name: str
    sku: Optional[str] = None
    category: str
    subcategory: Optional[str] = None
    short_description: Optional[str] = None
    description: Optional[str] = None
    material_ids: List[str] = []
    grade: Optional[str] = None
    industry: Optional[str] = None
    standards: Optional[str] = None
    weight: Optional[str] = None
    size: Optional[str] = None
    pressure_class: Optional[str] = None
    temperature_rating: Optional[str] = None
    casting_process: Optional[str] = None
    machining_details: Optional[str] = None
    inspection_details: Optional[str] = None
    heat_treatment: Optional[str] = None
    manufacturing_capacity: Optional[str] = None
    image_url: Optional[str] = None
    gallery: List[str] = []
    videos: List[str] = []
    brochures: List[str] = []
    drawings: List[str] = []
    certificates: List[str] = []
    seo_title: Optional[str] = None
    seo_description: Optional[str] = None
    seo_keywords: Optional[str] = None
    featured: bool = False
    enabled: bool = True
    archived: bool = False
    specs: Optional[dict] = None
    materials: Optional[str] = None
    applications: Optional[str] = None

@api.post("/admin/products/full")
async def admin_create_product_full(payload: ProductFullCreate, user=Depends(require_admin_or_super)):
    count = await db.products.count_documents({}) + 1
    doc = payload.model_dump()
    doc["id"] = str(uuid.uuid4())
    doc["ref_no"] = doc.get("sku") or f"TC-{count:05d}"
    doc["created_at"] = now_utc()
    doc["updated_at"] = now_utc()
    await db.products.insert_one(doc)
    await audit_log(user, "product.create", "product", doc["id"], {"name": doc["name"]})
    return {k: v for k, v in doc.items() if k != "_id"}

@api.patch("/admin/products/{product_id}")
async def admin_update_product(product_id: str, payload: dict, user=Depends(require_admin_or_super)):
    payload["updated_at"] = now_utc()
    payload.pop("_id", None); payload.pop("id", None)
    r = await db.products.update_one({"id": product_id}, {"$set": payload})
    if r.matched_count == 0:
        raise HTTPException(status_code=404, detail="Product not found")
    await audit_log(user, "product.update", "product", product_id, {"fields": list(payload.keys())})
    return await db.products.find_one({"id": product_id}, {"_id": 0})

@api.delete("/admin/products/{product_id}")
async def admin_delete_product(product_id: str, user=Depends(require_admin_or_super)):
    r = await db.products.delete_one({"id": product_id})
    if r.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Not found")
    await audit_log(user, "product.delete", "product", product_id)
    return {"status": "deleted"}

@api.post("/admin/products/{product_id}/duplicate")
async def admin_duplicate_product(product_id: str, user=Depends(require_admin_or_super)):
    src = await db.products.find_one({"id": product_id}, {"_id": 0})
    if not src:
        raise HTTPException(status_code=404, detail="Not found")
    count = await db.products.count_documents({}) + 1
    src["id"] = str(uuid.uuid4())
    src["ref_no"] = f"TC-{count:05d}"
    src["name"] = f"{src['name']} (Copy)"
    src["featured"] = False
    src["created_at"] = now_utc()
    src["updated_at"] = now_utc()
    await db.products.insert_one(src)
    await audit_log(user, "product.duplicate", "product", src["id"])
    src.pop("_id", None)
    return src

@api.post("/admin/products/{product_id}/toggle")
async def admin_toggle_product(product_id: str, field: str = Query(...), user=Depends(require_admin_or_super)):
    if field not in ("enabled", "featured", "archived"):
        raise HTTPException(status_code=400, detail="Invalid field")
    p = await db.products.find_one({"id": product_id})
    if not p:
        raise HTTPException(status_code=404, detail="Not found")
    new_val = not p.get(field, False)
    await db.products.update_one({"id": product_id}, {"$set": {field: new_val, "updated_at": now_utc()}})
    await audit_log(user, f"product.toggle.{field}", "product", product_id, {"value": new_val})
    return {"field": field, "value": new_val}

# ---------- Materials & Grades ----------
class Material(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    grade_code: Optional[str] = None
    description: Optional[str] = None
    category: Optional[str] = None  # e.g. "Carbon Steel", "Stainless Steel", "Nickel Alloy"
    standards: Optional[str] = None
    typical_use: Optional[str] = None
    image_url: Optional[str] = None
    enabled: bool = True
    created_at: datetime = Field(default_factory=now_utc)

class MaterialCreate(BaseModel):
    name: str
    grade_code: Optional[str] = None
    description: Optional[str] = None
    category: Optional[str] = None
    standards: Optional[str] = None
    typical_use: Optional[str] = None
    image_url: Optional[str] = None
    enabled: bool = True

@api.get("/materials")
async def list_materials():
    return await db.materials.find({"enabled": True}, {"_id": 0}).sort("name", 1).to_list(500)

@api.get("/materials/{material_id}")
async def get_material(material_id: str):
    m = await db.materials.find_one({"id": material_id}, {"_id": 0})
    if not m:
        raise HTTPException(status_code=404, detail="Material not found")
    m["products"] = await db.products.find({"material_ids": material_id}, {"_id": 0}).to_list(200)
    return m

@api.post("/admin/materials", response_model=Material)
async def admin_create_material(payload: MaterialCreate, user=Depends(require_admin_or_super)):
    m = Material(**payload.model_dump())
    await db.materials.insert_one(m.model_dump())
    await audit_log(user, "material.create", "material", m.id, {"name": m.name})
    return m

@api.patch("/admin/materials/{material_id}")
async def admin_update_material(material_id: str, payload: dict, user=Depends(require_admin_or_super)):
    payload.pop("id", None); payload.pop("_id", None)
    r = await db.materials.update_one({"id": material_id}, {"$set": payload})
    if r.matched_count == 0:
        raise HTTPException(status_code=404, detail="Not found")
    await audit_log(user, "material.update", "material", material_id)
    return await db.materials.find_one({"id": material_id}, {"_id": 0})

@api.delete("/admin/materials/{material_id}")
async def admin_delete_material(material_id: str, user=Depends(require_admin_or_super)):
    r = await db.materials.delete_one({"id": material_id})
    await db.products.update_many({"material_ids": material_id}, {"$pull": {"material_ids": material_id}})
    if r.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Not found")
    await audit_log(user, "material.delete", "material", material_id)
    return {"status": "deleted"}

# ---------- Categories & Subcategories ----------
class Category(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    parent_id: Optional[str] = None   # None = top-level
    description: Optional[str] = None
    icon: Optional[str] = None
    image_url: Optional[str] = None
    display_order: int = 0
    enabled: bool = True
    created_at: datetime = Field(default_factory=now_utc)

class CategoryCreate(BaseModel):
    name: str
    parent_id: Optional[str] = None
    description: Optional[str] = None
    icon: Optional[str] = None
    image_url: Optional[str] = None
    display_order: int = 0
    enabled: bool = True

@api.get("/categories")
async def list_categories():
    return await db.categories.find({"enabled": True}, {"_id": 0}).sort("display_order", 1).to_list(500)

@api.post("/admin/categories", response_model=Category)
async def admin_create_category(payload: CategoryCreate, user=Depends(require_admin_or_super)):
    normalized = _norm_cat_name(payload.name)
    if not normalized:
        raise HTTPException(status_code=400, detail="Category name required")
    key = normalized.lower()
    dup = await db.categories.find_one({"name_key": key})
    if dup:
        raise HTTPException(status_code=409, detail=f"Category '{normalized}' already exists")
    data = payload.model_dump()
    data["name"] = normalized
    c = Category(**data)
    doc = c.model_dump()
    doc["name_key"] = key
    await db.categories.insert_one(doc)
    # Auto-link products whose category matches exactly by normalized name (no guessing)
    linked = await db.products.update_many(
        {"$expr": {"$eq": [{"$toLower": {"$trim": {"input": "$category"}}}, key]}},
        {"$set": {"category": normalized, "updated_at": now_utc()}},
    )
    await audit_log(user, "category.create", "category", c.id, {"name": normalized, "linked_products": linked.modified_count})
    return c


@api.patch("/admin/categories/{cat_id}")
async def admin_update_category(cat_id: str, payload: dict, user=Depends(require_admin_or_super)):
    payload.pop("id", None); payload.pop("_id", None); payload.pop("name_key", None)
    existing = await db.categories.find_one({"id": cat_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Not found")
    old_name = existing.get("name")
    if "name" in payload:
        normalized = _norm_cat_name(payload["name"])
        if not normalized:
            raise HTTPException(status_code=400, detail="Category name required")
        new_key = normalized.lower()
        conflict = await db.categories.find_one({"name_key": new_key, "id": {"$ne": cat_id}})
        if conflict:
            raise HTTPException(status_code=409, detail=f"Another category named '{normalized}' already exists")
        payload["name"] = normalized
        payload["name_key"] = new_key
    r = await db.categories.update_one({"id": cat_id}, {"$set": payload})
    if r.matched_count == 0:
        raise HTTPException(status_code=404, detail="Not found")
    updated = await db.categories.find_one({"id": cat_id}, {"_id": 0})
    # Rename cascade: products carrying the OLD name migrate to the new one
    renamed_count = 0
    if "name" in payload and payload["name"] != old_name and old_name:
        r2 = await db.products.update_many({"category": old_name}, {"$set": {"category": payload["name"], "updated_at": now_utc()}})
        renamed_count = r2.modified_count
    await audit_log(user, "category.update", "category", cat_id, {"renamed_products": renamed_count})
    return updated


@api.delete("/admin/categories/{cat_id}")
async def admin_delete_category(cat_id: str, user=Depends(require_admin_or_super)):
    r = await db.categories.delete_one({"id": cat_id})
    if r.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Not found")
    await audit_log(user, "category.delete", "category", cat_id)
    return {"status": "deleted"}


# ---------- One-off category cleanup (idempotent) ----------
@api.post("/admin/categories/cleanup")
async def admin_cleanup_categories(user=Depends(require_admin_or_super)):
    """Safely dedupe admin categories, normalize product category strings, and auto-link.
    - Never deletes products.
    - Never partial-matches; only exact case/whitespace-normalized matches.
    """
    now = now_utc()
    # 1) Normalize product.category strings (trim + collapse spaces). Case preserved from admin category if a matching admin cat exists; otherwise keep normalized product string as-is.
    admin_cats = await db.categories.find({}, {"_id": 0, "id": 1, "name": 1, "name_key": 1}).to_list(1000)
    # ensure name_key is populated
    for ac in admin_cats:
        if not ac.get("name_key"):
            key = _norm_cat_key(ac["name"])
            await db.categories.update_one({"id": ac["id"]}, {"$set": {"name_key": key, "name": _norm_cat_name(ac["name"])}})
            ac["name_key"] = key

    key_to_official: dict[str, str] = {}
    for ac in admin_cats:
        key_to_official.setdefault(ac["name_key"], _norm_cat_name(ac["name"]))

    # normalize every product's category
    normalized_count = 0
    async for p in db.products.find({}, {"_id": 0, "id": 1, "category": 1}):
        raw = p.get("category") or ""
        norm = _norm_cat_name(raw)
        key = norm.lower()
        official = key_to_official.get(key, norm)
        if official != raw:
            await db.products.update_one({"id": p["id"]}, {"$set": {"category": official, "updated_at": now}})
            normalized_count += 1

    # 2) Merge duplicate admin categories by name_key (keep the earliest created).
    merged = 0
    grouped: dict[str, list] = {}
    for ac in admin_cats:
        grouped.setdefault(ac["name_key"], []).append(ac)
    for key, arr in grouped.items():
        if len(arr) <= 1:
            continue
        # keep the one with the smallest created_at (fetch full doc for created_at)
        full = await db.categories.find({"name_key": key}, {"_id": 0}).sort("created_at", 1).to_list(50)
        winner = full[0]
        losers = full[1:]
        for l in losers:
            await db.categories.delete_one({"id": l["id"]})
            merged += 1
        # nothing to do with products — they already carry the normalized name

    # 3) Delete empty admin categories (no product references)
    empties_removed = 0
    for ac in await db.categories.find({}, {"_id": 0}).to_list(1000):
        cnt = await db.products.count_documents({"category": ac["name"]})
        if cnt == 0:
            await db.categories.delete_one({"id": ac["id"]})
            empties_removed += 1

    await audit_log(user, "category.cleanup", "category", None, {
        "products_normalized": normalized_count,
        "duplicates_merged": merged,
        "empties_removed": empties_removed,
    })
    return {
        "products_normalized": normalized_count,
        "duplicates_merged": merged,
        "empties_removed": empties_removed,
    }

# ---------- Company Profile CMS ----------
@api.patch("/admin/company")
async def admin_update_company(payload: dict, user=Depends(require_admin_or_super)):
    payload.pop("_id", None)
    await db.company.update_one({"key": "profile"}, {"$set": payload}, upsert=True)
    await audit_log(user, "company.update", "company_profile", "profile", {"fields": list(payload.keys())})
    return await db.company.find_one({"key": "profile"}, {"_id": 0})

# ---------- Home CMS: News, Announcements, Hero ----------
class NewsItem(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    title: str
    summary: Optional[str] = None
    body: Optional[str] = None
    image_url: Optional[str] = None
    type: Literal["news", "announcement"] = "news"
    published: bool = True
    priority: Literal["low", "normal", "high"] = "normal"
    created_at: datetime = Field(default_factory=now_utc)

class NewsCreate(BaseModel):
    title: str
    summary: Optional[str] = None
    body: Optional[str] = None
    image_url: Optional[str] = None
    type: Literal["news", "announcement"] = "news"
    published: bool = True
    priority: Literal["low", "normal", "high"] = "normal"

@api.get("/news")
async def list_news(type: Optional[str] = None):
    q = {"published": True}
    if type: q["type"] = type
    return await db.news.find(q, {"_id": 0}).sort("created_at", -1).to_list(200)

@api.post("/admin/news", response_model=NewsItem)
async def admin_create_news(payload: NewsCreate, user=Depends(require_admin_or_super)):
    n = NewsItem(**payload.model_dump())
    await db.news.insert_one(n.model_dump())
    await audit_log(user, "news.create", "news", n.id, {"title": n.title, "type": n.type})
    return n

@api.patch("/admin/news/{news_id}")
async def admin_update_news(news_id: str, payload: dict, user=Depends(require_admin_or_super)):
    payload.pop("id", None); payload.pop("_id", None)
    r = await db.news.update_one({"id": news_id}, {"$set": payload})
    if r.matched_count == 0:
        raise HTTPException(status_code=404, detail="Not found")
    await audit_log(user, "news.update", "news", news_id)
    return await db.news.find_one({"id": news_id}, {"_id": 0})

@api.delete("/admin/news/{news_id}")
async def admin_delete_news(news_id: str, user=Depends(require_admin_or_super)):
    await db.news.delete_one({"id": news_id})
    await audit_log(user, "news.delete", "news", news_id)
    return {"status": "deleted"}

# ---------- Media CRUD ----------
@api.patch("/admin/media/{media_id}")
async def admin_update_media(media_id: str, payload: dict, user=Depends(require_admin_or_super)):
    payload.pop("id", None); payload.pop("_id", None)
    r = await db.media.update_one({"id": media_id}, {"$set": payload})
    if r.matched_count == 0:
        raise HTTPException(status_code=404, detail="Not found")
    await audit_log(user, "media.update", "media", media_id)
    return await db.media.find_one({"id": media_id}, {"_id": 0})

@api.delete("/admin/media/{media_id}")
async def admin_delete_media(media_id: str, user=Depends(require_admin_or_super)):
    existing = await db.media.find_one({"id": media_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Not found")
    # If media was created from a local upload, physically delete the file too
    upload_id = existing.get("upload_id")
    if upload_id:
        up = await db.uploads.find_one({"id": upload_id})
        if up:
            fp = UPLOAD_DIR / up["filename"]
            try:
                if fp.exists():
                    fp.unlink()
            except Exception as e:
                logging.warning(f"Failed to unlink {fp}: {e}")
            await db.uploads.delete_one({"id": upload_id})
    await db.media.delete_one({"id": media_id})
    await audit_log(user, "media.delete", "media", media_id)
    return {"status": "deleted"}

# ---------- Customer Management ----------
@api.get("/admin/customers")
async def admin_list_customers(user=Depends(require_admin), q: Optional[str] = None):
    query = {"role": "customer"}
    if q:
        query["$or"] = [
            {"email": {"$regex": q, "$options": "i"}},
            {"full_name": {"$regex": q, "$options": "i"}},
            {"company": {"$regex": q, "$options": "i"}},
        ]
    docs = await db.users.find(query, {"_id": 0, "password_hash": 0}).sort("created_at", -1).to_list(1000)
    # attach rfq count
    for d in docs:
        d["rfq_count"] = await db.rfqs.count_documents({"user_id": d["id"]})
    return docs

@api.get("/admin/customers/{user_id}")
async def admin_get_customer(user_id: str, user=Depends(require_admin)):
    c = await db.users.find_one({"id": user_id, "role": "customer"}, {"_id": 0, "password_hash": 0})
    if not c:
        raise HTTPException(status_code=404, detail="Customer not found")
    c["rfqs"] = await db.rfqs.find({"user_id": user_id}, {"_id": 0}).sort("created_at", -1).to_list(200)
    return c

@api.patch("/admin/customers/{user_id}")
async def admin_update_customer(user_id: str, payload: dict, user=Depends(require_admin_or_super)):
    payload.pop("password_hash", None); payload.pop("role", None); payload.pop("id", None); payload.pop("_id", None)
    r = await db.users.update_one({"id": user_id, "role": "customer"}, {"$set": payload})
    if r.matched_count == 0:
        raise HTTPException(status_code=404, detail="Not found")
    await audit_log(user, "customer.update", "user", user_id, {"fields": list(payload.keys())})
    return await db.users.find_one({"id": user_id}, {"_id": 0, "password_hash": 0})

# ---------- Staff Management (Super Admin) ----------
class StaffCreate(BaseModel):
    email: EmailStr
    password: str = Field(min_length=6)
    full_name: str
    role: Literal["super_admin", "admin", "sales_executive"]
    phone: Optional[str] = None

@api.get("/admin/staff")
async def admin_list_staff(user=Depends(require_admin_or_super)):
    return await db.users.find(
        {"role": {"$in": ["super_admin", "admin", "sales_executive"]}},
        {"_id": 0, "password_hash": 0},
    ).sort("created_at", -1).to_list(500)

@api.post("/admin/staff")
async def admin_create_staff(payload: StaffCreate, user=Depends(require_super_admin)):
    if await db.users.find_one({"email": payload.email.lower()}):
        raise HTTPException(status_code=400, detail="Email already exists")
    doc = {
        "id": str(uuid.uuid4()),
        "email": payload.email.lower(),
        "full_name": payload.full_name,
        "role": payload.role,
        "phone": payload.phone,
        "status": "active",
        "password_hash": hash_pw(payload.password),
        "created_at": now_utc(),
    }
    await db.users.insert_one(doc)
    await audit_log(user, "staff.create", "user", doc["id"], {"role": payload.role, "email": payload.email})
    return {k: v for k, v in doc.items() if k not in ("_id", "password_hash")}

@api.patch("/admin/staff/{staff_id}")
async def admin_update_staff(staff_id: str, payload: dict, user=Depends(require_super_admin)):
    payload.pop("password_hash", None); payload.pop("id", None); payload.pop("_id", None)
    if "password" in payload:
        payload["password_hash"] = hash_pw(payload.pop("password"))
    r = await db.users.update_one({"id": staff_id}, {"$set": payload})
    if r.matched_count == 0:
        raise HTTPException(status_code=404, detail="Not found")
    await audit_log(user, "staff.update", "user", staff_id)
    return await db.users.find_one({"id": staff_id}, {"_id": 0, "password_hash": 0})

@api.delete("/admin/staff/{staff_id}")
async def admin_delete_staff(staff_id: str, user=Depends(require_super_admin)):
    if staff_id == user["id"]:
        raise HTTPException(status_code=400, detail="Cannot delete yourself")
    r = await db.users.delete_one({"id": staff_id, "role": {"$in": ["admin", "sales_executive", "super_admin"]}})
    if r.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Not found")
    await audit_log(user, "staff.delete", "user", staff_id)
    return {"status": "deleted"}

# ---------- Enhanced RFQ ----------
class RFQAdminUpdate(BaseModel):
    status: Optional[Literal["submitted", "under_review", "engineering_review", "quoted", "closed"]] = None
    admin_notes: Optional[str] = None
    assigned_to: Optional[str] = None  # user_id of staff
    priority: Optional[Literal["low", "normal", "high", "urgent"]] = None
    quotation_url: Optional[str] = None
    quotation_amount: Optional[float] = None
    quotation_currency: Optional[str] = None

@api.patch("/admin/rfq/{rfq_id}")
async def admin_update_rfq_full(rfq_id: str, payload: RFQAdminUpdate, user=Depends(require_admin)):
    upd = {k: v for k, v in payload.model_dump().items() if v is not None}
    if not upd:
        raise HTTPException(status_code=400, detail="No fields provided")
    upd["updated_at"] = now_utc()
    r = await db.rfqs.update_one({"id": rfq_id}, {"$set": upd})
    if r.matched_count == 0:
        raise HTTPException(status_code=404, detail="Not found")
    await audit_log(user, "rfq.update", "rfq", rfq_id, {"fields": list(upd.keys())})
    return await db.rfqs.find_one({"id": rfq_id}, {"_id": 0})

@api.get("/admin/rfq/export")
async def admin_export_rfqs(user=Depends(require_admin)):
    from starlette.responses import StreamingResponse as _SR
    docs = await db.rfqs.find({}, {"_id": 0}).sort("created_at", -1).to_list(5000)
    buf = io.StringIO()
    w = csv.writer(buf)
    w.writerow(["ref_no", "company", "contact", "email", "phone", "status", "priority", "assigned_to", "items_count", "created_at"])
    for r in docs:
        w.writerow([
            r.get("ref_no"), r.get("company_name"), r.get("contact_person"), r.get("email"), r.get("phone"),
            r.get("status"), r.get("priority", ""), r.get("assigned_to", ""), len(r.get("items", [])),
            r.get("created_at", "").isoformat() if hasattr(r.get("created_at", ""), "isoformat") else str(r.get("created_at", "")),
        ])
    buf.seek(0)
    return _SR(iter([buf.getvalue()]), media_type="text/csv", headers={"Content-Disposition": "attachment; filename=rfqs.csv"})

# ---------- Inquiries ----------
class InquiryCreate(BaseModel):
    name: str
    email: EmailStr
    phone: Optional[str] = None
    company: Optional[str] = None
    subject: Optional[str] = None
    message: str
    source: Optional[str] = "app"

class Inquiry(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    ref_no: str
    name: str
    email: EmailStr
    phone: Optional[str] = None
    company: Optional[str] = None
    subject: Optional[str] = None
    message: str
    source: Optional[str] = "app"
    status: Literal["new", "in_progress", "resolved", "closed"] = "new"
    priority: Literal["low", "normal", "high"] = "normal"
    assigned_to: Optional[str] = None
    history: List[dict] = []
    created_at: datetime = Field(default_factory=now_utc)
    updated_at: datetime = Field(default_factory=now_utc)

@api.post("/inquiry", response_model=Inquiry)
async def create_inquiry(payload: InquiryCreate):
    count = await db.inquiries.count_documents({}) + 1
    ref = f"INQ-{datetime.now(timezone.utc).year}-{count:05d}"
    ing = Inquiry(ref_no=ref, **payload.model_dump())
    await db.inquiries.insert_one(ing.model_dump())
    return ing

@api.get("/admin/inquiries")
async def admin_list_inquiries(user=Depends(require_admin), status_filter: Optional[str] = Query(None, alias="status")):
    q = {}
    if status_filter: q["status"] = status_filter
    return await db.inquiries.find(q, {"_id": 0}).sort("created_at", -1).to_list(500)

@api.patch("/admin/inquiries/{inq_id}")
async def admin_update_inquiry(inq_id: str, payload: dict, user=Depends(require_admin)):
    payload.pop("id", None); payload.pop("_id", None)
    payload["updated_at"] = now_utc()
    r = await db.inquiries.update_one({"id": inq_id}, {"$set": payload, "$push": {"history": {"at": now_utc(), "by": user.get("email"), "note": payload.get("admin_note") or "updated"}}})
    if r.matched_count == 0:
        raise HTTPException(status_code=404, detail="Not found")
    await audit_log(user, "inquiry.update", "inquiry", inq_id)
    return await db.inquiries.find_one({"id": inq_id}, {"_id": 0})

# ---------- AI Knowledge Documents ----------
class AIDocCreate(BaseModel):
    title: str
    description: Optional[str] = None
    doc_type: Literal["catalogue", "brochure", "spec_sheet", "certificate", "policy", "other"] = "other"
    url: Optional[str] = None       # external URL
    content: Optional[str] = None   # plain-text content used as AI grounding
    tags: List[str] = []
    enabled: bool = True

@api.get("/admin/ai/docs")
async def admin_list_ai_docs(user=Depends(require_admin)):
    return await db.ai_docs.find({}, {"_id": 0, "content": 0}).sort("created_at", -1).to_list(200)

@api.post("/admin/ai/docs")
async def admin_create_ai_doc(payload: AIDocCreate, user=Depends(require_admin_or_super)):
    doc = payload.model_dump()
    doc["id"] = str(uuid.uuid4())
    doc["created_at"] = now_utc()
    doc["uploaded_by"] = user.get("email")
    await db.ai_docs.insert_one(doc)
    await audit_log(user, "ai_doc.create", "ai_doc", doc["id"], {"title": doc["title"]})
    return {k: v for k, v in doc.items() if k != "_id"}

@api.delete("/admin/ai/docs/{doc_id}")
async def admin_delete_ai_doc(doc_id: str, user=Depends(require_admin_or_super)):
    r = await db.ai_docs.delete_one({"id": doc_id})
    if r.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Not found")
    await audit_log(user, "ai_doc.delete", "ai_doc", doc_id)
    return {"status": "deleted"}

# ---------- Audit Logs ----------
@api.get("/admin/audit-logs")
async def admin_audit_logs(user=Depends(require_admin_or_super), entity: Optional[str] = None, limit: int = 200):
    q = {}
    if entity: q["entity"] = entity
    return await db.audit_logs.find(q, {"_id": 0}).sort("timestamp", -1).to_list(min(limit, 1000))

# ---------- Bulk CSV Import (products) ----------
class BulkProductImport(BaseModel):
    csv_text: str

@api.post("/admin/products/import-csv")
async def admin_import_csv(payload: BulkProductImport, user=Depends(require_admin_or_super)):
    reader = csv.DictReader(io.StringIO(payload.csv_text))
    imported, skipped = 0, 0
    errors = []
    base_count = await db.products.count_documents({})
    for i, row in enumerate(reader, start=1):
        try:
            if not row.get("name") or not row.get("category"):
                skipped += 1; errors.append(f"Row {i}: name/category required"); continue
            base_count += 1
            doc = {
                "id": str(uuid.uuid4()),
                "ref_no": row.get("sku") or f"TC-{base_count:05d}",
                "name": row["name"].strip(),
                "category": row["category"].strip(),
                "subcategory": (row.get("subcategory") or "").strip() or None,
                "description": row.get("description") or None,
                "short_description": row.get("short_description") or None,
                "materials": row.get("materials") or None,
                "grade": row.get("grade") or None,
                "standards": row.get("standards") or None,
                "weight": row.get("weight") or None,
                "size": row.get("size") or None,
                "image_url": row.get("image_url") or None,
                "featured": (row.get("featured", "").lower() in ("1", "true", "yes")),
                "enabled": True,
                "created_at": now_utc(),
                "updated_at": now_utc(),
            }
            await db.products.insert_one(doc)
            imported += 1
        except Exception as e:
            skipped += 1
            errors.append(f"Row {i}: {e}")
    await audit_log(user, "product.bulk_import", "product", None, {"imported": imported, "skipped": skipped})
    return {"imported": imported, "skipped": skipped, "errors": errors[:20]}

@api.get("/admin/products/export-csv")
async def admin_export_products_csv(user=Depends(require_admin)):
    from starlette.responses import StreamingResponse as _SR
    docs = await db.products.find({}, {"_id": 0}).to_list(5000)
    buf = io.StringIO()
    fields = ["ref_no", "name", "category", "subcategory", "grade", "materials", "standards", "weight", "size", "featured", "enabled"]
    w = csv.DictWriter(buf, fieldnames=fields, extrasaction="ignore")
    w.writeheader()
    for d in docs:
        w.writerow(d)
    buf.seek(0)
    return _SR(iter([buf.getvalue()]), media_type="text/csv", headers={"Content-Disposition": "attachment; filename=products.csv"})

# ---------- AI grounding — include uploaded AI docs ----------
async def get_extra_ai_knowledge() -> str:
    docs = await db.ai_docs.find({"enabled": True}, {"_id": 0, "title": 1, "content": 1, "doc_type": 1}).sort("created_at", -1).to_list(30)
    if not docs:
        return ""
    parts = ["\n\n---- ADDITIONAL APPROVED KNOWLEDGE DOCUMENTS ----"]
    for d in docs:
        if d.get("content"):
            parts.append(f"\n[{d['doc_type'].upper()}] {d['title']}\n{d['content'][:3000]}")
    return "\n".join(parts)

# ---------- File Upload endpoints (require_admin_or_super now defined) ----------
@api.post("/admin/upload")
async def upload_file(
    file: UploadFile = File(...),
    kind: str = Form("image"),
    title: str = Form(""),
    save_to_library: str = Form("false"),
    user=Depends(require_admin_or_super),
):
    content_type = (file.content_type or "").lower()
    if content_type not in ALLOWED_MIME:
        raise HTTPException(status_code=400, detail=f"Unsupported file type: {content_type}")
    data = await file.read()
    is_video = content_type.startswith("video/")
    max_bytes = MAX_VIDEO_BYTES if is_video else MAX_IMAGE_BYTES
    if len(data) > max_bytes:
        raise HTTPException(status_code=413, detail=f"File too large (max {max_bytes // (1024*1024)} MB)")
    if len(data) == 0:
        raise HTTPException(status_code=400, detail="Empty file")
    ext = mimetypes.guess_extension(content_type) or ".bin"
    if ext == ".jpe":
        ext = ".jpg"
    file_id = str(uuid.uuid4())
    filename = f"{file_id}{ext}"
    fpath = UPLOAD_DIR / filename
    fpath.write_bytes(data)
    checksum = hashlib.sha256(data).hexdigest()
    doc = {
        "id": file_id, "filename": filename, "original_name": file.filename,
        "content_type": content_type, "size": len(data), "checksum": checksum,
        "kind": kind, "uploaded_by": user.get("email"), "created_at": now_utc(),
    }
    await db.uploads.insert_one(doc)
    await audit_log(user, "upload.create", "upload", file_id, {"name": file.filename, "size": len(data)})
    url = f"/api/files/{filename}"

    # Also index into media library if requested (so it appears in admin Media screen)
    media_id = None
    if save_to_library.lower() in ("1", "true", "yes"):
        mtype = "image" if content_type.startswith("image/") else "video" if content_type.startswith("video/") else "pdf"
        media = MediaAsset(
            title=title or (file.filename or filename),
            media_type=mtype,
            category="Uploads",
            url=url,
            thumbnail_url=url if mtype == "image" else None,
            tags=[],
        )
        m_doc = media.model_dump()
        m_doc["upload_id"] = file_id
        await db.media.insert_one(m_doc)
        media_id = media.id
        await audit_log(user, "media.create", "media", media.id, {"via": "upload"})

    return {"id": file_id, "url": url, "content_type": content_type, "size": len(data), "media_id": media_id}


@api.delete("/admin/upload/{file_id}")
async def delete_upload(file_id: str, user=Depends(require_admin_or_super)):
    doc = await db.uploads.find_one({"id": file_id})
    if not doc:
        raise HTTPException(status_code=404, detail="Not found")
    fp = UPLOAD_DIR / doc["filename"]
    if fp.exists():
        fp.unlink()
    await db.uploads.delete_one({"id": file_id})
    # Cascade: also remove media library entries that reference this upload
    await db.media.delete_many({"upload_id": file_id})
    await audit_log(user, "upload.delete", "upload", file_id)
    return {"status": "deleted"}


class MediaReplacePayload(BaseModel):
    url: str
    thumbnail_url: Optional[str] = None
    upload_id: Optional[str] = None


@api.post("/admin/media/{media_id}/replace")
async def admin_media_replace(media_id: str, payload: MediaReplacePayload, user=Depends(require_admin_or_super)):
    existing = await db.media.find_one({"id": media_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Not found")
    # Delete old physical file if it was a previous upload
    prev_upload_id = existing.get("upload_id")
    if prev_upload_id and prev_upload_id != payload.upload_id:
        prev = await db.uploads.find_one({"id": prev_upload_id})
        if prev:
            fp = UPLOAD_DIR / prev["filename"]
            if fp.exists():
                fp.unlink()
            await db.uploads.delete_one({"id": prev_upload_id})
    upd = {"url": payload.url, "updated_at": now_utc()}
    if payload.thumbnail_url is not None:
        upd["thumbnail_url"] = payload.thumbnail_url
    if payload.upload_id is not None:
        upd["upload_id"] = payload.upload_id
    await db.media.update_one({"id": media_id}, {"$set": upd})
    await audit_log(user, "media.replace", "media", media_id)
    return await db.media.find_one({"id": media_id}, {"_id": 0})


# ============================================================
# END PHASE 2
# ============================================================


COMPANY_PROFILE = {
    "key": "profile",
    "name": "Thermal Casting LLP",
    "tagline": "Precision Alloy Steel Castings for Heavy Engineering",
    "about": "Thermal Casting LLP is a Sharda Alloys Group (SAPL Steel LLP) venture — an established player in Alloy Steel Casting (formerly M/s Reclamation Welding Ltd., now merged into AIA Engineering Ltd). The group leverages its core foundry strength to produce castings of Alloy Cast Steel, Cast Iron, S.G. Iron, Copper Alloy, Nickel Alloy and Stainless Steel grades — supplied to OEMs across Valves, Steel Mill Rolls, Pumps, Mining, Aluminium Smelting, Oil & Gas, General Engineering and Steel Plants.",
    "history": [
        {"year": 1975, "event": "Laxmi Foundry established (CI Grinding Media)"},
        {"year": 1985, "event": "Reclamation Welding Ltd. — HRCS Castings, Liners, Steel Mill Parts"},
        {"year": 2005, "event": "Merger with AIA Engineering — High Chrome Grinding Media"},
        {"year": 2013, "event": "SAPL Steel LLP — Castings Foundry, Boiler & Heat Exchanger Fabrication"},
        {"year": 2019, "event": "Thermal Casting LLP — Enhanced capacity for Valve, Pump, Mining & General Engineering"},
    ],
    "certifications": [
        "ISO 9001:2015 Certified Quality Management",
        "Well Known Foundry under Indian Boiler Regulations 1950 (Cert No. 543, valid until 17 April 2030)",
        "BHEL Approved Vendor — Bhopal & Varanasi Units",
    ],
    "facilities": {
        "foundry_area": "7,000 sq.m — induction melting + No Bake Sand Moulding + continuous sand mixer",
        "fabrication_shop": "2,000 sq.m fabrication capacity",
        "single_piece_capacity": "Up to 8 MT single-piece castings",
        "melting_furnaces": ["2 × 2.5 MT Induction", "1 × 5.0 MT Induction", "1 × 250 KG Induction"],
        "cranes": ["4 × 15 T Overhead", "2 × 10 T Overhead", "2 × 5.0 T Overhead"],
        "heat_treatment": "2 Heat Treatment Furnaces with Quenching Tank",
    },
    "capabilities": [
        "Alloy Steel & Stainless Steel Castings",
        "Cast Iron & S.G. Iron",
        "Copper Alloy & Nickel Alloy",
        "In-house Pattern Making & Storage",
        "Hitachi Mold-Flow Simulation",
        "Machining, Heat Treatment, Shot Blasting",
        "NDT: UT, MPI, DP; Spectrometer; Tensile Testing (60 T)",
    ],
    "industries": ["Valves", "Steel Mill Rolls", "Pumps", "Mining", "Aluminium Smelting", "Oil & Gas", "General Engineering", "Steel Plants"],
    "contact": {
        "phone": "+91-9898662888",
        "emails": ["sales@thermalcasting.com", "arun@thermalcasting.com"],
        "website": "www.thermalcasting.com",
        "address": "Plot No. 13-17, Shrey Industrial Park, Dhamatvan-Undrel Road, Village: Dhamatvan, Ahmedabad, Gujarat 382435, INDIA",
    },
    "hero_image": "https://images.pexels.com/photos/6804260/pexels-photo-6804260.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940",
}

PRODUCT_SEED = [
    # Valve Castings
    {"name": "Gate Valve Body Casting", "category": "Valve Castings", "description": "Precision cast valve body for gate valve applications; ANSI/API standards.", "materials": "WCB, WC6, WC9, CF8, CF8M", "applications": "Oil & Gas, Refineries, Power", "standards": "ASTM A216, A217, A351", "featured": True, "image_url": "https://images.unsplash.com/photo-1766325693346-6279a63b1fba?w=800&q=80"},
    {"name": "Globe Valve Body", "category": "Valve Castings", "description": "Globe valve cast body with precision throat and seat pocket.", "materials": "WCB, LCC, CF8M", "applications": "Steam service, HP process lines", "standards": "ASTM A216"},
    {"name": "Check Valve Body", "category": "Valve Castings", "description": "Swing check valve casting.", "materials": "WCB, WC6", "standards": "ASTM A216"},
    {"name": "Ball Valve Body 2-Piece", "category": "Valve Castings", "description": "Two-piece ball valve casting.", "materials": "WCB, CF8M"},
    {"name": "Butterfly Valve Body", "category": "Valve Castings", "description": "Wafer-style butterfly valve casting."},
    # Complete Valves
    {"name": "Complete Gate Valve 6\" 150#", "category": "Complete Valves", "description": "OS&Y bolted bonnet gate valve, fully assembled with trim.", "specs": {"size": "6 inch", "rating": "150#", "end": "RF Flanged"}, "featured": True, "image_url": "https://images.unsplash.com/photo-1581092160562-40aa08e78837?w=800&q=80"},
    {"name": "Complete Globe Valve 4\" 300#", "category": "Complete Valves", "specs": {"size": "4 inch", "rating": "300#"}},
    # Pump Castings
    {"name": "Pump Casing (Volute)", "category": "Pump Castings", "description": "Single-stage centrifugal pump volute casting.", "materials": "WCB, CF8M, Duplex", "featured": True},
    {"name": "Pump Impeller Casting", "category": "Pump Castings", "materials": "CF8M, CD4MCu"},
    {"name": "Pump Suction Cover", "category": "Pump Castings"},
    # Mining
    {"name": "Cone Crusher Bowl Liner", "category": "Mining & Crushing", "description": "Manganese steel mining cone crusher liner.", "materials": "Mn Steel Gr.3", "image_url": "https://images.unsplash.com/photo-1581093588401-fbb62a02f120?w=800&q=80"},
    {"name": "Jaw Crusher Fixed Jaw", "category": "Mining & Crushing", "materials": "Mn Steel Gr.3 / Gr.7"},
    {"name": "Jaw Crusher Swing Jaw", "category": "Mining & Crushing", "materials": "Mn Steel Gr.3"},
    {"name": "Blow Bar (Impact Crusher)", "category": "Mining & Crushing", "description": "High-chrome / manganese blow bar.", "materials": "Mn Steel / High Cr"},
    {"name": "Crusher Side Liner (HRCS)", "category": "Mining & Crushing", "materials": "HRCS"},
    {"name": "Mn Steel Plate (Gr.7)", "category": "Mining & Crushing", "materials": "Manganese Steel Gr.7"},
    {"name": "Sole Plate (G20Mn5)", "category": "Mining & Crushing", "materials": "G20Mn5"},
    # Aluminium Smelting
    {"name": "Sow Mould", "category": "Aluminium Smelting", "description": "Sow mould with stringent surface finish for aluminium cast house. 3rd party inspection (SGS) available.", "materials": "WC6, WCB, WC9, S.G. Iron", "applications": "Aluminium primary smelters", "featured": True, "image_url": "https://images.pexels.com/photos/6804260/pexels-photo-6804260.jpeg?w=800"},
    {"name": "Ingot Mould", "category": "Aluminium Smelting", "materials": "S.G. Iron, WCB"},
    {"name": "Dross Drain Pan", "category": "Aluminium Smelting"},
    {"name": "Pouring Spout", "category": "Aluminium Smelting"},
    {"name": "Anode Yoke Bracket", "category": "Aluminium Smelting"},
    {"name": "Furnace Door Casting", "category": "Aluminium Smelting"},
    {"name": "Sow Hook", "category": "Aluminium Smelting"},
    # Steel Mill Rolls
    {"name": "920 DIA Roller Casting", "category": "Steel Mill Rolls", "description": "Heavy roller casting.", "specs": {"diameter": "920 mm", "width": "420 mm", "weight": "1580 kg"}, "featured": True},
    {"name": "Split Girth Gear", "category": "Steel Mill Rolls", "specs": {"diameter": "4680 mm", "width": "330 mm", "inner_diameter": "3400 mm", "weight": "7040 kg"}},
    {"name": "Tyre Ring Casting", "category": "Steel Mill Rolls", "specs": {"diameter": "3815 mm", "width": "325 mm", "inner_diameter": "3460 mm", "weight": "5570 kg"}},
    {"name": "Manganese Roll Shell 800×800", "category": "Steel Mill Rolls", "specs": {"dimensions": "800 × 800 mm", "weight": "1300 kg"}, "materials": "Mn Steel Gr.3"},
    # Bowl Mill (Power)
    {"name": "Bowl Mill — Worm Gear Hub HY-193", "category": "Bowl Mill Components", "specs": {"weight": "2000 kg"}},
    {"name": "Bowl Mill — Bowl HY-192.M", "category": "Bowl Mill Components", "specs": {"weight": "2915 kg"}},
    {"name": "Bowl Mill — Lower Journal Housing", "category": "Bowl Mill Components", "specs": {"weight": "2850 kg"}},
    {"name": "Bowl Mill — Bowl Hub HY-269", "category": "Bowl Mill Components", "specs": {"weight": "2800 kg"}},
    {"name": "Bowl Mill — Gear Housing HY-216.M", "category": "Bowl Mill Components", "specs": {"weight": "2150 kg"}},
    # General Engineering
    {"name": "Sprocket Casting (WCB)", "category": "General Engineering", "specs": {"weight": "275 kg"}, "materials": "WCB"},
    {"name": "Rope Drum (WCB)", "category": "General Engineering", "specs": {"weight": "4000 kg"}, "materials": "WCB"},
    # IMM
    {"name": "Injection Moulding Machine — Moveable Platen", "category": "Injection Moulding", "description": "Large platen casting for plastic IMM. Made to Indian & overseas standards."},
    {"name": "Injection Moulding Machine — Stationary Platen", "category": "Injection Moulding"},
    # Special
    {"name": "Shree Yantra Casting (Panchdhatu)", "category": "Special Casting", "description": "Panchdhatu (Copper, Brass, Iron, Gold, Silver) Shree Yantra installed at Ambaji Mata Temple, Gujarat.", "specs": {"width": "4.5 ft", "height": "4.5 ft", "weight": "2200 kg"}, "materials": "Panchdhatu"},
    {"name": "Brass Temple Bell", "category": "Special Casting", "specs": {"weight": "4900 kg"}, "materials": "Brass"},
    {"name": "Copper Block", "category": "Special Casting", "specs": {"length": "1550 mm", "width": "475 mm", "height": "350 mm", "weight": "2300 kg"}, "materials": "Copper"},
]

MEDIA_SEED = [
    # Hero images
    {"title": "Molten Metal Pour — Foundry Floor", "media_type": "image", "category": "Facility", "url": "https://images.pexels.com/photos/6804260/pexels-photo-6804260.jpeg?w=1200", "thumbnail_url": "https://images.pexels.com/photos/6804260/pexels-photo-6804260.jpeg?w=400", "featured": True, "tags": ["foundry", "molten", "casting"]},
    {"title": "Industrial Plant Exterior", "media_type": "image", "category": "Facility", "url": "https://images.unsplash.com/photo-1566226196556-ef949ce5f1a3?w=1200&q=80", "thumbnail_url": "https://images.unsplash.com/photo-1566226196556-ef949ce5f1a3?w=400&q=80", "featured": True, "tags": ["plant"]},
    {"title": "Precision Valve Assembly", "media_type": "image", "category": "Products", "url": "https://images.unsplash.com/photo-1766325693346-6279a63b1fba?w=1200&q=80", "thumbnail_url": "https://images.unsplash.com/photo-1766325693346-6279a63b1fba?w=400&q=80", "tags": ["valve"]},
    {"title": "Foundry Sand Moulding Line", "media_type": "image", "category": "Facility", "url": "https://images.unsplash.com/photo-1581093588401-fbb62a02f120?w=1200&q=80", "thumbnail_url": "https://images.unsplash.com/photo-1581093588401-fbb62a02f120?w=400&q=80", "tags": ["moulding"]},
    # Videos (public sample streams)
    {"title": "Foundry Operations — Overview", "media_type": "video", "category": "Corporate", "url": "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4", "thumbnail_url": "https://images.pexels.com/photos/6804260/pexels-photo-6804260.jpeg?w=600", "featured": True, "tags": ["foundry", "overview"], "description": "Walk-through of induction melting, moulding, pouring and finishing."},
    {"title": "Valve Manufacturing Process", "media_type": "video", "category": "Products", "url": "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4", "thumbnail_url": "https://images.unsplash.com/photo-1766325693346-6279a63b1fba?w=600&q=80", "tags": ["valve", "manufacturing"], "description": "End-to-end valve body casting and assembly."},
    {"title": "Aluminium Sow Mould Production", "media_type": "video", "category": "Products", "url": "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4", "thumbnail_url": "https://images.pexels.com/photos/6804260/pexels-photo-6804260.jpeg?w=600", "tags": ["aluminium", "smelting"], "description": "Casting of sow moulds for aluminium primary smelters."},
    # Brochures / Certificates
    {"title": "Thermal Casting — Engineering Product Catalogue 2026", "media_type": "brochure", "category": "Brochures", "url": "https://customer-assets-jai6qajn.emergentagent.net/job_9ffe69ed-864c-4c61-9f7e-e7e81c1a9448/artifacts/osm01zbh_THERMAL%20-%20COMPANY%20PROFILE-%20ENGINEERING-2026.pdf", "tags": ["catalogue", "2026"], "featured": True},
    {"title": "Valve Product Catalogue 2026", "media_type": "brochure", "category": "Brochures", "url": "https://customer-assets-jai6qajn.emergentagent.net/job_9ffe69ed-864c-4c61-9f7e-e7e81c1a9448/artifacts/0o929mca_THERMAL%20CASTING%20LLP_COMPANY%20PROFILE%20WITH%20VALVE%20PRODUCT%202026.pdf", "tags": ["valve", "catalogue"]},
    {"title": "Aluminium Smelting Profile 2026", "media_type": "brochure", "category": "Brochures", "url": "https://customer-assets-jai6qajn.emergentagent.net/job_9ffe69ed-864c-4c61-9f7e-e7e81c1a9448/artifacts/ce12cqzt_THERMAL%20CASTING%20LLP%20ALLUMINIUM%20SMELTING%20PROFILE%20-2026.pdf", "tags": ["aluminium"]},
    {"title": "ISO 9001:2015 Certificate", "media_type": "certificate", "category": "Certifications", "url": "https://customer-assets-jai6qajn.emergentagent.net/job_9ffe69ed-864c-4c61-9f7e-e7e81c1a9448/artifacts/osm01zbh_THERMAL%20-%20COMPANY%20PROFILE-%20ENGINEERING-2026.pdf", "tags": ["ISO", "quality"]},
    {"title": "Well Known Foundry — IBR 1950 Certificate", "media_type": "certificate", "category": "Certifications", "url": "https://customer-assets-jai6qajn.emergentagent.net/job_9ffe69ed-864c-4c61-9f7e-e7e81c1a9448/artifacts/osm01zbh_THERMAL%20-%20COMPANY%20PROFILE-%20ENGINEERING-2026.pdf", "tags": ["IBR"]},
]

async def seed_data():
    # Company
    await db.company.update_one({"key": "profile"}, {"$set": COMPANY_PROFILE}, upsert=True)

    # Primary Administrator — seeded ONCE, never overwrites existing password
    admin_email = os.environ.get("ADMIN_EMAIL", "abhisheksharma@thermalcasting.com").lower()
    admin_pw = os.environ.get("ADMIN_INITIAL_PASSWORD")
    if not admin_pw:
        logger.warning("ADMIN_INITIAL_PASSWORD not set — skipping primary administrator seed. Set it in the environment to enable initial admin provisioning.")
    elif not await db.users.find_one({"email": admin_email}):
        await db.users.insert_one({
            "id": str(uuid.uuid4()),
            "email": admin_email,
            "full_name": "Abhishek Sharma",
            "company": "Thermal Casting LLP",
            "phone": "+91-9898662888",
            "role": "admin",
            "status": "active",
            "password_hash": hash_pw(admin_pw),
            "created_at": now_utc(),
        })
        logger.info(f"Seeded primary administrator: {admin_email}")

    cust_email = "customer@example.com"
    if os.environ.get("SEED_DEMO_CUSTOMER", "false").lower() == "true" and not await db.users.find_one({"email": cust_email}):
        await db.users.insert_one({
            "id": str(uuid.uuid4()),
            "email": cust_email,
            "full_name": "Demo Customer",
            "company": "Demo Industries Pvt Ltd",
            "phone": "+91-9000000000",
            "role": "customer",
            "status": "active",
            "password_hash": hash_pw("Customer@123"),
            "created_at": now_utc(),
        })
        logger.info("Seeded demo customer")

    # Products — seed only if empty
    if await db.products.count_documents({}) == 0:
        for i, p in enumerate(PRODUCT_SEED, start=1):
            doc = Product(ref_no=f"TC-{i:05d}", **p).model_dump()
            await db.products.insert_one(doc)
        logger.info(f"Seeded {len(PRODUCT_SEED)} products")

    # Media
    if await db.media.count_documents({}) == 0:
        for m in MEDIA_SEED:
            doc = MediaAsset(**m).model_dump()
            await db.media.insert_one(doc)
        logger.info(f"Seeded {len(MEDIA_SEED)} media assets")

    # Materials (seed core valve/casting grades)
    if await db.materials.count_documents({}) == 0:
        MAT_SEED = [
            ("WCB", "Carbon Steel", "ASTM A216 WCB — general-service carbon steel castings"),
            ("LCC", "Low-Temp Carbon Steel", "ASTM A352 LCC — low-temperature service"),
            ("LCB", "Low-Temp Carbon Steel", "ASTM A352 LCB"),
            ("WC6", "Alloy Steel", "1¼Cr-½Mo — high temperature service"),
            ("WC9", "Alloy Steel", "2¼Cr-1Mo — high temperature / hydrogen service"),
            ("CF8", "Stainless Steel", "ASTM A351 CF8 (304 equivalent)"),
            ("CF8M", "Stainless Steel", "ASTM A351 CF8M (316 equivalent)"),
            ("CF3", "Stainless Steel", "Low-carbon 304L equivalent"),
            ("CF3M", "Stainless Steel", "Low-carbon 316L equivalent"),
            ("Duplex", "Duplex Stainless", "Duplex stainless steel"),
            ("Super Duplex", "Super Duplex", "Super duplex stainless (e.g. CD3MWCuN)"),
            ("Monel", "Nickel Alloy", "Nickel-copper alloy"),
            ("Bronze", "Copper Alloy", "Tin bronze casting"),
            ("SG Iron", "Ductile Iron", "Spheroidal graphite iron"),
            ("Cast Iron", "Cast Iron", "Grey cast iron"),
            ("Mn Steel Gr.3", "Manganese Steel", "Wear-resistant Manganese Steel Grade 3"),
        ]
        for name, cat, desc in MAT_SEED:
            m = Material(name=name, grade_code=name, category=cat, description=desc, standards="ASTM").model_dump()
            await db.materials.insert_one(m)
        logger.info(f"Seeded {len(MAT_SEED)} materials")

    # Categories
    if await db.categories.count_documents({}) == 0:
        CAT_SEED = ["Valve Castings", "Complete Valves", "Pump Castings", "Mining & Crushing", "Aluminium Smelting", "Steel Mill Rolls", "Bowl Mill Components", "General Engineering", "Injection Moulding", "Special Casting"]
        for i, n in enumerate(CAT_SEED):
            await db.categories.insert_one(Category(name=n, display_order=i * 10).model_dump())
        logger.info(f"Seeded {len(CAT_SEED)} categories")

# ============================================================
# STARTUP / SHUTDOWN
# ============================================================
@api.get("/")
async def root():
    return {"service": "Thermal Casting LLP API", "version": "1.0.0", "status": "ok"}

@api.get("/health")
async def health():
    return {"status": "healthy", "time": now_utc().isoformat()}

app.include_router(api)

# Serve uploaded files at /api/files/<filename>
UPLOADS_MOUNT = ROOT_DIR / "uploads"
UPLOADS_MOUNT.mkdir(exist_ok=True)
app.mount("/api/files", StaticFiles(directory=str(UPLOADS_MOUNT)), name="uploads")

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
async def on_startup():
    try:
        await seed_data()
    except Exception:
        logger.exception("Seed failed")

@app.on_event("shutdown")
async def on_shutdown():
    client.close()
