function alert(id) {
  setTimeout(() => {
    id.style.border = "";
    id.textContent = "";
    id.classList.remove("custom_alert");
  }, 3000);
}

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const passwordRegex = /^(?=.*[A-Z])(?=.*[!@#$%^&*]).{6,}$/;

function validate() {
  let username = document.getElementById("uname");
  let password = document.getElementById("password");
  let passwordconf = document.getElementById("conform");
  let userphone = document.getElementById("phone");
  let email = document.getElementById("email");

  // Username validation
  if (!/^\w+$/.test(username.value)) {
    username.style.border = "solid 1px red";
    userError.textContent = "Please enter a valid username";
    alert(userError);
    return false;
  }

  // Email validation
  if (!emailRegex.test(email.value.trim())) {
    email.style.border = "solid 1px red";
    emailError.textContent = "Please enter a valid email address";
    alert(emailError);
    return false;
  }

  // Phone number validation
  if (userphone.value.trim().length !== 10 || !/^\d+$/.test(userphone.value)) {
    userphone.style.border = "solid 1px red";
    phoneErr.textContent = "Mobile number should be a number with 10 digits";
    alert(phoneErr);
    return false;
  }

  // Password validation
  if (password.value.trim() === "") {
    password.style.border = "solid 1px red";
    passwordError.textContent = "Password cannot be empty";
    alert(passwordError);
    return false;
  } else if (!passwordRegex.test(password.value.trim())) {
    password.style.border = "solid 1px red";
    passwordError.textContent = "Password must be at least 6 characters long, contain at least one uppercase letter, and one special character";
    alert(passwordError);
    return false;
  }

  // Password confirmation validation
  if (password.value !== passwordconf.value) {
    passwordconf.style.border = "solid 1px red";
    passwordError2.textContent = "Passwords should be the same";
    alert(passwordError2);
    return false;
  }

  return true;
}

const serverError = document.querySelector(".serverError");

setTimeout(() => {
  if (serverError) {
    serverError.style.display = "none";
  }
}, 3000);
