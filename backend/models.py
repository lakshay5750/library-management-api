from pydantic import BaseModel
from datetime import datetime
from typing import Optional

class UserLogin(BaseModel):
    email: str
    password: str

class Book(BaseModel):
    title: str
    author: str
    isbn: str
    category: str = "General"
    quantity: int
    location: str = "Main Section"

class IssueRequest(BaseModel):
    book_id: str
    student_email: str

class ReturnRequest(BaseModel):
    transaction_id: str

class SettingsUpdate(BaseModel):
    fine_per_day: int
    default_return_days: int