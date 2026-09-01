/**
 * Voren — Dashboard
 * Wires up the app shell: mobile sidebar drawer, notification/profile
 * dropdowns, subscription search + status filters, and the initial
 * skeleton-to-content transition.
 *
 * Subscription data below stands in for a real API response. Replace
 * `SUBSCRIPTIONS` with a fetch() to your backend and the rendering
 * functions below will work unchanged as long as the shape matches.
 */

(() => {
  // ==========================================================================
  // Persistence — the same localStorage-based approach already used by the
  // Subscriptions and Orçamento pages, reused here (no second storage
  // system). SUBSCRIPTIONS_STORAGE_KEY is specific to the list rendered on
  // this page; BUDGET_STORAGE_KEY is the exact key orcamento.js already
  // writes to, so this page reads whatever the user actually saved there.
  //
  // TODO(firebase): once a backend exists, replace carregarAssinaturas()/
  // salvarAssinaturas() with reads/writes to Firestore (e.g.
  // collection(db, 'users', uid, 'subscriptions')), and
  // carregarOrcamentoMensal() with a read from the same document
  // orcamento.js will write to. Every other function below only calls
  // these — none touch localStorage directly — so that swap is the only
  // change needed.
  // ==========================================================================
  const SUBSCRIPTIONS_STORAGE_KEY = 'voren_dashboard_subscriptions';
  const BUDGET_STORAGE_KEY = 'voren_monthly_budget'; // same key orcamento.js writes to

  const DEFAULT_SUBSCRIPTIONS = [
    { id: 'netflix',   name: 'Netflix',        category: 'Streaming',    plan: 'Premium',      amount: 22.99, cycle: 'Monthly', renewsInDays: 3,  status: 'active',  initials: 'N', color: '#E4483E' },
    { id: 'spotify',   name: 'Spotify',        category: 'Music',       plan: 'Family',       amount: 16.99, cycle: 'Monthly', renewsInDays: 9,  status: 'active',  initials: 'S', color: '#17A673' },
    { id: 'figma',     name: 'Figma',          category: 'Design',      plan: 'Professional', amount: 15.00, cycle: 'Monthly', renewsInDays: 14, status: 'active',  initials: 'F', color: '#7C5CFC' },
    { id: 'notion',    name: 'Notion',         category: 'Productivity',plan: 'Plus',         amount: 10.00, cycle: 'Monthly', renewsInDays: 21, status: 'active',  initials: 'N', color: '#14162B' },
    { id: 'aws',       name: 'AWS',            category: 'Cloud',       plan: 'Pay as you go',amount: 84.32, cycle: 'Monthly', renewsInDays: 5,  status: 'active',  initials: 'A', color: '#E5940D' },
    { id: 'chatgpt',   name: 'ChatGPT',        category: 'AI',          plan: 'Plus',         amount: 20.00, cycle: 'Monthly', renewsInDays: 27, status: 'trial',   initials: 'C', color: '#17A673' },
    { id: 'adobe',     name: 'Adobe CC',       category: 'Design',      plan: 'All Apps',     amount: 54.99, cycle: 'Monthly', renewsInDays: 40, status: 'active',  initials: 'A', color: '#E4483E' },
    { id: 'hulu',      name: 'Hulu',           category: 'Streaming',   plan: 'Basic',        amount: 7.99,  cycle: 'Monthly', renewsInDays: 60, status: 'canceled',initials: 'H', color: '#4361EE' },
  ];

  /** Loads the user's subscriptions, falling back to demo data on first visit. */
  function carregarAssinaturas() {
    try {
      const raw = window.localStorage.getItem(SUBSCRIPTIONS_STORAGE_KEY);
      if (!raw) return DEFAULT_SUBSCRIPTIONS.slice();
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : DEFAULT_SUBSCRIPTIONS.slice();
    } catch {
      return DEFAULT_SUBSCRIPTIONS.slice();
    }
  }

  function salvarAssinaturas(list) {
    window.localStorage.setItem(SUBSCRIPTIONS_STORAGE_KEY, JSON.stringify(list));
  }

  /** Reads the monthly budget saved on the Orçamento page. null if never set. */
  function carregarOrcamentoMensal() {
    const raw = window.localStorage.getItem(BUDGET_STORAGE_KEY);
    const value = raw === null ? null : parseFloat(raw);
    return Number.isFinite(value) ? value : null;
  }

  const SUBSCRIPTIONS = carregarAssinaturas();

  const STATUS_LABEL = {
    active: { label: 'Active', badgeClass: 'badge-success' },
    trial: { label: 'Trial', badgeClass: 'badge-warning' },
    canceled: { label: 'Canceled', badgeClass: 'badge-neutral' },
  };

  const tableBody = document.getElementById('subscriptions-body');
  const emptyState = document.getElementById('subscriptions-empty');
  const searchInput = document.getElementById('sub-search');
  const filterChips = document.querySelectorAll('.chip[data-filter]');

  // ==========================================================================
  // Summary cards, budget ring and upcoming payments — recomputed live from
  // SUBSCRIPTIONS and the saved budget every time something changes.
  // Nothing here is a fixed/mock number: if SUBSCRIPTIONS is empty or no
  // budget was ever saved, the cards reflect exactly that.
  //
  // Counting rules (documented here since nothing in the markup states
  // them):
  //  - "Active subscriptions" = status !== 'canceled' (active + trial)
  //  - "Monthly spending" / "Upcoming payments" = status === 'active' only
  //    (a subscription still in trial hasn't actually charged anything yet)
  // ==========================================================================
  function calcularResumo() {
    const naoCanceladas = SUBSCRIPTIONS.filter((s) => s.status !== 'canceled');
    const cobraveis = SUBSCRIPTIONS.filter((s) => s.status === 'active');

    const monthlySpending = cobraveis.reduce((sum, s) => sum + s.amount, 0);
    const upcoming = cobraveis.filter((s) => s.renewsInDays >= 0 && s.renewsInDays <= 7);
    const upcomingAmount = upcoming.reduce((sum, s) => sum + s.amount, 0);

    const budget = carregarOrcamentoMensal();
    const spentPct = budget && budget > 0 ? Math.min(100, Math.round((monthlySpending / budget) * 100)) : 0;

    return {
      totalCount: SUBSCRIPTIONS.length,
      activeCount: naoCanceladas.length,
      monthlySpending,
      upcomingAmount,
      upcomingCount: upcoming.length,
      upcomingItems: upcoming.slice().sort((a, b) => a.renewsInDays - b.renewsInDays).slice(0, 3),
      budget,
      spentPct,
    };
  }

  function formatUpcomingDate(renewsInDays) {
    const date = new Date();
    date.setDate(date.getDate() + renewsInDays);
    return {
      day: String(date.getDate()).padStart(2, '0'),
      month: new Intl.DateTimeFormat('en-US', { month: 'short' }).format(date),
    };
  }

  function renderUpcomingPaymentsList(items) {
    const container = document.getElementById('upcoming-payments-list');
    if (!container) return;

    if (items.length === 0) {
      container.innerHTML =
        '<p style="font-size: var(--fs-sm); color: var(--color-text-tertiary);">Nenhuma cobrança nos próximos 7 dias.</p>';
      return;
    }

    container.innerHTML = items
      .map((sub) => {
        const { day, month } = formatUpcomingDate(sub.renewsInDays);
        return `
          <div class="upcoming-item">
            <div class="upcoming-date"><span class="day numeric">${day}</span><span class="mon">${month}</span></div>
            <div class="upcoming-info">
              <p class="upcoming-name">${sub.name}</p>
              <p class="upcoming-plan">${sub.plan}</p>
            </div>
            <span class="upcoming-amount">${VorenUtils.formatCurrency(sub.amount)}</span>
          </div>
        `;
      })
      .join('');
  }

  /**
   * Single entry point that refreshes every data-driven part of the
   * Dashboard (stat cards, budget ring, upcoming payments list, sidebar
   * count) from the current SUBSCRIPTIONS array and the saved budget.
   * Called on load and after every add/edit/delete — never incrementally.
   */
  function atualizarDashboard() {
    const resumo = calcularResumo();

    const monthlyEl = document.getElementById('stat-monthly-spending');
    const activeEl = document.getElementById('stat-active-subscriptions');
    const upcomingEl = document.getElementById('stat-upcoming-payments');
    const upcomingDeltaEl = document.getElementById('stat-upcoming-payments-delta');
    const sidebarCountEl = document.getElementById('sidebar-subscriptions-count');

    if (monthlyEl) monthlyEl.textContent = VorenUtils.formatCurrency(resumo.monthlySpending);
    if (activeEl) activeEl.textContent = String(resumo.activeCount);
    if (upcomingEl) upcomingEl.textContent = VorenUtils.formatCurrency(resumo.upcomingAmount);
    if (upcomingDeltaEl) {
      upcomingDeltaEl.textContent = `Next 7 days · ${resumo.upcomingCount} charge${resumo.upcomingCount === 1 ? '' : 's'}`;
    }
    if (sidebarCountEl) sidebarCountEl.textContent = String(resumo.totalCount);

    const ringEl = document.getElementById('budget-ring');
    const ringPctEl = document.getElementById('budget-ring-pct');
    const ringBudgetEl = document.getElementById('budget-ring-value-budget');
    const ringSpentEl = document.getElementById('budget-ring-value-spent');
    const ringLeftEl = document.getElementById('budget-ring-value-left');

    if (ringEl) {
      ringEl.style.setProperty('--pct', resumo.spentPct);
      ringEl.setAttribute('aria-label', `${resumo.spentPct} percent of monthly budget used`);
    }
    if (ringPctEl) ringPctEl.textContent = `${resumo.spentPct}%`;
    if (ringBudgetEl) ringBudgetEl.textContent = resumo.budget !== null ? VorenUtils.formatCurrency(resumo.budget) : '—';
    if (ringSpentEl) ringSpentEl.textContent = VorenUtils.formatCurrency(resumo.monthlySpending);
    if (ringLeftEl) {
      const left = resumo.budget !== null ? Math.max(0, resumo.budget - resumo.monthlySpending) : null;
      ringLeftEl.textContent = left !== null ? VorenUtils.formatCurrency(left) : '—';
    }

    renderUpcomingPaymentsList(resumo.upcomingItems);

    // Spending trend — only the current month has a real number to show
    // (there's no stored history of past months yet). Its bar reflects
    // real spending against the real budget; past-month bars stay at 0%
    // in the HTML itself rather than being filled with invented data.
    const currentBarFill = document.getElementById('bar-chart-current-fill');
    if (currentBarFill) {
      const barHeight = resumo.monthlySpending > 0 ? Math.max(resumo.spentPct, 4) : 0;
      currentBarFill.style.height = `${Math.min(100, barHeight)}%`;
    }
  }

  let activeFilter = 'all';
  let searchTerm = '';

  function renderRow(sub) {
    const status = STATUS_LABEL[sub.status];
    const isSoon = sub.renewsInDays <= 5 && sub.status !== 'canceled';
    return `
      <tr>
        <td>
          <div class="sub-name-cell">
            <span class="sub-logo" style="background:${sub.color}" aria-hidden="true">${sub.initials}</span>
            <div>
              <div class="sub-name">${sub.name}</div>
              <div class="sub-category">${sub.category} · ${sub.plan}</div>
            </div>
          </div>
        </td>
        <td><span class="badge ${status.badgeClass}"><span class="badge-dot"></span>${status.label}</span></td>
        <td>
          <span class="sub-days-left ${isSoon ? 'soon' : ''}">
            ${sub.status === 'canceled' ? 'Ended' : `Renews in ${sub.renewsInDays}d`}
          </span>
        </td>
        <td class="numeric">${VorenUtils.formatCurrency(sub.amount)}<span style="color:var(--color-text-tertiary)">/mo</span></td>
        <td>
          <div class="row-menu">
            <button class="btn-icon row-menu-trigger" data-row-menu-trigger="${sub.id}" aria-haspopup="true" aria-expanded="false" aria-label="Mais ações para ${sub.name}">
              <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor"><circle cx="10" cy="4.5" r="1.6"/><circle cx="10" cy="10" r="1.6"/><circle cx="10" cy="15.5" r="1.6"/></svg>
            </button>
            <div class="row-menu-dropdown" data-row-menu-dropdown="${sub.id}" role="menu" aria-label="Ações para ${sub.name}">
              <button type="button" class="row-menu-item" data-row-action="edit" data-sub-id="${sub.id}" role="menuitem">
                <svg width="15" height="15" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M13.5 3.5 16 6l-9 9-3 .5.5-3z"/></svg>
                Editar assinatura
              </button>
              <button type="button" class="row-menu-item danger" data-row-action="delete" data-sub-id="${sub.id}" role="menuitem">
                <svg width="15" height="15" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M4 6h12M8 6V4.5a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1V6m2 0-.7 9.4a1.5 1.5 0 0 1-1.5 1.4H7.2a1.5 1.5 0 0 1-1.5-1.4L5 6"/></svg>
                Excluir assinatura
              </button>
            </div>
          </div>
        </td>
      </tr>
    `;
  }

  function renderTable() {
    const filtered = SUBSCRIPTIONS.filter((sub) => {
      const matchesFilter = activeFilter === 'all' || sub.status === activeFilter;
      const matchesSearch = sub.name.toLowerCase().includes(searchTerm.toLowerCase());
      return matchesFilter && matchesSearch;
    });

    if (filtered.length === 0) {
      tableBody.innerHTML = '';
      emptyState.hidden = false;
    } else {
      emptyState.hidden = true;
      tableBody.innerHTML = filtered.map(renderRow).join('');
    }
  }

  filterChips.forEach((chip) => {
    chip.addEventListener('click', () => {
      filterChips.forEach((c) => c.classList.remove('is-active'));
      chip.classList.add('is-active');
      activeFilter = chip.dataset.filter;
      renderTable();
    });
  });

  const globalSearch = document.getElementById('global-search');

  function handleSearchInput(e) {
    searchTerm = e.target.value;
    if (searchInput) searchInput.value = searchTerm;
    if (globalSearch) globalSearch.value = searchTerm;
    renderTable();
  }

  if (searchInput) {
    searchInput.addEventListener('input', VorenUtils.debounce(handleSearchInput, 150));
  }
  if (globalSearch) {
    globalSearch.addEventListener('input', VorenUtils.debounce(handleSearchInput, 150));
  }

  renderTable();
  atualizarDashboard();

  // ---- Row actions menu (three-dot) ---------------------------------------
  function closeAllRowMenus() {
    tableBody.querySelectorAll('.row-menu-dropdown.is-open').forEach((el) => el.classList.remove('is-open'));
    tableBody.querySelectorAll('[data-row-menu-trigger][aria-expanded="true"]').forEach((el) => {
      el.setAttribute('aria-expanded', 'false');
    });
  }

  tableBody.addEventListener('click', (e) => {
    const trigger = e.target.closest('[data-row-menu-trigger]');
    if (trigger) {
      e.stopPropagation();
      const id = trigger.dataset.rowMenuTrigger;
      const dropdown = tableBody.querySelector(`[data-row-menu-dropdown="${id}"]`);
      const isOpen = dropdown.classList.contains('is-open');
      closeAllRowMenus();
      if (!isOpen) {
        dropdown.classList.add('is-open');
        trigger.setAttribute('aria-expanded', 'true');
      }
      return;
    }

    const actionBtn = e.target.closest('[data-row-action]');
    if (actionBtn) {
      const sub = SUBSCRIPTIONS.find((s) => s.id === actionBtn.dataset.subId);
      closeAllRowMenus();
      if (!sub) return;
      if (actionBtn.dataset.rowAction === 'edit') openEditSubscriptionModal(sub);
      if (actionBtn.dataset.rowAction === 'delete') openDeleteSubscriptionConfirm(sub);
    }
  });

  document.addEventListener('click', closeAllRowMenus);
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeAllRowMenus();
  });

  // ---- Edit / delete modals -------------------------------------------------
  // No backend yet: editing updates the in-memory SUBSCRIPTIONS array and
  // re-renders the table; deleting removes the item the same way. Both are
  // isolated here so wiring up real persistence later only means adding a
  // fetch() call inside the existing submit/confirm handlers below.
  function closeModal(overlay) {
    overlay.classList.remove('is-open');
    overlay.addEventListener('transitionend', () => overlay.remove(), { once: true });
  }

  function bindModalDismiss(overlay, close) {
    const cancelBtn = overlay.querySelector('[data-modal-cancel]');
    const closeBtn = overlay.querySelector('.modal-close');
    if (cancelBtn) cancelBtn.addEventListener('click', close);
    if (closeBtn) closeBtn.addEventListener('click', close);
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) close();
    });
    document.addEventListener('keydown', function onEsc(e) {
      if (e.key === 'Escape') {
        close();
        document.removeEventListener('keydown', onEsc);
      }
    });
  }

  function openEditSubscriptionModal(sub) {
    const nextChargeDate = new Date();
    nextChargeDate.setDate(nextChargeDate.getDate() + sub.renewsInDays);
    const nextChargeISO = nextChargeDate.toISOString().slice(0, 10);

    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
      <div class="modal" role="dialog" aria-modal="true" aria-labelledby="edit-sub-title">
        <div class="modal-header">
          <h2 class="modal-title" id="edit-sub-title">Editar assinatura</h2>
          <button type="button" class="btn-icon modal-close" aria-label="Fechar">
            <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M5 5l10 10M15 5 5 15"/></svg>
          </button>
        </div>
        <form class="modal-body" id="edit-sub-form">
          <div class="field">
            <label class="field-label" for="edit-sub-name">Nome da assinatura</label>
            <input class="field-input" id="edit-sub-name" type="text" value="${sub.name}" required />
          </div>
          <div class="modal-field-grid">
            <div class="field">
              <label class="field-label" for="edit-sub-amount">Valor</label>
              <input class="field-input" id="edit-sub-amount" type="number" step="0.01" min="0" value="${sub.amount}" required />
            </div>
            <div class="field">
              <label class="field-label" for="edit-sub-date">Próxima cobrança</label>
              <input class="field-input" id="edit-sub-date" type="date" value="${nextChargeISO}" required />
            </div>
          </div>
          <div class="modal-field-grid">
            <div class="field">
              <label class="field-label" for="edit-sub-cycle">Frequência</label>
              <select class="field-input" id="edit-sub-cycle">
                <option value="Mensal" ${sub.cycle !== 'Yearly' ? 'selected' : ''}>Mensal</option>
                <option value="Anual" ${sub.cycle === 'Yearly' ? 'selected' : ''}>Anual</option>
              </select>
            </div>
            <div class="field">
              <label class="field-label" for="edit-sub-status">Status</label>
              <select class="field-input" id="edit-sub-status">
                <option value="Ativa" ${sub.status !== 'canceled' ? 'selected' : ''}>Ativa</option>
                <option value="Cancelada" ${sub.status === 'canceled' ? 'selected' : ''}>Cancelada</option>
              </select>
            </div>
          </div>
          <div class="field">
            <label class="field-label" for="edit-sub-category">Categoria</label>
            <input class="field-input" id="edit-sub-category" type="text" value="${sub.category}" required />
          </div>
        </form>
        <div class="modal-footer">
          <button type="button" class="btn btn-secondary" data-modal-cancel>Cancelar</button>
          <button type="submit" form="edit-sub-form" class="btn btn-primary">Salvar alterações</button>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);
    requestAnimationFrame(() => overlay.classList.add('is-open'));

    const close = () => closeModal(overlay);
    bindModalDismiss(overlay, close);

    overlay.querySelector('#edit-sub-form').addEventListener('submit', (e) => {
      e.preventDefault();
      sub.name = overlay.querySelector('#edit-sub-name').value.trim() || sub.name;
      sub.amount = parseFloat(overlay.querySelector('#edit-sub-amount').value) || sub.amount;
      sub.category = overlay.querySelector('#edit-sub-category').value.trim() || sub.category;
      sub.cycle = overlay.querySelector('#edit-sub-cycle').value === 'Anual' ? 'Yearly' : 'Monthly';

      const isActive = overlay.querySelector('#edit-sub-status').value === 'Ativa';
      sub.status = isActive ? (sub.status === 'trial' ? 'trial' : 'active') : 'canceled';

      const chosenDate = new Date(`${overlay.querySelector('#edit-sub-date').value}T00:00:00`);
      const diffDays = Math.round((chosenDate - new Date()) / (1000 * 60 * 60 * 24));
      if (Number.isFinite(diffDays)) sub.renewsInDays = diffDays;

      close();
      renderTable();
      salvarAssinaturas(SUBSCRIPTIONS);
      atualizarDashboard();
      VorenUtils.showToast({
        type: 'success',
        title: 'Alterações salvas',
        message: `${sub.name} foi atualizada.`,
      });
    });
  }

  function openDeleteSubscriptionConfirm(sub) {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
      <div class="modal modal--confirm" role="alertdialog" aria-modal="true" aria-labelledby="delete-sub-title">
        <div class="modal-header">
          <h2 class="modal-title" id="delete-sub-title">Excluir assinatura</h2>
        </div>
        <div class="modal-body">
          <p class="modal-confirm-text">Tem certeza de que deseja excluir esta assinatura?</p>
        </div>
        <div class="modal-footer">
          <button type="button" class="btn btn-secondary" data-modal-cancel>Cancelar</button>
          <button type="button" class="btn btn-danger" data-modal-confirm-delete>Excluir</button>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);
    requestAnimationFrame(() => overlay.classList.add('is-open'));

    const close = () => closeModal(overlay);
    bindModalDismiss(overlay, close);

    overlay.querySelector('[data-modal-confirm-delete]').addEventListener('click', () => {
      const index = SUBSCRIPTIONS.findIndex((s) => s.id === sub.id);
      if (index !== -1) SUBSCRIPTIONS.splice(index, 1);
      close();
      renderTable();
      salvarAssinaturas(SUBSCRIPTIONS);
      atualizarDashboard();
      VorenUtils.showToast({
        type: 'success',
        title: 'Assinatura excluída',
        message: `${sub.name} foi removida da sua lista.`,
      });
    });
  }

  // ---- Dropdown menus (notifications, profile) ---------------------------
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

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') close();
    });
  }

  setupDropdown('notif-trigger', 'notif-dropdown');
  setupDropdown('profile-trigger', 'profile-dropdown');

  // ---- Keyboard shortcut: Cmd/Ctrl+K focuses global search ---------------
  document.addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      globalSearch?.focus();
    }
  });

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
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeSidebar();
  });

  // ---- Quick actions (stand-ins until each flow has its own screen) ------
  document.querySelectorAll('[data-quick-action]').forEach((btn) => {
    btn.addEventListener('click', () => {
      if (btn.dataset.quickAction === 'Add subscription') {
        openAddSubscriptionModal();
        return;
      }
      if (btn.dataset.quickAction === 'Set a budget') {
        window.location.href = 'orcamento.html';
        return;
      }
      VorenUtils.showToast({
        type: 'success',
        title: btn.dataset.quickAction,
        message: 'This flow is on its way — nothing to configure yet.',
      });
    });
  });

  // ---- Add subscription modal ------------------------------------------------
  // No backend yet: saving pushes a new item into the in-memory SUBSCRIPTIONS
  // array and re-renders the table. The object shape matches every existing
  // entry exactly, so wiring up real persistence later is a matter of
  // replacing the push()+renderTable() below with a POST request (and,
  // ideally, reloading SUBSCRIPTIONS from that same API on page load).
  function generateSubscriptionId(name) {
    const slug = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    return `${slug || 'sub'}-${Date.now()}`;
  }

  const NEW_SUB_COLORS = ['#4361EE', '#17A673', '#7C5CFC', '#E5940D', '#E4483E', '#14162B'];

  function openAddSubscriptionModal() {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
      <div class="modal" role="dialog" aria-modal="true" aria-labelledby="add-sub-title">
        <div class="modal-header">
          <h2 class="modal-title" id="add-sub-title">Adicionar assinatura</h2>
          <button type="button" class="btn-icon modal-close" aria-label="Fechar">
            <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M5 5l10 10M15 5 5 15"/></svg>
          </button>
        </div>
        <form class="modal-body" id="add-sub-form" novalidate>
          <div class="field">
            <label class="field-label" for="add-sub-name">Nome da assinatura</label>
            <input class="field-input" id="add-sub-name" type="text" placeholder="Ex.: Netflix" required />
            <p class="field-error" id="add-sub-name-error" role="alert"></p>
          </div>
          <div class="modal-field-grid">
            <div class="field">
              <label class="field-label" for="add-sub-category">Categoria</label>
              <input class="field-input" id="add-sub-category" type="text" placeholder="Ex.: Streaming" required />
              <p class="field-error" id="add-sub-category-error" role="alert"></p>
            </div>
            <div class="field">
              <label class="field-label" for="add-sub-amount">Valor (R$)</label>
              <input class="field-input" id="add-sub-amount" type="number" step="0.01" min="0" placeholder="0,00" required />
              <p class="field-error" id="add-sub-amount-error" role="alert"></p>
            </div>
          </div>
          <div class="modal-field-grid">
            <div class="field">
              <label class="field-label" for="add-sub-cycle">Frequência</label>
              <select class="field-input" id="add-sub-cycle">
                <option value="Mensal" selected>Mensal</option>
                <option value="Anual">Anual</option>
              </select>
            </div>
            <div class="field">
              <label class="field-label" for="add-sub-date">Próxima cobrança</label>
              <input class="field-input" id="add-sub-date" type="date" required />
              <p class="field-error" id="add-sub-date-error" role="alert"></p>
            </div>
          </div>
          <div class="field">
            <label class="field-label" for="add-sub-status">Status</label>
            <select class="field-input" id="add-sub-status">
              <option value="Ativa" selected>Ativa</option>
              <option value="Cancelada">Cancelada</option>
            </select>
          </div>
        </form>
        <div class="modal-footer">
          <button type="button" class="btn btn-secondary" data-modal-cancel>Cancelar</button>
          <button type="submit" form="add-sub-form" class="btn btn-primary">Salvar assinatura</button>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);
    requestAnimationFrame(() => overlay.classList.add('is-open'));

    const close = () => closeModal(overlay);
    bindModalDismiss(overlay, close);

    const nameField = overlay.querySelector('#add-sub-name');
    const categoryField = overlay.querySelector('#add-sub-category');
    const amountField = overlay.querySelector('#add-sub-amount');
    const dateField = overlay.querySelector('#add-sub-date');

    function setFieldError(input, errorId, message) {
      const errorEl = overlay.querySelector(`#${errorId}`);
      if (message) {
        input.setAttribute('aria-invalid', 'true');
        errorEl.textContent = message;
      } else {
        input.removeAttribute('aria-invalid');
        errorEl.textContent = '';
      }
    }

    overlay.querySelector('#add-sub-form').addEventListener('submit', (e) => {
      e.preventDefault();

      const name = nameField.value.trim();
      const category = categoryField.value.trim();
      const amount = parseFloat(amountField.value);
      const dateValue = dateField.value;

      let hasError = false;
      setFieldError(nameField, 'add-sub-name-error', name ? '' : (hasError = true, 'Informe o nome da assinatura.'));
      setFieldError(categoryField, 'add-sub-category-error', category ? '' : (hasError = true, 'Informe a categoria.'));
      setFieldError(amountField, 'add-sub-amount-error', amountField.value && amount >= 0 ? '' : (hasError = true, 'Informe um valor válido.'));
      setFieldError(dateField, 'add-sub-date-error', dateValue ? '' : (hasError = true, 'Informe a data da próxima cobrança.'));

      if (hasError) return;

      const chosenDate = new Date(`${dateValue}T00:00:00`);
      const renewsInDays = Math.round((chosenDate - new Date()) / (1000 * 60 * 60 * 24));
      const cycle = overlay.querySelector('#add-sub-cycle').value === 'Anual' ? 'Yearly' : 'Monthly';
      const status = overlay.querySelector('#add-sub-status').value === 'Cancelada' ? 'canceled' : 'active';

      const newSub = {
        id: generateSubscriptionId(name),
        name,
        category,
        plan: cycle === 'Yearly' ? 'Annual plan' : 'Monthly plan',
        amount,
        cycle,
        renewsInDays,
        status,
        initials: name.trim().charAt(0).toUpperCase() || '?',
        color: NEW_SUB_COLORS[SUBSCRIPTIONS.length % NEW_SUB_COLORS.length],
      };

      SUBSCRIPTIONS.push(newSub);

      close();
      renderTable();
      salvarAssinaturas(SUBSCRIPTIONS);
      atualizarDashboard();
      VorenUtils.showToast({
        type: 'success',
        title: 'Assinatura adicionada',
        message: `${name} foi adicionada à sua lista.`,
      });
    });
  }

  // ---- Initial skeleton -> content transition -----------------------------
  // The real markup renders immediately underneath; the loader just masks
  // it for a moment to stand in for an actual data fetch.
  const pageLoader = document.getElementById('page-loader');
  if (pageLoader) {
    setTimeout(() => {
      pageLoader.classList.add('is-hidden');
      pageLoader.addEventListener(
        'transitionend',
        () => pageLoader.remove(),
        { once: true }
      );
    }, 700);
  }

  // ==========================================================================
  // Profile, Billing, Settings — all rendered as in-Dashboard modals (reusing
  // the same .modal-overlay/.modal markup and closeModal()/bindModalDismiss()
  // helpers as the subscription modals above), never as separate pages.
  // ==========================================================================
  const PROFILE_STORAGE_KEY = 'voren_user_profile';

  function getInitials(name) {
    const parts = name.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return '?';
    return (parts[0][0] + (parts[1] ? parts[1][0] : '')).toUpperCase();
  }

  /**
   * TODO(backend): once real user accounts exist, load this from the
   * authenticated session instead of localStorage.
   */
  function loadProfile() {
    try {
      const raw = window.localStorage.getItem(PROFILE_STORAGE_KEY);
      if (raw) return JSON.parse(raw);
    } catch {}
    return { name: 'Jordan Myers', email: 'jordan@voren.io' };
  }

  function saveProfile(profile) {
    window.localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(profile));
  }

  function renderProfile(profile) {
    const initials = getInitials(profile.name);
    const nameEl = document.getElementById('profile-dropdown-name');
    const emailEl = document.getElementById('profile-dropdown-email');
    const dropdownAvatar = document.getElementById('profile-avatar-initials');
    const topbarAvatar = document.getElementById('topbar-avatar-initials');

    if (nameEl) nameEl.textContent = profile.name;
    if (emailEl) emailEl.textContent = profile.email;
    if (dropdownAvatar) dropdownAvatar.textContent = initials;
    if (topbarAvatar) topbarAvatar.textContent = initials;
  }

  renderProfile(loadProfile());

  function openProfileModal() {
    const profile = loadProfile();
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
      <div class="modal" role="dialog" aria-modal="true" aria-labelledby="profile-modal-title">
        <div class="modal-header">
          <h2 class="modal-title" id="profile-modal-title">Your profile</h2>
          <button type="button" class="btn-icon modal-close" aria-label="Fechar">
            <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M5 5l10 10M15 5 5 15"/></svg>
          </button>
        </div>
        <form class="modal-body" id="profile-form">
          <div class="field">
            <label class="field-label" for="profile-name">Name</label>
            <input class="field-input" id="profile-name" type="text" value="${profile.name}" required />
          </div>
          <div class="field">
            <label class="field-label" for="profile-email">Email</label>
            <input class="field-input" id="profile-email" type="email" value="${profile.email}" required />
          </div>
        </form>
        <div class="modal-footer">
          <button type="button" class="btn btn-secondary" data-modal-cancel>Cancel</button>
          <button type="submit" form="profile-form" class="btn btn-primary">Save changes</button>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);
    requestAnimationFrame(() => overlay.classList.add('is-open'));
    const close = () => closeModal(overlay);
    bindModalDismiss(overlay, close);

    overlay.querySelector('#profile-form').addEventListener('submit', (e) => {
      e.preventDefault();
      const updated = {
        name: overlay.querySelector('#profile-name').value.trim() || profile.name,
        email: overlay.querySelector('#profile-email').value.trim() || profile.email,
      };
      saveProfile(updated);
      renderProfile(updated);
      close();
      VorenUtils.showToast({ type: 'success', title: 'Profile updated', message: 'Your changes were saved.' });
    });
  }

  /**
   * Reads the same subscription/trial state the Subscriptions page writes
   * (see subscriptions.js's carregarEstado()) and the same saved payment
   * method the Payment methods page writes (see payment.js). Reuses both
   * — doesn't invent a third data source. Shows an honest "not set up
   * yet" state for anything the user hasn't actually configured.
   */
  function loadBillingSnapshot() {
    let subscriptionState = null;
    let paymentMethod = null;
    try {
      const rawSub = window.localStorage.getItem('voren_subscription_state');
      if (rawSub) subscriptionState = JSON.parse(rawSub);
    } catch {}
    try {
      const rawPay = window.localStorage.getItem('voren_payment_method');
      if (rawPay) paymentMethod = JSON.parse(rawPay);
    } catch {}
    return { subscriptionState, paymentMethod };
  }

  function openBillingModal() {
    const { subscriptionState, paymentMethod } = loadBillingSnapshot();
    const hasPlan = subscriptionState && subscriptionState.subscription && subscriptionState.subscription.status === 'active';
    const planLabel = hasPlan
      ? subscriptionState.subscription.planId === 'pro' ? 'Pro' : 'Free'
      : null;
    const trial = subscriptionState && subscriptionState.trial;

    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
      <div class="modal" role="dialog" aria-modal="true" aria-labelledby="billing-modal-title">
        <div class="modal-header">
          <h2 class="modal-title" id="billing-modal-title">Billing</h2>
          <button type="button" class="btn-icon modal-close" aria-label="Fechar">
            <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M5 5l10 10M15 5 5 15"/></svg>
          </button>
        </div>
        <div class="modal-body">
          <div class="settings-row">
            <div>
              <p class="settings-row-label">Current plan</p>
              <p class="settings-row-hint">${hasPlan ? `Plan ${planLabel}` : 'No plan selected yet — visit Subscriptions to choose one.'}</p>
            </div>
            ${hasPlan ? `<span class="badge badge-success"><span class="badge-dot"></span>Active</span>` : `<span class="badge badge-neutral"><span class="badge-dot"></span>None</span>`}
          </div>
          <div class="settings-row">
            <div>
              <p class="settings-row-label">Free trial</p>
              <p class="settings-row-hint">${
                trial && trial.status === 'active'
                  ? `Active until ${new Intl.DateTimeFormat('en-US', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(trial.endsAt))}`
                  : trial && trial.status === 'expired'
                  ? 'Trial period has ended'
                  : 'Not started'
              }</p>
            </div>
          </div>
          <div class="settings-row">
            <div>
              <p class="settings-row-label">Payment method</p>
              <p class="settings-row-hint">${
                paymentMethod
                  ? `${paymentMethod.brand} ending in ${paymentMethod.last4}`
                  : 'Not added yet — this depends on connecting a real payment gateway.'
              }</p>
            </div>
          </div>
        </div>
        <div class="modal-footer">
          <button type="button" class="btn btn-secondary" data-modal-cancel>Close</button>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);
    requestAnimationFrame(() => overlay.classList.add('is-open'));
    const close = () => closeModal(overlay);
    bindModalDismiss(overlay, close);
  }

  // ---- Theme (dark mode) -----------------------------------------------------
  // All actual theme logic (get/set/persistence) lives in assets/js/theme.js,
  // loaded on every page — this just wires the Settings modal's switch to it.

  function openSettingsModal() {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
      <div class="modal" role="dialog" aria-modal="true" aria-labelledby="settings-modal-title">
        <div class="modal-header">
          <h2 class="modal-title" id="settings-modal-title">Settings</h2>
          <button type="button" class="btn-icon modal-close" aria-label="Fechar">
            <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M5 5l10 10M15 5 5 15"/></svg>
          </button>
        </div>
        <div class="modal-body">
          <div class="settings-row">
            <div>
              <p class="settings-row-label">Switch account</p>
              <p class="settings-row-hint">Multi-account isn't connected to a real backend yet.</p>
            </div>
          </div>
          <div class="field" style="margin-top: calc(var(--space-4) * -1);">
            <select class="field-input" id="settings-account-select" disabled>
              <option>Jordan Myers — jordan@voren.io</option>
            </select>
          </div>
          <div class="settings-row">
            <div>
              <p class="settings-row-label">Dark mode</p>
              <p class="settings-row-hint">Applies across the Dashboard and is remembered next time.</p>
            </div>
            <button
              type="button"
              class="theme-switch"
              id="theme-switch"
              role="switch"
              aria-checked="${VorenTheme.get() === 'dark' ? 'true' : 'false'}"
              aria-label="Toggle dark mode"
            ></button>
          </div>
        </div>
        <div class="modal-footer">
          <button type="button" class="btn btn-secondary" data-modal-cancel>Close</button>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);
    requestAnimationFrame(() => overlay.classList.add('is-open'));
    const close = () => closeModal(overlay);
    bindModalDismiss(overlay, close);

    overlay.querySelector('#theme-switch').addEventListener('click', (e) => {
      const next = VorenTheme.toggle();
      e.currentTarget.setAttribute('aria-checked', next === 'dark' ? 'true' : 'false');
    });
  }

  const menuYourProfile = document.getElementById('menu-your-profile');
  const menuBilling = document.getElementById('menu-billing');
  const menuSettings = document.getElementById('menu-settings');
  const menuSignOut = document.getElementById('menu-sign-out');

  if (menuYourProfile) menuYourProfile.addEventListener('click', openProfileModal);
  if (menuBilling) menuBilling.addEventListener('click', openBillingModal);
  if (menuSettings) menuSettings.addEventListener('click', openSettingsModal);

  /**
   * No real auth/session exists yet (login.js only simulates sign-in), so
   * there's nothing server-side to invalidate. The honest client-side
   * action is just returning to the login screen.
   *
   * TODO(backend): once real sessions exist, clear the session/token here
   * before redirecting.
   */
  if (menuSignOut) {
    menuSignOut.addEventListener('click', () => {
      window.location.href = 'login.html';
    });
  }
})();
