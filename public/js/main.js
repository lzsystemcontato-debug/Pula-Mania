(function () {
  const state = {
    products: [],
    selectedIds: new Set(),
    calendarYear: null,
    calendarMonth: null, // 1-12
    unavailable: [],
    selectedDate: null,
    days: 1,
    rangeStatus: 'idle', // idle | ok | error
    rangeError: '',
    distanceKm: null,
    pricePerKm: 2,
    distanceStatus: 'idle', // idle | loading | ok | error
    distanceError: '',
    settings: {},
    lightbox: { images: [], index: 0 }
  };

  const unavailableCache = new Map();

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
  const daysInput = document.getElementById('f-days');
  const rangeStatusEl = document.getElementById('range-status');
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

  function addDaysJS(dateStr, n) {
    const d = new Date(dateStr + 'T00:00:00');
    d.setDate(d.getDate() + n);
    return d.toISOString().slice(0, 10);
  }

  function getRangeEnd() {
    return state.selectedDate ? addDaysJS(state.selectedDate, state.days - 1) : null;
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
        <div class="product-media" style="background:linear-gradient(135deg, ${p.color}33, ${p.color}12)" data-lightbox="${p.id}">
          ${mediaContent(p)}
        </div>
        <div class="product-body">
          <h3>${escapeHtml(p.name)}</h3>
          <p>${escapeHtml(p.description)}</p>
          <div class="product-meta">
            <span>📐 ${escapeHtml(p.size || '-')}</span>
            <span>👥 até ${p.capacity || '-'} crianças</span>
            <span>🎂 ${p.minAge || 0}+ anos</span>
            <span>⏱ até 5h por diária</span>
          </div>
          <div class="product-price"><span class="price-value">${money(p.price)}</span> <small>/ diária (5h)</small></div>
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
        const partner = p.comboPartnerId ? state.products.find((x) => x.id === p.comboPartnerId) : null;
        const comboHint = partner ? `<span class="combo-hint">🎁 combo com ${escapeHtml(partner.name)}: ${money(p.comboPrice)}/diária</span>` : '';
        return `
        <div class="checklist-item ${checked ? 'checked' : ''}" data-toggle="${p.id}">
          ${thumb}
          <div class="info">
            <strong>${escapeHtml(p.name)}</strong>
            <span>${money(p.price)} / diária (5h)</span>
            ${comboHint}
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
    state.rangeStatus = 'idle';
    dateInput.value = '';
    renderRangeStatus();
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
      state.unavailable = Array.from(await fetchUnavailableForMonth(state.calendarYear, state.calendarMonth));
      renderCalendar();
    } catch (e) {
      calendarEl.innerHTML = '<p style="text-align:center;color:var(--gray)">Erro ao carregar disponibilidade.</p>';
    }
  }

  function idsKey() {
    return Array.from(state.selectedIds).sort((a, b) => a - b).join(',');
  }

  async function fetchUnavailableForMonth(year, month) {
    const cacheKey = `${idsKey()}|${year}-${month}`;
    if (unavailableCache.has(cacheKey)) return unavailableCache.get(cacheKey);
    const ids = Array.from(state.selectedIds).join(',');
    const res = await fetch(`/api/availability?productIds=${ids}&year=${year}&month=${month}`);
    const data = await res.json();
    const set = new Set(data.unavailable || []);
    unavailableCache.set(cacheKey, set);
    return set;
  }

  function renderCalendar() {
    const year = state.calendarYear;
    const month = state.calendarMonth;
    const firstDow = new Date(year, month - 1, 1).getDay();
    const daysInMonth = new Date(year, month, 0).getDate();
    const unavailableSet = new Set(state.unavailable);
    const rangeEnd = getRangeEnd();

    let cells = '';
    for (let i = 0; i < firstDow; i++) cells += '<div class="calendar-day empty"></div>';
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${year}-${pad(month)}-${pad(d)}`;
      const isUnavailable = unavailableSet.has(dateStr);
      const isSelected = state.selectedDate && rangeEnd && dateStr >= state.selectedDate && dateStr <= rangeEnd;
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
        validateRange();
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

  // ---------- Multi-day range validation ----------

  daysInput.addEventListener('input', () => {
    let n = parseInt(daysInput.value, 10);
    if (!n || n < 1) n = 1;
    if (n > 30) n = 30;
    state.days = n;
    renderCalendar();
    validateRange();
    renderBudgetSummary();
  });

  async function validateRange() {
    if (!state.selectedDate) {
      state.rangeStatus = 'idle';
      renderRangeStatus();
      return;
    }
    const start = state.selectedDate;
    const end = getRangeEnd();

    const months = new Set();
    let cursor = start;
    while (cursor <= end) {
      const [y, m] = cursor.split('-');
      months.add(`${Number(y)}-${Number(m)}`);
      cursor = addDaysJS(cursor, 1);
    }

    try {
      const sets = await Promise.all(
        Array.from(months).map((key) => {
          const [y, m] = key.split('-').map(Number);
          return fetchUnavailableForMonth(y, m);
        })
      );
      const merged = new Set();
      sets.forEach((s) => s.forEach((d) => merged.add(d)));

      let conflict = null;
      let c = start;
      while (c <= end) {
        if (merged.has(c)) { conflict = c; break; }
        c = addDaysJS(c, 1);
      }

      if (conflict) {
        state.rangeStatus = 'error';
        state.rangeError = `A data ${formatDateBR(conflict)} não está disponível dentro do período escolhido. Ajuste a data ou a quantidade de diárias.`;
      } else {
        state.rangeStatus = 'ok';
      }
    } catch (e) {
      state.rangeStatus = 'error';
      state.rangeError = 'Não foi possível confirmar a disponibilidade do período.';
    }
    renderRangeStatus();
    renderBudgetSummary();
  }

  function renderRangeStatus() {
    rangeStatusEl.className = 'distance-status';
    if (!state.selectedDate) {
      rangeStatusEl.textContent = '';
      return;
    }
    const end = getRangeEnd();
    if (state.rangeStatus === 'ok') {
      rangeStatusEl.classList.add('ok');
      rangeStatusEl.textContent = state.days > 1
        ? `📅 Período: ${formatDateBR(state.selectedDate)} até ${formatDateBR(end)} (${state.days} diárias)`
        : `📅 Data: ${formatDateBR(state.selectedDate)}`;
    } else if (state.rangeStatus === 'error') {
      rangeStatusEl.classList.add('error');
      rangeStatusEl.textContent = state.rangeError;
    } else {
      rangeStatusEl.textContent = '';
    }
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

  // Groups selected products into combo pairs + single items, mirroring the
  // server's order-independent pricing (lib/pricing.js): only products that
  // declare comboPartnerId attempt to claim their partner first; everything
  // left over is priced individually.
  function groupForPricing(items) {
    const selectedIds = new Set(items.map((p) => p.id));
    const handled = new Set();
    const groups = [];

    items.forEach((p) => {
      if (handled.has(p.id) || !p.comboPartnerId) return;
      if (selectedIds.has(p.comboPartnerId) && !handled.has(p.comboPartnerId)) {
        const partner = items.find((x) => x.id === p.comboPartnerId);
        groups.push({ type: 'combo', names: [p.name, partner.name], price: Number(p.comboPrice) || 0 });
        handled.add(p.id);
        handled.add(p.comboPartnerId);
      }
    });

    items.forEach((p) => {
      if (handled.has(p.id)) return;
      groups.push({ type: 'single', names: [p.name], price: p.price });
      handled.add(p.id);
    });

    return groups;
  }

  function computeTotals() {
    const items = getSelectedProducts();
    const days = state.days || 1;
    const groups = groupForPricing(items);
    const dailySubtotal = groups.reduce((sum, g) => sum + g.price, 0);
    const subtotal = Math.round(dailySubtotal * days * 100) / 100;
    const km = state.distanceStatus === 'ok' ? state.distanceKm : 0;
    const travelFee = Math.round(km * state.pricePerKm * 100) / 100;
    const total = Math.round((subtotal + travelFee) * 100) / 100;
    return { items, groups, days, subtotal, km, travelFee, total };
  }

  function renderBudgetSummary() {
    const { items, groups, days, subtotal, km, travelFee, total } = computeTotals();

    if (!items.length) {
      budgetEl.innerHTML = '<p class="budget-empty">Selecione ao menos um brinquedo para ver o valor.</p>';
      whatsappBtn.style.pointerEvents = 'none';
      whatsappBtn.style.opacity = '0.5';
      setSubmitEnabled(false);
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

    const periodLine = days > 1
      ? `<div class="budget-row item"><span>Diárias (5h cada)</span><span>${days}</span></div>`
      : '';

    budgetEl.innerHTML = `
      ${groups.map((g) => {
        const label = g.type === 'combo' ? `${g.names.join(' + ')} (combo)` : g.names[0];
        return `<div class="budget-row item"><span>${escapeHtml(label)}${days > 1 ? ` (${money(g.price)}/diária)` : ''}</span><span>${money(g.price * days)}</span></div>`;
      }).join('')}
      ${periodLine}
      <div class="budget-row subtotal"><span>Subtotal</span><span>${money(subtotal)}</span></div>
      ${feeLine}
      <div class="budget-row total"><span>Total</span><span>${money(total)}</span></div>
    `;

    setSubmitEnabled(state.rangeStatus !== 'error');
    updateWhatsAppLink();
  }

  function setSubmitEnabled(enabled) {
    const submitBtn = form.querySelector('button[type="submit"]');
    submitBtn.disabled = !enabled;
    submitBtn.style.opacity = enabled ? '' : '0.5';
  }

  function updateWhatsAppLink() {
    const { items, groups, days, subtotal, km, travelFee, total } = computeTotals();
    if (!items.length) return;
    const wa = String(state.settings.whatsapp || '').replace(/\D/g, '');
    const address = addressInput.value.trim();

    let msg = 'Olá! Gostaria de solicitar um orçamento para aluguel de brinquedos.\n\n';
    msg += 'Brinquedos selecionados:\n';
    groups.forEach((g) => {
      const label = g.type === 'combo' ? `${g.names.join(' + ')} (combo)` : g.names[0];
      msg += days > 1
        ? `- ${label} — ${money(g.price)}/diária (5h) × ${days} diárias = ${money(g.price * days)}\n`
        : `- ${label} — ${money(g.price)} (diária de até 5h)\n`;
    });
    if (state.selectedDate) {
      msg += days > 1
        ? `\nPeríodo: ${formatDateBR(state.selectedDate)} até ${formatDateBR(getRangeEnd())} (${days} diárias)\n`
        : `\nData: ${formatDateBR(state.selectedDate)}\n`;
    }
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

    if (state.rangeStatus === 'error') {
      showFeedback('error', state.rangeError || 'O período escolhido não está disponível.');
      return;
    }

    const payload = {
      productIds: Array.from(state.selectedIds),
      customerName: document.getElementById('f-name').value.trim(),
      phone: document.getElementById('f-phone').value.trim(),
      email: document.getElementById('f-email').value.trim(),
      address: addressInput.value.trim(),
      eventDate: state.selectedDate,
      days: state.days,
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
        if (res.status === 409) {
          unavailableCache.clear();
          loadAvailability();
          validateRange();
        }
      } else {
        showFeedback('success', 'Reserva enviada com sucesso! Em breve entraremos em contato para confirmar.');
        form.reset();
        state.selectedIds.clear();
        state.selectedDate = null;
        state.days = 1;
        state.rangeStatus = 'idle';
        state.distanceStatus = 'idle';
        state.distanceKm = null;
        dateInput.value = '';
        daysInput.value = '1';
        unavailableCache.clear();
        renderChecklist();
        renderDistanceStatus();
        renderRangeStatus();
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
