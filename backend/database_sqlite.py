import sqlite3
from datetime import datetime
import os

DB_PATH = "library.db"

def get_db():
    """Get database connection"""
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_database():
    """Initialize SQLite tables with sample data"""
    conn = get_db()
    cursor = conn.cursor()
    
    # Create users table
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
    
    # Create books table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS books (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            author TEXT NOT NULL,
            isbn TEXT UNIQUE NOT NULL,
            category TEXT,
            quantity INTEGER DEFAULT 1,
            available INTEGER DEFAULT 1,
            location TEXT
        )
    ''')
    
    # Create transactions table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS transactions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            book_id INTEGER NOT NULL,
            book_title TEXT NOT NULL,
            student_email TEXT NOT NULL,
            student_name TEXT NOT NULL,
            issue_date TIMESTAMP NOT NULL,
            due_date TIMESTAMP NOT NULL,
            return_date TIMESTAMP,
            fine INTEGER DEFAULT 0,
            status TEXT DEFAULT 'issued'
        )
    ''')
    
    # Create settings table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS settings (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            fine_per_day INTEGER DEFAULT 5,
            default_return_days INTEGER DEFAULT 14
        )
    ''')
    
    # Initialize sample users
    cursor.execute("SELECT COUNT(*) as count FROM users")
    if cursor.fetchone()['count'] == 0:
        users_data = [
            ("admin@library.com", "admin123", "admin", "System Admin", 0),
            ("staff@library.com", "staff123", "staff", "Library Staff", 0),
            ("student@library.com", "student123", "student", "John Student", 0)
        ]
        cursor.executemany(
            "INSERT INTO users (email, password, role, name, fine) VALUES (?, ?, ?, ?, ?)",
            users_data
        )
    
    # Initialize sample books
    cursor.execute("SELECT COUNT(*) as count FROM books")
    if cursor.fetchone()['count'] == 0:
        books_data = [
            ("The Great Gatsby", "F. Scott Fitzgerald", "9780141182636", "Fiction", 3, 3, "Section A"),
            ("Python Programming", "Guido van Rossum", "9780596158101", "Technology", 5, 5, "Section B"),
            ("To Kill a Mockingbird", "Harper Lee", "9780061120084", "Fiction", 2, 2, "Section A"),
            ("1984", "George Orwell", "9780451524935", "Fiction", 4, 4, "Section A"),
            ("Clean Code", "Robert Martin", "9780132350884", "Technology", 2, 2, "Section B")
        ]
        cursor.executemany(
            "INSERT INTO books (title, author, isbn, category, quantity, available, location) VALUES (?, ?, ?, ?, ?, ?, ?)",
            books_data
        )
    
    # Initialize settings
    cursor.execute("SELECT COUNT(*) as count FROM settings")
    if cursor.fetchone()['count'] == 0:
        cursor.execute("INSERT INTO settings (fine_per_day, default_return_days) VALUES (?, ?)", (5, 14))
    
    conn.commit()
    conn.close()
    print("Database initialized successfully!")

# Helper function for async operations
async def execute_query(query: str, params: tuple = (), fetch_one=False, fetch_all=False, commit=False):
    """Execute SQL query and return results"""
    conn = get_db()
    cursor = conn.cursor()
    
    try:
        cursor.execute(query, params)
        
        if fetch_one:
            result = cursor.fetchone()
            result = dict(result) if result else None
        elif fetch_all:
            result = [dict(row) for row in cursor.fetchall()]
        else:
            result = cursor.lastrowid if not fetch_one and not fetch_all else None
        
        if commit:
            conn.commit()
        
        return result
    except Exception as e:
        print(f"Database error: {e}")
        raise
    finally:
        conn.close()