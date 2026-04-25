import models
from database import engine

# Perintah ini akan otomatis membuat tabel di MySQL XAMPP berdasarkan models.py
print("Sedang menyelaraskan tabel ke database mixindo_db di XAMPP...")
models.Base.metadata.create_all(bind=engine)
print("Berhasil! Tabel 'users', 'projects', dan 'documents' sudah siap di phpMyAdmin.")