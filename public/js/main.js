(function () {
  const state = {
    products: [],
    selectedProductId: null,
    calendarYear: null,
    calendarMonth: null, // 1-12
    unavailable: [],
    selectedDate: null
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
  const selectedChip = document.getElementById('selected-product-chip');
  const productSelect = document.getElementById('f-product');
  const calendarEl = document.getElementById('calendar');
  const dateInput = document.getElementById('f-date');
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
    return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }

  async function loadSettings() {
    try {
      const res = await fetch('/api/settings');
      const s = await res.json();
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

  async function loadProducts() {
    const res = await fetch('/api/products');
    state.products = await res.json();
    renderCatalog();
    renderProductSelect();
    if (state.products.length) selectProduct(state.products[0].id, false);
  }

  function renderCatalog() {
    catalogGrid.innerHTML = state.products
      .map(
        (p) => `
      <div class="product-card">
        <div class="product-media" style="background:${p.color}18">
          ${ICONS[p.icon] ? ICONS[p.icon](p.color) : ICONS.bounce(p.color)}
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
        selectProduct(Number(btn.dataset.select));
        document.getElementById('reservar').scrollIntoView({ behavior: 'smooth' });
      });
    });
  }

  function renderProductSelect() {
    productSelect.innerHTML = state.products
      .map((p) => `<option value="${p.id}">${escapeHtml(p.name)} — ${money(p.price)}/dia</option>`)
      .join('');
  }

  function selectProduct(id, scroll) {
    state.selectedProductId = id;
    productSelect.value = String(id);
    const product = state.products.find((p) => p.id === id);
    if (product) {
      selectedChip.style.display = 'flex';
      selectedChip.innerHTML = `<span class="dot" style="background:${product.color}"></span> ${escapeHtml(product.name)} — ${money(product.price)}/dia`;
    }
    state.selectedDate = null;
    dateInput.value = '';
    const now = new Date();
    state.calendarYear = now.getFullYear();
    state.calendarMonth = now.getMonth() + 1;
    loadAvailability();
  }

  productSelect.addEventListener('change', () => {
    selectProduct(Number(productSelect.value));
  });

  async function loadAvailability() {
    if (!state.selectedProductId) return;
    calendarEl.innerHTML = '<p style="text-align:center;color:var(--gray)">Carregando...</p>';
    try {
      const res = await fetch(
        `/api/availability?productId=${state.selectedProductId}&year=${state.calendarYear}&month=${state.calendarMonth}`
      );
      const data = await res.json();
      state.unavailable = data.unavailable || [];
      renderCalendar();
    } catch (e) {
      calendarEl.innerHTML = '<p style="text-align:center;color:var(--gray)">Erro ao carregar disponibilidade.</p>';
    }
  }

  function pad(n) { return String(n).padStart(2, '0'); }

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

  function formatDateBR(dateStr) {
    const [y, m, d] = dateStr.split('-');
    return `${d}/${m}/${y}`;
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str == null ? '' : str;
    return div.innerHTML;
  }

  function showFeedback(type, msg) {
    feedbackEl.className = `booking-feedback ${type}`;
    feedbackEl.textContent = msg;
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    feedbackEl.className = 'booking-feedback';

    if (!state.selectedDate) {
      showFeedback('error', 'Selecione uma data disponível no calendário.');
      return;
    }

    const payload = {
      productId: Number(productSelect.value),
      customerName: document.getElementById('f-name').value.trim(),
      phone: document.getElementById('f-phone').value.trim(),
      email: document.getElementById('f-email').value.trim(),
      address: document.getElementById('f-address').value.trim(),
      eventDate: state.selectedDate,
      notes: document.getElementById('f-notes').value.trim()
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
        state.selectedDate = null;
        dateInput.value = '';
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
