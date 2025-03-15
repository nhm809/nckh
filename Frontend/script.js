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
    const studentID = document.getElementById("recommendStudentID").value;
    const grades = document.getElementById("grades").value;

    if (!studentID || !grades) {
        alert("Vui lòng nhập Student ID và điểm số.");
        return;
    }

    try {
        // Parse grades từ chuỗi JSON
        let parsedGrades;
        try {
            parsedGrades = JSON.parse(grades);
        } catch (parseError) {
            alert("Điểm số không đúng định dạng JSON. Ví dụ: {\"Math\": 7.2, \"Reading\": 7.2}");
            console.error("Lỗi parse JSON:", parseError);
            return;
        }

        // Gọi API
        const response = await fetch("http://localhost:3000/recommend-courses", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ studentID, grades: parsedGrades }),
        });

        // Kiểm tra phản hồi từ API
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Lỗi từ server: ${response.status} - ${errorText}`);
        }

        const result = await response.json();

        // Hiển thị kết quả
        document.getElementById("recommendations").innerHTML = result.recommendedCourses
            ? `<b>Gợi ý khóa học:</b> ${result.recommendedCourses.join(", ")}`
            : "Không có gợi ý khóa học.";

        document.getElementById("explanations").innerHTML = result.explanations
            ? `<b>Giải thích:</b> ${result.explanations}`
            : "Không có giải thích.";

        document.getElementById("shapExplanation").innerHTML = result.shapExplanation
            ? `<b>SHAP:</b> ${JSON.stringify(result.shapExplanation, null, 2)}`
            : "Không có giải thích SHAP.";

        document.getElementById("limeExplanation").innerHTML = result.limeExplanation
            ? `<b>LIME:</b> ${result.limeExplanation.join("<br>")}`
            : "Không có giải thích LIME.";

    } catch (error) {
        alert("Lỗi khi xử lý gợi ý lộ trình học tập.");
        console.error("Chi tiết lỗi:", {
            message: error.message,
            stack: error.stack,
            request: { studentID, grades },
        });
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
async function verifyCertificate() {
    const studentID = document.getElementById("verifyStudentID").value.trim();
    const certificateHash = document.getElementById("verifyHash").value.trim();
    const resultElement = document.getElementById("verifyResult");

    if (!studentID || !certificateHash) {
        resultElement.innerText = "Vui lòng nhập đầy đủ thông tin!";
        resultElement.style.color = "red";
        return;
    }

    try {
        const response = await fetch("http://localhost:3000/verify-certificate", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ studentID, certificateHash }),
        });

        const data = await response.json();

        if (data.success) {
            resultElement.innerText = "Bằng cấp hợp lệ!";
            resultElement.style.color = "green";
        } else {
            resultElement.innerText = "Bằng cấp không hợp lệ!";
            resultElement.style.color = "red";
        }
    } catch (error) {
        console.error("Lỗi khi xác minh:", error);
        resultElement.innerText = "Lỗi khi xác minh!";
        resultElement.style.color = "red";
    }
}

// Gán sự kiện khi nhấn Enter để xác minh
document.addEventListener("DOMContentLoaded", function () {
    document.querySelector("button[onclick='verifyCertificate()']").addEventListener("click", verifyCertificate);
});
async function addCertificate() {
    const studentID = document.getElementById("studentID").value.trim();
    const certificateHash = document.getElementById("certificateHash").value.trim();

    if (!studentID || !certificateHash) {
        alert("Vui lòng nhập đầy đủ thông tin!");
        return;
    }

    try {
        const response = await fetch("http://localhost:3000/add-certificate", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ studentID, certificateHash })
        });

        const data = await response.json();

        if (data.success) {
            alert("Thêm bằng cấp thành công!");
        } else {
            alert("Thêm bằng cấp thất bại: " + data.message);
        }
    } catch (error) {
        console.error("Lỗi khi thêm bằng cấp:", error);
        alert("Lỗi khi kết nối đến server.");
    }
}


