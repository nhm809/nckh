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
        document.querySelectorAll(".recommendStudentID").forEach(input => {
            input.value = userID;
        });        
        fetchStudentGrades(userID);
    } else {//mới thêm phần sinh viên đã tốt nghiệp - bổ sung phần này vô nhen Hiếu em
        document.getElementById("studentSection").style.display = "none";
        document.getElementById("adminSection").style.display = "none";
        fetchGraduationInfo(userID);
    }
});

function logout() {
    localStorage.removeItem("loggedInUser");
    window.location.href = "login.html";
}

async function fetchStudentGrades(studentIDs) {
    try {

        if (typeof studentIDs === "string") {
            studentIDs = studentIDs.split(",").map(id => id.trim());  
        }
                
        const response = await fetch(`http://localhost:3000/get-grades?studentIDs=${studentIDs.join(',')}`);
        if (!response.ok) {
            throw new Error("Không thể lấy điểm sinh viên.");
        }

        const result = await response.json();
        console.log("Dữ liệu nhận được:", result);

        if (result.students) {
            document.querySelectorAll(".grades").forEach(textarea => {
                textarea.value = JSON.stringify(result.students, null, 2);
            });
        } else {
            throw new Error("Dữ liệu không hợp lệ.");
        }
    } catch (error) {
        alert(error.message);
    }
}

async function recommendCourses() {
    const gradesTextarea = document.querySelector(".grades").value;

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

        if (!Array.isArray(parsedGrades)) {
            throw new Error("Định dạng dữ liệu điểm số không hợp lệ. Vui lòng nhập một mảng JSON.");
        }

        // Gửi dữ liệu lên backend
        const response = await fetch('http://localhost:5000/analyze', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ students: parsedGrades }), 
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
        
                explanationsHTML += student.explanations && student.explanations.length > 0
                    ? `<b>Giải thích cho ${student.studentID}:</b> ${student.explanations.join(", ")}<br>`
                    : `Không có giải thích cho ${student.studentID}.<br>`;
        
                shapExplanationHTML += student.shapExplanation && student.shapExplanation.length > 0
                    ? `<b>SHAP cho ${student.studentID}:</b> ${JSON.stringify(student.shapExplanation, null, 2)}<br>`
                    : `Không có giải thích SHAP cho ${student.studentID}.<br>`;
        
                limeExplanationHTML += student.limeExplanation && student.limeExplanation.length > 0
                    ? `<b>LIME cho ${student.studentID}:</b> ${student.limeExplanation.join("<br>")}<br>`
                    : `Không có giải thích LIME cho ${student.studentID}.<br>`;
            });
        

            document.querySelectorAll(".recommendations").forEach(el => {
                el.innerHTML = recommendationsHTML;
            });
            document.querySelectorAll(".explanations").forEach(el => {
                el.innerHTML = explanationsHTML;
            });
            document.querySelectorAll(".shapExplanation").forEach(el => {
                el.innerHTML = shapExplanationHTML;
            });
            document.querySelectorAll(".limeExplanation").forEach(el => {
                el.innerHTML = limeExplanationHTML;
            });
            

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


// async function verifyCertificate() {
//     const studentID = document.getElementById("verifyStudentID").value.trim();
//     const certificateHash = document.getElementById("verifyHash").value.trim();
//     const resultElement = document.getElementById("verifyResult");

//     if (!studentID || !certificateHash) {
//         resultElement.innerText = "Vui lòng nhập đầy đủ thông tin!";
//         resultElement.style.color = "red";
//         return;
//     }

//     try {
//         const response = await fetch("http://localhost:3000/verify-certificate", {
//             method: "POST",
//             headers: { "Content-Type": "application/json" },
//             body: JSON.stringify({ studentID, certificateHash }),
//         });

//         const data = await response.json();

//         if (data.success) {
//             resultElement.innerText = "Bằng cấp hợp lệ!";
//             resultElement.style.color = "green";
//         } else {
//             resultElement.innerText = "Bằng cấp không hợp lệ!";
//             resultElement.style.color = "red";
//         }
//     } catch (error) {
//         console.error("Lỗi khi xác minh:", error);
//         resultElement.innerText = "Lỗi khi xác minh!";
//         resultElement.style.color = "red";
//     }
// }

// document.addEventListener("DOMContentLoaded", function () {
//     document.querySelector("button[onclick='verifyCertificate()']").addEventListener("click", verifyCertificate);
// });

// async function addCertificate() {
//     const studentID = document.getElementById("studentID").value.trim();
//     const certificateHash = document.getElementById("certificateHash").value.trim();

//     if (!studentID || !certificateHash) {
//         alert("Vui lòng nhập đầy đủ thông tin!");
//         return;
//     }

//     try {
//         const response = await fetch("http://localhost:3000/add-certificate", {
//             method: "POST",
//             headers: { "Content-Type": "application/json" },
//             body: JSON.stringify({ studentID, certificateHash })
//         });

//         const data = await response.json();

