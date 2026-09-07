(function () {
  const MONTHS_SHORT = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

  const backdrop = document.getElementById('contract-modal');
  const body = document.getElementById('contract-modal-body');
  const closeBtn = document.getElementById('contract-close');

  let pendingWaUrl = null;
  let pendingCpf = '';

  function money(v) { return Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }); }
  function escapeHtml(str) { const div = document.createElement('div'); div.textContent = str == null ? '' : str; return div.innerHTML; }
  function itemNames(items) { return (items || []).map((i) => i.name).join(', ') || '-'; }

  function fmtDateBR(dateStr) {
    const [y, m, d] = dateStr.split('-');
    return `${d}/${m}/${y}`;
  }

  function fmtCpf(cpf) {
    const d = String(cpf || '').replace(/\D/g, '');
    if (d.length !== 11) return cpf || '-';
    return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9, 11)}`;
  }

  function openModal() {
    backdrop.classList.add('show');
    document.body.style.overflow = 'hidden';
  }

  function closeModal() {
    backdrop.classList.remove('show');
    document.body.style.overflow = '';
  }

  closeBtn.addEventListener('click', closeModal);
  backdrop.addEventListener('click', (e) => { if (e.target === backdrop) closeModal(); });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && backdrop.classList.contains('show')) closeModal();
  });

  function renderLoading() {
    body.innerHTML = '<div class="contract-state"><p>Carregando contrato...</p></div>';
  }

  function renderError(message) {
    body.innerHTML = `<div class="contract-state"><div class="icon">⚠️</div><p>${escapeHtml(message)}</p></div>`;
  }

  function renderSuccess() {
    body.innerHTML = `
      <div class="contract-state">
        <div class="icon">✅</div>
        <h2>Contrato assinado!</h2>
        <p style="color:var(--gray)">Recebemos seus dados e o contrato foi assinado com sucesso.</p>
        <p style="color:var(--gray); font-size:0.85rem; margin-top:6px;">Agora finalize enviando seu pedido pelo WhatsApp.</p>
        <button type="button" class="btn btn-primary" id="contract-go-wa" style="margin-top:16px">💬 Continuar no WhatsApp</button>
      </div>`;
    document.getElementById('contract-go-wa').addEventListener('click', () => {
      if (pendingWaUrl) window.open(pendingWaUrl, '_blank');
      closeModal();
    });
  }

  function renderForm(token, data) {
    const period = data.endDate && data.endDate !== data.eventDate
      ? `${fmtDateBR(data.eventDate)} a ${fmtDateBR(data.endDate)} (${data.days || 1} dia(s))`
      : fmtDateBR(data.eventDate);

    body.innerHTML = `
      <h2 style="margin-bottom:14px;">Confirme seus dados e assine o contrato</h2>
      <div class="contract-alert" id="c-alert"></div>
      <dl class="contract-summary">
        <dt>Cliente</dt><dd>${escapeHtml(data.customerName)}</dd>
        <dt>Brinquedos</dt><dd>${escapeHtml(itemNames(data.items))}</dd>
        <dt>Período</dt><dd>${period}</dd>
        <dt>Endereço do evento</dt><dd>${escapeHtml(data.address)}</dd>
        <dt>Valor total</dt><dd>${money(data.total)}</dd>
      </dl>

      <h3 style="font-size:0.95rem; margin-bottom:8px;">Termos de locação</h3>
      <div class="terms-box">${escapeHtml(data.rentalTerms)}</div>

      <form id="contract-sign-form">
        <div class="contract-field">
          <label>Nome completo *</label>
          <input type="text" id="cf-name" value="${escapeHtml(data.customerName)}" required />
        </div>
        <div class="contract-field">
          <label>CPF *</label>
          <input type="text" id="cf-cpf" value="${escapeHtml(pendingCpf)}" inputmode="numeric" maxlength="14" placeholder="000.000.000-00" required />
        </div>
        <div class="contract-field">
          <label>Endereço completo *</label>
          <input type="text" id="cf-address" value="${escapeHtml(data.address)}" required />
        </div>
        <label class="accept-row">
          <input type="checkbox" id="cf-accept" required />
          <span>Li e concordo com os termos de locação apresentados acima.</span>
        </label>
        <button type="submit" class="btn btn-primary btn-block" id="contract-sign-submit">Assinar e confirmar</button>
      </form>`;

    document.getElementById('contract-sign-form').addEventListener('submit', (e) => onSubmit(e, token));
    document.getElementById('cf-cpf').addEventListener('input', (e) => {
      const digits = e.target.value.replace(/\D/g, '').slice(0, 11);
      let out = digits.slice(0, 3);
      if (digits.length > 3) out += `.${digits.slice(3, 6)}`;
      if (digits.length > 6) out += `.${digits.slice(6, 9)}`;
      if (digits.length > 9) out += `-${digits.slice(9, 11)}`;
      e.target.value = out;
    });
  }

  async function onSubmit(e, token) {
    e.preventDefault();
    const alertEl = document.getElementById('c-alert');
    alertEl.classList.remove('show');
    const btn = document.getElementById('contract-sign-submit');
    btn.disabled = true;
    btn.textContent = 'Enviando...';

    try {
      const res = await fetch(`/api/contract/${token}/sign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName: document.getElementById('cf-name').value.trim(),
          cpf: document.getElementById('cf-cpf').value.trim(),
          address: document.getElementById('cf-address').value.trim(),
          acceptedTerms: document.getElementById('cf-accept').checked
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Não foi possível registrar a assinatura.');
      renderSuccess();
    } catch (err) {
      alertEl.textContent = err.message;
      alertEl.classList.add('show');
      btn.disabled = false;
      btn.textContent = 'Assinar e confirmar';
    }
  }

  async function openContractModal(token, waUrl, opts) {
    pendingWaUrl = waUrl;
    pendingCpf = (opts && opts.cpf) || '';
    renderLoading();
    openModal();
    try {
      const res = await fetch(`/api/contract/${token}`);
      const data = await res.json();
      if (!res.ok) return renderError(data.error || 'Contrato não encontrado.');
      if (data.alreadySigned) renderSuccess();
      else renderForm(token, data);
    } catch (err) {
      renderError('Erro de conexão. Tente novamente em instantes.');
    }
  }

  window.openContractModal = openContractModal;
})();
