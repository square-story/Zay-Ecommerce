// script.js
const inputs = document.getElementById('inputs');
const resendBtn = document.getElementById('resend');
const timerElement = document.getElementById('timer');

// Focus handling for OTP inputs
if (inputs) {
  inputs.addEventListener('input', function (e) {
    const target = e.target;
    const val = target.value;

    if (isNaN(val)) {
      target.value = '';
      return;
    }

    if (val != '') {
      const next = target.nextElementSibling;
      if (next) {
        next.focus();
      }
    }
  });

  inputs.addEventListener('keyup', function (e) {
    const target = e.target;
    const key = e.key.toLowerCase();

    if (key == 'backspace' || key == 'delete') {
      target.value = '';
      const prev = target.previousElementSibling;
      if (prev) {
        prev.focus();
      }
      return;
    }
  });
}

let countdownInterval;
const COUNTDOWN_TIME = 60;

function startCountdown(initialValue) {
  let n = initialValue;

  // Disable button and ensure styling reflects it
  resendBtn.style.pointerEvents = 'none';
  resendBtn.style.opacity = '0.5';
  resendBtn.style.cursor = 'not-allowed';

  if (timerElement) {
    timerElement.style.display = 'inline';
    timerElement.textContent = `Verify in ${n}s`;
  }

  clearInterval(countdownInterval); // Clear any existing interval
  countdownInterval = setInterval(() => {
    n--;
    if (timerElement) {
      timerElement.textContent = `Verify in ${n}s`;
    }

    if (n <= 0) {
      clearInterval(countdownInterval);
      enableResend();
    }
  }, 1000);
}

function enableResend() {
  if (timerElement) {
    timerElement.style.display = 'none'; // Hide timer when finished
  }

  resendBtn.style.pointerEvents = 'auto';
  resendBtn.style.opacity = '1';
  resendBtn.style.cursor = 'pointer';
  resendBtn.textContent = 'Resend OTP';
}

function handleResend() {
  const urlParams = new URLSearchParams(window.location.search);
  const email = urlParams.get('email');

  console.log('Resending OTP to:', email);

  const postUrl = '/resend' + (email ? `?email=${encodeURIComponent(email)}` : '');

  fetch(postUrl, {
    method: 'POST',
  })
    .then((response) => {
      if (response.ok) {
        console.log('Resend request successful');
        // Restart countdown only on success or as desired logic
        startCountdown(COUNTDOWN_TIME);
      } else {
        console.error('Resend request failed');
        // Optional: Show error message to user
        alert('Failed to resend OTP. Please try again.');
        enableResend(); // Re-enable if failed so they can try again
      }
    })
    .catch((error) => {
      console.error('Error:', error);
      alert('An error occurred. Please check your connection.');
      enableResend();
    });
}

// Initialize
if (resendBtn) {
  resendBtn.addEventListener('click', handleResend);
  startCountdown(COUNTDOWN_TIME);
}