//         if (response.ok) {
//             alert(data.message || "Thêm bằng cấp thành công!");
//         } else {
//             alert("Thêm bằng cấp thất bại: " + (data.message || "Lỗi không xác định"));
//         }
//     } catch (error) {
//         console.error("Lỗi khi thêm bằng cấp:", error);
//         alert("Lỗi khi kết nối đến server.");
//     }
// }

async function addCertificate() {
    const studentID = document.querySelector(".studentID").value.trim();
    const studentName = document.querySelector(".studentName").value.trim();
    const certificateName = document.querySelector(".certificateName").value.trim();
    const issueDate = document.querySelector(".issueDate").value.trim();
    const issuedBy = document.querySelector(".issuedBy").value.trim();
    const graduationGrade = document.querySelector(".graduationGrade").value.trim();
    const resultElement = document.getElementById("addCertificateResult");

    if (!studentID || !studentName || !certificateName || !issueDate || !issuedBy || !graduationGrade) {
        resultElement.innerText = "Vui lòng nhập đầy đủ thông tin!";
        resultElement.style.color = "red";
        return;
    }

    // Kiểm tra định dạng ngày (YYYY/MM/DD)
    const datePattern = /^\d{4}\/\d{2}\/\d{2}$/;
    if (!datePattern.test(issueDate)) {
        resultElement.innerText = "Ngày cấp không đúng định dạng (YYYY/MM/DD, ví dụ: 2025/03/18)!";
        resultElement.style.color = "red";
        return;
    }

    try {
        const response = await fetch("http://localhost:3000/add-certificate", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                studentID,
                studentName,
                certificateName,
                issueDate,
                issuedBy,
                graduationGrade
            })
        });

        const data = await response.json();

        if (response.ok) {
            resultElement.innerText = data.message || "Thêm bằng cấp thành công!";
            resultElement.style.color = "green";
        } else {
            resultElement.innerText = data.message || "Thêm bằng cấp thất bại!";
            resultElement.style.color = "red";
        }
    } catch (error) {
        console.error("Lỗi khi thêm bằng cấp:", error);
        resultElement.innerText = "Lỗi khi kết nối đến server: " + error.message;
        resultElement.style.color = "red";
    }
}

async function verifyCertificate() {
    const studentID = document.querySelector(".verifyStudentID").value.trim();
    const certificateHash = document.querySelector(".verifyHash").value.trim();
    const resultElement = document.getElementById("verifyResult");

    if (!studentID || !certificateHash) {
        resultElement.innerText = "Vui lòng nhập đầy đủ thông tin!";
        resultElement.style.color = "red";
        return;
    }

    try {
        const response = await fetch(`http://localhost:3000/verify-certificate?studentID=${encodeURIComponent(studentID)}&certificateHash=${encodeURIComponent(certificateHash)}`, {
            method: "GET",
            headers: { "Content-Type": "application/json" }
        });

        const data = await response.json();

        if (response.ok) {
            if (data.isValid) {
                resultElement.innerText = "Bằng cấp hợp lệ!";
                resultElement.style.color = "green";
            } else {
                resultElement.innerText = "Bằng cấp không hợp lệ!";
                resultElement.style.color = "red";
            }
        } else {
            resultElement.innerText = data.error || "Xác minh thất bại!";
            resultElement.style.color = "red";
        }
    } catch (error) {
        console.error("Lỗi khi xác minh:", error);
        resultElement.innerText = "Lỗi khi kết nối đến server: " + error.message;
        resultElement.style.color = "red";
    }
}

//mới thêm
async function fetchGraduationInfo(studentID) {
    try {
        const response = await fetch(`http://localhost:3000/get-graduation-info?studentID=${studentID}`);
        if (!response.ok) {
            throw new Error("Không thể lấy thông tin tốt nghiệp.");
        }
        
        const data = await response.json();
        if (data.success && data.studentInfo) {
            const info = data.studentInfo;
            document.querySelector(".main-content").innerHTML = `
                <h2>Thông Tin Tốt Nghiệp</h2>
                <p><strong>Student ID:</strong> ${info.studentID}</p>
                <p><strong>Student Name:</strong> ${info.studentName}</p>
                <p><strong>Certificate Name:</strong> ${info.certificateName}</p>
                <p><strong>Issue Date:</strong> ${info.issueDate}</p>
                <p><strong>Issued By:</strong> ${info.issuedBy}</p>
                <p><strong>Graduation Grade:</strong> ${info.graduationGrade}</p>
                <p><strong>Certificate Hash:</strong> ${info.certificateHash}</p>
                <p><strong>Timestamp:</strong> ${info.timestamp}</p>
            `;
        } else {
            document.querySelector(".main-content").innerHTML = "Không tìm thấy thông tin tốt nghiệp.";
        }
    } catch (error) {
        console.error("Lỗi khi lấy thông tin tốt nghiệp:", error);
        document.querySelector(".main-content").innerHTML = "Lỗi khi lấy thông tin tốt nghiệp.";
    }
} 
