function alert(id) {
  setTimeout(() => {
    id.style.border = "";
    id.textContent = "";
    id.classList.remove("custom_alert");
  }, 3000);
}

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
function validate() {
  let username = document.getElementById("uname");
  let password = document.getElementById("password");
  let passwordconf = document.getElementById("conform");
  let userphone = document.getElementById("phone");
  let email = document.getElementById("email");

  if (!/^\w+$/.test(username.value)) {
    username.style.border = "solid 1px red";
    userError.textContent = "Please enter valid username";
    setTimeout(function () {
      username.style.border = "";
      userError.textContent = "";
    }, 3000);

    return false;
  } else if (
    email.value.indexOf("@") == -1 ||
    !emailRegex.test(email.value.trim()) ||
    email.value.trim() === ""
  ) {
    email.style.border = "solid 1px red";
    emailError.textContent = "Please enter a valid email address";

    setTimeout(() => {
      email.style.border = "";
      emailError.textContent = "";
    }, 3000);

    return false;
  } else if (
    userphone.value.trim().length < 10 ||
    !/^\d+$/.test(userphone.value)
  ) {
    userphone.style.border = "solid 1px red";
    phoneErr.textContent = "Mobile number should be an Number with  10 digits";
    setTimeout(function () {
      userphone.style.border = "";
      phoneErr.textContent = "";
    }, 3000);
    return false;
  }  else if (password.value !== passwordconf.value) {
    passwordconf.style.border = "solid 1px red";
    passwordError2.textContent = "Password should be same";
    setTimeout(function () {
      passwordconf.style.border = "";
      passwordError2.textContent = "";
    }, 3000);
    return false;
  } else {
    true;
  }
}

const serverError = document.querySelector(".serverError");

setTimeout(() => {
  serverError.style.display = "none";
}, 3000);
