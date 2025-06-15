document.addEventListener("DOMContentLoaded", function () {
    const userID = localStorage.getItem("loggedInUser");
    
    if (!userID) {
        window.location.href = "login.html"; // Nếu chưa đăng nhập, chuyển về login
    }

    document.getElementById("welcomeMessage").innerText = `Welcome, ${userID}`; //   Hiển thị chào mừng

    if (userID.toLowerCase() === "admin") {
        document.getElementById("adminSection").style.display = "block";
    } else if (/^S\d{4}$/.test(userID) && parseInt(userID.substring(1)) >= 1 && parseInt(userID.substring(1)) <= 1000) {
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

// Thêm vào dashboard.js
function toggleForm(formId) {
    // Ẩn tất cả các form trước
    document.querySelectorAll('.collapsible-form').forEach(form => {
        form.style.display = 'none';
    });
    
    // Hiển thị form được chọn
    const form = document.getElementById(formId);
    form.style.display = 'block';
    
    // Cuộn đến form
    form.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

// Khởi tạo - ẩn tất cả form khi load trang
document.addEventListener('DOMContentLoaded', function() {
    document.querySelectorAll('.collapsible-form').forEach(form => {
        form.style.display = 'none';
    });
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
            throw new Error("Student scores cannot be taken.");
        }

        const result = await response.json();
        console.log("Data received:", result);

        if (result.students) {
            document.querySelectorAll(".grades").forEach(textarea => {
                textarea.value = JSON.stringify(result.students, null, 2);
            });
        } else {
            throw new Error("Invalid data.");
        }
    } catch (error) {
        alert(error.message);
    }
}

async function recommendCourses() {
    const gradesTextarea = document.querySelector(".grades").value;
    const recommendationsContainer = document.querySelector('.recommendations');

    if (!gradesTextarea) {
        alert("Please enter scores.");
        return;
    }

    try {
        let parsedGrades;
        try {
            parsedGrades = JSON.parse(gradesTextarea);
        } catch (parseError) {
            alert("The score is not in the correct JSON format. For example: [{\"studentID\": \"S0001\", \"grades\": {\"Math\": 7.2, \"Reading\": 7.2}}]");
            console.error("JSON parsing error:", parseError);
            return;
        }

        if (!Array.isArray(parsedGrades)) {
            throw new Error("Invalid score data format. Please enter a JSON array.");
        }

        // Hiển thị loading và xóa kết quả cũ
        recommendationsContainer.innerHTML = '<div class="loading">Đang xử lý...</div>';
        document.querySelectorAll(".explanations, .shapExplanation, .limeExplanation")
            .forEach(el => el.innerHTML = '');

        const response = await fetch('http://localhost:5000/analyze', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ students: parsedGrades }), 
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Error from server: ${response.status} - ${errorText}`);
        }

        const result = await response.json();

        // Xóa nội dung loading trước khi hiển thị kết quả
        recommendationsContainer.innerHTML = '';

        if (result.students && result.students.length > 0) {
            result.students.forEach(student => {
                const studentContainer = document.createElement('div');
                studentContainer.className = 'student-result';
                studentContainer.innerHTML = `
                    <div class="student-header">
                        <h3>Results for students: ${student.studentID}</h3>
                    </div>
                    <div class="recommendation-section">
                        <h4>Recommended courses:</h4>
                        <ul>
                            ${student.recommendedCourses.map(course => `<li>${course}</li>`).join('')}
                        </ul>
                    </div>
                    <div class="explanation-section">
                        <h4>Explaination:</h4>
                        <ul>
                            ${student.explanations.map(exp => `<li>${exp}</li>`).join('')}
                        </ul>
                    </div>
                    ${student.shapExplanation && student.shapExplanation.length > 0 ? `
                    <div class="shap-section">
                        <h4>Impact analysis (SHAP):</h4>
                        <table>
                            <thead>
                                <tr>
                                    <th>Subject</th>
                                    <th>Score</th>
                                    <th>Affect</th>
                                    <th>Value</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${student.shapExplanation.map(item => `
                                <tr>
                                    <td>${item.feature}</td>
                                    <td>${item.score}</td>
                                    <td class="impact-${item.impact === 'positive' ? 'positive' : 'negative'}">
                                        ${item.impact}
                                    </td>
                                    <td>${item.value.toFixed(4)}</td>
                                </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                    ` : '<p class="no-explanation">There is no SHAP explanation</p>'}
                    ${student.limeExplanation && student.limeExplanation.length > 0 ? `
                    <div class="lime-section">
                        <h4>Local Explanation (LIME):</h4>
                        <ul>
                            ${student.limeExplanation.map(exp => `<li>${exp}</li>`).join('')}
                        </ul>
                    </div>
                    ` : '<p class="no-explanation">No LIME explanation available</p>'}
                `;

                recommendationsContainer.appendChild(studentContainer);
            });
        } else {
            throw new Error("No student data returned.");
        }
    } catch (error) {
        recommendationsContainer.innerHTML = 
            `<div class="error-message">Error: ${error.message}</div>`;
    console.error("Error details:", error);
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
        resultElement.innerText = "Please fill in all the required fields!";
        resultElement.style.color = "red";
        return;
    }

    // Check date format (YYYY-MM-DD)
    const datePattern = /^\d{4}-\d{2}-\d{2}$/;
    if (!datePattern.test(issueDate)) {
        resultElement.innerText = "Issue date format is incorrect (YYYY-MM-DD, e.g., 2025-03-18)!";
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
            let message = data.message || "Certificate added successfully!";
            if (data.certificateHash) {
                message += `\nCertificate Hash: ${data.certificateHash}`;
            }
            resultElement.innerText = message;
            resultElement.style.color = "green";
        } else {
            resultElement.innerText = data.message || "Failed to add certificate!";
            resultElement.style.color = "red";
        }
    } catch (error) {
        console.error("Error adding certificate:", error);
        resultElement.innerText = "Error connecting to server: " + error.message;
        resultElement.style.color = "red";
    }
}

