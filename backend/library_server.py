from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from datetime import datetime, timedelta
from typing import Optional
import sqlite3
import os

app = FastAPI()

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize SQLite database
DB_FILE = "library.db"

def init_database():
    """Create tables and sample data"""
    conn = sqlite3.connect(DB_FILE)
    cursor = conn.cursor()
    
    # Users table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            email TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL,
            role TEXT NOT NULL,
            name TEXT NOT NULL,
            fine INTEGER DEFAULT 0
        )
    ''')
    
    # Books table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS books (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            author TEXT NOT NULL,
            isbn TEXT UNIQUE,
            category TEXT,
            quantity INTEGER DEFAULT 1,
            available INTEGER DEFAULT 1,
            location TEXT
        )
    ''')
    
    # Transactions table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS transactions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            book_id INTEGER NOT NULL,
            book_title TEXT NOT NULL,
            student_email TEXT NOT NULL,
            student_name TEXT NOT NULL,
            issue_date TEXT NOT NULL,
            due_date TEXT NOT NULL,
            return_date TEXT,
            fine INTEGER DEFAULT 0,
            status TEXT DEFAULT 'issued'
        )
    ''')
    
    # Settings table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS settings (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            fine_per_day INTEGER DEFAULT 5,
            default_return_days INTEGER DEFAULT 14
        )
    ''')
    
    # Insert sample users
    cursor.execute("SELECT COUNT(*) FROM users")
    if cursor.fetchone()[0] == 0:
        users_data = [
            ("admin@library.com", "admin123", "admin", "System Administrator", 0),
            ("staff@library.com", "staff123", "staff", "Library Staff", 0),
            ("student@library.com", "student123", "student", "John Student", 0)
        ]
        cursor.executemany("INSERT INTO users (email, password, role, name, fine) VALUES (?, ?, ?, ?, ?)", users_data)
    
    # Insert sample books
    cursor.execute("SELECT COUNT(*) FROM books")
    if cursor.fetchone()[0] == 0:
        books_data = [
            ("The Great Gatsby", "F. Scott Fitzgerald", "9780141182636", "Fiction", 3, 3, "Section A"),
            ("Python Programming", "Guido van Rossum", "9780596158101", "Technology", 5, 5, "Section B"),
            ("To Kill a Mockingbird", "Harper Lee", "9780061120084", "Fiction", 2, 2, "Section A"),
        ]
        cursor.executemany("INSERT INTO books (title, author, isbn, category, quantity, available, location) VALUES (?, ?, ?, ?, ?, ?, ?)", books_data)
    
    # Insert settings
    cursor.execute("SELECT COUNT(*) FROM settings")
    if cursor.fetchone()[0] == 0:
        cursor.execute("INSERT INTO settings (fine_per_day, default_return_days) VALUES (?, ?)", (5, 14))
    
    conn.commit()
    conn.close()
    print("✅ Database initialized successfully!")

# Initialize database
init_database()

# Session storage
active_sessions = {}

def get_db():
    """Get database connection"""
    conn = sqlite3.connect(DB_FILE)
    conn.row_factory = sqlite3.Row
    return conn

# ========== AUTHENTICATION ==========
@app.post("/api/login")
def login(user_data: dict):
    email = user_data.get('email')
    password = user_data.get('password')
    
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM users WHERE email = ? AND password = ?", (email, password))
    user = cursor.fetchone()
    conn.close()
    
    if user:
        token = f"{email}_{datetime.now().timestamp()}"
        active_sessions[token] = {
            'email': user['email'],
            'role': user['role'],
            'name': user['name']
        }
        return {
            "success": True,
            "token": token,
            "role": user['role'],
            "name": user['name'],
            "email": user['email']
        }
    
    return {"success": False, "message": "Invalid credentials"}

@app.post("/api/logout")
def logout(request: dict):
    token = request.get('token', '')
    if token in active_sessions:
        del active_sessions[token]
    return {"success": True}

# ========== BOOKS MANAGEMENT ==========
@app.get("/api/books")
def get_books(search: Optional[str] = None):
    conn = get_db()
    cursor = conn.cursor()
    
    if search:
        cursor.execute("""
            SELECT * FROM books 
            WHERE title LIKE ? OR author LIKE ? OR isbn LIKE ?
        """, (f"%{search}%", f"%{search}%", f"%{search}%"))
    else:
        cursor.execute("SELECT * FROM books")
    
    books = cursor.fetchall()
    conn.close()
    
    result = []
    for book in books:
        result.append({
            "_id": str(book['id']),
            "title": book['title'],
            "author": book['author'],
            "isbn": book['isbn'],
            "category": book['category'],
            "quantity": book['quantity'],
            "available": book['available'],
            "location": book['location']
        })
    
    return result

