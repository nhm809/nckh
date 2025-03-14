//scrip.js
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

        // Nếu là sinh viên, lấy điểm từ CSV và gợi ý lộ trình
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
            // Hiển thị điểm lên giao diện
            document.getElementById("grades").value = JSON.stringify(result.grades, null, 2);

            // Tự động gợi ý lộ trình học tập
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
    const studentIDInput = document.getElementById("loginStudentID");
    const passwordInput = document.getElementById("password");

    function handleEnter(event) {
        if (event.key === "Enter") {
            event.preventDefault();
            login();
        }
    }

    studentIDInput.addEventListener("keydown", handleEnter);
    passwordInput.addEventListener("keydown", handleEnter);
});

// Thêm bằng cấp vào Blockchain
async function addCertificate() {
    const studentID = document.getElementById("studentID").value;
    const certificateHash = document.getElementById("certificateHash").value;

    if (!studentID || !certificateHash) {
        alert("Please fill in all fields.");
        return;
    }

    const response = await fetch("http://localhost:3000/add-certificate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentID, certificateHash }),
    });

    alert(await response.text());
}

// Xác minh bằng cấp
async function verifyCertificate() {
    const studentID = document.getElementById("verifyStudentID").value;
    const certificateHash = document.getElementById("verifyHash").value;

    if (!studentID || !certificateHash) {
        alert("Please enter both Student ID and Certificate Hash.");
        return;
    }

    const response = await fetch(`http://localhost:3000/verify-certificate?studentID=${studentID}&certificateHash=${certificateHash}`);
    const result = await response.text();
    document.getElementById("verifyResult").innerText = result;
}

// Gợi ý lộ trình học tập
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
