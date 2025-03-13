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
    } else {
        document.getElementById("loginError").innerText = result.message;
    }
}

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