@app.post("/api/books")
def add_book(book: dict):
    conn = get_db()
    cursor = conn.cursor()
    
    cursor.execute("""
        INSERT INTO books (title, author, isbn, category, quantity, available, location)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    """, (
        book['title'], book['author'], book['isbn'],
        book.get('category', 'General'),
        book['quantity'], book['quantity'],
        book.get('location', 'Main Section')
    ))
    
    book_id = cursor.lastrowid
    conn.commit()
    conn.close()
    
    return {"success": True, "_id": str(book_id)}

@app.delete("/api/books/{book_id}")
def delete_book(book_id: int):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM books WHERE id = ?", (book_id,))
    conn.commit()
    conn.close()
    return {"success": True}

# ========== ISSUE/RETURN BOOKS ==========
@app.post("/api/issue-book")
def issue_book(data: dict):
    book_id = data.get('book_id')
    student_email = data.get('student_email')
    
    conn = get_db()
    cursor = conn.cursor()
    
    cursor.execute("SELECT * FROM books WHERE id = ?", (book_id,))
    book = cursor.fetchone()
    
    if not book:
        conn.close()
        raise HTTPException(status_code=404, detail="Book not found")
    
    if book['available'] <= 0:
        conn.close()
        raise HTTPException(status_code=400, detail="Book not available")
    
    cursor.execute("SELECT * FROM users WHERE email = ? AND role = 'student'", (student_email,))
    student = cursor.fetchone()
    
    if not student:
        conn.close()
        raise HTTPException(status_code=404, detail="Student not found")
    
    cursor.execute("SELECT * FROM settings LIMIT 1")
    settings = cursor.fetchone()
    return_days = settings['default_return_days']
    due_date = datetime.now() + timedelta(days=return_days)
    
    cursor.execute("""
        INSERT INTO transactions (book_id, book_title, student_email, student_name, issue_date, due_date, status)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    """, (
        book['id'], book['title'], student_email, student['name'],
        datetime.now().isoformat(), due_date.isoformat(), 'issued'
    ))
    
    cursor.execute("UPDATE books SET available = available - 1 WHERE id = ?", (book_id,))
    
    conn.commit()
    conn.close()
    
    return {"success": True, "due_date": due_date.isoformat()}

@app.post("/api/return-book")
def return_book(data: dict):
    transaction_id = data.get('transaction_id')
    
    conn = get_db()
    cursor = conn.cursor()
    
    cursor.execute("SELECT * FROM transactions WHERE id = ?", (transaction_id,))
    transaction = cursor.fetchone()
    
    if not transaction:
        conn.close()
        raise HTTPException(status_code=404, detail="Transaction not found")
    
    cursor.execute("SELECT * FROM settings LIMIT 1")
    settings = cursor.fetchone()
    fine_per_day = settings['fine_per_day']
    
    today = datetime.now()
    due_date = datetime.fromisoformat(transaction['due_date'])
    fine = 0
    
    if today > due_date:
        days_late = (today - due_date).days
        fine = days_late * fine_per_day
    
    cursor.execute("""
        UPDATE transactions 
        SET return_date = ?, fine = ?, status = 'returned' 
        WHERE id = ?
    """, (today.isoformat(), fine, transaction_id))
    
    cursor.execute("UPDATE books SET available = available + 1 WHERE id = ?", (transaction['book_id'],))
    
    if fine > 0:
        cursor.execute("UPDATE users SET fine = fine + ? WHERE email = ?", (fine, transaction['student_email']))
    
    conn.commit()
    conn.close()
    
    return {"success": True, "fine": fine}

