from fastapi import FastAPI, Depends, HTTPException, UploadFile, File, Form, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import Column, String, Integer, Date, DateTime, Text, ForeignKey, UniqueConstraint, text, LargeBinary
from sqlalchemy.orm import Session
try:
    from sqlalchemy.dialects.mysql import LONGBLOB as MYSQL_LONGBLOB
except Exception:  # pragma: no cover
    MYSQL_LONGBLOB = None
from datetime import datetime, date
from pydantic import BaseModel
from fastapi.responses import StreamingResponse, Response
from io import BytesIO
from typing import Optional, List
from .database import Base, SessionLocal, engine
import uuid
import random
import string
import traceback
import os
import hashlib
import secrets
import time

# Use LONGBLOB on MySQL to avoid 64KB BLOB truncation for PDFs/images.
_DB_KIND = engine.dialect.name
BinaryBlob = MYSQL_LONGBLOB if (_DB_KIND == "mysql" and MYSQL_LONGBLOB is not None) else LargeBinary

# ================= HELPER =================
def generate_project_code(db: Session):
    while True:
        code = ''.join(random.choices(string.ascii_uppercase + string.digits, k=4))
        existing = db.query(Project).filter(Project.project_code == code).first()
        if not existing:
            return code

# ================= MODEL =================
class MaterialTest(Base):
    __tablename__ = "material_tests"
    __table_args__ = (
        # Prevent duplicates (same test under the same material).
        UniqueConstraint("material_name", "test_name", name="uq_material_test"),
    )

    id = Column(String(100), primary_key=True, default=lambda: str(uuid.uuid4()))
    # Match the PDF style: I, II, III, ...
    material_no = Column(String(10), nullable=True)
    material_name = Column(String(255), nullable=False, index=True)
    # Match the test numbering style within a material: 1, 2, 3, ...
    test_no = Column(Integer, nullable=True)
    # Keep this as VARCHAR (not TEXT) so MySQL can enforce UNIQUE constraints.
    # 255 is also safe for older MySQL index-length limits.
    test_name = Column(String(255), nullable=False)

    created_at = Column(DateTime, default=datetime.utcnow)


class Project(Base):
    __tablename__ = "projects"

    id = Column(String(100), primary_key=True, default=lambda: str(uuid.uuid4()))
    project_code = Column(String(4), unique=True, index=True)

    name = Column(String(255))
    description = Column(String(1000), nullable=True)
    client_name = Column(String(255))
    start_date = Column(Date)
    deadline = Column(Date)

    status = Column(String(50), default="Planning")
    budget = Column(Integer, default=0)
    progress = Column(Integer, default=0)

    created_at = Column(DateTime, default=datetime.utcnow)


class Task(Base):
    __tablename__ = "tasks"
    __table_args__ = (
        # One project cannot select the same material test twice.
        UniqueConstraint("project_id", "material_test_id", name="uq_project_material_test"),
    )

    id = Column(String(100), primary_key=True)
    project_id = Column(
        String(100),
        ForeignKey("projects.id", ondelete="CASCADE")
    )
    material_test_id = Column(
        String(100),
        ForeignKey("material_tests.id", ondelete="RESTRICT"),
        nullable=True,
        index=True,
    )

    title = Column(String(255))
    description = Column(String(1000), nullable=True)   # ✅ BARU
    progress = Column(Integer, default=0)       # ✅ BARU
    deadline = Column(Date, nullable=True)      # ✅ BARU

    status = Column(String(50), default="Pending")
    created_at = Column(DateTime, default=datetime.utcnow)

