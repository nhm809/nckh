document.addEventListener("DOMContentLoaded", function () {
    const userID = localStorage.getItem("loggedInUser");
    
    if (!userID) {
        window.location.href = "login.html"; // Nếu chưa đăng nhập, chuyển về login
    }

    document.getElementById("welcomeMessage").innerText = `Xin chào, ${userID}`; //   Hiển thị chào mừng

    if (userID.toLowerCase() === "admin") {
        document.getElementById("adminSection").style.display = "block";
    } else if (/^S\d{4}$/.test(userID)) {
        document.getElementById("studentSection").style.display = "block";
    }

});

function logout() {
    localStorage.removeItem("loggedInUser");
    window.location.href = "login.html";
}

async function fetchStudentGrades(studentIDs) {
    try {

        // Gọi API để lấy điểm số của các sinh viên
        if (typeof studentIDs === "string") {
            studentIDs = studentIDs.split(",").map(id => id.trim());  // Chuyển thành mảng, loại bỏ khoảng trắng nếu có
        }
                
        const response = await fetch(`http://localhost:3000/get-grades?studentIDs=${studentIDs.join(',')}`);
        if (!response.ok) {
            throw new Error("Không thể lấy điểm sinh viên.");
        }

        const result = await response.json();
        console.log("Dữ liệu nhận được:", result);

        if (result.students) {
            // Lưu dữ liệu điểm số vào trường grades
            document.getElementById("grades").value = JSON.stringify(result.students, null, 2);

            // Gọi hàm recommendCourses với dữ liệu đúng định dạng
            recommendCourses(result.students);
        } else {
            throw new Error("Dữ liệu không hợp lệ.");
        }
    } catch (error) {
        alert(error.message);
    }
}

async function recommendCourses() {
    const gradesTextarea = document.getElementById("grades").value;

    if (!gradesTextarea) {
        alert("Vui lòng nhập điểm số.");
        return;
    }

    try {
        let parsedGrades;
        try {
            parsedGrades = JSON.parse(gradesTextarea); // Parse dữ liệu từ textarea
        } catch (parseError) {
            alert("Điểm số không đúng định dạng JSON. Ví dụ: [{\"studentID\": \"S0001\", \"grades\": {\"Math\": 7.2, \"Reading\": 7.2}}]");
            console.error("Lỗi parse JSON:", parseError);
            return;
        }

        // Kiểm tra nếu parsedGrades là một mảng
        if (!Array.isArray(parsedGrades)) {
            throw new Error("Định dạng dữ liệu điểm số không hợp lệ. Vui lòng nhập một mảng JSON.");
        }

        // Gửi dữ liệu lên backend
        const response = await fetch('http://localhost:5000/analyze', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ students: parsedGrades }), // Gửi đúng định dạng
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Lỗi từ server: ${response.status} - ${errorText}`);
        }

        const result = await response.json();

        // Hiển thị kết quả lên giao diện
        if (result.students && result.students.length > 0) {
            let recommendationsHTML = "";
            let explanationsHTML = "";
            let shapExplanationHTML = "";
            let limeExplanationHTML = "";

            result.students.forEach(student => {
                recommendationsHTML += student.recommendedCourses
                    ? `<b>Gợi ý khóa học cho ${student.studentID}:</b> ${student.recommendedCourses.join(", ")}<br>`
                    : `Không có gợi ý khóa học cho ${student.studentID}.<br>`;

                explanationsHTML += student.explanations
                    ? `<b>Giải thích cho ${student.studentID}:</b> ${student.explanations.join(", ")}<br>`
                    : `Không có giải thích cho ${student.studentID}.<br>`;

                shapExplanationHTML += student.shapExplanation
                    ? `<b>SHAP cho ${student.studentID}:</b> ${JSON.stringify(student.shapExplanation, null, 2)}<br>`
                    : `Không có giải thích SHAP cho ${student.studentID}.<br>`;

                limeExplanationHTML += student.limeExplanation
                    ? `<b>LIME cho ${student.studentID}:</b> ${student.limeExplanation.join("<br>")}<br>`
                    : `Không có giải thích LIME cho ${student.studentID}.<br>`;
            });

            document.getElementById("recommendations").innerHTML = recommendationsHTML;
            document.getElementById("explanations").innerHTML = explanationsHTML;
            document.getElementById("shapExplanation").innerHTML = shapExplanationHTML;
            document.getElementById("limeExplanation").innerHTML = limeExplanationHTML;
        } else {
            throw new Error("Không có dữ liệu sinh viên trả về.");
        }
    } catch (error) {
        alert("Lỗi khi xử lý gợi ý lộ trình học tập.");
        console.error("Chi tiết lỗi:", {
            message: error.message,
            stack: error.stack,
            request: { grades: gradesTextarea },
        });
    }
}


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

        if (response.ok) {
            alert(data.message || "Thêm bằng cấp thành công!");
        } else {
            alert("Thêm bằng cấp thất bại: " + (data.message || "Lỗi không xác định"));
        }
    } catch (error) {
        console.error("Lỗi khi thêm bằng cấp:", error);
        alert("Lỗi khi kết nối đến server.");
    }
}
