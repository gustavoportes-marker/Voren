/**
 * Voren — Login
 * Handles field validation, password visibility, and the sign-in flow.
 * There is no live backend yet, so `authenticate()` simulates a network
 * call. Swap its body for a real fetch() to your auth endpoint when ready —
 * every other function in this file stays the same.
 */

(() => {
  const form = document.getElementById('login-form');
  const emailField = document.getElementById('email');
  const passwordField = document.getElementById('password');
  const emailError = document.getElementById('email-error');
  const passwordError = document.getElementById('password-error');
  const toggleVisibilityBtn = document.getElementById('toggle-password');
  const submitBtn = document.getElementById('submit-btn');
  const submitBtnLabel = submitBtn.querySelector('.btn-label');
  const submitBtnSpinner = submitBtn.querySelector('.spinner');

  /** Simulated auth call. Rejects for one seeded "wrong password" demo case
   *  so the error state is easy to trigger: try any email with password
   *  "wrongpass1". Everything else that passes validation succeeds. */
  function authenticate(email, password) {
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        if (password === 'wrongpass1') {
          reject(new Error('The email or password you entered is incorrect.'));
        } else {
          resolve({ email });
        }
      }, 900);
    });
  }

  function setFieldError(input, errorEl, message) {
    if (message) {
      input.setAttribute('aria-invalid', 'true');
      errorEl.textContent = message;
    } else {
      input.removeAttribute('aria-invalid');
      errorEl.textContent = '';
    }
  }

  function validateEmail() {
    const value = emailField.value.trim();
    if (!value) {
      setFieldError(emailField, emailError, 'Enter your email address.');
      return false;
    }
    if (!VorenUtils.isValidEmail(value)) {
      setFieldError(emailField, emailError, 'Enter a valid email address.');
      return false;
    }
    setFieldError(emailField, emailError, '');
    return true;
  }

  function validatePassword() {
    const value = passwordField.value;
    if (!value) {
      setFieldError(passwordField, passwordError, 'Enter your password.');
      return false;
    }
    if (value.length < 8) {
      setFieldError(passwordField, passwordError, 'Password must be at least 8 characters.');
      return false;
    }
    setFieldError(passwordField, passwordError, '');
    return true;
  }

  // Validate as the user leaves a field, and re-validate live once an error
  // is already showing — this clears the message as soon as it's fixed
  // instead of waiting for the next blur.
  emailField.addEventListener('blur', validateEmail);
  passwordField.addEventListener('blur', validatePassword);
  emailField.addEventListener('input', () => {
    if (emailField.getAttribute('aria-invalid') === 'true') validateEmail();
  });
  passwordField.addEventListener('input', () => {
    if (passwordField.getAttribute('aria-invalid') === 'true') validatePassword();
  });

  toggleVisibilityBtn.addEventListener('click', () => {
    const isPassword = passwordField.type === 'password';
    passwordField.type = isPassword ? 'text' : 'password';
    toggleVisibilityBtn.setAttribute('aria-label', isPassword ? 'Hide password' : 'Show password');
    toggleVisibilityBtn.innerHTML = isPassword ? ICON_EYE_OFF : ICON_EYE;
  });

  const ICON_EYE =
    '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M1.5 10S4.5 4 10 4s8.5 6 8.5 6-3 6-8.5 6-8.5-6-8.5-6Z"/><circle cx="10" cy="10" r="2.5"/></svg>';
  const ICON_EYE_OFF =
    '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M2.5 2.5l15 15M8.3 8.4a2.5 2.5 0 0 0 3.4 3.4M6.2 5.1C3.6 6.1 1.5 10 1.5 10s3 6 8.5 6c1.5 0 2.8-.4 3.9-1M15.7 13.9C17.4 12.4 18.5 10 18.5 10s-1.3-2.6-3.7-4.3C13.6 4.8 11.9 4 10 4c-.5 0-1 0-1.4.1"/></svg>';

  function setLoading(isLoading) {
    submitBtn.disabled = isLoading;
    submitBtnSpinner.hidden = !isLoading;
    submitBtnLabel.textContent = isLoading ? 'Signing in…' : 'Sign in';
  }

  form.addEventListener('submit', async (event) => {
    event.preventDefault();

    const emailOk = validateEmail();
    const passwordOk = validatePassword();
    if (!emailOk || !passwordOk) {
      (emailOk ? passwordField : emailField).focus();
      return;
    }

    setLoading(true);
    try {
      await authenticate(emailField.value.trim(), passwordField.value);
      VorenUtils.showToast({
        type: 'success',
        title: 'Signed in',
        message: 'Taking you to your dashboard…',
        duration: 1200,
      });
      setTimeout(() => {
        window.location.href = 'dashboard.html';
      }, 550);
    } catch (err) {
      setLoading(false);
      setFieldError(passwordField, passwordError, err.message);
      passwordField.focus();
      VorenUtils.showToast({
        type: 'error',
        title: 'Sign-in failed',
        message: err.message,
      });
    }
  });
})();