# ========== TRANSACTIONS ==========
@app.get("/api/my-books")
def get_my_books(email: str):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT * FROM transactions 
        WHERE student_email = ? AND status = 'issued'
    """, (email,))
    transactions = cursor.fetchall()
    conn.close()
    
    result = []
    for trans in transactions:
        result.append({
            "_id": str(trans['id']),
            "book_title": trans['book_title'],
            "issue_date": trans['issue_date'],
            "due_date": trans['due_date'],
            "status": trans['status']
        })
    
    return result

@app.get("/api/all-issued-books")
def get_all_issued_books():
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM transactions WHERE status = 'issued'")
    transactions = cursor.fetchall()
    conn.close()
    
    result = []
    for trans in transactions:
        result.append({
            "_id": str(trans['id']),
            "book_title": trans['book_title'],
            "student_name": trans['student_name'],
            "student_email": trans['student_email'],
            "issue_date": trans['issue_date'],
            "due_date": trans['due_date']
        })
    
    return result

@app.get("/api/student-fine")
def get_student_fine(email: str):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT fine FROM users WHERE email = ?", (email,))
    user = cursor.fetchone()
    conn.close()
    
    return {"fine": user['fine'] if user else 0}

# ========== SETTINGS ==========
@app.get("/api/settings")
def get_settings():
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM settings LIMIT 1")
    settings = cursor.fetchone()
    conn.close()
    
    return {
        "fine_per_day": settings['fine_per_day'],
        "default_return_days": settings['default_return_days']
    }

@app.put("/api/settings")
def update_settings(settings_data: dict):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("""
        UPDATE settings 
        SET fine_per_day = ?, default_return_days = ?
    """, (settings_data['fine_per_day'], settings_data['default_return_days']))
    conn.commit()
    conn.close()
    
    return {"success": True}

# ========== STAFF MANAGEMENT ==========
@app.get("/api/staff")
def get_staff():
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT id, email, name, role FROM users WHERE role = 'staff'")
    staff = cursor.fetchall()
    conn.close()
    
    result = []
    for member in staff:
        result.append({
            "_id": str(member['id']),
            "email": member['email'],
            "name": member['name'],
            "role": member['role']
        })
    
    return result

@app.post("/api/staff")
def add_staff(staff_data: dict):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("""
        INSERT INTO users (email, password, role, name, fine)
        VALUES (?, ?, 'staff', ?, 0)
    """, (staff_data['email'], staff_data['password'], staff_data['name']))
    conn.commit()
    conn.close()
    
    return {"success": True}

@app.delete("/api/staff/{staff_email}")
def delete_staff(staff_email: str):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM users WHERE email = ? AND role = 'staff'", (staff_email,))
    conn.commit()
    conn.close()
    
    return {"success": True}

# ========== STUDENT MANAGEMENT (NEW) ==========
@app.get("/api/students")
def get_students(search: Optional[str] = None):
    """Get all students"""
    conn = get_db()
    cursor = conn.cursor()
    
    if search:
        cursor.execute("""
            SELECT id, email, name, role, fine 
            FROM users 
            WHERE role = 'student' AND (email LIKE ? OR name LIKE ?)
        """, (f"%{search}%", f"%{search}%"))
    else:
        cursor.execute("SELECT id, email, name, role, fine FROM users WHERE role = 'student'")
    
    students = cursor.fetchall()
    conn.close()
    
    result = []
    for student in students:
        result.append({
            "_id": str(student['id']),
            "email": student['email'],
            "name": student['name'],
            "role": student['role'],
            "fine": student['fine']
        })
    
    return result

@app.post("/api/students")
def add_student(student_data: dict):
    """Add new student"""
    conn = get_db()
    cursor = conn.cursor()
    
    # Check if email already exists
    cursor.execute("SELECT id FROM users WHERE email = ?", (student_data['email'],))
    if cursor.fetchone():
        conn.close()
        raise HTTPException(status_code=400, detail="Email already exists")
    
    # Insert new student
    cursor.execute("""
        INSERT INTO users (email, password, role, name, fine)
        VALUES (?, ?, 'student', ?, 0)
    """, (
        student_data['email'],
        student_data.get('password', 'password123'),
        student_data['name']
    ))
    
    student_id = cursor.lastrowid
    conn.commit()
    conn.close()
    
    return {"success": True, "_id": str(student_id), "message": "Student added successfully"}

@app.delete("/api/students/{student_email}")
def delete_student(student_email: str):
    """Delete student"""
    conn = get_db()
    cursor = conn.cursor()
    
    # Check if student has issued books
    cursor.execute("""
        SELECT COUNT(*) as count FROM transactions 
        WHERE student_email = ? AND status = 'issued'
    """, (student_email,))
    
    if cursor.fetchone()['count'] > 0:
        conn.close()
        raise HTTPException(status_code=400, detail="Cannot delete student with issued books")
    
    # Delete student
    cursor.execute("DELETE FROM users WHERE email = ? AND role = 'student'", (student_email,))
    conn.commit()
    conn.close()
    
    return {"success": True, "message": "Student deleted successfully"}

# ========== HEALTH CHECK ==========
@app.get("/api/health")
def health_check():
    return {"status": "healthy", "database": "connected"}

@app.get("/")
def root():
    return {
        "message": "Library Management System API",
        "version": "1.0",
        "status": "running",
        "endpoints": {
            "docs": "/docs",
            "login": "/api/login",
            "books": "/api/books",
            "students": "/api/students",
            "staff": "/api/staff",
            "settings": "/api/settings"
        }
    }

if __name__ == "__main__":
    import uvicorn
    print("\n" + "="*60)
    print("📚 LIBRARY MANAGEMENT SYSTEM")
    print("="*60)
    print("\n✅ Backend server starting...")
    print("\n📍 Access URLs:")
    print("   • Main API: http://localhost:8000")
    print("   • API Docs: http://localhost:8000/docs")
    print("   • Students API: http://localhost:8000/api/students")
    print("\n🔐 Login Credentials:")
    print("   👑 Admin:  admin@library.com / admin123")
    print("   👔 Staff:  staff@library.com / staff123")
    print("   🧑‍🎓 Student: student@library.com / student123")
    print("\n⚠️  Press CTRL+C to stop the server")
    print("="*60 + "\n")
    
    uvicorn.run(app, host="127.0.0.1", port=8000, log_level="info")