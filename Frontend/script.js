async function login() {
    const studentID = document.getElementById("StudentID").value.trim();
    const password = document.getElementById("password").value.trim();
    
    if (!studentID || !password) {
        document.getElementById("loginError").innerText = "Vui lòng nhập đầy đủ thông tin.";
        return;
    }

    const response = await fetch("http://localhost:3000/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentID, password })
    });

    const result = await response.json();
    if (response.ok) {
        document.querySelector(".login-container").style.display = "none";
        document.querySelector(".main-content").style.display = "block";
        document.getElementById("recommendStudentID").value = studentID;
        
        if (/^S\d{4}$/.test(studentID)) {
            fetchStudentGrades(studentID);
        }
    } else {
        document.getElementById("loginError").innerText = result.message;
    }
}

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

async function recommendCourses() {
    const studentID = document.getElementById("recommendStudentID").value;
    const grades = document.getElementById("grades").value;

    if (!studentID || !grades) {
        alert("Vui lòng nhập Student ID và điểm số.");
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
        document.getElementById("recommendResult").innerText = `Khóa học đề xuất: ${result.recommendedCourses.join(", ")}`;
        document.getElementById("recommendations").innerHTML = `
            <h3>Recommended Courses:</h3>
            <p><strong>Courses:</strong> ${result.recommendedCourses.join(", ")}</p>
            <h3>Explanation:</h3>
            <ul>${result.explanations.map(exp => `<li>${exp}</li>`).join('')}</ul>`;
    } catch (error) {
        alert("Lỗi khi xử lý gợi ý lộ trình học tập.");
    }
}

function logout() {
    location.reload();
}

document.addEventListener("DOMContentLoaded", function () {
    function handleEnter(event) {
        if (event.key === "Enter") {
            event.preventDefault();
            login();
        }
    }
    
    document.getElementById("username").addEventListener("keydown", handleEnter);
    document.getElementById("password").addEventListener("keydown", handleEnter);
});
