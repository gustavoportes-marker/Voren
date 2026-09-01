/**
 * Voren — Sign up
 * Field validation, password visibility toggles, and the account-creation
 * flow. There is no live backend yet, so `registerAccount()` simulates a
 * network call — replace its body with a real fetch() to your signup
 * endpoint when ready. Every other function here stays the same.
 */

(() => {
  const form = document.getElementById('signup-form');
  const fullNameField = document.getElementById('full-name');
  const emailField = document.getElementById('email');
  const passwordField = document.getElementById('password');
  const confirmPasswordField = document.getElementById('confirm-password');

  const fullNameError = document.getElementById('full-name-error');
  const emailError = document.getElementById('email-error');
  const passwordError = document.getElementById('password-error');
  const confirmPasswordError = document.getElementById('confirm-password-error');

  const submitBtn = document.getElementById('submit-btn');
  const submitBtnLabel = submitBtn.querySelector('.btn-label');
  const submitBtnSpinner = submitBtn.querySelector('.spinner');

  const ICON_EYE =
    '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M1.5 10S4.5 4 10 4s8.5 6 8.5 6-3 6-8.5 6-8.5-6-8.5-6Z"/><circle cx="10" cy="10" r="2.5"/></svg>';
  const ICON_EYE_OFF =
    '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M2.5 2.5l15 15M8.3 8.4a2.5 2.5 0 0 0 3.4 3.4M6.2 5.1C3.6 6.1 1.5 10 1.5 10s3 6 8.5 6c1.5 0 2.8-.4 3.9-1M15.7 13.9C17.4 12.4 18.5 10 18.5 10s-1.3-2.6-3.7-4.3C13.6 4.8 11.9 4 10 4c-.5 0-1 0-1.4.1"/></svg>';

  /**
   * Simulated signup call. Rejects for one seeded "already registered"
   * demo case so the error state is easy to trigger: use the email
   * taken@voren.io. Everything else that passes validation succeeds.
   *
   * TODO(auth): replace with a real request once the backend exists, e.g.
   *   const res = await fetch('/api/auth/signup', {
   *     method: 'POST',
   *     headers: { 'Content-Type': 'application/json' },
   *     body: JSON.stringify({ fullName, email, password }),
   *   });
   *   if (!res.ok) throw new Error((await res.json()).message);
   *   return res.json();
   */
  function registerAccount(fullName, email, password) {
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        if (email.toLowerCase() === 'taken@voren.io') {
          reject(new Error('An account with this email already exists.'));
        } else {
          resolve({ fullName, email });
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

  function validateFullName() {
    const value = fullNameField.value.trim();
    if (!value) {
      setFieldError(fullNameField, fullNameError, 'Enter your full name.');
      return false;
    }
    if (value.length < 2) {
      setFieldError(fullNameField, fullNameError, 'Enter your full name.');
      return false;
    }
    setFieldError(fullNameField, fullNameError, '');
    return true;
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
      setFieldError(passwordField, passwordError, 'Create a password.');
      return false;
    }
    if (!VorenUtils.isValidPassword(value)) {
      setFieldError(passwordField, passwordError, 'Use at least 8 characters, with a letter and a number.');
      return false;
    }
    setFieldError(passwordField, passwordError, '');
    return true;
  }

  function validateConfirmPassword() {
    const value = confirmPasswordField.value;
    if (!value) {
      setFieldError(confirmPasswordField, confirmPasswordError, 'Confirm your password.');
      return false;
    }
    if (value !== passwordField.value) {
      setFieldError(confirmPasswordField, confirmPasswordError, 'Passwords do not match.');
      return false;
    }
    setFieldError(confirmPasswordField, confirmPasswordError, '');
    return true;
  }

  // Validate on blur; once a field shows an error, re-validate live so the
  // message clears as soon as it's fixed instead of waiting for another blur.
  fullNameField.addEventListener('blur', validateFullName);
  emailField.addEventListener('blur', validateEmail);
  passwordField.addEventListener('blur', validatePassword);
  confirmPasswordField.addEventListener('blur', validateConfirmPassword);

  fullNameField.addEventListener('input', () => {
    if (fullNameField.getAttribute('aria-invalid') === 'true') validateFullName();
  });
  emailField.addEventListener('input', () => {
    if (emailField.getAttribute('aria-invalid') === 'true') validateEmail();
  });
  passwordField.addEventListener('input', () => {
    if (passwordField.getAttribute('aria-invalid') === 'true') validatePassword();
    // Confirm-password depends on password's value, so keep it in sync
    // whenever it's already showing an error.
    if (confirmPasswordField.getAttribute('aria-invalid') === 'true') validateConfirmPassword();
  });
  confirmPasswordField.addEventListener('input', () => {
    if (confirmPasswordField.getAttribute('aria-invalid') === 'true') validateConfirmPassword();
  });

  function bindPasswordToggle(toggleId, fieldEl) {
    const toggleBtn = document.getElementById(toggleId);
    toggleBtn.addEventListener('click', () => {
      const isPassword = fieldEl.type === 'password';
      fieldEl.type = isPassword ? 'text' : 'password';
      toggleBtn.setAttribute('aria-label', isPassword ? 'Hide password' : 'Show password');
      toggleBtn.innerHTML = isPassword ? ICON_EYE_OFF : ICON_EYE;
    });
  }

  bindPasswordToggle('toggle-password', passwordField);
  bindPasswordToggle('toggle-confirm-password', confirmPasswordField);

  function setLoading(isLoading) {
    submitBtn.disabled = isLoading;
    submitBtnSpinner.hidden = !isLoading;
    submitBtnLabel.textContent = isLoading ? 'Creating account…' : 'Create account';
  }

  form.addEventListener('submit', async (event) => {
    event.preventDefault();

    const validations = [validateFullName(), validateEmail(), validatePassword(), validateConfirmPassword()];
    if (validations.includes(false)) {
      const firstInvalid = [fullNameField, emailField, passwordField, confirmPasswordField].find(
        (field) => field.getAttribute('aria-invalid') === 'true'
      );
      if (firstInvalid) firstInvalid.focus();
      return;
    }

    setLoading(true);
    try {
      await registerAccount(fullNameField.value.trim(), emailField.value.trim(), passwordField.value);
      VorenUtils.showToast({
        type: 'success',
        title: 'Account created',
        message: 'Taking you to your dashboard…',
        duration: 1200,
      });
      setTimeout(() => {
        window.location.href = 'dashboard.html';
      }, 550);
    } catch (err) {
      setLoading(false);
      setFieldError(emailField, emailError, err.message);
      emailField.focus();
      VorenUtils.showToast({
        type: 'error',
        title: 'Could not create account',
        message: err.message,
      });
    }
  });
})();