async function verifyCertificate() {
    const studentID = document.querySelector(".verifyStudentID").value.trim();
    const certificateHash = document.querySelector(".verifyHash").value.trim();
    const resultElement = document.getElementById("verifyResult");

    if (!studentID || !certificateHash) {
        resultElement.innerText = "Please enter both Student ID and Certificate Hash.";
        resultElement.style.color = "red";
        return;
    }

    try {
        const query = new URLSearchParams({
            studentID: studentID,
            certificateHash: certificateHash
        });

        const response = await fetch(`http://localhost:3000/verify-certificate-full?${query.toString()}`, {
            method: "GET",
            headers: { "Content-Type": "application/json" }
        });

        const data = await response.json();

        if (response.ok) {
            if (data.isValid) {
                resultElement.innerText = "✅ Certificate is valid!";
                resultElement.style.color = "green";
            } else {
                resultElement.innerText = "❌ Certificate is invalid!";
                resultElement.style.color = "red";
            }
        } else {
            resultElement.innerText = data.error || "Verification failed.";
            resultElement.style.color = "red";
        }
    } catch (error) {
        console.error("Error verifying certificate:", error);
        resultElement.innerText = "Server error: " + error.message;
        resultElement.style.color = "red";
    }
}


// Newly added
async function fetchGraduationInfo(studentID) {
    try {
        console.log("Fetching graduation information for:", studentID);
        const response = await fetch(`http://localhost:3000/get-graduation-info?studentID=${studentID}`);
        console.log("Response from server:", response);
        if (!response.ok) {
            throw new Error("Unable to fetch graduation information.");
        }

        const data = await response.json();
        console.log("Received data:", data);
        if (data.success && data.studentInfo) {
            const info = data.studentInfo;
            document.querySelector(".main-content").innerHTML = `
                <h2>Graduation Information</h2>
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
            document.querySelector(".main-content").innerHTML = "No graduation information found.";
        }
    } catch (error) {
        console.error("Error fetching graduation info:", error);
        document.querySelector(".main-content").innerHTML = "Error fetching graduation information.";
    }
}
