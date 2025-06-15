async function login() {
    const studentID = document.getElementById("studentID").value.trim();
    const password = document.getElementById("password").value.trim();
    
    if (!studentID || !password) {
        document.getElementById("loginError").innerText = "Please enter complete information.";
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
            alert(`Welcome ${studentID}`); //   Alert khi đăng nhập thành công

            localStorage.setItem("loggedInUser", studentID);
            window.location.href = "dashboard.html";
        } else {
            document.getElementById("loginError").innerText = result.message;
        }
    } catch (error) {
        document.getElementById("loginError").innerText = "Error connecting to server.";
    }
}

document.getElementById("loginBtn").addEventListener("click", login);
