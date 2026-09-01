/**
 * Voren — Subscriptions page
 * Belongs exclusively to pages/subscriptions.html.
 *
 * This file owns three things:
 *   1. Rendering the plan cards into #plans-grid from a single PLANS array
 *      (the exact plans/prices/benefits already defined visually on this
 *      page — nothing added, nothing changed).
 *   2. The 21-day free trial: starting it once per account, detecting when
 *      it has expired, and reflecting that in the existing trial button
 *      and copy — no new UI elements.
 *   3. Choosing a plan and showing/hiding the existing "current
 *      subscription" section accordingly.
 *
 * PERSISTENCE: there is no backend yet, so all state below lives in
 * localStorage. Every place that reads or writes it goes through
 * carregarEstado() / salvarEstado() — the only two functions that would
 * need to change to move this to Firebase later (see the comments on
 * each). Nothing else in this file talks to storage directly.
 */

(() => {
  // ==========================================================================
  // 1. Plans — the same data already shown visually on this page.
  // ==========================================================================
  const PLANS = [
    {
      id: 'free',
      name: 'Free',
      price: 0,
      priceDisplay: 'R$ 0',
      priceCycle: '/mês',
      description: 'Para começar a organizar suas assinaturas sem custo.',
      benefits: ['Recursos básicos', 'Projetos limitados', 'Uso gratuito'],
      ctaLabel: 'Começar grátis',
      note: 'Sem cartão de crédito necessário',
      highlighted: false,
      badge: null,
    },
    {
      id: 'pro',
      name: 'Pro',
      price: 49.9,
      priceDisplay: 'R$ 49,90',
      priceCycle: '/mês',
      description: 'Para quem já depende do Voren no dia a dia.',
      benefits: [
        'Todos os recursos do Free',
        'Projetos ilimitados',
        'Ferramentas avançadas',
        'Melhor desempenho',
        'Suporte prioritário',
      ],
      ctaLabel: 'Assinar Pro',
      note: 'Cancele quando quiser',
      highlighted: true,
      badge: '⭐ Mais escolhido',
    },
  ];

  const TRIAL_LENGTH_DAYS = 21;

  // ==========================================================================
  // Persistence — localStorage today, Firebase later.
  //
  // TODO(firebase): once auth + Firestore are wired up, replace the body of
  // carregarEstado() with a read from something like
  //   doc(db, 'users', uid, 'billing', 'state')
  // and the body of salvarEstado() with a setDoc()/updateDoc() to the same
  // document. Every function below only calls carregarEstado()/
  // salvarEstado() — none of them touch localStorage directly — so that
  // swap is the only change needed.
  // ==========================================================================
  const STATE_STORAGE_KEY = 'voren_subscription_state';

  function estadoPadrao() {
    return {
      trial: {
        startedAt: null, // ISO string
        endsAt: null, // ISO string
        status: 'not_started', // 'not_started' | 'active' | 'expired'
      },
      subscription: {
        planId: null,
        status: 'none', // 'none' | 'active' | 'canceled'
        startedAt: null, // ISO string
      },
    };
  }

  function carregarEstado() {
    try {
      const raw = window.localStorage.getItem(STATE_STORAGE_KEY);
      if (!raw) return estadoPadrao();
      const parsed = JSON.parse(raw);
      // Merge with defaults so a state saved by an older version of this
      // file (missing a field) never breaks the page.
      return {
        ...estadoPadrao(),
        ...parsed,
        trial: { ...estadoPadrao().trial, ...(parsed.trial || {}) },
        subscription: { ...estadoPadrao().subscription, ...(parsed.subscription || {}) },
      };
    } catch {
      return estadoPadrao();
    }
  }

  function salvarEstado(state) {
    window.localStorage.setItem(STATE_STORAGE_KEY, JSON.stringify(state));
    return state;
  }

  // ==========================================================================
  // 2. Free trial
  // ==========================================================================

  /**
   * Recomputes trial.status from trial.startedAt/endsAt. Called whenever
   * the page loads, so a trial that expired since the user's last visit is
   * caught immediately, without waiting for any action.
   */
  function verificarStatusTeste(state) {
    if (state.trial.status === 'active' && state.trial.endsAt) {
      const now = new Date();
      const endsAt = new Date(state.trial.endsAt);
      if (now >= endsAt) {
        state.trial.status = 'expired';
        salvarEstado(state);
      }
    }
    return state;
  }

  function formatDatePtBR(isoString) {
    return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' }).format(
      new Date(isoString)
    );
  }

  /**
   * Starts the 21-day trial. Refuses to start a second one for the same
   * account — whether the first is still running or already expired.
   */
  function iniciarTeste() {
    const state = carregarEstado();
    verificarStatusTeste(state);

    if (state.trial.status === 'active') {
      VorenUtils.showToast({
        type: 'success',
        title: 'Teste em andamento',
        message: `Seu teste gratuito já está ativo até ${formatDatePtBR(state.trial.endsAt)}.`,
      });
      renderizarEstadoTeste(state);
      return;
    }

    if (state.trial.status === 'expired') {
      VorenUtils.showToast({
        type: 'error',
        title: 'Teste já utilizado',
        message: 'Seu período de teste gratuito de 21 dias já foi utilizado nesta conta.',
      });
      renderizarEstadoTeste(state);
      return;
    }

    const startedAt = new Date();
    const endsAt = new Date(startedAt);
    endsAt.setDate(endsAt.getDate() + TRIAL_LENGTH_DAYS);

    state.trial.startedAt = startedAt.toISOString();
    state.trial.endsAt = endsAt.toISOString();
    state.trial.status = 'active';
    salvarEstado(state);

    renderizarEstadoTeste(state);
    VorenUtils.showToast({
      type: 'success',
      title: 'Teste gratuito iniciado',
      message: `Você tem acesso completo até ${formatDatePtBR(state.trial.endsAt)}.`,
    });
  }

  /**
   * Reflects trial.status onto the existing trial button and description —
   * no new elements, just text/state changes on what's already there.
   */
  function renderizarEstadoTeste(state) {
    const trialBtn = document.getElementById('start-trial-btn');
    const trialDescription = document.querySelector('.trial-description');
    if (!trialBtn) return;

    if (state.trial.status === 'active') {
      trialBtn.textContent = `Teste ativo até ${formatDatePtBR(state.trial.endsAt)}`;
      trialBtn.disabled = true;
      if (trialDescription) {
        trialDescription.textContent = `Seu teste gratuito termina em ${formatDatePtBR(state.trial.endsAt)}. Escolha um plano a qualquer momento.`;
      }
    } else if (state.trial.status === 'expired') {
      trialBtn.textContent = 'Período de teste encerrado';
      trialBtn.disabled = true;
      if (trialDescription) {
        trialDescription.textContent = 'Seu teste gratuito de 21 dias já terminou. Escolha um dos planos abaixo para continuar usando o Voren.';
      }
    } else {
      trialBtn.textContent = 'Iniciar teste gratuito';
      trialBtn.disabled = false;
      if (trialDescription) {
        trialDescription.textContent = 'Experimente todos os recursos do Voren gratuitamente por 21 dias antes de decidir.';
      }
    }
  }

  // ==========================================================================
  // 1. Plan cards — rendered from PLANS, not duplicated in the HTML.
  // ==========================================================================
  function renderBenefit(benefit) {
    return `
      <li class="plan-feature">
        <span class="plan-feature-icon" aria-hidden="true">
          <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M4 10.5 8 14l8-8"/></svg>
        </span>
        <span>${benefit}</span>
      </li>
    `;
  }

  function renderPlanCard(plan) {
    return `
      <article
        class="card plan-card ${plan.highlighted ? 'is-highlighted' : ''}"
        data-plan-id="${plan.id}"
        aria-label="Plano ${plan.name}"
      >
        ${plan.badge ? `<span class="plan-badge">${plan.badge}</span>` : ''}
        <h2 class="plan-name">${plan.name}</h2>
        <div class="plan-price-row">
          <span class="plan-price">${plan.priceDisplay}</span><span class="plan-price-cycle">${plan.priceCycle}</span>
        </div>
        <p class="plan-description">${plan.description}</p>
        <ul class="plan-features">
          ${plan.benefits.map(renderBenefit).join('')}
        </ul>
        <button
          type="button"
          class="btn ${plan.highlighted ? 'btn-primary' : 'btn-secondary'} btn-block plan-cta"
          data-plan-select="${plan.id}"
          aria-label="${plan.ctaLabel} — plano ${plan.name}"
        >
          ${plan.ctaLabel}
        </button>
        <p class="plan-note">${plan.note}</p>
      </article>
    `;
  }

  function renderizarPlanos() {
    const grid = document.getElementById('plans-grid');
    if (!grid) return;

    grid.innerHTML = PLANS.map(renderPlanCard).join('');

    grid.querySelectorAll('[data-plan-select]').forEach((btn) => {
      btn.addEventListener('click', () => selecionarPlano(btn.dataset.planSelect));
    });
  }

  // ==========================================================================
  // 4/5. Choosing a plan + current subscription section
  // ==========================================================================

  /**
   * Records the chosen plan and shows it in #current-subscription-section.
   *
   * TODO(gateway): for a paid plan, this is where checkout would happen
   * first — redirect to Stripe/Mercado Pago, wait for confirmation, and
   * only call this function (or an equivalent one) once the gateway
   * confirms the charge. Today, with no gateway connected, selecting a
   * plan just records the choice locally — no charge is simulated.
   */
  function selecionarPlano(planId) {
    const plan = PLANS.find((p) => p.id === planId);
    if (!plan) return;

    const state = carregarEstado();

    state.subscription.planId = plan.id;
    state.subscription.status = 'active';
    state.subscription.startedAt = new Date().toISOString();
    salvarEstado(state);

    renderizarAssinaturaAtual(state);

    VorenUtils.showToast({
      type: 'success',
      title: 'Plano selecionado',
      message: `Você está agora no plano ${plan.name}.`,
    });
  }

  function renderizarAssinaturaAtual(state) {
    const section = document.getElementById('current-subscription-section');
    if (!section) return;

    if (state.subscription.status !== 'active' || !state.subscription.planId) {
      section.hidden = true;
      return;
    }

    const plan = PLANS.find((p) => p.id === state.subscription.planId);
    if (!plan) {
      section.hidden = true;
      return;
    }

    const nameEl = document.getElementById('current-subscription-plan-name');
    const statusEl = document.getElementById('current-subscription-status');
    const renewsEl = document.getElementById('current-subscription-renews');
    const amountEl = document.getElementById('current-subscription-amount');

    if (nameEl) nameEl.textContent = `Plano ${plan.name}`;
    if (statusEl) statusEl.textContent = plan.id === 'free' ? 'Sem cobrança' : 'Renovação mensal';

    if (renewsEl) {
      if (plan.price > 0) {
        const nextCharge = new Date();
        nextCharge.setDate(nextCharge.getDate() + 30);
        renewsEl.textContent = formatDatePtBR(nextCharge.toISOString());
      } else {
        renewsEl.textContent = '—';
      }
    }

    if (amountEl) amountEl.textContent = plan.price > 0 ? plan.priceDisplay : 'R$ 0';

    // #payment-history-list stays empty until a real gateway exists — no
    // charge has actually happened, so there is nothing real to list yet.

    section.hidden = false;
  }

  /**
   * Cancels the locally-recorded subscription. No gateway/backend call
   * exists yet — this only updates local state, same as selecionarPlano().
   *
   * TODO(gateway/firebase): once connected, call the gateway's
   * cancellation endpoint first, then persist the resulting status here
   * instead of assuming success immediately.
   */
  function cancelarAssinatura() {
    const confirmed = window.confirm('Tem certeza de que deseja cancelar sua assinatura?');
    if (!confirmed) return;

    const state = carregarEstado();
    state.subscription.planId = null;
    state.subscription.status = 'none';
    state.subscription.startedAt = null;
    salvarEstado(state);

    renderizarAssinaturaAtual(state);

    VorenUtils.showToast({
      type: 'success',
      title: 'Assinatura cancelada',
      message: 'Sua assinatura foi cancelada.',
    });
  }

  /**
   * TODO(gateway): opens the provider's billing portal (Stripe Billing
   * Portal, Mercado Pago assinaturas, etc.) once one is connected.
   */
  function abrirGerenciamentoAssinatura() {
    VorenUtils.showToast({
      type: 'success',
      title: 'Gerenciar assinatura',
      message: 'O portal de cobrança será conectado aqui.',
    });
  }

  // ==========================================================================
  // Wiring
  // ==========================================================================
  function init() {
    const state = carregarEstado();
    verificarStatusTeste(state);

    renderizarPlanos();
    renderizarEstadoTeste(state);
    renderizarAssinaturaAtual(state);

    const trialBtn = document.getElementById('start-trial-btn');
    if (trialBtn) trialBtn.addEventListener('click', iniciarTeste);

    const manageBtn = document.getElementById('manage-subscription-btn');
    if (manageBtn) manageBtn.addEventListener('click', abrirGerenciamentoAssinatura);

    const cancelBtn = document.getElementById('cancel-subscription-btn');
    if (cancelBtn) cancelBtn.addEventListener('click', cancelarAssinatura);
  }

  init();
})();
