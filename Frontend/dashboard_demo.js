document.addEventListener("DOMContentLoaded", function () {
    const userID = localStorage.getItem("loggedInUser");
    
    if (!userID) {
        window.location.href = "login.html"; // Nếu chưa đăng nhập, chuyển về login
    }

    document.getElementById("welcomeMessage").innerText = `Hi ${userID}, Have a nice day!`; //   Hiển thị chào mừng

    if (userID.toLowerCase() === "admin") {
        document.getElementById("adminSection").style.display = "block";
    } else if (/^S\d{4}$/.test(userID) && parseInt(userID.substring(1)) >= 1 && parseInt(userID.substring(1)) <= 1000) {
        document.getElementById("studentSection").style.display = "block";
        document.querySelectorAll(".recommendStudentID").forEach(input => {
            input.value = userID;
        });        
        fetchStudentGrades(userID);
    } else {
        document.getElementById("studentSection").style.display = "none";
        document.getElementById("adminSection").style.display = "none";
        document.getElementById("graduationSection").style.display = "block";
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
    const recommendationsContainer = document.querySelector('.recommendations');

    if (!gradesTextarea) {
        alert("Vui lòng nhập điểm số.");
        return;
    }

    try {
        let parsedGrades;
        try {
            parsedGrades = JSON.parse(gradesTextarea);
        } catch (parseError) {
            alert("Điểm số không đúng định dạng JSON. Ví dụ: [{\"studentID\": \"S0001\", \"grades\": {\"Math\": 7.2, \"Reading\": 7.2}}]");
            console.error("Lỗi parse JSON:", parseError);
            return;
        }

        if (!Array.isArray(parsedGrades)) {
            throw new Error("Định dạng dữ liệu điểm số không hợp lệ. Vui lòng nhập một mảng JSON.");
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
            throw new Error(`Lỗi từ server: ${response.status} - ${errorText}`);
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
                        <h3>Kết quả cho sinh viên: ${student.studentID}</h3>
                    </div>
                    <div class="recommendation-section">
                        <h4>Khóa học đề xuất:</h4>
                        <ul>
                            ${student.recommendedCourses.map(course => `<li>${course}</li>`).join('')}
                        </ul>
                    </div>
                    <div class="explanation-section">
                        <h4>Giải thích:</h4>
                        <ul>
                            ${student.explanations.map(exp => `<li>${exp}</li>`).join('')}
                        </ul>
                    </div>
                    ${student.shapExplanation && student.shapExplanation.length > 0 ? `
                    <div class="shap-section">
                        <h4>Phân tích ảnh hưởng (SHAP):</h4>
                        <table>
                            <thead>
                                <tr>
                                    <th>Môn học</th>
                                    <th>Điểm số</th>
                                    <th>Ảnh hưởng</th>
                                    <th>Giá trị</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${student.shapExplanation.map(item => `
                                <tr>
                                    <td>${item.feature}</td>
                                    <td>${item.score}</td>
                                    <td class="impact-${item.impact === 'tích cực' ? 'positive' : 'negative'}">
                                        ${item.impact}
                                    </td>
                                    <td>${item.value.toFixed(4)}</td>
                                </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                    ` : '<p class="no-explanation">Không có giải thích SHAP</p>'}
                    ${student.limeExplanation && student.limeExplanation.length > 0 ? `
                    <div class="lime-section">
                        <h4>Giải thích địa phương (LIME):</h4>
                        <ul>
                            ${student.limeExplanation.map(exp => `<li>${exp}</li>`).join('')}
                        </ul>
                    </div>
                    ` : '<p class="no-explanation">Không có giải thích LIME</p>'}
                `;

                recommendationsContainer.appendChild(studentContainer);
            });
        } else {
            throw new Error("Không có dữ liệu sinh viên trả về.");
        }
    } catch (error) {
        recommendationsContainer.innerHTML = 
            `<div class="error-message">Lỗi: ${error.message}</div>`;
        console.error("Chi tiết lỗi:", error);
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
    const issueDateInput = document.querySelector(".issueDate").value.trim();
    const issuedBy = document.querySelector(".issuedBy").value.trim();
    const graduationGrade = document.querySelector(".graduationGrade").value.trim();
    const resultElement = document.getElementById("addCertificateResult");

    // Chuyển định dạng ngày từ YYYY-MM-DD sang YYYY/MM/DD
    const issueDate = issueDateInput ? issueDateInput.replace(/-/g, "/") : "";

    // Kiểm tra dữ liệu đầu vào (sử dụng issueDate đã khai báo)
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

async function fetchGraduationInfo(studentID) {
    try {
        console.log("Đang lấy thông tin tốt nghiệp cho:", studentID);
        const response = await fetch(`http://localhost:3000/get-certificate?studentID=${studentID}`);
        console.log("Phản hồi từ server:", response);

        const contentType = response.headers.get("content-type");
        console.log("Content-Type:", contentType);
        if (!contentType || !contentType.includes("application/json")) {
            throw new Error("Phản hồi từ server không phải JSON");
        }

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(`Không thể lấy thông tin tốt nghiệp. Status: ${response.status}, Error: ${errorData.error || "Không xác định"}`);
        }
        
        const data = await response.json();
        console.log("Dữ liệu nhận được:", data);

        const graduateSection = document.getElementById("graduationSection");
        if (data.studentID) { // Sửa điều kiện để kiểm tra data.studentID
            graduateSection.innerHTML = `
                <h2>Thông Tin Tốt Nghiệp</h2>
                <p><strong>Student ID:</strong> ${data.studentID}</p>
                <p><strong>Student Name:</strong> ${data.studentName}</p>
                <p><strong>Certificate Name:</strong> ${data.certificateName}</p>
                <p><strong>Issue Date:</strong> ${data.issueDate}</p>
                <p><strong>Issued By:</strong> ${data.issuedBy}</p>
                <p><strong>Graduation Grade:</strong> ${data.graduationGrade}</p>
            `;
            graduateSection.style.display = "block";
        } else {
            graduateSection.innerHTML = "Không tìm thấy thông tin tốt nghiệp.";
            graduateSection.style.display = "block";
        }
    } catch (error) {
        console.error("Lỗi khi lấy thông tin tốt nghiệp:", error);
        const graduateSection = document.getElementById("graduationSection"); // Sửa từ "graduateSection" thành "graduationSection"
        graduateSection.innerHTML = `Không tìm thấy thông tin tốt nghiệp cho ${studentID}. Vui lòng liên hệ admin để thêm chứng chỉ.`;
        graduateSection.style.display = "block";
    }
}
//phần hiện điểm của sinh viên   PHẦN DEMO NHÉ 
document.getElementById("semesterSelect").addEventListener("change", updateSemester);

const maxSemester = 5; // Ví dụ: Sinh viên mới học đến kỳ 5

// Giới hạn hiển thị các kỳ trong dropdown
function limitSemesterOptions() {
    const semesterSelect = document.getElementById("semesterSelect");
    semesterSelect.innerHTML = ""; // Xóa các option cũ

    for (let i = 1; i <= maxSemester; i++) {
        const option = document.createElement("option");
        option.value = i;
        option.text =  + i;
        semesterSelect.appendChild(option);
    }
}

function updateSemester() {
    const selectedSemester = document.getElementById("semesterSelect").value;
    const subjectTable = document.getElementById("subjectTable");

    // Dữ liệu các kỳ học
    const semesterData = {
        1: { subjects: ["Math", "Physics", "Chemistry"], grades: [9.0, 8.5, 7.5] },
        2: { subjects: ["Biology", "Geography", "History"], grades: [8.0, 7.0, 8.5] },
        3: { subjects: ["English", "IT", "Physical Education"], grades: [9.5, 8.5, 7.0] },
        4: { subjects: ["Philosophy", "Literature", "Art"], grades: [7.5, 8.0, 7.0] },
        5: { subjects: ["Programming", "Data Science", "Algorithms"], grades: [6.3, 5.0, 6.0] },
        6: { subjects: ["Economics", "Accounting", "Management"], grades: [8.0, 8.5, 7.5] },
        7: { subjects: ["Psychology", "Sociology", "Law"], grades: [8.5, 8.0, 7.0] },
        8: { subjects: ["Robotics", "AI", "Blockchain"], grades: [9.0, 9.5, 8.5] },
        9: { subjects: ["Cyber Security", "Cloud Computing", "Networking"], grades: [8.5, 9.0, 8.0] }
    };

    // Kiểm tra dữ liệu hợp lệ
    if (!semesterData[selectedSemester]) {
        subjectTable.innerHTML = "<tr><td colspan='2' style='padding: 8px;'>Không có dữ liệu</td></tr>";
        return;
    }

    // Lấy dữ liệu kỳ học hiện tại
    const { subjects, grades } = semesterData[selectedSemester];

    // Xóa bảng cũ
    subjectTable.innerHTML = "";

    // Cập nhật nội dung bảng
    subjects.forEach((subject, index) => {
        const row = document.createElement("tr");
        row.innerHTML = `
            <td style="padding: 8px; border-bottom: 1px solid #ddd;">${subject}</td>
            <td style="padding: 8px; border-bottom: 1px solid #ddd;">${grades[index]}</td>
        `;
        subjectTable.appendChild(row);
    });
}

// Gọi khi trang tải xong
limitSemesterOptions();
updateSemester();



//dành cho admin   PHẦN DEMO NHÉ
document.getElementById("recommendStudentID").addEventListener("input", handleAdminInput);

const studentData = {
    "S0001": { maxSemester: 5, grades: { 
        1: { subjects: ["Math", "Physics", "Chemistry"], grades: [9.0, 8.5, 7.5] },
        2: { subjects: ["Biology", "Geography", "History"], grades: [8.0, 7.0, 8.5] },
        3: { subjects: ["English", "IT", "Physical Education"], grades: [9.5, 8.5, 7.0] },
        4: { subjects: ["Philosophy", "Literature", "Art"], grades: [7.5, 8.0, 7.0] },
        5: { subjects: ["Programming", "Data Science", "Algorithms"], grades: [6.0, 5.5, 6.8] }
    }},
    "S0002": { maxSemester: 4, grades: { 
        1: { subjects: ["Math", "Physics", "Chemistry"], grades: [8.0, 7.5, 7.0] },
        2: { subjects: ["Biology", "Geography", "History"], grades: [7.5, 8.0, 7.5] },
        3: { subjects: ["English", "IT", "Physical Education"], grades: [8.5, 9.0, 7.5] },
        4: { subjects: ["Philosophy", "Literature", "Art"], grades: [7.0, 7.5, 8.0] }
    }},
    "S0003": { maxSemester: 3, grades: { 
        1: { subjects: ["Math", "Physics", "Chemistry"], grades: [7.5, 7.0, 7.0] },
        2: { subjects: ["Biology", "Geography", "History"], grades: [8.0, 7.5, 7.5] },
        3: { subjects: ["English", "IT", "Physical Education"], grades: [9.0, 8.0, 7.5] }
    }},
    "S0004": { maxSemester: 5, grades: { 
        1: { subjects: ["Math", "Physics", "Chemistry"], grades: [8.5, 8.0, 7.5] },
        2: { subjects: ["Biology", "Geography", "History"], grades: [7.0, 8.0, 7.5] },
        3: { subjects: ["English", "IT", "Physical Education"], grades: [8.5, 7.5, 7.0] },
        4: { subjects: ["Philosophy", "Literature", "Art"], grades: [7.5, 8.0, 7.0] },
        5: { subjects: ["Programming", "Data Science", "Algorithms"], grades: [8.5, 8.0, 7.5] }
    }}
};

function handleAdminInput() {
    const inputIDs = document.getElementById("recommendStudentID").value.split(",").map(id => id.trim());
    fetchStudentGrades(inputIDs);
}

function fetchStudentGrades(studentIDs) {
    const gradesTableContainer = document.getElementById("gradesTableContainer");
    gradesTableContainer.innerHTML = ""; // Xóa dữ liệu cũ

    // Nhóm sinh viên theo từng kỳ học
    const semesterGroups = {};

    studentIDs.forEach(studentID => {
        const student = studentData[studentID];

        if (!student) {
            gradesTableContainer.innerHTML += `<p style="color: red;">Không tìm thấy dữ liệu của ${studentID}</p>`;
            return;
        }

        const { maxSemester, grades } = student;
        if (!semesterGroups[maxSemester]) {
            semesterGroups[maxSemester] = [];
        }
        semesterGroups[maxSemester].push({ studentID, subjects: grades[maxSemester].subjects, scores: grades[maxSemester].grades });
    });

    // Hiển thị bảng theo từng kỳ học
    Object.keys(semesterGroups).forEach(semester => {
        const studentsInSemester = semesterGroups[semester];

        let tableHTML = `
            <div class="student-info">
                <h4>Semester: ${semester}</h4>
                ${studentsInSemester.map(({ studentID }) => `<p  padding: 5px; border-radius: 5px; display: block; max-width: 130px; margin-bottom: 5px;">StudentID: ${studentID}</p>`).join("")}
                <table style="border-collapse: collapse; width: 100%; border: 2px solid black;">
                    <tr style="border: 2px solid black;">
                        <th style="text-align: center; padding: 10px; border: 2px solid black;">StudentID</th>
                        ${studentsInSemester[0].subjects.map(subject => `<th style="text-align: center; padding: 10px; border: 2px solid black;">${subject}</th>`).join("")}
                    </tr>
        `;

        studentsInSemester.forEach(({ studentID, scores }) => {
            tableHTML += `
                <tr style="border: 2px solid black;">
                    <td style="text-align: center; padding: 10px; border: 2px solid black;">${studentID}</td>
                    ${scores.map(score => `<td style="text-align: center; padding: 10px; border: 2px solid black;">${score}</td>`).join("")}
                </tr>
            `;
        });

        tableHTML += `</table></div><br>`;
        gradesTableContainer.innerHTML += tableHTML;
    });
}
