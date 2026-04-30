import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from dotenv import load_dotenv

# load .env (buat lokal)
load_dotenv()

# ambil dari environment variable
DATABASE_URL = os.getenv("DATABASE_URL")

# fallback kalau belum ada (biar tetap bisa jalan di lokal)
if not DATABASE_URL:
    DATABASE_URL = "mysql+pymysql://root@localhost/mixindo_db"

engine = create_engine(
    DATABASE_URL,
    echo=True,
    pool_pre_ping=True,
    pool_recycle=300
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()