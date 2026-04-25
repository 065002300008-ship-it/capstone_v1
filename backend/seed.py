from database import SessionLocal
import models
from datetime import date

db = SessionLocal()

# Tambahkan User (Contoh: Ir. Siti Rahmawati)
user1 = models.User(
    id="USR-002", 
    full_name="Ir. Siti Rahmawati", 
    email="siti.rahmawati@mixindo.com", 
    role="Project Manager", 
    department="Project Management"
)

# Tambahkan Proyek (Contoh: Renovasi Gedung Utama)
project1 = models.Project(
    id="PRJ-001", 
    name="Renovasi Gedung Utama", 
    client_name="PT. Sinar Jaya", 
    start_date=date(2024, 6, 1), 
    deadline=date(2024, 12, 15), 
    status="In Progress", 
    progress=85
)

try:
    db.add(user1)
    db.add(project1)
    db.commit()
    print("Data simulasi (Seed Data) berhasil dimasukkan ke MySQL!")
except Exception as e:
    print(f"Gagal memasukkan data: {e}")
    db.rollback()
finally:
    db.close()