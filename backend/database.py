import os

try:
    from dotenv import load_dotenv
except Exception:  # pragma: no cover
    load_dotenv = None
from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

# Load .env for local development only (Railway/Vercel should use real env vars).
if load_dotenv is not None:
    load_dotenv()

# Railway MySQL may provide `mysql://...`; SQLAlchemy wants `mysql+pymysql://...`.
raw_database_url = os.getenv("DATABASE_URL") or "mysql+pymysql://root@localhost/mixindo_db"
if raw_database_url.startswith("mysql://"):
    DATABASE_URL = "mysql+pymysql://" + raw_database_url.removeprefix("mysql://")
else:
    DATABASE_URL = raw_database_url

SQLALCHEMY_ECHO = os.getenv("SQLALCHEMY_ECHO", "0") == "1"

engine = create_engine(
    DATABASE_URL,
    echo=SQLALCHEMY_ECHO,
    pool_pre_ping=True,
    pool_recycle=300,
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Shared Base for models defined in `backend.main`.
Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
