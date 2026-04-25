from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

# Menggunakan create_engine (bukan create_api_engine)
# Pastikan user 'root' dan database 'mixindo_db' sudah ada di XAMPP MySQL
SQLALCHEMY_DATABASE_URL = "mysql+pymysql://root@localhost/mixindo_db"

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