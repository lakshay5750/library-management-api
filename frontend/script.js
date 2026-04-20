// CHANGE: Dynamic API URL for Render deployment
const API_URL =
  window.location.hostname === "localhost" ||
  window.location.hostname === "127.0.0.1"
    ? "http://localhost:8000/api"
    : "https://library-management-api-7tua.onrender.com"; // CHANGE: Replace with your actual backend URL after deployment

// The rest of your existing script.js code continues below...
// Make sure ALL fetch() calls use API_URL instead of hardcoded URLs

let authToken = localStorage.getItem("token");

// Check authentication on page load
if (
  window.location.pathname.includes(".html") &&
  !window.location.pathname.includes("index.html")
) {
  if (!authToken) {
    window.location.href = "index.html";
  } else {
    loadUserInfo();
    loadInitialData();
  }
}

// Login handler
document.getElementById("loginForm")?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const email = document.getElementById("email").value;
  const password = document.getElementById("password").value;

  try {
    const response = await fetch(`${API_URL}/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    const data = await response.json();

    if (data.success) {
      localStorage.setItem("token", data.token);
      localStorage.setItem("role", data.role);
      localStorage.setItem("name", data.name);
      localStorage.setItem("email", data.email);

      if (data.role === "admin") window.location.href = "admin.html";
      else if (data.role === "staff") window.location.href = "staff.html";
      else window.location.href = "student.html";
    } else {
      alert("Login failed! Check credentials.");
    }
  } catch (error) {
    alert("Login error: " + error.message);
  }
});

// Logout function
async function logout() {
  await fetch(`${API_URL}/logout`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token: authToken }),
  });
  localStorage.clear();
  window.location.href = "index.html";
}

// Load user info
async function loadUserInfo() {
  const userName = localStorage.getItem("name") || "User";
  const userEmail = localStorage.getItem("email") || "";

  document.getElementById("userName").innerText = userName;

  // Load fine for student dashboard
  if (window.location.pathname.includes("student.html")) {
    await loadStudentFine();
  }
}

// Load initial data based on role
async function loadInitialData() {
  const role = localStorage.getItem("role");
  const userEmail = localStorage.getItem("email");

  if (role === "admin") {
    loadStaffList();
    loadBooks();
    loadSettings();
    loadIssuedBooks();
  } else if (role === "staff") {
    loadBooks();
    loadIssuedBooks();
    loadAvailableBooksForIssue();
    loadIssuedBooksForReturn();
  } else if (role === "student") {
    await loadBooks();
    await loadMyBooks();
    await loadStudentFine();
  }
}

// ========== BOOK FUNCTIONS ==========
async function loadBooks() {
  try {
    const response = await fetch(`${API_URL}/books`, {
      headers: { Authorization: `Bearer ${authToken}` },
    });
    const books = await response.json();
    displayBooks(books);
  } catch (error) {
    console.error("Error loading books:", error);
    const container = document.getElementById("booksList");
    if (container)
      container.innerHTML =
        "<p>Error loading books. Make sure backend is running.</p>";
  }
}

async function searchBooks() {
  const searchTerm = document.getElementById("searchBooks")?.value || "";
  try {
    const response = await fetch(`${API_URL}/books?search=${searchTerm}`, {
      headers: { Authorization: `Bearer ${authToken}` },
    });
    const books = await response.json();
    displayBooks(books);
  } catch (error) {
    console.error("Error searching books:", error);
  }
}

function displayBooks(books) {
  const container = document.getElementById("booksList");
  if (!container) return;

  if (!books || books.length === 0) {
    container.innerHTML = "<p>No books found.</p>";
    return;
  }

  container.innerHTML = books
    .map(
      (book) => `
        <div class="book-item">
            <div class="book-info">
                <h4>${book.title}</h4>
                <p>By ${book.author} | ISBN: ${book.isbn} | Location: ${book.location}</p>
                <p>Available: <span class="available-badge ${book.available === 0 ? "unavailable-badge" : ""}">${book.available}/${book.quantity}</span></p>
            </div>
            ${
              localStorage.getItem("role") === "student" && book.available > 0
                ? `<button onclick="issueBook('${book._id}')" class="btn-primary">Issue</button>`
                : ""
            }
            ${
              localStorage.getItem("role") !== "student"
                ? `<button onclick="deleteBook('${book._id}')" class="btn-danger">Delete</button>`
                : ""
            }
        </div>
    `,
    )
    .join("");
}

// Add book
document
  .getElementById("addBookForm")
  ?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const bookData = {
      title: document.getElementById("bookTitle").value,
      author: document.getElementById("bookAuthor").value,
      isbn: document.getElementById("bookISBN").value,
      category: document.getElementById("bookCategory")?.value || "General",
      quantity: parseInt(document.getElementById("bookQuantity").value),
      location:
        document.getElementById("bookLocation")?.value || "Main Section",
    };

    try {
      const response = await fetch(`${API_URL}/books`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify(bookData),
      });

      if (response.ok) {
        alert("Book added successfully!");
        loadBooks();
        e.target.reset();
      } else {
        alert("Failed to add book");
      }
    } catch (error) {
      alert("Error adding book: " + error.message);
    }
  });

async function deleteBook(bookId) {
  if (confirm("Are you sure you want to delete this book?")) {
    try {
      await fetch(`${API_URL}/books/${bookId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${authToken}` },
      });
      loadBooks();
    } catch (error) {
      alert("Error deleting book: " + error.message);
    }
  }
}

// ========== ISSUE/RETURN FUNCTIONS ==========
async function issueBook(bookId) {
  const studentEmail =
    localStorage.getItem("role") === "student"
      ? localStorage.getItem("email")
      : prompt("Enter student email:");

  if (!studentEmail) return;

  try {
    const response = await fetch(`${API_URL}/issue-book`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({ book_id: bookId, student_email: studentEmail }),
    });

    const data = await response.json();
    if (response.ok) {
      alert(
        `Book issued successfully! Due date: ${new Date(data.due_date).toLocaleDateString()}`,
      );
      loadBooks();
      if (localStorage.getItem("role") === "student") {
        loadMyBooks();
        loadStudentFine();
      } else {
        loadIssuedBooks();
      }
    } else {
      alert(data.detail || "Failed to issue book");
    }
  } catch (error) {
    alert("Error issuing book: " + error.message);
  }
}

async function returnBook(transactionId) {
  if (!transactionId) return;

  try {
    const response = await fetch(`${API_URL}/return-book`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({ transaction_id: transactionId }),
    });

    const data = await response.json();
    if (response.ok) {
      alert(`Book returned successfully! Fine: ₹${data.fine}`);
      if (localStorage.getItem("role") === "student") {
        loadMyBooks();
        loadStudentFine();
      }
      loadBooks();
      loadIssuedBooks();
    } else {
      alert(data.detail || "Failed to return book");
    }
  } catch (error) {
    alert("Error returning book: " + error.message);
  }
}

// Student: Load my issued books
async function loadMyBooks() {
  const userEmail = localStorage.getItem("email");
  if (!userEmail) return;

  try {
    const response = await fetch(`${API_URL}/my-books?email=${userEmail}`, {
      headers: { Authorization: `Bearer ${authToken}` },
    });
    const books = await response.json();
    displayMyBooks(books);
  } catch (error) {
    console.error("Error loading my books:", error);
    const container = document.getElementById("myBooksList");
    if (container) container.innerHTML = "<p>Error loading your books.</p>";
  }
}

function displayMyBooks(books) {
  const container = document.getElementById("myBooksList");
  if (!container) return;

  if (!books || books.length === 0) {
    container.innerHTML = "<p>You have no issued books.</p>";
    return;
  }

  container.innerHTML = books
    .map(
      (book) => `
        <div class="book-item">
            <div class="book-info">
                <h4>${book.book_title}</h4>
                <p>Issued: ${new Date(book.issue_date).toLocaleDateString()}</p>
                <p>Due Date: ${new Date(book.due_date).toLocaleDateString()}</p>
                <p>Status: ${book.status}</p>
            </div>
            <button onclick="returnBook('${book._id}')" class="btn-primary">Return</button>
        </div>
    `,
    )
    .join("");
}

// Load student fine
async function loadStudentFine() {
  const userEmail = localStorage.getItem("email");
  if (!userEmail) return;

  try {
    const response = await fetch(`${API_URL}/student-fine?email=${userEmail}`, {
      headers: { Authorization: `Bearer ${authToken}` },
    });
    const data = await response.json();

    const fineAmount = data.fine || 0;
    const fineElement = document.getElementById("fineAmount");
    if (fineElement) {
      fineElement.innerText = `Fine: ₹${fineAmount}`;
      if (fineAmount > 0) {
        fineElement.style.background = "#dc3545";
        fineElement.style.color = "white";
      } else {
        fineElement.style.background = "#28a745";
        fineElement.style.color = "white";
      }
    }
  } catch (error) {
    console.error("Error loading fine:", error);
    const fineElement = document.getElementById("fineAmount");
    if (fineElement) {
      fineElement.innerText = "Fine: ₹0";
    }
  }
}

// Staff: Load all issued books
async function loadIssuedBooks() {
  try {
    const response = await fetch(`${API_URL}/all-issued-books`, {
      headers: { Authorization: `Bearer ${authToken}` },
    });
    const books = await response.json();
    displayIssuedBooks(books);
  } catch (error) {
    console.error("Error loading issued books:", error);
  }
}

function displayIssuedBooks(books) {
  const container = document.getElementById("issuedBooksList");
  if (!container) return;

  if (!books || books.length === 0) {
    container.innerHTML = "<p>No books currently issued.</p>";
    return;
  }

  container.innerHTML = `
        <table style="width:100%; border-collapse: collapse;">
            <thead>
                <tr><th style="padding:10px; text-align:left; background:#f5f5f5;">Book Title</th>
                    <th style="padding:10px; text-align:left; background:#f5f5f5;">Student</th>
                    <th style="padding:10px; text-align:left; background:#f5f5f5;">Issue Date</th>
                    <th style="padding:10px; text-align:left; background:#f5f5f5;">Due Date</th>
                </tr>
            </thead>
            <tbody>
                ${books
                  .map(
                    (book) => `
                    <tr>
                        <td style="padding:10px; border-bottom:1px solid #ddd;">${book.book_title}</td>
                        <td style="padding:10px; border-bottom:1px solid #ddd;">${book.student_name} (${book.student_email})</td>
                        <td style="padding:10px; border-bottom:1px solid #ddd;">${new Date(book.issue_date).toLocaleDateString()}</td>
                        <td style="padding:10px; border-bottom:1px solid #ddd;">${new Date(book.due_date).toLocaleDateString()}</td>
                    </tr>
                `,
                  )
                  .join("")}
            </tbody>
        </table>
    `;
}

// Staff: Load available books for issuing
async function loadAvailableBooksForIssue() {
  try {
    const response = await fetch(`${API_URL}/books`, {
      headers: { Authorization: `Bearer ${authToken}` },
    });
    const books = await response.json();
    const availableBooks = books.filter((b) => b.available > 0);

    const select = document.getElementById("issueBookId");
    if (select) {
      select.innerHTML = availableBooks
        .map(
          (book) =>
            `<option value="${book._id}">${book.title} (${book.available} available)</option>`,
        )
        .join("");

      if (availableBooks.length === 0) {
        select.innerHTML = "<option>No books available</option>";
      }
    }
  } catch (error) {
    console.error("Error loading available books:", error);
  }
}

// Staff: Load issued books for return dropdown
async function loadIssuedBooksForReturn() {
  try {
    const response = await fetch(`${API_URL}/all-issued-books`, {
      headers: { Authorization: `Bearer ${authToken}` },
    });
    const books = await response.json();

    const select = document.getElementById("returnTransactionId");
    if (select) {
      select.innerHTML = books
        .map(
          (book) =>
            `<option value="${book._id}">${book.book_title} - ${book.student_name}</option>`,
        )
        .join("");

      if (books.length === 0) {
        select.innerHTML = "<option>No issued books</option>";
      }
    }
  } catch (error) {
    console.error("Error loading issued books:", error);
  }
}

// Issue form for staff
document.getElementById("issueForm")?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const bookId = document.getElementById("issueBookId").value;
  const studentEmail = document.getElementById("studentEmail").value;

  if (!bookId || bookId === "No books available") {
    alert("Please select a valid book");
    return;
  }

  try {
    const response = await fetch(`${API_URL}/issue-book`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({ book_id: bookId, student_email: studentEmail }),
    });

    if (response.ok) {
      alert("Book issued successfully!");
      e.target.reset();
      loadAvailableBooksForIssue();
      loadIssuedBooksForReturn();
      loadIssuedBooks();
      loadBooks();
    } else {
      const error = await response.json();
      alert(error.detail || "Failed to issue book");
    }
  } catch (error) {
    alert("Error issuing book: " + error.message);
  }
});

// ========== ADMIN FUNCTIONS ==========
async function loadStaffList() {
  try {
    const response = await fetch(`${API_URL}/staff`, {
      headers: { Authorization: `Bearer ${authToken}` },
    });
    const staff = await response.json();

    const container = document.getElementById("staffList");
    if (container) {
      if (staff.length === 0) {
        container.innerHTML = "<p>No staff members found.</p>";
        return;
      }

      container.innerHTML = staff
        .map(
          (member) => `
                <div class="staff-item">
                    <div>
                        <strong>${member.name}</strong><br>
                        ${member.email}
                    </div>
                    <button onclick="deleteStaff('${member.email}')" class="btn-danger">Delete</button>
                </div>
            `,
        )
        .join("");
    }
  } catch (error) {
    console.error("Error loading staff:", error);
  }
}

// Add staff form
document
  .getElementById("addStaffForm")
  ?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const staffData = {
      name: document.getElementById("staffName").value,
      email: document.getElementById("staffEmail").value,
      password: document.getElementById("staffPassword").value,
    };

    try {
      const response = await fetch(`${API_URL}/staff`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify(staffData),
      });

      if (response.ok) {
        alert("Staff added successfully!");
        loadStaffList();
        e.target.reset();
      } else {
        alert("Failed to add staff");
      }
    } catch (error) {
      alert("Error adding staff: " + error.message);
    }
  });

async function deleteStaff(email) {
  if (confirm("Delete this staff member?")) {
    try {
      await fetch(`${API_URL}/staff/${email}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${authToken}` },
      });
      loadStaffList();
    } catch (error) {
      alert("Error deleting staff: " + error.message);
    }
  }
}

// Settings functions
async function loadSettings() {
  try {
    const response = await fetch(`${API_URL}/settings`);
    const settings = await response.json();

    document.getElementById("finePerDay").value = settings.fine_per_day;
    document.getElementById("returnDays").value = settings.default_return_days;
  } catch (error) {
    console.error("Error loading settings:", error);
  }
}

document
  .getElementById("settingsForm")
  ?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const settings = {
      fine_per_day: parseInt(document.getElementById("finePerDay").value),
      default_return_days: parseInt(
        document.getElementById("returnDays").value,
      ),
    };

    try {
      const response = await fetch(`${API_URL}/settings`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify(settings),
      });

      if (response.ok) {
        alert("Settings updated successfully!");
      } else {
        alert("Failed to update settings");
      }
    } catch (error) {
      alert("Error updating settings: " + error.message);
    }
  });

// Student Management Functions
document
  .getElementById("addStudentForm")
  ?.addEventListener("submit", async (e) => {
    e.preventDefault();

    const studentData = {
      name: document.getElementById("studentName").value,
      email: document.getElementById("studentEmail").value,
      password: document.getElementById("studentPassword").value,
    };

    try {
      const response = await fetch(`${API_URL}/students`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify(studentData),
      });

      if (response.ok) {
        alert("Student added successfully!");
        loadStudentsList();
        e.target.reset();
      } else {
        const error = await response.json();
        alert("Error: " + (error.detail || "Failed to add student"));
      }
    } catch (error) {
      alert("Error adding student: " + error.message);
    }
  });

async function loadStudentsList() {
  try {
    const response = await fetch(`${API_URL}/students`, {
      headers: { Authorization: `Bearer ${authToken}` },
    });
    const students = await response.json();
    displayStudents(students);
  } catch (error) {
    console.error("Error loading students:", error);
  }
}

function displayStudents(students) {
  const container = document.getElementById("studentsList");
  if (!container) return;

  if (!students || students.length === 0) {
    container.innerHTML = "<p>No students found.</p>";
    return;
  }

  container.innerHTML = `
        <table style="width:100%; border-collapse: collapse;">
            <thead>
                <tr><th style="padding:10px; text-align:left;">Name</th>
                    <th style="padding:10px; text-align:left;">Email</th>
                    <th style="padding:10px; text-align:left;">Fine (₹)</th>
                    <th style="padding:10px; text-align:left;">Action</th>
                </tr>
            </thead>
            <tbody>
                ${students
                  .map(
                    (student) => `
                    <tr>
                        <td style="padding:10px; border-bottom:1px solid #ddd;">${student.name}</td>
                        <td style="padding:10px; border-bottom:1px solid #ddd;">${student.email}</td>
                        <td style="padding:10px; border-bottom:1px solid #ddd;">${student.fine || 0}</td>
                        <td style="padding:10px; border-bottom:1px solid #ddd;">
                            <button onclick="deleteStudent('${student.email}')" class="btn-danger">Delete</button>
                        </td>
                    </tr>
                `,
                  )
                  .join("")}
            </tbody>
        </table>
    `;
}

async function deleteStudent(email) {
  if (confirm(`Delete student: ${email}?`)) {
    try {
      const response = await fetch(`${API_URL}/students/${email}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${authToken}` },
      });

      if (response.ok) {
        alert("Student deleted successfully!");
        loadStudentsList();
      } else {
        const error = await response.json();
        alert("Error: " + (error.detail || "Failed to delete student"));
      }
    } catch (error) {
      alert("Error deleting student: " + error.message);
    }
  }
}

// Section switching
function showSection(sectionName) {
  document.querySelectorAll(".section").forEach((section) => {
    section.classList.remove("active");
  });
  document.getElementById(`${sectionName}Section`).classList.add("active");

  // Load data when switching sections
  if (sectionName === "students") {
    loadStudentsList();
  } else if (sectionName === "staff") {
    loadStaffList();
  } else if (sectionName === "books") {
    loadBooks();
  } else if (sectionName === "issued") {
    loadIssuedBooks();
  }
}
// Staff: Return book function
// ========== STAFF RETURN BOOK FUNCTION ==========

// Load issued books when return section is shown
async function loadIssuedBooksForReturn() {
  try {
    const response = await fetch(`${API_URL}/all-issued-books`, {
      headers: { Authorization: `Bearer ${authToken}` },
    });

    if (!response.ok) {
      throw new Error("Failed to fetch issued books");
    }

    const books = await response.json();
    const select = document.getElementById("returnTransactionId");

    if (select) {
      if (!books || books.length === 0) {
        select.innerHTML =
          '<option value="">📭 No books currently issued</option>';
        select.disabled = true;
      } else {
        select.disabled = false;
        select.innerHTML =
          '<option value="">-- Select a book to return --</option>' +
          books
            .map((book) => {
              const dueDate = new Date(book.due_date);
              const today = new Date();
              const isOverdue = dueDate < today;
              const overdueText = isOverdue ? " ⚠️ OVERDUE" : "";
              return `<option value="${book._id}">📖 ${book.book_title} - 👤 ${book.student_name} - Due: ${dueDate.toLocaleDateString()}${overdueText}</option>`;
            })
            .join("");
      }
    }
  } catch (error) {
    console.error("Error loading issued books:", error);
    const select = document.getElementById("returnTransactionId");
    if (select) {
      select.innerHTML = '<option value="">❌ Error loading books</option>';
    }
  }
}

// Return book function for staff
async function returnBookStaff() {
  const select = document.getElementById("returnTransactionId");
  const transactionId = select?.value;

  if (!transactionId || transactionId === "") {
    alert("⚠️ Please select a book to return");
    return;
  }

  // Get selected book text for confirmation
  const selectedOption = select.options[select.selectedIndex];
  const bookInfo = selectedOption?.text || "this book";

  if (!confirm(`Are you sure you want to return ${bookInfo}?`)) {
    return;
  }

  // Show loading state
  const returnButton = document.querySelector("#returnSection .btn-primary");
  const originalButtonText = returnButton?.innerHTML || "Return Book";
  if (returnButton) {
    returnButton.innerHTML = "⏳ Processing...";
    returnButton.disabled = true;
  }

  try {
    const response = await fetch(`${API_URL}/return-book`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({ transaction_id: transactionId }),
    });

    const data = await response.json();

    if (response.ok) {
      const fineAmount = data.fine || 0;

      if (fineAmount > 0) {
        alert(
          `✅ Book returned successfully!\n💰 Fine collected: ₹${fineAmount}`,
        );
      } else {
        alert("✅ Book returned successfully! No fine.");
      }

      // Refresh all data
      await loadIssuedBooksForReturn(); // Refresh the dropdown
      await loadIssuedBooks(); // Refresh the issued books list
      await loadBooks(); // Refresh book availability
      await loadAvailableBooksForIssue(); // Refresh issue dropdown
    } else {
      alert(`❌ Failed to return book: ${data.detail || "Unknown error"}`);
    }
  } catch (error) {
    console.error("Error returning book:", error);
    alert(`❌ Error returning book: ${error.message}`);
  } finally {
    // Reset button
    if (returnButton) {
      returnButton.innerHTML = originalButtonText;
      returnButton.disabled = false;
    }
  }
}

// Make sure the return section loads data when shown
// Update the showSection function
const originalShowSection = window.showSection;
window.showSection = function (sectionName) {
  if (originalShowSection) {
    originalShowSection(sectionName);
  } else {
    // Hide all sections
    document.querySelectorAll(".section").forEach((section) => {
      section.classList.remove("active");
    });
    // Show selected section
    const selectedSection = document.getElementById(`${sectionName}Section`);
    if (selectedSection) {
      selectedSection.classList.add("active");
    }
    // Update active button
    document.querySelectorAll(".sidebar-btn").forEach((btn) => {
      btn.classList.remove("active");
      if (btn.textContent.toLowerCase().includes(sectionName.toLowerCase())) {
        btn.classList.add("active");
      }
    });
  }

  // Load specific data when section is shown
  if (sectionName === "return") {
    loadIssuedBooksForReturn();
  } else if (sectionName === "issued") {
    loadIssuedBooks();
  } else if (sectionName === "books") {
    loadBooks();
  } else if (sectionName === "issue") {
    loadAvailableBooksForIssue();
  }
};
