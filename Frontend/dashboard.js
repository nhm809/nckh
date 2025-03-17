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
