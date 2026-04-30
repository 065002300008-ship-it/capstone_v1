from sqlalchemy import Column, String, Integer, Date, DateTime
from sqlalchemy.ext.declarative import declarative_base
from datetime import datetime

Base = declarative_base()

# ================= PROJECT =================
class Project(Base):
    __tablename__ = "projects"

    id = Column(String(100), primary_key=True, index=True)
    name = Column(String(255))
    description = Column(String)
    client_name = Column(String(255))

    start_date = Column(Date)
    deadline = Column(Date)

    status = Column(String(100), default="Planning")
    priority = Column(String(50), default="Medium")
    budget = Column(Integer, default=0)

    progress = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)


# ================= TASK =================
class Task(Base):
    __tablename__ = "tasks"

    id = Column(String(100), primary_key=True, index=True)
    project_id = Column(String(100))
    name = Column(String(255))
    description = Column(String)

    status = Column(String(100), default="To Do")
    progress = Column(Integer, default=0)

    deadline = Column(Date)


# ================= TEST =================
class Test(Base):
    __tablename__ = "tests"

    id = Column(String(100), primary_key=True, index=True)
    project_name = Column(String(255))
    test_type = Column(String(255))
    test_date = Column(Date)

    status = Column(String(100), default="On Progress")
    result = Column(String(100), default="Pending")


# ================= REPORT =================
class Report(Base):
    __tablename__ = "reports"

    id = Column(String(100), primary_key=True, index=True)
    title = Column(String(255))
    project_name = Column(String(255))

    status = Column(String(100), default="Generated")
    created_at = Column(DateTime, default=datetime.utcnow)


# ================= DOCUMENT =================
class Document(Base):
    __tablename__ = "documents"

    id = Column(String(100), primary_key=True, index=True)
    name = Column(String(255))
    category = Column(String(100))
    project_id = Column(String(100))

    upload_date = Column(Date, default=datetime.utcnow)
    file_size = Column(String(50))
    file_path = Column(String(500))