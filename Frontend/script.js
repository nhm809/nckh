async function login() {
    const studentID = document.getElementById("studentID").value.trim();
    const password = document.getElementById("password").value.trim();
    
    if (!studentID || !password) {
        document.getElementById("loginError").innerText = "Vui lòng nhập đầy đủ thông tin.";
        return;
    }

    try {
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
    } catch (error) {
        document.getElementById("loginError").innerText = "Lỗi kết nối đến server.";
    }
}

async function fetchStudentGrades(studentID) {
    try {
        const response = await fetch(`http://localhost:3000/get-grades?studentID=${studentID}`);
        if (!response.ok) {
            throw new Error("Không thể lấy điểm sinh viên.");
        }

        const result = await response.json();
        console.log("Dữ liệu nhận được:", result); // Log để kiểm tra dữ liệu

        if (result.grades) {
            document.getElementById("grades").value = JSON.stringify(result.grades, null, 2);
            recommendCourses();
        } else {
            throw new Error("Dữ liệu không hợp lệ.");
        }
    } catch (error) {
        alert(error.message);
    }
}


async function recommendCourses() {
    const studentID = document.getElementById("studentID").value;
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
        document.getElementById("recommendResult").innerText = `Lộ trình học tập: `;
        
        let recommendationsDiv = document.getElementById("recommendations");
        if (!recommendationsDiv) {
            recommendationsDiv = document.createElement("div");
            recommendationsDiv.id = "recommendations";
            document.body.appendChild(recommendationsDiv);
        }
        
        recommendationsDiv.innerHTML = `<pre>${JSON.stringify(result, null, 2)}</pre>`;
    } catch (error) {
        alert("Lỗi khi xử lý gợi ý lộ trình học tập.");
    }
}

function logout() {
    localStorage.removeItem("loggedIn"); 
    location.reload();
}

document.addEventListener("DOMContentLoaded", function () {

    document.getElementById("loginBtn").addEventListener("click", login);

    function handleEnter(event) {
        if (event.key === "Enter") {
            event.preventDefault();
            login();
        }
    }
    
    document.getElementById("studentID").addEventListener("keydown", handleEnter);
    document.getElementById("password").addEventListener("keydown", handleEnter);
});

