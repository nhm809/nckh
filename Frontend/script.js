// script.js
async function login() {
    const studentID = document.getElementById("loginStudentID").value.trim();
    const password = document.getElementById("password").value.trim();
    
    if (!studentID || !password) {
        document.getElementById("loginError").innerText = "Please enter all fields.";
        return;
    }

    // Gửi request đăng nhập
    const response = await fetch("http://localhost:3000/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentID, password })
    });

    const result = await response.json();
    if (response.ok) {
        document.getElementById("loginForm").style.display = "none";
        document.getElementById("displayStudentID").innerText = studentID;
        document.getElementById("mainContent").style.display = "block";

        if (/^S\d{4}$/.test(studentID)) {
            fetchStudentGrades(studentID);
        }
    } else {
        document.getElementById("loginError").innerText = result.message;
    }
}

// Hàm lấy điểm từ CSV và tự động gợi ý lộ trình
async function fetchStudentGrades(studentID) {
    try {
        const response = await fetch(`http://localhost:3000/get-grades?studentID=${studentID}`);
        const result = await response.json();

        if (response.ok) {
            document.getElementById("grades").value = JSON.stringify(result.grades, null, 2);
            recommendCourses();
        } else {
            alert(result.message);
        }
    } catch (error) {
        alert("Lỗi khi lấy điểm sinh viên.");
    }
}

// Kích hoạt đăng nhập khi nhấn Enter
document.addEventListener("DOMContentLoaded", function () {
    document.getElementById("loginForm").addEventListener("keydown", function (event) {
        if (event.key === "Enter") {
            event.preventDefault();
            login();
        }
    });
});

// Gợi ý lộ trình học tập (admin nhập điểm trước)
async function recommendCourses() {
    const studentID = document.getElementById("recommendStudentID").value;
    const grades = document.getElementById("grades").value;

    if (!studentID || !grades) {
        alert("Please enter both Student ID and grades in JSON format.");
        return;
    }

    try {
        const parsedGrades = JSON.parse(grades);
        const response = await fetch("http://localhost:3000/recommend-courses", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ studentID, grades: parsedGrades }),
        });

        const result = await response.json();
        document.getElementById("recommendations").innerHTML = `
            <h3>Recommended Courses:</h3>
            <p><strong>Courses:</strong> ${result.recommendedCourses.join(", ")}</p>
            <h3>Explanation:</h3>
            <ul>${result.recommendations.map(exp => `<li>${exp}</li>`).join('')}</ul>`;
    } catch (error) {
        alert("Invalid input format. Please check your JSON input.");
    }
}
