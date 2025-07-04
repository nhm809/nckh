document.addEventListener("DOMContentLoaded", function () {
    const userID = localStorage.getItem("loggedInUser");
    
    if (!userID) {
        window.location.href = "login.html"; // Nếu chưa đăng nhập, chuyển về login
    }

    document.getElementById("welcomeMessage").innerText = `Xin chào, ${userID}`; //   Hiển thị chào mừng

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
            throw new Error("Failed to fetch student grades.");
        }

        const result = await response.json();
        console.log("Received data:", result);

        if (result.students) {
            document.querySelectorAll(".grades").forEach(textarea => {
                textarea.value = JSON.stringify({ students: result.students }, null, 2);
                // textarea.value = JSON.stringify(result.students, null, 2);
            });
        } else {
            throw new Error("Invalid data format.");
        }
    } catch (error) {
        alert(error.message);
    }
}


async function recommendCourses() {
    const gradesTextarea = document.querySelector(".grades").value;
    const recommendationsContainer = document.querySelector('.recommendations');

    if (!gradesTextarea) {
        alert("Please enter the grade data.");
        return;
    }

    let parsedGrades;
    try {
        parsedGrades = JSON.parse(gradesTextarea);
    } catch (parseError) {
        alert("Invalid JSON format.\nCorrect format:\n{\n  \"students\": [ ... ]\n}");
        console.error("JSON parse error:", parseError);
        return;
    }

    if (!parsedGrades.students || !Array.isArray(parsedGrades.students)) {
        alert("Invalid format: 'students' must be an array inside the object.");
        return;
    }

    const studentsData = parsedGrades.students;

    // Show loading
    recommendationsContainer.innerHTML = '<div class="loading">Processing...</div>';
    document.querySelectorAll(".explanations, .shapExplanation, .limeExplanation")
        .forEach(el => el.innerHTML = '');

    try {
        const response = await fetch('http://localhost:5000/analyze', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ students: studentsData }) // ✅ Không gửi thêm `parsedGrades`
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Server error: ${response.status} - ${errorText}`);
        }

        const result = await response.json();
        recommendationsContainer.innerHTML = ''; // Clear loading

        if (result.students?.length > 0) {
            result.students.forEach(student => {
                const studentContainer = document.createElement('div');
                studentContainer.className = 'student-result';

                studentContainer.innerHTML = `
                    <div class="student-header">
                        <h3>Results for Student: ${student.studentID}</h3>
                    </div>

                    <div class="score-section">
                        <h4>Scores:</h4>
                        <table>
                            <thead>
                                <tr>
                                    <th>Subject</th>
                                    <th>Score</th>
                                    <th>Evaluation</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${student.scores.map(item => `
                                    <tr>
                                        <td>${item.subject}</td>
                                        <td>${item.score}</td>
                                        <td>${item.evaluation}</td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>

                    <div class="recommendation-section">
                        <h4>Recommended Courses:</h4>
                        <ul>
                            ${student.recommendedCourses.map(course => `<li>${course}</li>`).join('')}
                        </ul>
                    </div>

                    <div class="explanation-section">
                        <h4>Explanations:</h4>
                        <ul>
                            ${student.explanations.map(exp => `<li>${exp}</li>`).join('')}
                        </ul>
                    </div>

                    ${student.shap_lime_summary?.length > 0 ? `
                    <div class="shaplime-section">
                        <h4>SHAP & LIME Summary:</h4>
                        <table>
                            <thead>
                                <tr>
                                    <th>Subject</th>
                                    <th>SHAP Value</th>
                                    <th>LIME Weight</th>
                                    <th>Impact</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${student.shap_lime_summary.map(item => `
                                    <tr>
                                        <td>${item.subject}</td>
                                        <td>${item.shap_value.toFixed(4)}</td>
                                        <td>${item.lime_weight.toFixed(4)}</td>
                                        <td class="impact-${item.impact.toLowerCase()}">${item.impact}</td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>` : `<p class="no-explanation">No SHAP/LIME explanation available</p>`}
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
    const issueDateRaw = document.querySelector(".issueDate").value.trim();
    const issuedBy = document.querySelector(".issuedBy").value.trim();
    const graduationGrade = document.querySelector(".graduationGrade").value.trim();
    const resultElement = document.getElementById("addCertificateResult");

    // Convert from YYYY-MM-DD to DD/MM/YYYY
    let issueDate = "";
    if (issueDateRaw) {
        const [year, month, day] = issueDateRaw.split("-");
        issueDate = `${day}/${month}/${year}`;
    }

    if (!studentID || !studentName || !certificateName || !issueDate || !issuedBy || !graduationGrade) {
        resultElement.innerText = "Please fill in all required fields!";
        resultElement.style.color = "red";
        return;
    }

    // Validate date format (DD/MM/YYYY)
    const datePattern = /^\d{2}\/\d{2}\/\d{4}$/;
    if (!datePattern.test(issueDate)) {
        resultElement.innerText = "Issue date must follow the format DD/MM/YYYY (e.g., 18/03/2025)!";
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
            resultElement.innerText = `${data.message}\nCertificate Hash: ${data.certificateHash}`;
            resultElement.style.color = "green";
        } else {
            resultElement.innerText = data.message || "Failed to add certificate!";
            resultElement.style.color = "red";
        }
    } catch (error) {
        console.error("Error adding certificate:", error);
        resultElement.innerText = "Server connection error: " + error.message;
        resultElement.style.color = "red";
    }
}


async function verifyCertificate() {
    const studentID = document.querySelector('.verifyStudentID').value;
    const certificateHash = document.querySelector('.verifyHash').value;
    const resultElement = document.getElementById('verifyResult');
    const certificateInfo = document.getElementById('certificateInfo');

    if (!studentID || !certificateHash) {
        resultElement.textContent = 'Please enter all required fields!';
        resultElement.style.color = 'red';
        certificateInfo.style.display = 'none';
        return;
    }

    try {
        const response = await fetch(`http://localhost:3000/verify-certificate?studentID=${studentID}&certificateHash=${certificateHash}`);
        const data = await response.json();

        if (response.ok) {
            if (data.isValid) {
                resultElement.textContent = 'Certificate is valid!';
                resultElement.style.color = 'green';
                
                // Display certificate info
                if (data.certificateInfo) {
                    document.getElementById('certStudentID').textContent = data.certificateInfo.studentID;
                    document.getElementById('certStudentName').textContent = data.certificateInfo.studentName;
                    document.getElementById('certCertificateName').textContent = data.certificateInfo.certificateName;
                    document.getElementById('certIssueDate').textContent = data.certificateInfo.issueDate;
                    document.getElementById('certIssuedBy').textContent = data.certificateInfo.issuedBy;
                    document.getElementById('certGraduationGrade').textContent = data.certificateInfo.graduationGrade;
                    certificateInfo.style.display = 'block';
                }
            } else {
                resultElement.textContent = 'Certificate is not valid!';
                resultElement.style.color = 'red';
                certificateInfo.style.display = 'none';
            }
        } else {
            resultElement.textContent = data.error || 'An error occurred!';
            resultElement.style.color = 'red';
            certificateInfo.style.display = 'none';
        }
    } catch (error) {
        resultElement.textContent = 'Server connection error!';
        resultElement.style.color = 'red';
        certificateInfo.style.display = 'none';
    }
}


// newly added
async function fetchGraduationInfo(studentID) {
    try {
        console.log("Fetching graduation info for:", studentID);
        const response = await fetch(`http://localhost:3000/get-graduation-info?studentID=${studentID}`);
        console.log("Server response:", response);
        
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
            document.querySelector(".main-content").innerHTML = "Graduation information not found.";
        }
    } catch (error) {
        console.error("Error fetching graduation information:", error);
        document.querySelector(".main-content").innerHTML = "Error fetching graduation information.";
    }
}
