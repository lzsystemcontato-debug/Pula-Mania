(function () {
  const state = {
    bookings: [],
    products: [],
    blockedDates: [],
    calYear: new Date().getFullYear(),
    calMonth: new Date().getMonth() + 1
  };

  const MONTHS = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
  const DOW = ['D','S','T','Q','Q','S','S'];
  const STATUS_LABEL = { pending: 'Pendente', confirmed: 'Confirmada', cancelled: 'Cancelada', completed: 'Concluída' };

  function pad(n) { return String(n).padStart(2, '0'); }
  function fmtDateBR(dateStr) { const [y,m,d] = dateStr.split('-'); return `${d}/${m}/${y}`; }
  function money(v) { return Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }); }
  function escapeHtml(str) { const div = document.createElement('div'); div.textContent = str == null ? '' : str; return div.innerHTML; }
  function itemNames(b) { return (b.items || []).map((i) => i.name).join(', ') || '-'; }

  async function api(url, options) {
    const res = await fetch(url, {
      headers: { 'Content-Type': 'application/json' },
      ...options
    });
    if (res.status === 401) {
      window.location.href = '/admin';
      throw new Error('unauthorized');
    }
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Erro na requisição');
    return data;
  }

  // ---------- Auth / nav ----------

  async function init() {
    try {
      const me = await api('/api/admin/auth/me');
      if (!me.authenticated) { window.location.href = '/admin'; return; }
      document.getElementById('username-label').textContent = me.username;
    } catch (e) { return; }

    document.querySelectorAll('.side-nav button').forEach((btn) => {
      btn.addEventListener('click', () => switchView(btn.dataset.view));
    });

    document.getElementById('logout-btn').addEventListener('click', async () => {
      await api('/api/admin/auth/logout', { method: 'POST' });
      window.location.href = '/admin';
    });

    document.getElementById('filter-status').addEventListener('change', renderBookingsTable);

    document.getElementById('blocked-form').addEventListener('submit', onAddBlockedDate);
    document.getElementById('settings-form').addEventListener('submit', onSaveSettings);
    document.getElementById('delivery-form').addEventListener('submit', onSaveDelivery);
    document.getElementById('password-form').addEventListener('submit', onChangePassword);

    document.getElementById('add-product-btn').addEventListener('click', () => openProductModal(null));
    document.getElementById('product-cancel-btn').addEventListener('click', closeProductModal);
    document.getElementById('product-form').addEventListener('submit', onSaveProduct);
    document.getElementById('pf-add-image-btn').addEventListener('click', () => addImageRow(''));

    document.getElementById('admin-cal-prev').addEventListener('click', () => shiftAdminMonth(-1));
    document.getElementById('admin-cal-next').addEventListener('click', () => shiftAdminMonth(1));

    await Promise.all([loadOverview(), loadBookings(), loadProducts(), loadBlockedDates(), loadSettings()]);
    renderAdminCalendar();
  }

  const VIEW_TITLES = {
    overview: 'Visão geral', bookings: 'Reservas', calendar: 'Calendário',
    products: 'Produtos', blocked: 'Datas bloqueadas', settings: 'Configurações'
  };

  function switchView(view) {
    document.querySelectorAll('.side-nav button').forEach((b) => b.classList.toggle('active', b.dataset.view === view));
    document.querySelectorAll('.view').forEach((v) => v.classList.remove('active'));
    document.getElementById(`view-${view}`).classList.add('active');
    document.getElementById('view-title').textContent = VIEW_TITLES[view] || '';
    if (view === 'overview') loadOverview();
    if (view === 'calendar') renderAdminCalendar();
  }

  // ---------- Overview ----------

  async function loadOverview() {
    const stats = await api('/api/admin/stats');
    document.getElementById('stat-pending').textContent = stats.pending;
    document.getElementById('stat-today').textContent = stats.confirmedToday;
    document.getElementById('stat-next7').textContent = stats.next7Days;
    document.getElementById('stat-products').textContent = stats.totalProducts;

    const bookings = await api('/api/admin/bookings');
    state.bookings = bookings;
    const recent = [...bookings].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 5);
    const el = document.getElementById('recent-bookings');
    if (!recent.length) {
      el.innerHTML = '<div class="empty-state">Nenhuma reserva ainda.</div>';
      return;
    }
    el.innerHTML = `<table><thead><tr><th>Cliente</th><th>Brinquedos</th><th>Data</th><th>Total</th><th>Status</th></tr></thead><tbody>
      ${recent.map((b) => `<tr>
        <td>${escapeHtml(b.customerName)}</td>
        <td>${escapeHtml(itemNames(b))}</td>
        <td>${fmtDateBR(b.eventDate)}</td>
        <td>${money(b.total)}</td>
        <td><span class="badge badge-${b.status}">${STATUS_LABEL[b.status]}</span></td>
      </tr>`).join('')}
    </tbody></table>`;
  }

  // ---------- Bookings ----------

  async function loadBookings() {
    state.bookings = await api('/api/admin/bookings');
    renderBookingsTable();
  }

  function renderBookingsTable() {
    const filter = document.getElementById('filter-status').value;
    let list = [...state.bookings];
    if (filter) list = list.filter((b) => b.status === filter);
    list.sort((a, b) => (a.eventDate < b.eventDate ? -1 : a.eventDate > b.eventDate ? 1 : 0));

    const el = document.getElementById('bookings-table');
    if (!list.length) {
      el.innerHTML = '<div class="empty-state">Nenhuma reserva encontrada.</div>';
      return;
    }

    el.innerHTML = `<table><thead><tr>
        <th>Data</th><th>Cliente</th><th>Contato</th><th>Brinquedos</th><th>Endereço</th><th>Distância</th><th>Total</th><th>Status</th><th>Ações</th>
      </tr></thead><tbody>
      ${list.map((b) => `<tr>
        <td>${fmtDateBR(b.eventDate)}</td>
        <td>${escapeHtml(b.customerName)}</td>
        <td>${escapeHtml(b.phone)}${b.email ? '<br>' + escapeHtml(b.email) : ''}</td>
        <td>${escapeHtml(itemNames(b))}</td>
        <td>${escapeHtml(b.address)}</td>
        <td>${b.distanceKm ? `${b.distanceKm.toLocaleString('pt-BR')} km<br><span style="color:var(--gray)">${money(b.travelFee)}</span>` : '-'}</td>
        <td><strong>${money(b.total)}</strong><br><span style="color:var(--gray);font-size:0.75rem">subtotal ${money(b.subtotal)}</span></td>
        <td><span class="badge badge-${b.status}">${STATUS_LABEL[b.status]}</span></td>
        <td class="actions-cell">
          ${b.status !== 'confirmed' ? `<button class="btn btn-outline btn-sm" data-action="confirmed" data-id="${b.id}">Confirmar</button>` : ''}
          ${b.status !== 'completed' ? `<button class="btn btn-outline btn-sm" data-action="completed" data-id="${b.id}">Concluir</button>` : ''}
          ${b.status !== 'cancelled' ? `<button class="btn btn-outline btn-sm" data-action="cancelled" data-id="${b.id}">Cancelar</button>` : ''}
          <button class="btn btn-danger btn-sm" data-action="delete" data-id="${b.id}">Excluir</button>
        </td>
      </tr>`).join('')}
    </tbody></table>`;

    el.querySelectorAll('button[data-action]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const id = btn.dataset.id;
        const action = btn.dataset.action;
        try {
          if (action === 'delete') {
            if (!confirm('Excluir esta reserva permanentemente?')) return;
            await api(`/api/admin/bookings/${id}`, { method: 'DELETE' });
          } else {
            await api(`/api/admin/bookings/${id}`, { method: 'PATCH', body: JSON.stringify({ status: action }) });
          }
          await loadBookings();
          loadOverview();
        } catch (e) { alert(e.message); }
      });
    });
  }

  // ---------- Calendar ----------

  function shiftAdminMonth(delta) {
    let m = state.calMonth + delta, y = state.calYear;
    if (m < 1) { m = 12; y -= 1; } if (m > 12) { m = 1; y += 1; }
    state.calYear = y; state.calMonth = m;
    renderAdminCalendar();
  }

  function renderAdminCalendar() {
    const year = state.calYear, month = state.calMonth;
    document.getElementById('admin-cal-label').textContent = `${MONTHS[month - 1]} ${year}`;
    const firstDow = new Date(year, month - 1, 1).getDay();
    const daysInMonth = new Date(year, month, 0).getDate();
    const monthPrefix = `${year}-${pad(month)}`;

    const blockedInMonth = new Set(state.blockedDates.filter((b) => b.date.startsWith(monthPrefix)).map((b) => b.date));

    let html = DOW.map((d) => `<div class="dow">${d}</div>`).join('');
    for (let i = 0; i < firstDow; i++) html += '<div class="admin-cal-day empty"></div>';

    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${monthPrefix}-${pad(d)}`;
      const dayBookings = state.bookings.filter((b) => b.eventDate === dateStr && b.status !== 'cancelled');
      const isBlocked = blockedInMonth.has(dateStr);
      let tags = dayBookings.slice(0, 2).map((b) => `<span class="d-tag ${b.status}">${escapeHtml(itemNames(b)).slice(0, 14)}</span>`).join('');
      if (dayBookings.length > 2) tags += `<span class="d-tag">+${dayBookings.length - 2}</span>`;
      if (isBlocked) tags += `<span class="d-tag blocked-tag">Bloqueado</span>`;
      html += `<div class="admin-cal-day ${isBlocked ? 'blocked' : ''}" data-date="${dateStr}">
        <div class="d-num">${d}</div>${tags}
      </div>`;
    }

    document.getElementById('admin-calendar').innerHTML = html;
    document.querySelectorAll('.admin-cal-day[data-date]').forEach((cell) => {
      cell.addEventListener('click', () => showDayDetail(cell.dataset.date));
    });
  }

  function showDayDetail(dateStr) {
    const panel = document.getElementById('day-detail-panel');
    panel.style.display = 'block';
    document.getElementById('day-detail-title').textContent = `Detalhes — ${fmtDateBR(dateStr)}`;
    const dayBookings = state.bookings.filter((b) => b.eventDate === dateStr);
    const blocked = state.blockedDates.find((b) => b.date === dateStr);
    let html = '';
    if (blocked) {
      html += `<div class="alert alert-error show">🚫 Data bloqueada${blocked.reason ? ': ' + escapeHtml(blocked.reason) : ''}</div>`;
    }
    if (!dayBookings.length) {
      html += '<div class="empty-state">Nenhuma reserva para esta data.</div>';
    } else {
      html += `<table><thead><tr><th>Cliente</th><th>Brinquedos</th><th>Contato</th><th>Total</th><th>Status</th></tr></thead><tbody>
        ${dayBookings.map((b) => `<tr>
          <td>${escapeHtml(b.customerName)}</td>
          <td>${escapeHtml(itemNames(b))}</td>
          <td>${escapeHtml(b.phone)}</td>
          <td>${money(b.total)}</td>
          <td><span class="badge badge-${b.status}">${STATUS_LABEL[b.status]}</span></td>
        </tr>`).join('')}
      </tbody></table>`;
    }
    document.getElementById('day-detail-content').innerHTML = html;
    panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  // ---------- Products ----------

  async function loadProducts() {
    state.products = await api('/api/admin/products');
    renderProducts();
  }

  function renderProducts() {
    const el = document.getElementById('products-grid');
    if (!state.products.length) { el.innerHTML = '<div class="empty-state">Nenhum produto cadastrado.</div>'; return; }
    el.innerHTML = state.products.map((p) => {
      const cover = p.images && p.images[0];
      return `
      <div class="product-admin-card">
        <div class="swatch" style="background:${p.color}22; ${cover ? `background-image:url('${cover}'); background-size:cover; background-position:center;` : ''}">
          ${cover ? '' : '🎪'}
          ${p.images && p.images.length > 1 ? `<span class="swatch-badge">📷 ${p.images.length}</span>` : ''}
        </div>
        <h4>${escapeHtml(p.name)}</h4>
        <div class="price">${money(p.price)}/dia</div>
        <div style="font-size:0.78rem;color:var(--gray)">${escapeHtml(p.size || '-')} · até ${p.capacity || '-'} crianças</div>
        ${!p.active ? '<div class="inactive-tag">Inativo (oculto no site)</div>' : ''}
        <div class="card-actions">
          <button class="btn btn-outline btn-sm" data-edit="${p.id}">Editar</button>
          <button class="btn btn-outline btn-sm" data-toggle="${p.id}">${p.active ? 'Desativar' : 'Ativar'}</button>
          <button class="btn btn-danger btn-sm" data-del="${p.id}">Excluir</button>
        </div>
      </div>
    `;
    }).join('');

    el.querySelectorAll('[data-edit]').forEach((btn) => btn.addEventListener('click', () => openProductModal(Number(btn.dataset.edit))));
    el.querySelectorAll('[data-toggle]').forEach((btn) => btn.addEventListener('click', async () => {
      const p = state.products.find((x) => x.id === Number(btn.dataset.toggle));
      await api(`/api/admin/products/${p.id}`, { method: 'PUT', body: JSON.stringify({ active: !p.active }) });
      await loadProducts();
    }));
    el.querySelectorAll('[data-del]').forEach((btn) => btn.addEventListener('click', async () => {
      if (!confirm('Excluir este produto permanentemente?')) return;
      await api(`/api/admin/products/${btn.dataset.del}`, { method: 'DELETE' });
      await loadProducts();
    }));
  }

  // ---- dynamic photo list in the product form ----

  function addImageRow(value) {
    const list = document.getElementById('pf-images-list');
    const row = document.createElement('div');
    row.className = 'image-list-row';
    row.innerHTML = `
      <input type="text" class="pf-image-input" placeholder="/img/products/arquivo.jpg" value="${value ? escapeHtml(value) : ''}" />
      <button type="button" class="btn btn-outline btn-sm image-remove-btn" aria-label="Remover">✕</button>
    `;
    row.querySelector('.image-remove-btn').addEventListener('click', () => row.remove());
    list.appendChild(row);
  }

  function renderImageRows(images) {
    const list = document.getElementById('pf-images-list');
    list.innerHTML = '';
    (images && images.length ? images : ['']).forEach((img) => addImageRow(img));
  }

  function collectImages() {
    return Array.from(document.querySelectorAll('.pf-image-input'))
      .map((input) => input.value.trim())
      .filter(Boolean);
  }

  function openProductModal(id) {
    const modal = document.getElementById('product-modal');
    const isEdit = !!id;
    document.getElementById('product-modal-title').textContent = isEdit ? 'Editar produto' : 'Novo produto';
    const p = isEdit ? state.products.find((x) => x.id === id) : null;
    document.getElementById('pf-id').value = id || '';
    document.getElementById('pf-name').value = p ? p.name : '';
    document.getElementById('pf-description').value = p ? p.description : '';
    document.getElementById('pf-price').value = p ? p.price : '';
    document.getElementById('pf-capacity').value = p ? p.capacity || '' : '';
    document.getElementById('pf-size').value = p ? p.size || '' : '';
    document.getElementById('pf-minAge').value = p ? p.minAge || '' : '';
    renderImageRows(p ? p.images : []);
    document.getElementById('pf-icon').value = p ? p.icon : 'bounce';
    document.getElementById('pf-color').value = p ? p.color : '#ff6b6b';
    document.getElementById('pf-active').checked = p ? p.active : true;
    modal.classList.add('show');
  }

  function closeProductModal() { document.getElementById('product-modal').classList.remove('show'); }

  async function onSaveProduct(e) {
    e.preventDefault();
    const id = document.getElementById('pf-id').value;
    const payload = {
      name: document.getElementById('pf-name').value.trim(),
      description: document.getElementById('pf-description').value.trim(),
      price: Number(document.getElementById('pf-price').value),
      capacity: Number(document.getElementById('pf-capacity').value) || null,
      size: document.getElementById('pf-size').value.trim(),
      minAge: Number(document.getElementById('pf-minAge').value) || null,
      images: collectImages(),
      icon: document.getElementById('pf-icon').value,
      color: document.getElementById('pf-color').value,
      active: document.getElementById('pf-active').checked
    };
    try {
      if (id) await api(`/api/admin/products/${id}`, { method: 'PUT', body: JSON.stringify(payload) });
      else await api('/api/admin/products', { method: 'POST', body: JSON.stringify(payload) });
      closeProductModal();
      await loadProducts();
    } catch (err) { alert(err.message); }
  }

  // ---------- Blocked dates ----------

  async function loadBlockedDates() {
    state.blockedDates = await api('/api/admin/blocked-dates');
    renderBlockedDates();
  }

  function renderBlockedDates() {
    const el = document.getElementById('blocked-list');
    if (!state.blockedDates.length) { el.innerHTML = '<div class="empty-state">Nenhuma data bloqueada.</div>'; return; }
    el.innerHTML = `<table><thead><tr><th>Data</th><th>Motivo</th><th></th></tr></thead><tbody>
      ${state.blockedDates.map((b) => `<tr>
        <td>${fmtDateBR(b.date)}</td>
        <td>${escapeHtml(b.reason || '-')}</td>
        <td><button class="btn btn-danger btn-sm" data-unblock="${b.id}">Remover</button></td>
      </tr>`).join('')}
    </tbody></table>`;
    el.querySelectorAll('[data-unblock]').forEach((btn) => btn.addEventListener('click', async () => {
      await api(`/api/admin/blocked-dates/${btn.dataset.unblock}`, { method: 'DELETE' });
      await loadBlockedDates();
      renderAdminCalendar();
    }));
  }

  async function onAddBlockedDate(e) {
    e.preventDefault();
    const date = document.getElementById('blocked-date').value;
    const reason = document.getElementById('blocked-reason').value.trim();
    if (!date) return;
    try {
      await api('/api/admin/blocked-dates', { method: 'POST', body: JSON.stringify({ date, reason }) });
      document.getElementById('blocked-form').reset();
      await loadBlockedDates();
      renderAdminCalendar();
    } catch (err) { alert(err.message); }
  }

  // ---------- Settings ----------

  async function loadSettings() {
    const s = await api('/api/settings');
    document.getElementById('s-companyName').value = s.companyName || '';
    document.getElementById('s-whatsapp').value = s.whatsapp || '';
    document.getElementById('s-email').value = s.email || '';
    document.getElementById('s-city').value = s.city || '';
    document.getElementById('s-instagram').value = s.instagram || '';
    document.getElementById('s-address').value = s.address || '';
    document.getElementById('s-pricePerKm').value = s.pricePerKm != null ? s.pricePerKm : 2;
  }

  async function onSaveSettings(e) {
    e.preventDefault();
    const fb = document.getElementById('settings-feedback');
    const payload = {
      companyName: document.getElementById('s-companyName').value.trim(),
      whatsapp: document.getElementById('s-whatsapp').value.trim(),
      email: document.getElementById('s-email').value.trim(),
      city: document.getElementById('s-city').value.trim(),
      instagram: document.getElementById('s-instagram').value.trim()
    };
    try {
      await api('/api/admin/settings', { method: 'PUT', body: JSON.stringify(payload) });
      fb.style.color = '#047857';
      fb.textContent = 'Salvo com sucesso!';
      setTimeout(() => (fb.textContent = ''), 3000);
    } catch (err) {
      fb.style.color = '#b91c1c';
      fb.textContent = err.message;
    }
  }

  async function onSaveDelivery(e) {
    e.preventDefault();
    const fb = document.getElementById('delivery-feedback');
    const payload = {
      address: document.getElementById('s-address').value.trim(),
      pricePerKm: Number(document.getElementById('s-pricePerKm').value) || 0
    };
    try {
      await api('/api/admin/settings', { method: 'PUT', body: JSON.stringify(payload) });
      fb.style.color = '#047857';
      fb.textContent = 'Salvo com sucesso!';
      setTimeout(() => (fb.textContent = ''), 3000);
    } catch (err) {
      fb.style.color = '#b91c1c';
      fb.textContent = err.message;
    }
  }

  async function onChangePassword(e) {
    e.preventDefault();
    const fb = document.getElementById('password-feedback');
    const currentPassword = document.getElementById('p-current').value;
    const newPassword = document.getElementById('p-new').value;
    try {
      await api('/api/admin/auth/change-password', { method: 'POST', body: JSON.stringify({ currentPassword, newPassword }) });
      fb.style.color = '#047857';
      fb.textContent = 'Senha atualizada!';
      document.getElementById('password-form').reset();
      setTimeout(() => (fb.textContent = ''), 3000);
    } catch (err) {
      fb.style.color = '#b91c1c';
      fb.textContent = err.message;
    }
  }

  init();
})();
