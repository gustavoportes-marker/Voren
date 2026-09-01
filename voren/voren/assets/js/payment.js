/**
 * Voren — Método de pagamento
 * Belongs exclusively to pages/payment.html. Does not touch, import, or
 * depend on assets/js/dashboard.js (which expects elements — the
 * subscriptions table, quick actions, summary cards — that don't exist on
 * this page). The shell interactions below (mobile drawer, dropdowns,
 * loader) are written fresh here, matching dashboard.js's behavior exactly
 * so the page feels identical, without risking a crash from a missing
 * element dashboard.js assumes is present.
 *
 * SECURITY NOTE: this is a frontend-only mock with no backend or payment
 * gateway wired up. On purpose, it never stores the full card number or
 * CVV anywhere (not even localStorage) — only a masked last-4 + brand +
 * expiry, the same way a real app would only ever keep what a gateway
 * (Stripe, Mercado Pago, etc.) returns after tokenizing the card. The raw
 * PAN/CVV are read only long enough to validate them in memory, then
 * discarded. See saveCardToGateway() below for where the real integration
 * goes.
 */

(() => {
  // ---- Mobile sidebar drawer ----------------------------------------------
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('sidebar-overlay');
  const menuToggle = document.getElementById('menu-toggle');
  const sidebarClose = document.getElementById('sidebar-close');

  function openSidebar() {
    sidebar.classList.add('is-open');
    overlay.classList.add('is-visible');
    menuToggle.setAttribute('aria-expanded', 'true');
  }

  function closeSidebar() {
    sidebar.classList.remove('is-open');
    overlay.classList.remove('is-visible');
    menuToggle.setAttribute('aria-expanded', 'false');
  }

  if (menuToggle) menuToggle.addEventListener('click', openSidebar);
  if (sidebarClose) sidebarClose.addEventListener('click', closeSidebar);
  if (overlay) overlay.addEventListener('click', closeSidebar);

  // ---- Dropdown menus (notifications, profile) ----------------------------
  function setupDropdown(triggerId, dropdownId) {
    const trigger = document.getElementById(triggerId);
    const dropdown = document.getElementById(dropdownId);
    if (!trigger || !dropdown) return;

    const close = () => {
      dropdown.classList.remove('is-open');
      trigger.setAttribute('aria-expanded', 'false');
    };

    trigger.addEventListener('click', (e) => {
      e.stopPropagation();
      const isOpen = dropdown.classList.contains('is-open');
      document.querySelectorAll('.notif-dropdown.is-open, .profile-dropdown.is-open').forEach((el) => {
        el.classList.remove('is-open');
      });
      document.querySelectorAll('[aria-expanded="true"]').forEach((el) => el.setAttribute('aria-expanded', 'false'));
      if (!isOpen) {
        dropdown.classList.add('is-open');
        trigger.setAttribute('aria-expanded', 'true');
      }
    });

    document.addEventListener('click', (e) => {
      if (!dropdown.contains(e.target) && !trigger.contains(e.target)) close();
    });
  }

  setupDropdown('notif-trigger', 'notif-dropdown');
  setupDropdown('profile-trigger', 'profile-dropdown');

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeSidebar();
      document.querySelectorAll('.notif-dropdown.is-open, .profile-dropdown.is-open').forEach((el) => {
        el.classList.remove('is-open');
      });
    }
  });

  // ---- Initial skeleton -> content transition ------------------------------
  const pageLoader = document.getElementById('page-loader');
  if (pageLoader) {
    setTimeout(() => {
      pageLoader.classList.add('is-hidden');
      pageLoader.addEventListener('transitionend', () => pageLoader.remove(), { once: true });
    }, 500);
  }

  // ==========================================================================
  // Payment method form
  // ==========================================================================
  const PAYMENT_METHOD_STORAGE_KEY = 'voren_payment_method';

  const form = document.getElementById('payment-form');
  const nameField = document.getElementById('cardholder-name');
  const numberField = document.getElementById('card-number');
  const numberWrap = document.getElementById('card-number-wrap');
  const expiryField = document.getElementById('card-expiry');
  const cvvField = document.getElementById('card-cvv');
  const zipField = document.getElementById('card-zip');
  const cancelBtn = document.getElementById('payment-cancel-btn');
  const savedNote = document.getElementById('payment-saved-note');
  const savedNoteText = document.getElementById('payment-saved-note-text');

  // ---- Input formatting (pure UX, not validation) --------------------------
  function formatCardNumberInput(e) {
    const digits = e.target.value.replace(/\D/g, '').slice(0, 19);
    e.target.value = digits.replace(/(\d{4})(?=\d)/g, '$1 ');
    numberWrap.classList.toggle('has-value', digits.length > 0);
  }

  function formatExpiryInput(e) {
    const digits = e.target.value.replace(/\D/g, '').slice(0, 4);
    e.target.value = digits.length > 2 ? `${digits.slice(0, 2)}/${digits.slice(2)}` : digits;
  }

  function formatDigitsOnlyInput(e) {
    e.target.value = e.target.value.replace(/\D/g, '');
  }

  numberField.addEventListener('input', formatCardNumberInput);
  expiryField.addEventListener('input', formatExpiryInput);
  cvvField.addEventListener('input', formatDigitsOnlyInput);
  zipField.addEventListener('input', (e) => {
    const digits = e.target.value.replace(/\D/g, '').slice(0, 8);
    e.target.value = digits.length > 5 ? `${digits.slice(0, 5)}-${digits.slice(5)}` : digits;
  });

  // ---- Validation ------------------------------------------------------------
  /** Standard Luhn checksum, the same basic check every card form runs. */
  function isValidCardNumber(digitsOnly) {
    if (digitsOnly.length < 13 || digitsOnly.length > 19) return false;
    let sum = 0;
    let shouldDouble = false;
    for (let i = digitsOnly.length - 1; i >= 0; i -= 1) {
      let digit = parseInt(digitsOnly[i], 10);
      if (shouldDouble) {
        digit *= 2;
        if (digit > 9) digit -= 9;
      }
      sum += digit;
      shouldDouble = !shouldDouble;
    }
    return sum % 10 === 0;
  }

  function isValidExpiry(mmYY) {
    const match = /^(\d{2})\/(\d{2})$/.exec(mmYY);
    if (!match) return false;
    const month = parseInt(match[1], 10);
    const year = 2000 + parseInt(match[2], 10);
    if (month < 1 || month > 12) return false;

    const now = new Date();
    const expiryDate = new Date(year, month, 0, 23, 59, 59);
    return expiryDate >= new Date(now.getFullYear(), now.getMonth(), 1);
  }

  function setFieldError(input, errorId, message) {
    const errorEl = document.getElementById(errorId);
    if (message) {
      input.setAttribute('aria-invalid', 'true');
      errorEl.textContent = message;
    } else {
      input.removeAttribute('aria-invalid');
      errorEl.textContent = '';
    }
  }

  function validateName() {
    const value = nameField.value.trim();
    if (!value || value.length < 3) {
      setFieldError(nameField, 'cardholder-name-error', 'Informe o nome como está no cartão.');
      return false;
    }
    setFieldError(nameField, 'cardholder-name-error', '');
    return true;
  }

  function validateNumber() {
    const digits = numberField.value.replace(/\D/g, '');
    if (!digits) {
      setFieldError(numberField, 'card-number-error', 'Informe o número do cartão.');
      return false;
    }
    if (!isValidCardNumber(digits)) {
      setFieldError(numberField, 'card-number-error', 'Número de cartão inválido.');
      return false;
    }
    setFieldError(numberField, 'card-number-error', '');
    return true;
  }

  function validateExpiry() {
    const value = expiryField.value.trim();
    if (!value) {
      setFieldError(expiryField, 'card-expiry-error', 'Informe a validade.');
      return false;
    }
    if (!isValidExpiry(value)) {
      setFieldError(expiryField, 'card-expiry-error', 'Data inválida ou vencida.');
      return false;
    }
    setFieldError(expiryField, 'card-expiry-error', '');
    return true;
  }

  function validateCvv() {
    const digits = cvvField.value.trim();
    if (digits.length < 3 || digits.length > 4) {
      setFieldError(cvvField, 'card-cvv-error', 'CVV inválido.');
      return false;
    }
    setFieldError(cvvField, 'card-cvv-error', '');
    return true;
  }

  function validateZip() {
    const value = zipField.value.trim();
    if (!value) {
      setFieldError(zipField, 'card-zip-error', '');
      return true; // optional field
    }
    if (!/^\d{5}-?\d{3}$/.test(value)) {
      setFieldError(zipField, 'card-zip-error', 'CEP inválido.');
      return false;
    }
    setFieldError(zipField, 'card-zip-error', '');
    return true;
  }

  [nameField, numberField, expiryField, cvvField, zipField].forEach((field) => {
    field.addEventListener('blur', () => {
      if (field === nameField) validateName();
      if (field === numberField) validateNumber();
      if (field === expiryField) validateExpiry();
      if (field === cvvField) validateCvv();
      if (field === zipField) validateZip();
    });
  });

  // ---- Persistence / future integration --------------------------------------
  /**
   * Reads the saved (masked) payment method, if any, so the page can show
   * what's already on file instead of an empty form.
   */
  function loadSavedPaymentMethod() {
    try {
      const raw = window.localStorage.getItem(PAYMENT_METHOD_STORAGE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  /**
   * Detects the card brand from its leading digits — display only, no
   * validation weight. Good enough for showing an icon/label.
   */
  function detectCardBrand(digitsOnly) {
    if (/^4/.test(digitsOnly)) return 'Visa';
    if (/^5[1-5]/.test(digitsOnly)) return 'Mastercard';
    if (/^3[47]/.test(digitsOnly)) return 'Amex';
    return 'Cartão';
  }

  /**
   * Sends the raw card data to a payment gateway for tokenization.
   * NOT IMPLEMENTED — no gateway is connected yet, per this task's scope.
   *
   * TODO(gateway): this is the only place the raw card number/CVV should
   * ever be sent, and only ever directly to the gateway's SDK — never to
   * our own backend. With Stripe.js, for example:
   *   const { token, error } = await stripe.createToken(cardElement);
   *   if (error) throw new Error(error.message);
   *   return token.id;
   * With Mercado Pago's SDK the shape differs but the principle is the
   * same: exchange the raw card for an opaque token here, then only ever
   * work with that token afterward.
   */
  async function saveCardToGateway({ cardholderName, cardNumberDigits, expiry, cvv }) {
    throw new Error('Payment gateway not configured yet.');
  }

  /**
   * Persists only the masked, non-sensitive summary of the card — never
   * the full number or CVV.
   *
   * TODO(firebase): once a backend exists, replace this localStorage write
   * with something like:
   *   await setDoc(doc(db, 'users', uid, 'settings', 'paymentMethod'), {
   *     brand, last4, expiry, updatedAt: serverTimestamp(),
   *   });
   * The shape of `maskedMethod` below already matches what that call would
   * send, so this function's signature won't need to change later.
   */
  function savePaymentMethodMasked(maskedMethod) {
    window.localStorage.setItem(PAYMENT_METHOD_STORAGE_KEY, JSON.stringify(maskedMethod));
  }

  function describeSavedMethod(method) {
    return `${method.brand} terminado em ${method.last4} · válido até ${method.expiry}`;
  }

  function showSavedNote(method) {
    if (!savedNote || !savedNoteText) return;
    savedNoteText.textContent = `Cartão salvo: ${describeSavedMethod(method)}.`;
    savedNote.hidden = false;
  }

  const existingMethod = loadSavedPaymentMethod();
  if (existingMethod) {
    showSavedNote(existingMethod);
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const validations = [validateName(), validateNumber(), validateExpiry(), validateCvv(), validateZip()];
    if (validations.includes(false)) {
      const firstInvalid = [nameField, numberField, expiryField, cvvField, zipField].find(
        (field) => field.getAttribute('aria-invalid') === 'true'
      );
      if (firstInvalid) firstInvalid.focus();
      VorenUtils.showToast({
        type: 'error',
        title: 'Verifique os campos',
        message: 'Alguns dados do cartão precisam ser corrigidos antes de salvar.',
      });
      return;
    }

    const cardNumberDigits = numberField.value.replace(/\D/g, '');
    const maskedMethod = {
      brand: detectCardBrand(cardNumberDigits),
      last4: cardNumberDigits.slice(-4),
      expiry: expiryField.value.trim(),
    };

    // Gateway integration is not connected yet in this step — saving stays
    // frontend-only, matching the task's scope. Once it exists, this is
    // where its result (a token) would be awaited before saving.
    savePaymentMethodMasked(maskedMethod);
    showSavedNote(maskedMethod);

    VorenUtils.showToast({
      type: 'success',
      title: 'Método de pagamento salvo',
      message: describeSavedMethod(maskedMethod),
    });
  });

  if (cancelBtn) {
    cancelBtn.addEventListener('click', () => {
      window.location.href = 'dashboard.html';
    });
  }
})();
