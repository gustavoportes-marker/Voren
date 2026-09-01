/**
 * Voren — Shared Utilities
 * Small, dependency-free helpers reused across the login screen and the
 * dashboard: validation, formatting, and a toast notification system.
 */

const VorenUtils = (() => {
  const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  /** Basic RFC-5322-ish email check — good enough for client-side UX. */
  function isValidEmail(value) {
    return EMAIL_PATTERN.test(value.trim());
  }

  /** Password policy: 8+ characters, at least one letter and one number. */
  function isValidPassword(value) {
    return value.length >= 8 && /[A-Za-z]/.test(value) && /[0-9]/.test(value);
  }

  /** Formats a number as Brazilian currency, e.g. 1234.5 -> "R$ 1.234,50". */
  function formatCurrency(amount) {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 2,
    }).format(amount);
  }

  /** Formats a Date as "Jul 26" for compact date chips. */
  function formatShortDate(date) {
    return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(date);
  }

  /** Debounce: delays invoking `fn` until `wait` ms after the last call. */
  function debounce(fn, wait = 200) {
    let timeoutId;
    return (...args) => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => fn(...args), wait);
    };
  }

  /**
   * Toast notification system.
   * Renders into a single #toast-region container, auto-creating it if the
   * page doesn't already have one.
   */
  function getToastRegion() {
    let region = document.querySelector('.toast-region');
    if (!region) {
      region = document.createElement('div');
      region.className = 'toast-region';
      region.setAttribute('role', 'status');
      region.setAttribute('aria-live', 'polite');
      document.body.appendChild(region);
    }
    return region;
  }

  const ICONS = {
    success:
      '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16.7 5.3 8 14l-3.7-3.7"/></svg>',
    error:
      '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="10" cy="10" r="7.5"/><path d="M10 6.5v4M10 13.5h.01"/></svg>',
  };

  function showToast({ type = 'success', title, message, duration = 4200 }) {
    const region = getToastRegion();
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `
      <span class="toast-icon">${ICONS[type] || ICONS.success}</span>
      <span class="toast-body">
        <span class="toast-title">${title}</span>
        ${message ? `<span class="toast-message">${message}</span>` : ''}
      </span>
    `;
    region.appendChild(toast);

    const remove = () => {
      toast.classList.add('is-leaving');
      toast.addEventListener('animationend', () => toast.remove(), { once: true });
    };

    setTimeout(remove, duration);
    return { remove };
  }

  return {
    isValidEmail,
    isValidPassword,
    formatCurrency,
    formatShortDate,
    debounce,
    showToast,
  };
})();
