/**
 * Voren — Orçamento
 * Belongs exclusively to pages/orcamento.html. Does not touch, import, or
 * depend on assets/js/dashboard.js (which expects DOM elements — the
 * subscriptions table, quick actions, summary cards — that don't exist on
 * this page). The shell interactions below (mobile drawer, dropdowns,
 * loader) are written fresh here, matching dashboard.js's behavior exactly
 * so the page feels identical, without risking a crash from a missing
 * element dashboard.js assumes is present.
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
  // Budget form
  // ==========================================================================
  const BUDGET_STORAGE_KEY = 'voren_monthly_budget';

  const form = document.getElementById('budget-form');
  const amountField = document.getElementById('budget-amount');
  const amountError = document.getElementById('budget-amount-error');
  const cancelBtn = document.getElementById('budget-cancel-btn');
  const savedNote = document.getElementById('budget-saved-note');
  const savedNoteText = document.getElementById('budget-saved-note-text');

  /**
   * Reads the previously saved budget, if any.
   *
   * TODO(firebase): once a backend exists, replace this with a read from
   * Firestore for the current user, e.g.:
   *   const snap = await getDoc(doc(db, 'users', uid, 'settings', 'budget'));
   *   return snap.exists() ? snap.data().monthlyAmount : null;
   * Everything below that calls loadSavedBudget() stays the same — it just
   * needs a number back.
   */
  function loadSavedBudget() {
    const raw = window.localStorage.getItem(BUDGET_STORAGE_KEY);
    const value = raw === null ? null : parseFloat(raw);
    return Number.isFinite(value) ? value : null;
  }

  /**
   * Persists the budget. Frontend-only for now (localStorage stands in for
   * a real store) — no backend, no Firebase calls yet.
   *
   * TODO(firebase): replace the localStorage.setItem call with something
   * like:
   *   await setDoc(doc(db, 'users', uid, 'settings', 'budget'), {
   *     monthlyAmount: amount,
   *     updatedAt: serverTimestamp(),
   *   });
   * The Dashboard's budget chart will read from that same source once it's
   * wired up — this page's only job is to write the value.
   */
  function saveBudget(amount) {
    window.localStorage.setItem(BUDGET_STORAGE_KEY, String(amount));
  }

  function setAmountError(message) {
    if (message) {
      amountField.setAttribute('aria-invalid', 'true');
      amountError.textContent = message;
    } else {
      amountField.removeAttribute('aria-invalid');
      amountError.textContent = '';
    }
  }

  function showSavedNote(amount) {
    if (!savedNote || !savedNoteText) return;
    savedNoteText.textContent = `Orçamento salvo: ${VorenUtils.formatCurrency(amount)} por mês.`;
    savedNote.hidden = false;
  }

  // Prefill with whatever was saved before, so reopening this page shows
  // the current setting instead of an empty field.
  const existingBudget = loadSavedBudget();
  if (existingBudget !== null) {
    amountField.value = existingBudget;
    showSavedNote(existingBudget);
  }

  amountField.addEventListener('input', () => {
    if (amountField.getAttribute('aria-invalid') === 'true') setAmountError('');
  });

  form.addEventListener('submit', (e) => {
    e.preventDefault();

    const rawValue = amountField.value.trim();
    const amount = parseFloat(rawValue);

    if (!rawValue || Number.isNaN(amount) || amount <= 0) {
      setAmountError('Informe um valor para o orçamento mensal.');
      amountField.focus();
      return;
    }

    setAmountError('');
    saveBudget(amount);
    showSavedNote(amount);

    VorenUtils.showToast({
      type: 'success',
      title: 'Orçamento salvo',
      message: `O Voren vai usar ${VorenUtils.formatCurrency(amount)} por mês a partir de agora.`,
    });
  });

  if (cancelBtn) {
    cancelBtn.addEventListener('click', () => {
      window.location.href = 'dashboard.html';
    });
  }
})();
