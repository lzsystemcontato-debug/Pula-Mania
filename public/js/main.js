(function () {
  const state = {
    products: [],
    selectedIds: new Set(),
    calendarYear: null,
    calendarMonth: null, // 1-12
    unavailable: [],
    selectedDate: null,
    distanceKm: null,
    pricePerKm: 2,
    distanceStatus: 'idle', // idle | loading | ok | error
    distanceError: '',
    settings: {},
    lightbox: { images: [], index: 0 }
  };

  const MONTHS = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
  ];
  const DOW = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];

  const ICONS = {
    bounce: (color) => `<svg viewBox="0 0 100 100" width="90" height="90"><circle cx="50" cy="50" r="42" fill="${color}22"/><circle cx="50" cy="50" r="30" fill="${color}"/><circle cx="50" cy="50" r="16" fill="${color}aa"/></svg>`,
    castle: (color) => `<svg viewBox="0 0 100 100" width="90" height="90"><rect x="20" y="40" width="60" height="45" rx="6" fill="${color}"/><circle cx="28" cy="38" r="14" fill="${color}"/><circle cx="72" cy="38" r="14" fill="${color}"/><circle cx="50" cy="30" r="16" fill="${color}"/><rect x="42" y="60" width="16" height="25" fill="white" opacity="0.5"/></svg>`,
    balls: (color) => `<svg viewBox="0 0 100 100" width="90" height="90"><rect x="15" y="55" width="70" height="30" rx="8" fill="${color}22"/><circle cx="30" cy="60" r="10" fill="${color}"/><circle cx="52" cy="50" r="12" fill="#ffd166"/><circle cx="72" cy="62" r="9" fill="#06d6a0"/><circle cx="45" cy="72" r="8" fill="${color}"/></svg>`,
    slide: (color) => `<svg viewBox="0 0 100 100" width="90" height="90"><path d="M20 85 L20 40 Q20 25 40 30 L75 55 Q85 62 75 70 L30 85 Z" fill="${color}"/><circle cx="25" cy="30" r="10" fill="${color}"/></svg>`
  };

  const catalogGrid = document.getElementById('catalog-grid');
  const checklistEl = document.getElementById('product-checklist');
  const calendarEl = document.getElementById('calendar');
  const dateInput = document.getElementById('f-date');
  const addressInput = document.getElementById('f-address');
  const distanceStatusEl = document.getElementById('distance-status');
  const budgetEl = document.getElementById('budget-summary');
  const whatsappBtn = document.getElementById('whatsapp-budget-btn');
  const feedbackEl = document.getElementById('booking-feedback');
  const form = document.getElementById('booking-form');

  document.getElementById('year').textContent = new Date().getFullYear();

  const navToggle = document.getElementById('nav-toggle');
  const mainNav = document.getElementById('main-nav');
  if (navToggle && mainNav) {
    navToggle.addEventListener('click', () => {
      const isOpen = mainNav.classList.toggle('open');
      navToggle.classList.toggle('open', isOpen);
      navToggle.setAttribute('aria-expanded', String(isOpen));
    });
    mainNav.querySelectorAll('a').forEach((link) => {
      link.addEventListener('click', () => {
        mainNav.classList.remove('open');
        navToggle.classList.remove('open');
        navToggle.setAttribute('aria-expanded', 'false');
      });
    });
  }

  function money(v) {
    return Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str == null ? '' : str;
    return div.innerHTML;
  }

  function pad(n) { return String(n).padStart(2, '0'); }

  function formatDateBR(dateStr) {
    const [y, m, d] = dateStr.split('-');
    return `${d}/${m}/${y}`;
  }

  // ---------- Settings ----------

  async function loadSettings() {
    try {
      const res = await fetch('/api/settings');
      const s = await res.json();
      state.settings = s;
      state.pricePerKm = Number(s.pricePerKm) || 2;
      document.getElementById('brand-name').textContent = s.companyName;
      document.getElementById('footer-brand').textContent = s.companyName;
      document.getElementById('stat-city').textContent = s.city;
      document.getElementById('footer-city').textContent = s.city;
      document.getElementById('footer-whatsapp').textContent = s.whatsapp;
      document.getElementById('footer-email').textContent = s.email;
      document.getElementById('footer-instagram').textContent = s.instagram;
      const wa = String(s.whatsapp || '').replace(/\D/g, '');
      const heroWa = document.getElementById('hero-whatsapp');
      heroWa.href = wa ? `https://wa.me/${wa}` : '#';
    } catch (e) {
      console.error('Erro ao carregar configurações', e);
    }
  }

  // ---------- Products / catalog ----------

  async function loadProducts() {
    const res = await fetch('/api/products');
    state.products = await res.json();
    renderCatalog();
    renderChecklist();
    renderBudgetSummary();
    const now = new Date();
    state.calendarYear = now.getFullYear();
    state.calendarMonth = now.getMonth() + 1;
    loadAvailability();
  }

  function mediaContent(p) {
    if (p.images && p.images.length) {
      const hint = p.images.length > 1 ? `<span class="media-hint">📷 ${p.images.length} fotos</span>` : `<span class="media-hint">🔍 ver foto</span>`;
      return `<img src="${p.images[0]}" alt="${escapeHtml(p.name)}" loading="lazy" />${hint}`;
    }
    return ICONS[p.icon] ? ICONS[p.icon](p.color) : ICONS.bounce(p.color);
  }

  function renderCatalog() {
    catalogGrid.innerHTML = state.products
      .map(
        (p) => `
      <div class="product-card" style="--accent:${p.color}">
        <div class="product-media" style="background:${p.color}18" data-lightbox="${p.id}">
          ${mediaContent(p)}
        </div>
        <div class="product-body">
          <h3>${escapeHtml(p.name)}</h3>
          <p>${escapeHtml(p.description)}</p>
          <div class="product-meta">
            <span>📐 ${escapeHtml(p.size || '-')}</span>
            <span>👥 até ${p.capacity || '-'} crianças</span>
            <span>🎂 ${p.minAge || 0}+ anos</span>
          </div>
          <div class="product-price">${money(p.price)} <small>/ dia</small></div>
          <button class="btn btn-primary btn-block btn-sm" data-select="${p.id}">Agendar este brinquedo</button>
        </div>
      </div>
    `
      )
      .join('');

    catalogGrid.querySelectorAll('[data-select]').forEach((btn) => {
      btn.addEventListener('click', () => {
        state.selectedIds.add(Number(btn.dataset.select));
        onSelectionChanged();
        document.getElementById('reservar').scrollIntoView({ behavior: 'smooth' });
      });
    });

    catalogGrid.querySelectorAll('[data-lightbox]').forEach((el) => {
      el.addEventListener('click', () => {
        const product = state.products.find((p) => p.id === Number(el.dataset.lightbox));
        if (product && product.images && product.images.length) openLightbox(product.images, 0);
      });
    });
  }

  // ---------- Multi-select checklist ----------

  function renderChecklist() {
    if (!state.products.length) {
      checklistEl.innerHTML = '<p style="color:var(--gray)">Nenhum brinquedo disponível no momento.</p>';
      return;
    }
    checklistEl.innerHTML = state.products
      .map((p) => {
        const checked = state.selectedIds.has(p.id);
        const thumb = p.images && p.images.length ? `<img class="thumb" src="${p.images[0]}" alt="" />` : `<div class="thumb"></div>`;
        return `
        <div class="checklist-item ${checked ? 'checked' : ''}" data-toggle="${p.id}">
          ${thumb}
          <div class="info">
            <strong>${escapeHtml(p.name)}</strong>
            <span>${money(p.price)} / dia</span>
          </div>
          <div class="checkbox-visual">${checked ? '✓' : ''}</div>
        </div>`;
      })
      .join('');

    checklistEl.querySelectorAll('[data-toggle]').forEach((el) => {
      el.addEventListener('click', () => {
        const id = Number(el.dataset.toggle);
        if (state.selectedIds.has(id)) state.selectedIds.delete(id);
        else state.selectedIds.add(id);
        onSelectionChanged();
      });
    });
  }

  function onSelectionChanged() {
    renderChecklist();
    state.selectedDate = null;
    dateInput.value = '';
    if (!state.calendarYear) {
      const now = new Date();
      state.calendarYear = now.getFullYear();
      state.calendarMonth = now.getMonth() + 1;
    }
    loadAvailability();
    renderBudgetSummary();
  }

  // ---------- Calendar / availability ----------

  async function loadAvailability() {
    if (!state.selectedIds.size) {
      calendarEl.innerHTML = '<p style="text-align:center;color:var(--gray);padding:20px 0">Selecione ao menos um brinquedo acima para ver a disponibilidade.</p>';
      return;
    }
    calendarEl.innerHTML = '<p style="text-align:center;color:var(--gray)">Carregando...</p>';
    try {
      const ids = Array.from(state.selectedIds).join(',');
      const res = await fetch(
        `/api/availability?productIds=${ids}&year=${state.calendarYear}&month=${state.calendarMonth}`
      );
      const data = await res.json();
      state.unavailable = data.unavailable || [];
      renderCalendar();
    } catch (e) {
      calendarEl.innerHTML = '<p style="text-align:center;color:var(--gray)">Erro ao carregar disponibilidade.</p>';
    }
  }

  function renderCalendar() {
    const year = state.calendarYear;
    const month = state.calendarMonth;
    const firstDow = new Date(year, month - 1, 1).getDay();
    const daysInMonth = new Date(year, month, 0).getDate();
    const unavailableSet = new Set(state.unavailable);

    let cells = '';
    for (let i = 0; i < firstDow; i++) cells += '<div class="calendar-day empty"></div>';
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${year}-${pad(month)}-${pad(d)}`;
      const isUnavailable = unavailableSet.has(dateStr);
      const isSelected = state.selectedDate === dateStr;
      const cls = ['calendar-day'];
      if (isUnavailable) cls.push('unavailable');
      if (isSelected) cls.push('selected');
      cells += `<div class="${cls.join(' ')}" data-date="${dateStr}" ${isUnavailable ? '' : `role="button"`}>${d}</div>`;
    }

    calendarEl.innerHTML = `
      <div class="calendar-head">
        <button type="button" class="calendar-nav-btn" id="cal-prev">‹</button>
        <strong>${MONTHS[month - 1]} ${year}</strong>
        <button type="button" class="calendar-nav-btn" id="cal-next">›</button>
      </div>
      <div class="calendar-grid">
        ${DOW.map((d) => `<div class="dow">${d}</div>`).join('')}
        ${cells}
      </div>
    `;

    document.getElementById('cal-prev').addEventListener('click', () => shiftMonth(-1));
    document.getElementById('cal-next').addEventListener('click', () => shiftMonth(1));
    calendarEl.querySelectorAll('.calendar-day:not(.unavailable):not(.empty)').forEach((cell) => {
      cell.addEventListener('click', () => {
        state.selectedDate = cell.dataset.date;
        dateInput.value = formatDateBR(cell.dataset.date);
        renderCalendar();
      });
    });
  }

  function shiftMonth(delta) {
    let m = state.calendarMonth + delta;
    let y = state.calendarYear;
    if (m < 1) { m = 12; y -= 1; }
    if (m > 12) { m = 1; y += 1; }
    const now = new Date();
    const minY = now.getFullYear();
    const minM = now.getMonth() + 1;
    if (y < minY || (y === minY && m < minM)) return;
    state.calendarYear = y;
    state.calendarMonth = m;
    loadAvailability();
  }

  // ---------- Distance / travel fee ----------

  let distanceTimer = null;
  let distanceRequestId = 0;

  addressInput.addEventListener('input', () => {
    clearTimeout(distanceTimer);
    const value = addressInput.value.trim();
    if (value.length < 8) {
      state.distanceStatus = 'idle';
      state.distanceKm = null;
      renderDistanceStatus();
      renderBudgetSummary();
      return;
    }
    distanceTimer = setTimeout(() => computeDistance(value), 900);
  });

  async function computeDistance(address) {
    const myRequestId = ++distanceRequestId;
    state.distanceStatus = 'loading';
    renderDistanceStatus();
    try {
      const res = await fetch('/api/distance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address })
      });
      const data = await res.json();
      if (myRequestId !== distanceRequestId) return; // stale response
      if (!res.ok) {
        state.distanceStatus = 'error';
        state.distanceError = data.error || 'Não foi possível calcular a distância.';
        state.distanceKm = null;
      } else {
        state.distanceStatus = 'ok';
        state.distanceKm = data.km;
        state.pricePerKm = Number(data.pricePerKm) || state.pricePerKm;
      }
    } catch (e) {
      if (myRequestId !== distanceRequestId) return;
      state.distanceStatus = 'error';
      state.distanceError = 'Erro de conexão ao calcular a distância.';
      state.distanceKm = null;
    }
    renderDistanceStatus();
    renderBudgetSummary();
  }

  function renderDistanceStatus() {
    distanceStatusEl.className = 'distance-status';
    if (state.distanceStatus === 'loading') {
      distanceStatusEl.classList.add('loading');
      distanceStatusEl.textContent = 'Calculando distância até o local do evento...';
    } else if (state.distanceStatus === 'ok') {
      distanceStatusEl.classList.add('ok');
      distanceStatusEl.textContent = `📍 Distância calculada: ${state.distanceKm.toLocaleString('pt-BR')} km`;
    } else if (state.distanceStatus === 'error') {
      distanceStatusEl.classList.add('error');
      distanceStatusEl.textContent = state.distanceError;
    } else {
      distanceStatusEl.textContent = '';
    }
  }

  // ---------- Budget summary ----------

  function getSelectedProducts() {
    return state.products.filter((p) => state.selectedIds.has(p.id));
  }

  function computeTotals() {
    const items = getSelectedProducts();
    const subtotal = items.reduce((sum, p) => sum + p.price, 0);
    const km = state.distanceStatus === 'ok' ? state.distanceKm : 0;
    const travelFee = Math.round(km * state.pricePerKm * 100) / 100;
    const total = Math.round((subtotal + travelFee) * 100) / 100;
    return { items, subtotal, km, travelFee, total };
  }

  function renderBudgetSummary() {
    const { items, subtotal, km, travelFee, total } = computeTotals();

    if (!items.length) {
      budgetEl.innerHTML = '<p class="budget-empty">Selecione ao menos um brinquedo para ver o valor.</p>';
      whatsappBtn.style.pointerEvents = 'none';
      whatsappBtn.style.opacity = '0.5';
      return;
    }

    whatsappBtn.style.pointerEvents = '';
    whatsappBtn.style.opacity = '';

    let feeLine = '';
    if (state.distanceStatus === 'ok') {
      feeLine = `<div class="budget-row fee"><span>Taxa de deslocamento (${km.toLocaleString('pt-BR')} km × ${money(state.pricePerKm)})</span><span>${money(travelFee)}</span></div>`;
    } else if (state.distanceStatus === 'loading') {
      feeLine = `<div class="budget-row fee"><span>Taxa de deslocamento</span><span>calculando...</span></div>`;
    } else if (state.distanceStatus === 'error') {
      feeLine = `<div class="budget-row fee"><span>Taxa de deslocamento</span><span>a confirmar</span></div>`;
    } else {
      feeLine = `<div class="budget-row fee"><span>Taxa de deslocamento</span><span>informe o endereço</span></div>`;
    }

    budgetEl.innerHTML = `
      ${items.map((p) => `<div class="budget-row item"><span>${escapeHtml(p.name)}</span><span>${money(p.price)}</span></div>`).join('')}
      <div class="budget-row subtotal"><span>Subtotal</span><span>${money(subtotal)}</span></div>
      ${feeLine}
      <div class="budget-row total"><span>Total</span><span>${money(total)}</span></div>
    `;

    updateWhatsAppLink();
  }

  function updateWhatsAppLink() {
    const { items, subtotal, km, travelFee, total } = computeTotals();
    if (!items.length) return;
    const wa = String(state.settings.whatsapp || '').replace(/\D/g, '');
    const address = addressInput.value.trim();

    let msg = 'Olá! Gostaria de solicitar um orçamento para aluguel de brinquedos.\n\n';
    msg += 'Brinquedos selecionados:\n';
    items.forEach((p) => { msg += `- ${p.name} — ${money(p.price)}\n`; });
    msg += `\nSubtotal: ${money(subtotal)}\n`;
    if (address) msg += `\nEndereço do evento: ${address}\n`;
    if (state.distanceStatus === 'ok') {
      msg += `\nDistância: ${km.toLocaleString('pt-BR')} km`;
      msg += `\nTaxa de deslocamento: ${money(travelFee)}`;
    }
    msg += `\n\nValor total: ${money(total)}`;

    whatsappBtn.href = wa ? `https://wa.me/${wa}?text=${encodeURIComponent(msg)}` : '#';
  }

  addressInput.addEventListener('input', updateWhatsAppLink);

  // ---------- Lightbox ----------

  const lightboxEl = document.getElementById('lightbox');
  const lightboxImg = document.getElementById('lightbox-img');
  const lightboxDots = document.getElementById('lightbox-dots');

  function openLightbox(images, index) {
    state.lightbox = { images, index };
    renderLightbox();
    lightboxEl.classList.add('show');
  }

  function renderLightbox() {
    const { images, index } = state.lightbox;
    lightboxImg.src = images[index];
    lightboxDots.innerHTML = images
      .map((_, i) => `<span class="dot ${i === index ? 'active' : ''}"></span>`)
      .join('');
    document.getElementById('lightbox-prev').style.display = images.length > 1 ? 'flex' : 'none';
    document.getElementById('lightbox-next').style.display = images.length > 1 ? 'flex' : 'none';
  }

  document.getElementById('lightbox-close').addEventListener('click', () => lightboxEl.classList.remove('show'));
  lightboxEl.addEventListener('click', (e) => { if (e.target === lightboxEl) lightboxEl.classList.remove('show'); });
  document.getElementById('lightbox-prev').addEventListener('click', () => {
    const { images, index } = state.lightbox;
    state.lightbox.index = (index - 1 + images.length) % images.length;
    renderLightbox();
  });
  document.getElementById('lightbox-next').addEventListener('click', () => {
    const { images, index } = state.lightbox;
    state.lightbox.index = (index + 1) % images.length;
    renderLightbox();
  });
  document.addEventListener('keydown', (e) => {
    if (!lightboxEl.classList.contains('show')) return;
    if (e.key === 'Escape') lightboxEl.classList.remove('show');
    if (e.key === 'ArrowLeft') document.getElementById('lightbox-prev').click();
    if (e.key === 'ArrowRight') document.getElementById('lightbox-next').click();
  });

  // ---------- Form submission ----------

  function showFeedback(type, msg) {
    feedbackEl.className = `booking-feedback ${type}`;
    feedbackEl.textContent = msg;
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    feedbackEl.className = 'booking-feedback';

    if (!state.selectedIds.size) {
      showFeedback('error', 'Selecione ao menos um brinquedo.');
      return;
    }

    if (!state.selectedDate) {
      showFeedback('error', 'Selecione uma data disponível no calendário.');
      return;
    }

    const payload = {
      productIds: Array.from(state.selectedIds),
      customerName: document.getElementById('f-name').value.trim(),
      phone: document.getElementById('f-phone').value.trim(),
      email: document.getElementById('f-email').value.trim(),
      address: addressInput.value.trim(),
      eventDate: state.selectedDate,
      notes: document.getElementById('f-notes').value.trim(),
      distanceKm: state.distanceStatus === 'ok' ? state.distanceKm : 0
    };

    const submitBtn = form.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Enviando...';

    try {
      const res = await fetch('/api/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (!res.ok) {
        showFeedback('error', data.error || 'Não foi possível enviar a reserva.');
        if (res.status === 409) loadAvailability();
      } else {
        showFeedback('success', 'Reserva enviada com sucesso! Em breve entraremos em contato para confirmar.');
        form.reset();
        state.selectedIds.clear();
        state.selectedDate = null;
        state.distanceStatus = 'idle';
        state.distanceKm = null;
        dateInput.value = '';
        renderChecklist();
        renderDistanceStatus();
        renderBudgetSummary();
        loadAvailability();
      }
    } catch (err) {
      showFeedback('error', 'Erro de conexão. Tente novamente.');
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Enviar solicitação de reserva';
    }
  });

  loadSettings();
  loadProducts();
})();
