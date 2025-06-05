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

function toggleExplanations1() {
    const box1 = document.getElementById('box1');
    const box2 = document.getElementById('box2');
    const button = document.getElementById('toggle1');

    const isHidden = box1.classList.contains('hidden') && box2.classList.contains('hidden');

    if (isHidden) {
        box1.classList.remove('hidden');
        box2.classList.remove('hidden');
        button.textContent = 'Hide Explanations';
    } else {
        box1.classList.add('hidden');
        box2.classList.add('hidden');
        button.textContent = 'Show Explanations';
    }
}


function toggleExplanations2() {
    const box3 = document.getElementById('box3');
    const box4 = document.getElementById('box4');
    const button = document.getElementById('toggle2');

    const isHidden = box3.classList.contains('hidden') && box4.classList.contains('hidden');

    if (isHidden) {
        box3.classList.remove('hidden');
        box4.classList.remove('hidden');
        button.textContent = 'Hide Explanations';
    } else {
        box3.classList.add('hidden');
        box4.classList.add('hidden');
        button.textContent = 'Show Explanations';
    }
}




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


function logout() {
    localStorage.removeItem("loggedInUser");
    window.location.href = "login.html";
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
// document.getElementById("recommendStudentID").addEventListener("input", handleAdminInput);

const studentData = {
    "S0001": { maxSemester: 5, grades: { 
        1: { subjects: ["Math", "Physics", "Chemistry"], grades: [9.0, 8.5, 7.5] },
        2: { subjects: ["Biology", "Geography", "History"], grades: [8.0, 7.0, 8.5] },
        3: { subjects: ["English", "IT", "Physical Education"], grades: [9.5, 8.5, 7.0] },
        4: { subjects: ["Philosophy", "Literature", "Art"], grades: [7.5, 8.0, 7.0] },
        5: { subjects: ["Programming", "Data Science", "Algorithms"], grades: [6.0, 4.5, 4.8] }
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

function recommendCourses() {
    document.querySelectorAll(".rcm").forEach(panel => {
        panel.style.display = "block";
        panel.scrollIntoView({ behavior: 'smooth' });
    });
}