class ReportFolder(Base):
    __tablename__ = "report_folders"

    id = Column(String(100), primary_key=True, default=lambda: str(uuid.uuid4()))
    name = Column(String(255), nullable=False, index=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class ReportFile(Base):
    __tablename__ = "report_files"

    id = Column(String(100), primary_key=True, default=lambda: str(uuid.uuid4()))
    folder_id = Column(
        String(100),
        ForeignKey("report_folders.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    filename = Column(String(255), nullable=False)
    content_type = Column(String(255), nullable=True)
    size_bytes = Column(Integer, default=0)
    data = Column(BinaryBlob, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

class DocumentFile(Base):
    __tablename__ = "document_files"

    id = Column(String(100), primary_key=True, default=lambda: str(uuid.uuid4()))
    filename = Column(String(255), nullable=False, index=True)
    content_type = Column(String(255), nullable=True)
    size_bytes = Column(Integer, default=0)
    data = Column(BinaryBlob, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

class User(Base):
    __tablename__ = "users"

    id = Column(String(100), primary_key=True, default=lambda: str(uuid.uuid4()))
    username = Column(String(80), unique=True, index=True, nullable=False)
    email_or_phone = Column(String(255), nullable=True)
    status = Column(String(20), default="active")  # active|inactive
    role = Column(String(20), default="admin")     # admin|owner
    last_seen_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

class AuthAccount(Base):
    __tablename__ = "auth_accounts"

    id = Column(String(100), primary_key=True, default=lambda: str(uuid.uuid4()))
    email = Column(String(255), unique=True, index=True, nullable=False)
    password_salt = Column(String(64), nullable=False)
    password_hash = Column(String(128), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

class NotificationSettings(Base):
    __tablename__ = "notification_settings"

    # Singleton row (single tenant)
    id = Column(String(50), primary_key=True, default="singleton")
    email_enabled = Column(Integer, default=0)  # 0/1 (MySQL friendly)
    phone_enabled = Column(Integer, default=0)  # 0/1 (MySQL friendly)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class Notification(Base):
    __tablename__ = "notifications"

    id = Column(String(100), primary_key=True, default=lambda: str(uuid.uuid4()))
    channel = Column(String(20), nullable=False)  # email|phone
    category = Column(String(30), nullable=False)  # project|report|document
    title = Column(String(255), nullable=False)
    body = Column(String(1000), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, index=True)


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(String(100), primary_key=True, default=lambda: str(uuid.uuid4()))
    actor_username = Column(String(80), index=True, nullable=True)
    scope = Column(String(20), index=True, nullable=False)   # report|document
    action = Column(String(20), nullable=False)              # create|update|delete
    entity_type = Column(String(30), nullable=False)         # report_file|document_file|report_folder
    entity_id = Column(String(100), index=True, nullable=False)
    entity_label = Column(String(255), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, index=True)

class CompanySettings(Base):
    __tablename__ = "company_settings"

    # Singleton row (single tenant)
    id = Column(String(50), primary_key=True, default="singleton")

    company_name = Column(String(255), nullable=False, default="PT. Mixindo Abadi Karya")
    address = Column(String(1000), nullable=True)
    whatsapp = Column(String(50), nullable=True)
    email = Column(String(255), nullable=True)
    website = Column(String(255), nullable=True)

    logo_content_type = Column(String(255), nullable=True)
    logo_data = Column(BinaryBlob, nullable=True)

    stamp_content_type = Column(String(255), nullable=True)
    stamp_data = Column(BinaryBlob, nullable=True)

    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


# Table creation is done on startup to avoid crashing during import when the DB is not ready yet
# (common during Railway deploy restarts).

# ================= AUDIT HELPERS =================
def _actor_username(request: Request) -> Optional[str]:
    raw = (request.headers.get("X-Actor-Username") or "").strip()
    return raw or None


def _touch_last_seen(db: Session, username: Optional[str]) -> None:
    if not username:
        return
    u = db.query(User).filter(User.username == username).first()
    if not u:
        return
    u.last_seen_at = datetime.utcnow()


def _log_audit(
    db: Session,
    request: Request,
    *,
    scope: str,
    action: str,
    entity_type: str,
    entity_id: str,
    entity_label: Optional[str] = None,
) -> None:
    actor = _actor_username(request)
    _touch_last_seen(db, actor)
    db.add(
        AuditLog(
            actor_username=actor,
            scope=scope,
            action=action,
            entity_type=entity_type,
            entity_id=entity_id,
            entity_label=(entity_label or None),
        )
    )

def _get_company_settings(db: Session) -> CompanySettings:
    row = db.query(CompanySettings).filter(CompanySettings.id == "singleton").first()
    if row:
        return row
    row = CompanySettings(id="singleton")
    db.add(row)
    # Ensure the row exists in the DB/session before returning so callers can safely
    # access attributes like `logo_data` and also so concurrent requests don't create duplicates.
    db.flush()
    return row

# ================= AUTH HELPERS =================
def _hash_password(password: str, salt_hex: str) -> str:
    dk = hashlib.pbkdf2_hmac(
        "sha256",
        (password or "").encode("utf-8"),
        bytes.fromhex(salt_hex),
        120_000,
    )
    return dk.hex()


def _verify_password(password: str, salt_hex: str, expected_hash_hex: str) -> bool:
    got = _hash_password(password, salt_hex)
    return secrets.compare_digest(got, expected_hash_hex or "")


def _notify(db: Session, *, category: str, title: str, body: Optional[str] = None) -> None:
    settings = db.query(NotificationSettings).filter(NotificationSettings.id == "singleton").first()
    if not settings:
        settings = NotificationSettings(id="singleton", email_enabled=0, phone_enabled=0)
        db.add(settings)
        db.flush()

    if int(settings.email_enabled or 0) == 1:
        db.add(Notification(channel="email", category=category, title=title[:255], body=body))
    if int(settings.phone_enabled or 0) == 1:
        db.add(Notification(channel="phone", category=category, title=title[:255], body=body))
    # Commit is handled by the caller so notifications are stored atomically.
    return None

# ================= APP =================
app = FastAPI()

@app.on_event("startup")
def _startup_create_tables() -> None:
    # Attempt to create tables with a short retry loop, so cold starts don't flake
    # if the MySQL service is still warming up.
    last_error: Optional[Exception] = None
    for _ in range(int(os.getenv("DB_INIT_RETRIES", "20"))):
        try:
            Base.metadata.create_all(bind=engine)
            return
        except Exception as exc:  # pragma: no cover
            last_error = exc
            time.sleep(float(os.getenv("DB_INIT_RETRY_DELAY", "1.0")))
    if last_error is not None:
        raise last_error

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ================= DB =================
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# ================= SCHEMA =================
class ProjectCreate(BaseModel):
    name: str
    description: str
    client_name: str
    start_date: date
    deadline: date
    status: str = "Planning"
    budget: int = 0


class ProjectUpdate(BaseModel):
    name: str
    description: str
    client_name: str
    status: str
    budget: int

class ReportFolderCreate(BaseModel):
    name: str


class ReportFolderUpdate(BaseModel):
    name: str


class RenameFile(BaseModel):
    filename: str


class UserCreate(BaseModel):
    username: str
    email_or_phone: Optional[str] = None
    status: str = "active"
    role: str = "admin"


class UserUpdate(BaseModel):
    email_or_phone: Optional[str] = None
    status: Optional[str] = None
    role: Optional[str] = None


class CompanySettingsUpdate(BaseModel):
    company_name: str
    address: Optional[str] = None
    whatsapp: Optional[str] = None
    email: Optional[str] = None
    website: Optional[str] = None


class AuthRegister(BaseModel):
    email: str
    password: str


class AuthLogin(BaseModel):
    email: str
    password: str


class AuthChangePassword(BaseModel):
    email: str
    old_password: str
    new_password: str


class NotificationSettingsUpdate(BaseModel):
    email_enabled: bool
    phone_enabled: bool


class TaskCreate(BaseModel):
    project_id: str
    # Optional: selected from master "MaterialTest"
    material_test_id: Optional[str] = None
    # Optional: manual task title (when material_test_id is not provided)
    title: Optional[str] = None
    description: Optional[str] = None
    progress: int = 0
    deadline: Optional[date] = None


class TaskUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    progress: int
    deadline: Optional[date] = None
    status: str


class MaterialTestCreate(BaseModel):
    material_no: Optional[str] = None
    material_name: str
    test_no: Optional[int] = None
    test_name: str


class MaterialTestUpdate(BaseModel):
    material_no: Optional[str] = None
    material_name: str
    test_no: Optional[int] = None
    test_name: str


def _task_label(task: Task, material_map: dict) -> str:
    if task.material_test_id and task.material_test_id in material_map:
        return material_map[task.material_test_id].test_name
    return task.title or "-"

# ================= AUTH + NOTIFICATION SETTINGS =================
@app.post("/api/v1/auth/register")
def auth_register(payload: AuthRegister, db: Session = Depends(get_db)):
    email = (payload.email or "").strip().lower()
    password = payload.password or ""
    if not email:
        raise HTTPException(status_code=422, detail="Email wajib diisi")
    if not password.strip():
        raise HTTPException(status_code=422, detail="Password wajib diisi")

    existing = db.query(AuthAccount).filter(AuthAccount.email == email).first()
    if existing:
        raise HTTPException(status_code=409, detail="Email sudah terdaftar")

    salt = secrets.token_hex(16)
    row = AuthAccount(email=email, password_salt=salt, password_hash=_hash_password(password, salt))
    db.add(row)
    db.commit()
    db.refresh(row)

    actor_username = (email.split("@")[0] or email)[:80]
    return {"message": "Registrasi berhasil", "actor_username": actor_username}


@app.post("/api/v1/auth/login")
def auth_login(payload: AuthLogin, db: Session = Depends(get_db)):
    email = (payload.email or "").strip().lower()
    password = payload.password or ""
    if not email:
        raise HTTPException(status_code=422, detail="Email wajib diisi")
    if not password.strip():
        raise HTTPException(status_code=422, detail="Password wajib diisi")

    acc = db.query(AuthAccount).filter(AuthAccount.email == email).first()
    if not acc:
        raise HTTPException(status_code=401, detail="Email atau password salah")
    if not _verify_password(password, acc.password_salt, acc.password_hash):
        raise HTTPException(status_code=401, detail="Email atau password salah")

    actor_username = (email.split("@")[0] or email)[:80]
    return {"message": "Login berhasil", "actor_username": actor_username}


@app.post("/api/v1/auth/change-password")
def auth_change_password(payload: AuthChangePassword, db: Session = Depends(get_db)):
    email = (payload.email or "").strip().lower()
    if not email:
        raise HTTPException(status_code=422, detail="Email wajib diisi")
    acc = db.query(AuthAccount).filter(AuthAccount.email == email).first()
    if not acc:
        raise HTTPException(status_code=404, detail="Akun tidak ditemukan")

    if not _verify_password(payload.old_password or "", acc.password_salt, acc.password_hash):
        raise HTTPException(status_code=401, detail="Password lama salah")

    new_pw = payload.new_password or ""
    if not new_pw.strip():
        raise HTTPException(status_code=422, detail="Password baru wajib diisi")

    salt = secrets.token_hex(16)
    acc.password_salt = salt
    acc.password_hash = _hash_password(new_pw, salt)
    db.commit()
    return {"message": "Password berhasil diubah"}


@app.get("/api/v1/notification-settings")
def get_notification_settings(db: Session = Depends(get_db)):
    row = db.query(NotificationSettings).filter(NotificationSettings.id == "singleton").first()
    if not row:
        row = NotificationSettings(id="singleton", email_enabled=0, phone_enabled=0)
        db.add(row)
        db.commit()
        db.refresh(row)
    return {
        "email_enabled": bool(int(row.email_enabled or 0)),
        "phone_enabled": bool(int(row.phone_enabled or 0)),
        "updated_at": row.updated_at.isoformat() if row.updated_at else None,
    }


@app.put("/api/v1/notification-settings")
def update_notification_settings(payload: NotificationSettingsUpdate, db: Session = Depends(get_db)):
    row = db.query(NotificationSettings).filter(NotificationSettings.id == "singleton").first()
    if not row:
        row = NotificationSettings(id="singleton", email_enabled=0, phone_enabled=0)
        db.add(row)
        db.flush()

    row.email_enabled = 1 if payload.email_enabled else 0
    row.phone_enabled = 1 if payload.phone_enabled else 0
    db.commit()
    return {"message": "Pengaturan notifikasi tersimpan"}


@app.get("/api/v1/notifications")
def list_notifications(limit: int = Query(50, ge=1, le=200), db: Session = Depends(get_db)):
    items = db.query(Notification).order_by(Notification.created_at.desc()).limit(limit).all()
    return [
        {
            "id": x.id,
            "channel": x.channel,
            "category": x.category,
            "title": x.title,
            "body": x.body,
            "created_at": x.created_at.isoformat() if x.created_at else None,
        }
        for x in items
    ]

# ================= SERIALIZER =================
def serialize_project(project: Project):
    return {
        "project_code": project.project_code,
        "id": project.id,
        "name": project.name,
        "description": project.description,
        "client_name": project.client_name,
        "start_date": str(project.start_date) if project.start_date else None,
        "deadline": str(project.deadline) if project.deadline else None,
        "status": project.status,
        "budget": project.budget,
        "progress": project.progress
    }

def serialize_material_test(mt: MaterialTest):
    # UI-friendly numbering, keep raw columns too.
    display_no = None
    if mt.material_no and mt.test_no is not None:
        display_no = f"{mt.material_no}.{mt.test_no}"
    elif mt.material_no:
        display_no = mt.material_no
    elif mt.test_no is not None:
        display_no = str(mt.test_no)

    return {
        "id": mt.id,
        "material_no": mt.material_no,
        "material_name": mt.material_name,
        "test_no": mt.test_no,
        "test_name": mt.test_name,
        "display_no": display_no,
    }

# ================= LOGIC =================
def update_project_progress(project_id: str, db: Session):
    project = db.query(Project).filter(
    (Project.id == project_id) | (Project.project_code == project_id)
).first()
    if not project:
        return

    tasks = db.query(Task).filter(Task.project_id == project.id).all()
    prev_progress = int(project.progress or 0)

    # ===== HITUNG PROGRESS =====
    if len(tasks) == 0:
        project.progress = 0
        project.status = "Planning"
    else:
        done = len([t for t in tasks if t.status == "Done"])
        project.progress = int((done / len(tasks)) * 100)

        # ===== AUTO STATUS =====
        if done == 0:
            project.status = "In Progress"
        elif done == len(tasks):
            project.status = "Completed"
        else:
            project.status = "In Progress"

    # ===== NOTIFIKASI (PROYEK 100%) =====
    if prev_progress < 100 and int(project.progress or 0) >= 100:
        title = "Proyek selesai 100%"
        body = f"Proyek {project.project_code or project.id} - {project.name or '-'} telah selesai."
        _notify(db, category="project", title=title, body=body)

    db.commit()

# ================= SEED (MATERIAL TESTS) =================
DEFAULT_MATERIAL_TESTS = [
    # I. BATU BOULDER
    {"material_no": "I", "material_name": "BATU BOULDER", "test_no": 1, "test_name": "Coring + Cutting + Capping Compression Strength Test"},
    {"material_no": "I", "material_name": "BATU BOULDER", "test_no": 2, "test_name": "Concrete Shrinkage Test (28 Day)"},
    {"material_no": "I", "material_name": "BATU BOULDER", "test_no": 3, "test_name": "Concrete Shrinkage Test (56 Day)"},
    # II. BATU SPLITE
    {"material_no": "II", "material_name": "BATU SPLITE", "test_no": 1, "test_name": "Grain Size / Sieve Analysis"},
    {"material_no": "II", "material_name": "BATU SPLITE", "test_no": 2, "test_name": "Specific Gravity & Water Absorption"},
    {"material_no": "II", "material_name": "BATU SPLITE", "test_no": 3, "test_name": "L.A. Abrasion / Keausan"},
    {"material_no": "II", "material_name": "BATU SPLITE", "test_no": 4, "test_name": "Soundness / Kekekalan"},
    {"material_no": "II", "material_name": "BATU SPLITE", "test_no": 5, "test_name": "Clay Lump And Friable Particles / Kadar Lumpur"},
    {"material_no": "II", "material_name": "BATU SPLITE", "test_no": 6, "test_name": "Unit Weight and Void In Aggregate / Berat Isi"},
    {"material_no": "II", "material_name": "BATU SPLITE", "test_no": 7, "test_name": "Flakiness & Elongation"},
    {"material_no": "II", "material_name": "BATU SPLITE", "test_no": 8, "test_name": "Finer Than 0,075 mm (No. 200 Sieve)"},
    # III. ABU BATU / SCREENING
    {"material_no": "III", "material_name": "ABU BATU / SCREENING", "test_no": 1, "test_name": "Grain Size / Sieve Analysis"},
    {"material_no": "III", "material_name": "ABU BATU / SCREENING", "test_no": 2, "test_name": "Specific Gravity & Water Absorption"},
    {"material_no": "III", "material_name": "ABU BATU / SCREENING", "test_no": 3, "test_name": "Soundness / Kekekalan"},
    {"material_no": "III", "material_name": "ABU BATU / SCREENING", "test_no": 4, "test_name": "Clay Lump Friable Particles / Kadar Lumpur"},
    {"material_no": "III", "material_name": "ABU BATU / SCREENING", "test_no": 5, "test_name": "Fineness Modulus / Modulus Kehalusan"},
    {"material_no": "III", "material_name": "ABU BATU / SCREENING", "test_no": 6, "test_name": "Organic Impurities"},
    {"material_no": "III", "material_name": "ABU BATU / SCREENING", "test_no": 7, "test_name": "Unit Weight and Void In Aggregate / Berat Isi"},
    # IV. PASIR
    {"material_no": "IV", "material_name": "PASIR", "test_no": 1, "test_name": "Grain Size / Sieve Analysis"},
    {"material_no": "IV", "material_name": "PASIR", "test_no": 2, "test_name": "Specific Gravity & Water Absorption"},
    {"material_no": "IV", "material_name": "PASIR", "test_no": 3, "test_name": "Soundness / Kekekalan"},
    {"material_no": "IV", "material_name": "PASIR", "test_no": 4, "test_name": "Clay Lump Friable Particles / Kadar Lumpur"},
    {"material_no": "IV", "material_name": "PASIR", "test_no": 5, "test_name": "Organic Impurities"},
    {"material_no": "IV", "material_name": "PASIR", "test_no": 6, "test_name": "Unit Weight and Void In Aggregate / Berat Isi"},
    {"material_no": "IV", "material_name": "PASIR", "test_no": 7, "test_name": "Sand Equivalent"},
    # V. BASE A / B SUB-BASE
    {"material_no": "V", "material_name": "BASE A / B SUB-BASE", "test_no": 1, "test_name": "Grain Size / Sieve Analysis"},
    {"material_no": "V", "material_name": "BASE A / B SUB-BASE", "test_no": 2, "test_name": "Specific Gravity & Water Absorption"},
    {"material_no": "V", "material_name": "BASE A / B SUB-BASE", "test_no": 3, "test_name": "L.A. Abrasion"},
    {"material_no": "V", "material_name": "BASE A / B SUB-BASE", "test_no": 4, "test_name": "Finer Than 0,075 mm (No. 200 Sieve)"},
    {"material_no": "V", "material_name": "BASE A / B SUB-BASE", "test_no": 5, "test_name": "Unit Weight and Void In Aggregate / Berat Isi"},
    {"material_no": "V", "material_name": "BASE A / B SUB-BASE", "test_no": 6, "test_name": "Atterberg Limit (LL / PL / IP)"},
    {"material_no": "V", "material_name": "BASE A / B SUB-BASE", "test_no": 7, "test_name": "Modified Proctor"},
    {"material_no": "V", "material_name": "BASE A / B SUB-BASE", "test_no": 8, "test_name": "CBR Design Laboratory - Soaked"},
    {"material_no": "V", "material_name": "BASE A / B SUB-BASE", "test_no": 9, "test_name": "CBR Laboratory - Unsoaked"},
    # VI. SIRTU SIRDAM GRANULAR
    {"material_no": "VI", "material_name": "SIRTU SIRDAM GRANULAR", "test_no": 1, "test_name": "Grain Size / Sieve Analysis"},
    {"material_no": "VI", "material_name": "SIRTU SIRDAM GRANULAR", "test_no": 2, "test_name": "Specific Gravity & Water Absorption"},
    {"material_no": "VI", "material_name": "SIRTU SIRDAM GRANULAR", "test_no": 3, "test_name": "L.A. Abrasion"},
    {"material_no": "VI", "material_name": "SIRTU SIRDAM GRANULAR", "test_no": 4, "test_name": "Finer Than 0,075 mm (No. 200 Sieve)"},
    {"material_no": "VI", "material_name": "SIRTU SIRDAM GRANULAR", "test_no": 5, "test_name": "Unit Weight and Void In Aggregate / Berat Isi"},
    {"material_no": "VI", "material_name": "SIRTU SIRDAM GRANULAR", "test_no": 6, "test_name": "Atterberg Limit (LL / PL / IP)"},
    {"material_no": "VI", "material_name": "SIRTU SIRDAM GRANULAR", "test_no": 7, "test_name": "Modified Proctor"},
    {"material_no": "VI", "material_name": "SIRTU SIRDAM GRANULAR", "test_no": 8, "test_name": "CBR Design Laboratory - Soaked"},
    {"material_no": "VI", "material_name": "SIRTU SIRDAM GRANULAR", "test_no": 9, "test_name": "CBR Laboratory - Unsoaked"},
    # VII. TANAH MERAH LIME STONE
    {"material_no": "VII", "material_name": "TANAH MERAH LIME STONE", "test_no": 1, "test_name": "Water Content Field (Lapangan)"},
    {"material_no": "VII", "material_name": "TANAH MERAH LIME STONE", "test_no": 2, "test_name": "Specific Gravity & Water Absorption"},
    {"material_no": "VII", "material_name": "TANAH MERAH LIME STONE", "test_no": 3, "test_name": "Atterberg Limit (LL/PL/IP)"},
    {"material_no": "VII", "material_name": "TANAH MERAH LIME STONE", "test_no": 4, "test_name": "Sieve Analysis"},
    {"material_no": "VII", "material_name": "TANAH MERAH LIME STONE", "test_no": 5, "test_name": "Sieve Analysis + Hydrometer"},
    {"material_no": "VII", "material_name": "TANAH MERAH LIME STONE", "test_no": 6, "test_name": "Standar Proctor / Modified Proctor"},
    {"material_no": "VII", "material_name": "TANAH MERAH LIME STONE", "test_no": 7, "test_name": "CBR Design Laboratory - Soaked"},
    {"material_no": "VII", "material_name": "TANAH MERAH LIME STONE", "test_no": 8, "test_name": "CBR Laboratory - Unsoaked"},
]


@app.on_event("startup")
def seed_material_tests_on_startup():
    # Lightweight "migration" so existing DBs don't crash.
    # SQLAlchemy create_all() won't add new columns to existing tables.
    with engine.begin() as conn:
        try:
            col = conn.execute(text("SHOW COLUMNS FROM tasks LIKE 'material_test_id'")).fetchone()
            if not col:
                conn.execute(text("ALTER TABLE tasks ADD COLUMN material_test_id VARCHAR(100) NULL"))
                conn.execute(text("CREATE INDEX ix_tasks_material_test_id ON tasks (material_test_id)"))
        except Exception:
            # If MySQL/MariaDB doesn't support the above (or table missing), let FastAPI raise later.
            pass

    # Seed once if the master table is empty. No overwrites.
    db = SessionLocal()
    try:
        existing = db.query(MaterialTest).first()
        if existing:
            return
        for row in DEFAULT_MATERIAL_TESTS:
            db.add(MaterialTest(**row))
        db.commit()
    finally:
        db.close()


@app.on_event("startup")
def migrate_blob_columns_on_startup():
    # If using MySQL, ensure file blobs are stored in LONGBLOB (BLOB defaults to 64KB).
    if _DB_KIND != "mysql":
        return

    with engine.begin() as conn:
        for table_name in ("report_files", "document_files"):
            try:
                conn.execute(text(f"ALTER TABLE {table_name} MODIFY data LONGBLOB NOT NULL"))
            except Exception:
                # Table may not exist yet or user may lack privileges; ignore and let runtime errors surface.
                pass


# ================= MATERIAL TESTS (MASTER) =================
@app.get("/api/v1/material-tests")
def get_material_tests(db: Session = Depends(get_db)):
    items = db.query(MaterialTest).order_by(MaterialTest.material_no, MaterialTest.test_no).all()
    return [serialize_material_test(x) for x in items]


@app.post("/api/v1/material-tests")
def create_material_test(data: MaterialTestCreate, db: Session = Depends(get_db)):
    try:
        mt = MaterialTest(**data.model_dump())
        db.add(mt)
        db.commit()
        db.refresh(mt)
        return serialize_material_test(mt)
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))


@app.put("/api/v1/material-tests/{material_test_id}")
def update_material_test(material_test_id: str, data: MaterialTestUpdate, db: Session = Depends(get_db)):
    mt = db.query(MaterialTest).filter(MaterialTest.id == material_test_id).first()
    if not mt:
        raise HTTPException(status_code=404, detail="Tes material tidak ditemukan")

    mt.material_no = data.material_no
    mt.material_name = data.material_name
    mt.test_no = data.test_no
    mt.test_name = data.test_name
    db.commit()
    return {"message": "Tes material berhasil diupdate"}


@app.delete("/api/v1/material-tests/{material_test_id}")
def delete_material_test(material_test_id: str, db: Session = Depends(get_db)):
    mt = db.query(MaterialTest).filter(MaterialTest.id == material_test_id).first()
    if not mt:
        raise HTTPException(status_code=404, detail="Tes material tidak ditemukan")
    db.delete(mt)
    db.commit()
    return {"message": "Tes material berhasil dihapus"}

# ================= PROJECT =================

@app.get("/api/v1/projects")
def get_projects(db: Session = Depends(get_db)):
    projects = db.query(Project).all()
    return [serialize_project(p) for p in projects]


@app.get("/api/v1/projects/{project_id}")
def get_project(project_id: str, db: Session = Depends(get_db)):
    project = db.query(Project).filter(Project.id == project_id).first()

    if not project:
        raise HTTPException(status_code=404, detail="Project tidak ditemukan")

    return serialize_project(project)


@app.post("/api/v1/projects")
def create_project(project: ProjectCreate, db: Session = Depends(get_db)):
    try:
        new_project = Project(
            **project.model_dump(),
            project_code=generate_project_code(db)
        )
        db.add(new_project)
        db.commit()
        db.refresh(new_project)
        return serialize_project(new_project)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.put("/api/v1/projects/{project_id}")
def update_project(project_id: str, data: ProjectUpdate, db: Session = Depends(get_db)):
    project = db.query(Project).filter(Project.id == project_id).first()

    if not project:
        raise HTTPException(status_code=404, detail="Project tidak ditemukan")

    project.name = data.name
    project.description = data.description
    project.client_name = data.client_name
    project.status = data.status
    project.budget = data.budget

    db.commit()

    update_project_progress(project_id, db)

    return {"message": "Project berhasil diupdate"}


@app.delete("/api/v1/projects/{project_id}")
def delete_project(project_id: str, db: Session = Depends(get_db)):
    project = db.query(Project).filter(Project.id == project_id).first()

    if not project:
        raise HTTPException(status_code=404, detail="Project tidak ditemukan")

    db.delete(project)
    db.commit()

    return {"message": "Project berhasil dihapus"}

# ================= PENGUJIAN (TASK) =================

@app.post("/api/v1/tasks")
def create_task(task: TaskCreate, db: Session = Depends(get_db)):
    try:
        project = db.query(Project).filter(Project.id == task.project_id).first()
        if not project:
            raise HTTPException(status_code=404, detail="Project tidak ditemukan")

        # Mode A: create task from master material test
        if task.material_test_id:
            mt = db.query(MaterialTest).filter(MaterialTest.id == task.material_test_id).first()
            if not mt:
                raise HTTPException(status_code=404, detail="Tes material tidak ditemukan")

            existing = db.query(Task).filter(
                Task.project_id == task.project_id,
                Task.material_test_id == task.material_test_id,
            ).first()
            if existing:
                raise HTTPException(status_code=409, detail="Pengujian ini sudah dipilih untuk proyek ini")

            new_task = Task(
                id=str(uuid.uuid4()),
                project_id=task.project_id,
                material_test_id=task.material_test_id,
                title=(mt.test_name or "")[:255],
                description=task.description,
                progress=task.progress,
                deadline=task.deadline,
            )
        else:
            # Mode B: manual task (not tied to master material tests)
            title = (task.title or "").strip()
            if not title:
                raise HTTPException(status_code=422, detail="title wajib diisi jika material_test_id tidak ada")

            new_task = Task(
                id=str(uuid.uuid4()),
                project_id=task.project_id,
                material_test_id=None,
                title=title[:255],
                description=task.description,
                progress=task.progress,
                deadline=task.deadline,
            )
        db.add(new_task)
        db.commit()
        db.refresh(new_task)

        update_project_progress(task.project_id, db)

        return {
            "message": "Pengujian berhasil dibuat",
            "task": {
                "id": new_task.id,
                "project_id": new_task.project_id,
                "material_test_id": new_task.material_test_id,
                "title": new_task.title,
                "description": new_task.description,
                "progress": new_task.progress,
                "deadline": str(new_task.deadline) if new_task.deadline else None,
                "status": new_task.status,
            },
        }
    except HTTPException:
        db.rollback()
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))


@app.put("/api/v1/tasks/{task_id}")
def update_task(task_id: str, data: TaskUpdate, db: Session = Depends(get_db)):
    task = db.query(Task).filter(Task.id == task_id).first()

    if not task:
        raise HTTPException(status_code=404, detail="Pengujian tidak ditemukan")

    if data.title is not None:
        task.title = (data.title or "").strip()[:255]
    task.description = data.description
    task.progress = data.progress
    task.deadline = data.deadline
    task.status = data.status

    db.commit()

    update_project_progress(task.project_id, db)

    return {"message": "Pengujian berhasil diupdate"}


@app.delete("/api/v1/tasks/{task_id}")
def delete_task(task_id: str, db: Session = Depends(get_db)):
    task = db.query(Task).filter(Task.id == task_id).first()

    if not task:
        raise HTTPException(status_code=404, detail="Pengujian tidak ditemukan")

    project_id = task.project_id

    db.delete(task)
    db.commit()

    update_project_progress(project_id, db)

    return {"message": "Pengujian berhasil dihapus"}

@app.get("/api/v1/projects/{project_id}/tasks")
def get_tasks_by_project(project_id: str, db: Session = Depends(get_db)):
    project = db.query(Project).filter(
        (Project.id == project_id) | (Project.project_code == project_id)
    ).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project tidak ditemukan")

    tasks = db.query(Task).filter(Task.project_id == project.id).all()

    material_ids = [t.material_test_id for t in tasks if t.material_test_id]
    material_map = {}
    if material_ids:
        mts = db.query(MaterialTest).filter(MaterialTest.id.in_(material_ids)).all()
        material_map = {m.id: m for m in mts}

    return [
    {
        "id": t.id,
        "material_test_id": t.material_test_id,
        "material_name": material_map.get(t.material_test_id).material_name if t.material_test_id in material_map else None,
        "test_name": material_map.get(t.material_test_id).test_name if t.material_test_id in material_map else t.title,
        "title": t.title,
        "description": t.description,
        "progress": t.progress,
        "deadline": str(t.deadline) if t.deadline else None,
        "status": t.status
    }
    for t in tasks
]

@app.get("/api/v1/projects/{project_id}/report")
def generate_report(project_id: str, db: Session = Depends(get_db)):
    try:
        # ✅ SUPPORT ID + PROJECT CODE
        project = db.query(Project).filter(
            (Project.id == project_id) | (Project.project_code == project_id)
        ).first()

        if not project:
            raise HTTPException(status_code=404, detail="Project tidak ditemukan")

        tasks = db.query(Task).filter(Task.project_id == project.id).all()

        material_ids = [t.material_test_id for t in tasks if t.material_test_id]
        material_map = {}
        if material_ids:
            mts = db.query(MaterialTest).filter(MaterialTest.id.in_(material_ids)).all()
            material_map = {m.id: m for m in mts}

        settings = _get_company_settings(db)

        # ================= PDF =================
        from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, Image
        from reportlab.lib.styles import getSampleStyleSheet
        from reportlab.lib import colors
        from reportlab.lib.pagesizes import A4
        from reportlab.lib.units import cm
        from reportlab.lib.utils import ImageReader

        buffer = BytesIO()
        doc = SimpleDocTemplate(
            buffer,
            pagesize=A4,
            leftMargin=1.5 * cm,
            rightMargin=1.5 * cm,
            topMargin=1.5 * cm,
            bottomMargin=1.5 * cm,
        )
        styles = getSampleStyleSheet()
        elements = []

        logo_flowable = None
        if settings.logo_data:
            try:
                reader = ImageReader(BytesIO(settings.logo_data))
                w, h = reader.getSize()
                max_w = 4.5 * cm
                max_h = 2.2 * cm
                scale = min(max_w / float(w), max_h / float(h))
                logo_flowable = Image(BytesIO(settings.logo_data), width=w * scale, height=h * scale)
            except Exception:
                logo_flowable = None

        company_lines = []
        company_name = (settings.company_name or "").strip() or "PT. Mixindo Abadi Karya"
        company_lines.append(f"<b>{company_name}</b>")
        if settings.address:
            company_lines.append(settings.address)
        contact_bits = []
        if settings.whatsapp:
            contact_bits.append(f"WA: {settings.whatsapp}")
        if settings.email:
            contact_bits.append(f"Email: {settings.email}")
        if settings.website:
            contact_bits.append(f"Web: {settings.website}")
        if contact_bits:
            company_lines.append(" • ".join(contact_bits))

        header_table = Table(
            [
                [
                    logo_flowable if logo_flowable else "",
                    Paragraph("<br/>".join(company_lines), styles["Normal"]),
                ]
            ],
            colWidths=[5.0 * cm, 12.0 * cm],
        )
        header_table.setStyle(
            TableStyle(
                [
                    ("VALIGN", (0, 0), (-1, -1), "TOP"),
                    ("LEFTPADDING", (0, 0), (-1, -1), 0),
                    ("RIGHTPADDING", (0, 0), (-1, -1), 0),
                    ("TOPPADDING", (0, 0), (-1, -1), 0),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
                ]
            )
        )

        elements.append(header_table)
        elements.append(Paragraph("<b>LAPORAN PROYEK</b>", styles["Title"]))
        elements.append(Spacer(1, 10))

        elements.append(Paragraph(f"Nama: {project.name}", styles['Normal']))
        elements.append(Paragraph(f"Kode: {project.project_code}", styles['Normal']))
        elements.append(Paragraph(f"Client: {project.client_name}", styles['Normal']))
        elements.append(Paragraph(f"Status: {project.status}", styles['Normal']))
        elements.append(Paragraph(f"Progress: {project.progress}%", styles['Normal']))
        elements.append(Paragraph(f"Start Date: {project.start_date}", styles['Normal']))
        elements.append(Paragraph(f"Deadline: {project.deadline}", styles['Normal']))
        elements.append(Paragraph(f"Deskripsi: {project.description or '-'}", styles['Normal']))

        elements.append(Spacer(1, 15))
        elements.append(Paragraph("<b>Detail Pengujian</b>", styles['Heading2']))
        elements.append(Spacer(1, 10))

        if not tasks:
            elements.append(Paragraph("Belum ada pengujian", styles['Normal']))
        else:
            header = ["No", "Material", "Tes", "Status", "Progress", "Deadline", "Detail"]
            data: List[list] = [header]

            normal = styles["Normal"]
            normal.fontSize = 9

            for idx, t in enumerate(tasks, start=1):
                mt = material_map.get(t.material_test_id) if t.material_test_id else None
                material_name = mt.material_name if mt else "-"
                test_name = (mt.test_name if mt else (t.title or "-")) or "-"
                deadline = t.deadline.isoformat() if t.deadline else "-"
                detail = t.description or "-"

                data.append([
                    str(idx),
                    Paragraph(material_name, normal),
                    Paragraph(test_name, normal),
                    Paragraph(t.status or "-", normal),
                    Paragraph(f"{int(t.progress or 0)}%", normal),
                    Paragraph(deadline, normal),
                    Paragraph(detail, normal),
                ])

            table = Table(
                data,
                colWidths=[1.0 * cm, 3.0 * cm, 4.0 * cm, 2.2 * cm, 2.0 * cm, 2.6 * cm, 4.2 * cm],
                repeatRows=1,
            )
            table.setStyle(
                TableStyle([
                    ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#1e3a8a")),
                    ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                    ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                    ("FONTSIZE", (0, 0), (-1, 0), 9),
                    ("VALIGN", (0, 0), (-1, -1), "TOP"),
                    ("GRID", (0, 0), (-1, -1), 0.25, colors.HexColor("#e5e7eb")),
                    ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#f8fafc")]),
                    ("LEFTPADDING", (0, 0), (-1, -1), 6),
                    ("RIGHTPADDING", (0, 0), (-1, -1), 6),
                    ("TOPPADDING", (0, 0), (-1, -1), 4),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
                ])
            )
            elements.append(table)

        stamp_reader = None
        if settings.stamp_data:
            try:
                stamp_reader = ImageReader(BytesIO(settings.stamp_data))
            except Exception:
                stamp_reader = None

        def _on_page(canvas, _doc):
            if not stamp_reader:
                return
            try:
                sw, sh = stamp_reader.getSize()
                max_w = 4.0 * cm
                max_h = 4.0 * cm
                scale = min(max_w / float(sw), max_h / float(sh))
                w = sw * scale
                h = sh * scale
                x = _doc.pagesize[0] - _doc.rightMargin - w
                y = _doc.bottomMargin - 0.2 * cm
                if y < 0.8 * cm:
                    y = 0.8 * cm
                canvas.drawImage(stamp_reader, x, y, width=w, height=h, mask="auto")
            except Exception:
                return

        doc.build(elements, onFirstPage=_on_page, onLaterPages=_on_page)

        buffer.seek(0)

        return StreamingResponse(
            buffer,
            media_type="application/pdf",
            headers={
                "Content-Disposition": f"attachment; filename=report_{project.project_code}.pdf"
            }
        )

    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/v1/audit-logs")
def list_audit_logs(scope: str = Query("all"), limit: int = Query(10, ge=1, le=100), db: Session = Depends(get_db)):
    q = db.query(AuditLog)
    if scope != "all":
        q = q.filter(AuditLog.scope == scope)
    items = q.order_by(AuditLog.created_at.desc()).limit(limit).all()
    return [
        {
            "id": x.id,
            "actor_username": x.actor_username,
            "scope": x.scope,
            "action": x.action,
            "entity_type": x.entity_type,
            "entity_id": x.entity_id,
            "entity_label": x.entity_label,
            "created_at": x.created_at.isoformat() if x.created_at else None,
        }
        for x in items
    ]


# ================= COMPANY SETTINGS (SINGLE TENANT) =================
def _serialize_company_settings(row: CompanySettings):
    return {
        "company_name": row.company_name,
        "address": row.address,
        "whatsapp": row.whatsapp,
        "email": row.email,
        "website": row.website,
        "has_logo": bool(row.logo_data),
        "has_stamp": bool(row.stamp_data),
        "updated_at": row.updated_at.isoformat() if row.updated_at else None,
    }


@app.get("/api/v1/company-settings")
def get_company_settings(db: Session = Depends(get_db)):
    row = _get_company_settings(db)
    return _serialize_company_settings(row)


@app.put("/api/v1/company-settings")
def update_company_settings(data: CompanySettingsUpdate, request: Request, db: Session = Depends(get_db)):
    row = _get_company_settings(db)
    row.company_name = (data.company_name or "").strip()[:255] or row.company_name
    row.address = (data.address or "").strip() or None
    row.whatsapp = (data.whatsapp or "").strip() or None
    row.email = (data.email or "").strip() or None
    row.website = (data.website or "").strip() or None
    _log_audit(db, request, scope="document", action="update", entity_type="company_settings", entity_id=row.id, entity_label="company_profile")
    db.commit()
    return {"message": "Pengaturan perusahaan berhasil disimpan"}


@app.get("/api/v1/company-settings/logo")
def view_company_logo(download: bool = Query(False), db: Session = Depends(get_db)):
    row = _get_company_settings(db)
    if not row.logo_data:
        raise HTTPException(status_code=404, detail="Logo belum diupload")
    media_type = (row.logo_content_type or "").strip() or "application/octet-stream"
    disposition = "attachment" if download else "inline"
    headers = {"Content-Disposition": f'{disposition}; filename="company_logo"'}
    return Response(content=row.logo_data, media_type=media_type, headers=headers)


@app.post("/api/v1/company-settings/logo")
async def upload_company_logo(
    request: Request,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    row = _get_company_settings(db)
    raw = await file.read()
    if raw is None:
        raw = b""
    content_type = (file.content_type or "").strip()[:255] or None
    if content_type and not content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="File harus berupa gambar")
    row.logo_content_type = content_type
    row.logo_data = raw
    _log_audit(db, request, scope="document", action="update", entity_type="company_settings", entity_id=row.id, entity_label="company_logo")
    db.commit()
    return {"message": "Logo berhasil diupload"}


@app.delete("/api/v1/company-settings/logo")
def delete_company_logo(request: Request, db: Session = Depends(get_db)):
    row = _get_company_settings(db)
    row.logo_content_type = None
    row.logo_data = None
    _log_audit(db, request, scope="document", action="delete", entity_type="company_settings", entity_id=row.id, entity_label="company_logo")
    db.commit()
    return {"message": "Logo berhasil dihapus"}


@app.get("/api/v1/company-settings/stamp")
def view_company_stamp(download: bool = Query(False), db: Session = Depends(get_db)):
    row = _get_company_settings(db)
    if not row.stamp_data:
        raise HTTPException(status_code=404, detail="Cap belum diupload")
    media_type = (row.stamp_content_type or "").strip() or "application/octet-stream"
    disposition = "attachment" if download else "inline"
    headers = {"Content-Disposition": f'{disposition}; filename="company_stamp"'}
    return Response(content=row.stamp_data, media_type=media_type, headers=headers)


@app.post("/api/v1/company-settings/stamp")
async def upload_company_stamp(
    request: Request,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    row = _get_company_settings(db)
    raw = await file.read()
    if raw is None:
        raw = b""
    content_type = (file.content_type or "").strip()[:255] or None
    if content_type and not content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="File harus berupa gambar")
    row.stamp_content_type = content_type
    row.stamp_data = raw
    _log_audit(db, request, scope="document", action="update", entity_type="company_settings", entity_id=row.id, entity_label="company_stamp")
    db.commit()
    return {"message": "Cap berhasil diupload"}


@app.delete("/api/v1/company-settings/stamp")
def delete_company_stamp(request: Request, db: Session = Depends(get_db)):
    row = _get_company_settings(db)
    row.stamp_content_type = None
    row.stamp_data = None
    _log_audit(db, request, scope="document", action="delete", entity_type="company_settings", entity_id=row.id, entity_label="company_stamp")
    db.commit()
    return {"message": "Cap berhasil dihapus"}


@app.get("/api/v1/dashboard")
def dashboard(db: Session = Depends(get_db)):
    today = date.today()
    due_soon = today.toordinal() + 7

    projects = db.query(Project).order_by(Project.created_at.desc()).all()
    tasks = db.query(Task).all()

    material_ids = [t.material_test_id for t in tasks if t.material_test_id]
    material_map = {}
    if material_ids:
        mts = db.query(MaterialTest).filter(MaterialTest.id.in_(material_ids)).all()
        material_map = {m.id: m for m in mts}

    # Project counts by status
    project_by_status = {}
    for p in projects:
        key = p.status or "Unknown"
        project_by_status[key] = project_by_status.get(key, 0) + 1

    # Task counts by status + due soon/overdue
    task_by_status = {}
    overdue_count = 0
    due_soon_count = 0
    for t in tasks:
        key = t.status or "Unknown"
        task_by_status[key] = task_by_status.get(key, 0) + 1
        if t.deadline:
            if t.deadline < today and (t.status or "") != "Done":
                overdue_count += 1
            if t.deadline.toordinal() <= due_soon and t.deadline >= today and (t.status or "") != "Done":
                due_soon_count += 1

    # Files counts
    report_files_total = db.query(ReportFile).count()
    document_files_total = db.query(DocumentFile).count()

    # Recent projects
    recent_projects = []
    for p in projects[:8]:
        recent_projects.append(
            {
                "id": p.id,
                "project_code": p.project_code,
                "name": p.name,
                "client_name": p.client_name,
                "status": p.status,
                "progress": p.progress,
                "deadline": p.deadline.isoformat() if p.deadline else None,
                "budget": p.budget,
            }
        )

    # Attention tasks: overdue first then earliest deadline
    project_map = {p.id: p for p in projects}
    attention = []
    for t in tasks:
        if not t.deadline:
            continue
        if (t.status or "") == "Done":
            continue
        proj = project_map.get(t.project_id)
        if not proj:
            continue
        attention.append((t.deadline, t, proj))
    attention.sort(key=lambda x: (0 if x[0] < today else 1, x[0]))
    attention_tasks = []
    for d, t, proj in attention[:12]:
        mt = material_map.get(t.material_test_id) if t.material_test_id else None
        attention_tasks.append(
            {
                "task_id": t.id,
                "project_id": proj.id,
                "project_code": proj.project_code,
                "project_name": proj.name,
                "material_name": mt.material_name if mt else None,
                "test_name": (mt.test_name if mt else (t.title or None)),
                "status": t.status,
                "progress": t.progress,
                "deadline": t.deadline.isoformat() if t.deadline else None,
                "description": t.description,
            }
        )

    # Task breakdown per project (for stacked chart)
    tasks_by_project = []
    by_project = {}
    for t in tasks:
        by_project.setdefault(t.project_id, []).append(t)
    for pid, group in by_project.items():
        proj = project_map.get(pid)
        if not proj:
            continue
        c = {"Pending": 0, "In Progress": 0, "Done": 0, "Other": 0}
        for t in group:
            s = t.status or "Other"
            if s not in ("Pending", "In Progress", "Done"):
                c["Other"] += 1
            else:
                c[s] += 1
        tasks_by_project.append(
            {
                "project_id": proj.id,
                "project_code": proj.project_code,
                "project_name": proj.name,
                "counts": c,
                "total": len(group),
            }
        )
    tasks_by_project.sort(key=lambda x: x["total"], reverse=True)
    tasks_by_project = tasks_by_project[:10]

    return {
        "projects": {"total": len(projects), "by_status": project_by_status},
        "tasks": {
            "total": len(tasks),
            "by_status": task_by_status,
            "overdue": overdue_count,
            "due_soon_7d": due_soon_count,
        },
        "files": {"report_total": report_files_total, "document_total": document_files_total},
        "recent_projects": recent_projects,
        "attention_tasks": attention_tasks,
        "tasks_by_project": tasks_by_project,
    }


# ================= USER MANAGEMENT =================
def _serialize_user(u: User):
    return {
        "id": u.id,
        "username": u.username,
        "email_or_phone": u.email_or_phone,
        "status": u.status,
        "role": u.role,
        "last_seen_at": u.last_seen_at.isoformat() if u.last_seen_at else None,
        "created_at": u.created_at.isoformat() if u.created_at else None,
    }


@app.get("/api/v1/users")
def list_users(db: Session = Depends(get_db)):
    items = db.query(User).order_by(User.created_at.desc()).all()
    return [_serialize_user(x) for x in items]


@app.post("/api/v1/users")
def create_user(data: UserCreate, db: Session = Depends(get_db)):
    if db.query(User).count() >= 2:
        raise HTTPException(status_code=409, detail="Maksimal 2 user saja")

    username = (data.username or "").strip()
    if not username:
        raise HTTPException(status_code=400, detail="Username wajib diisi")
    if data.role not in ("admin", "owner"):
        raise HTTPException(status_code=400, detail="Role harus admin atau owner")
    if data.status not in ("active", "inactive"):
        raise HTTPException(status_code=400, detail="Status harus active atau inactive")

    existing = db.query(User).filter(User.username == username).first()
    if existing:
        raise HTTPException(status_code=409, detail="Username sudah digunakan")

    row = User(
        username=username,
        email_or_phone=(data.email_or_phone or None),
        role=data.role,
        status=data.status,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return _serialize_user(row)


@app.put("/api/v1/users/{user_id}")
def update_user(user_id: str, data: UserUpdate, db: Session = Depends(get_db)):
    u = db.query(User).filter(User.id == user_id).first()
    if not u:
        raise HTTPException(status_code=404, detail="User tidak ditemukan")

    if data.role is not None:
        if data.role not in ("admin", "owner"):
            raise HTTPException(status_code=400, detail="Role harus admin atau owner")
        u.role = data.role
    if data.status is not None:
        if data.status not in ("active", "inactive"):
            raise HTTPException(status_code=400, detail="Status harus active atau inactive")
        u.status = data.status
    if data.email_or_phone is not None:
        u.email_or_phone = (data.email_or_phone or None)

    db.commit()
    return {"message": "User berhasil diupdate"}


@app.delete("/api/v1/users/{user_id}")
def delete_user(user_id: str, db: Session = Depends(get_db)):
    u = db.query(User).filter(User.id == user_id).first()
    if not u:
        raise HTTPException(status_code=404, detail="User tidak ditemukan")
    db.delete(u)
    db.commit()
    return {"message": "User berhasil dihapus"}


# ================= LAPORAN (FOLDER + FILES) =================
def serialize_report_folder(folder: ReportFolder):
    return {
        "id": folder.id,
        "name": folder.name,
        "created_at": folder.created_at.isoformat() if folder.created_at else None,
    }


def serialize_report_file(file: ReportFile):
    return {
        "id": file.id,
        "folder_id": file.folder_id,
        "filename": file.filename,
        "content_type": file.content_type or "application/octet-stream",
        "size_bytes": file.size_bytes or 0,
        "created_at": file.created_at.isoformat() if file.created_at else None,
    }


def serialize_document_file(file: DocumentFile):
    return {
        "id": file.id,
        "filename": file.filename,
        "content_type": file.content_type or "application/octet-stream",
        "size_bytes": file.size_bytes or 0,
        "created_at": file.created_at.isoformat() if file.created_at else None,
    }

def _attach_last_audit(db: Session, entity_type: str, ids: List[str]):
    if not ids:
        return {}
    rows = (
        db.query(AuditLog)
        .filter(AuditLog.entity_type == entity_type, AuditLog.entity_id.in_(ids))
        .order_by(AuditLog.created_at.desc())
        .all()
    )
    latest = {}
    for r in rows:
        if r.entity_id in latest:
            continue
        latest[r.entity_id] = {
            "action": r.action,
            "actor_username": r.actor_username,
            "created_at": r.created_at.isoformat() if r.created_at else None,
        }
    return latest


@app.get("/api/v1/report-folders")
def list_report_folders(db: Session = Depends(get_db)):
    items = db.query(ReportFolder).order_by(ReportFolder.created_at.desc()).all()
    return [serialize_report_folder(x) for x in items]


@app.post("/api/v1/report-folders")
def create_report_folder(data: ReportFolderCreate, request: Request, db: Session = Depends(get_db)):
    name = (data.name or "").strip()
    if not name:
        raise HTTPException(status_code=422, detail="name wajib diisi")

    folder = ReportFolder(name=name)
    db.add(folder)
    db.flush()
    _log_audit(db, request, scope="report", action="create", entity_type="report_folder", entity_id=folder.id, entity_label=folder.name)
    _notify(db, category="report", title="Aktivitas Laporan (CRUD)", body=f"Create folder laporan: {folder.name}")
    db.commit()
    db.refresh(folder)
    return serialize_report_folder(folder)

@app.put("/api/v1/report-folders/{folder_id}")
def update_report_folder(folder_id: str, data: ReportFolderUpdate, request: Request, db: Session = Depends(get_db)):
    folder = db.query(ReportFolder).filter(ReportFolder.id == folder_id).first()
    if not folder:
        raise HTTPException(status_code=404, detail="Folder tidak ditemukan")

    name = (data.name or "").strip()
    if not name:
        raise HTTPException(status_code=422, detail="name wajib diisi")

    folder.name = name
    _log_audit(db, request, scope="report", action="update", entity_type="report_folder", entity_id=folder.id, entity_label=folder.name)
    _notify(db, category="report", title="Aktivitas Laporan (CRUD)", body=f"Update folder laporan: {folder.name}")
    db.commit()
    return {"message": "Folder berhasil diupdate"}


@app.delete("/api/v1/report-folders/{folder_id}")
def delete_report_folder(folder_id: str, request: Request, db: Session = Depends(get_db)):
    folder = db.query(ReportFolder).filter(ReportFolder.id == folder_id).first()
    if not folder:
        raise HTTPException(status_code=404, detail="Folder tidak ditemukan")

    _log_audit(db, request, scope="report", action="delete", entity_type="report_folder", entity_id=folder.id, entity_label=folder.name)
    _notify(db, category="report", title="Aktivitas Laporan (CRUD)", body=f"Delete folder laporan: {folder.name}")
    # Delete files first for DBs that don't enforce cascade reliably.
    db.query(ReportFile).filter(ReportFile.folder_id == folder_id).delete(synchronize_session=False)
    db.delete(folder)
    db.commit()
    return {"message": "Folder berhasil dihapus"}


@app.get("/api/v1/report-folders/{folder_id}/files")
def list_report_files(folder_id: str, db: Session = Depends(get_db)):
    folder = db.query(ReportFolder).filter(ReportFolder.id == folder_id).first()
    if not folder:
        raise HTTPException(status_code=404, detail="Folder tidak ditemukan")

    items = db.query(ReportFile).filter(ReportFile.folder_id == folder_id).order_by(ReportFile.created_at.desc()).all()
    payload = [serialize_report_file(x) for x in items]
    audit = _attach_last_audit(db, "report_file", [x["id"] for x in payload])
    for x in payload:
        x["last_action"] = audit.get(x["id"], {}).get("action")
        x["last_actor_username"] = audit.get(x["id"], {}).get("actor_username")
        x["last_action_at"] = audit.get(x["id"], {}).get("created_at")
    return payload


@app.delete("/api/v1/report-files/{file_id}")
def delete_report_file(file_id: str, request: Request, db: Session = Depends(get_db)):
    f = db.query(ReportFile).filter(ReportFile.id == file_id).first()
    if not f:
        raise HTTPException(status_code=404, detail="File tidak ditemukan")

    _log_audit(db, request, scope="report", action="delete", entity_type="report_file", entity_id=f.id, entity_label=f.filename)
    _notify(db, category="report", title="Aktivitas Laporan (CRUD)", body=f"Delete file laporan: {f.filename}")
    db.delete(f)
    db.commit()
    return {"message": "File berhasil dihapus"}

@app.put("/api/v1/report-files/{file_id}")
def rename_report_file(file_id: str, data: RenameFile, request: Request, db: Session = Depends(get_db)):
    f = db.query(ReportFile).filter(ReportFile.id == file_id).first()
    if not f:
        raise HTTPException(status_code=404, detail="File tidak ditemukan")

    filename = (data.filename or "").strip()
    if not filename:
        raise HTTPException(status_code=422, detail="filename wajib diisi")

    f.filename = filename[:255]
    _log_audit(db, request, scope="report", action="update", entity_type="report_file", entity_id=f.id, entity_label=f.filename)
    _notify(db, category="report", title="Aktivitas Laporan (CRUD)", body=f"Rename file laporan: {f.filename}")
    db.commit()
    return {"message": "File berhasil diupdate"}


@app.get("/api/v1/report-files/{file_id}")
def view_report_file(file_id: str, download: bool = Query(False), db: Session = Depends(get_db)):
    f = db.query(ReportFile).filter(ReportFile.id == file_id).first()
    if not f:
        raise HTTPException(status_code=404, detail="File tidak ditemukan")

    filename = f.filename or "file"
    media_type = (f.content_type or "").strip() or "application/octet-stream"
    if media_type == "application/octet-stream" and filename.lower().endswith(".pdf"):
        media_type = "application/pdf"
    if media_type == "application/octet-stream" and filename.lower().endswith(".jpg"):
        media_type = "image/jpeg"
    if media_type == "application/octet-stream" and filename.lower().endswith(".jpeg"):
        media_type = "image/jpeg"
    if media_type == "application/octet-stream" and filename.lower().endswith(".png"):
        media_type = "image/png"

    disposition = "attachment" if download else "inline"
    headers = {"Content-Disposition": f'{disposition}; filename="{filename}"'}
    # Use Response (not streaming) to avoid partial/lock issues in browser PDF viewers.
    return Response(content=f.data, media_type=media_type, headers=headers)


@app.post("/api/v1/report-files")
async def upload_report_file(
    request: Request,
    folder_id: str = Form(...),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    folder = db.query(ReportFolder).filter(ReportFolder.id == folder_id).first()
    if not folder:
        raise HTTPException(status_code=404, detail="Folder tidak ditemukan")

    raw = await file.read()
    if raw is None:
        raw = b""

    filename = (file.filename or "upload").strip()[:255]
    content_type = (file.content_type or "").strip()[:255] or None
    size_bytes = len(raw)

    row = ReportFile(
        folder_id=folder_id,
        filename=filename,
        content_type=content_type,
        size_bytes=size_bytes,
        data=raw,
    )
    db.add(row)
    db.flush()
    _log_audit(db, request, scope="report", action="create", entity_type="report_file", entity_id=row.id, entity_label=row.filename)
    _notify(db, category="report", title="Aktivitas Laporan (CRUD)", body=f"Upload file laporan: {row.filename}")
    db.commit()
    db.refresh(row)
    return serialize_report_file(row)


# ================= DOKUMEN (FILES) =================
@app.get("/api/v1/document-files")
def list_document_files(db: Session = Depends(get_db)):
    items = db.query(DocumentFile).order_by(DocumentFile.created_at.desc()).all()
    payload = [serialize_document_file(x) for x in items]
    audit = _attach_last_audit(db, "document_file", [x["id"] for x in payload])
    for x in payload:
        x["last_action"] = audit.get(x["id"], {}).get("action")
        x["last_actor_username"] = audit.get(x["id"], {}).get("actor_username")
        x["last_action_at"] = audit.get(x["id"], {}).get("created_at")
    return payload


@app.post("/api/v1/document-files")
async def upload_document_file(
    request: Request,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    raw = await file.read()
    if raw is None:
        raw = b""

    filename = (file.filename or "upload").strip()[:255]
    content_type = (file.content_type or "").strip()[:255] or None
    size_bytes = len(raw)

    row = DocumentFile(
        filename=filename,
        content_type=content_type,
        size_bytes=size_bytes,
        data=raw,
    )
    db.add(row)
    db.flush()
    _log_audit(db, request, scope="document", action="create", entity_type="document_file", entity_id=row.id, entity_label=row.filename)
    _notify(db, category="document", title="Aktivitas Dokumen (CRUD)", body=f"Upload dokumen: {row.filename}")
    db.commit()
    db.refresh(row)
    return serialize_document_file(row)

@app.put("/api/v1/document-files/{file_id}")
def rename_document_file(file_id: str, data: RenameFile, request: Request, db: Session = Depends(get_db)):
    f = db.query(DocumentFile).filter(DocumentFile.id == file_id).first()
    if not f:
        raise HTTPException(status_code=404, detail="File tidak ditemukan")

    filename = (data.filename or "").strip()
    if not filename:
        raise HTTPException(status_code=422, detail="filename wajib diisi")

    f.filename = filename[:255]
    _log_audit(db, request, scope="document", action="update", entity_type="document_file", entity_id=f.id, entity_label=f.filename)
    _notify(db, category="document", title="Aktivitas Dokumen (CRUD)", body=f"Rename dokumen: {f.filename}")
    db.commit()
    return {"message": "File berhasil diupdate"}


@app.delete("/api/v1/document-files/{file_id}")
def delete_document_file(file_id: str, request: Request, db: Session = Depends(get_db)):
    f = db.query(DocumentFile).filter(DocumentFile.id == file_id).first()
    if not f:
        raise HTTPException(status_code=404, detail="File tidak ditemukan")

    _log_audit(db, request, scope="document", action="delete", entity_type="document_file", entity_id=f.id, entity_label=f.filename)
    _notify(db, category="document", title="Aktivitas Dokumen (CRUD)", body=f"Delete dokumen: {f.filename}")
    db.delete(f)
    db.commit()
    return {"message": "File berhasil dihapus"}


@app.get("/api/v1/document-files/{file_id}")
def view_document_file(file_id: str, download: bool = Query(False), db: Session = Depends(get_db)):
    f = db.query(DocumentFile).filter(DocumentFile.id == file_id).first()
    if not f:
        raise HTTPException(status_code=404, detail="File tidak ditemukan")

    filename = f.filename or "file"
    media_type = (f.content_type or "").strip() or "application/octet-stream"
    if media_type == "application/octet-stream" and filename.lower().endswith(".pdf"):
        media_type = "application/pdf"
    if media_type == "application/octet-stream" and filename.lower().endswith(".jpg"):
        media_type = "image/jpeg"
    if media_type == "application/octet-stream" and filename.lower().endswith(".jpeg"):
        media_type = "image/jpeg"
    if media_type == "application/octet-stream" and filename.lower().endswith(".png"):
        media_type = "image/png"

    disposition = "attachment" if download else "inline"
    headers = {"Content-Disposition": f'{disposition}; filename="{filename}"'}
    return Response(content=f.data, media_type=media_type, headers=headers)

@app.get("/test-db")
def test_db():
    return {"db": "connected"}
