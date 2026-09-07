(function () {
  const MONTHS_SHORT = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];

  function fmtDateBR(dateStr) {
    const [y, m, d] = dateStr.split('-');
    return `${d}/${m}/${y}`;
  }
  function money(v) { return Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }); }
  function escapeHtml(str) { const div = document.createElement('div'); div.textContent = str == null ? '' : str; return div.innerHTML; }
  function itemNames(items) { return (items || []).map((i) => i.name).join(', ') || '-'; }
  function fmtSignedAt(iso) {
    const d = new Date(iso);
    return `${String(d.getDate()).padStart(2, '0')} de ${MONTHS_SHORT[d.getMonth()]} de ${d.getFullYear()} às ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  }

  function getToken() {
    const parts = window.location.pathname.split('/').filter(Boolean);
    return parts[parts.length - 1];
  }

  function renderError(message) {
    document.getElementById('contract-loading').style.display = 'none';
    const content = document.getElementById('contract-content');
    content.style.display = 'block';
    content.innerHTML = `<div class="contract-state"><div class="icon">⚠️</div><p>${escapeHtml(message)}</p></div>`;
  }

  function fmtCpf(cpf) {
    const d = String(cpf || '').replace(/\D/g, '');
    if (d.length !== 11) return cpf || '-';
    return `${d.slice(0,3)}.${d.slice(3,6)}.${d.slice(6,9)}-${d.slice(9,11)}`;
  }

  function signatureBlock(data, signature) {
    return `
      <div class="signature-block">
        <div class="sig-party">
          <strong>LOCADORA</strong>
          <div>Nome: ${escapeHtml(data.ownerFullName || '-')}</div>
          <div>CPF: ${fmtCpf(data.ownerCpf)}</div>
        </div>
        <div class="sig-party">
          <strong>LOCATÁRIO(A)</strong>
          <div>Nome: ${escapeHtml(signature.fullName)}</div>
          <div>CPF: ${fmtCpf(signature.cpf)}</div>
        </div>
        <p style="color:var(--gray); font-size:0.8rem; margin-top:10px;">${escapeHtml(data.city || '')}, ${fmtSignedAt(signature.signedAt)}.</p>
      </div>`;
  }

  function renderSigned(data) {
    const content = document.getElementById('contract-content');
    content.innerHTML = `
      <div class="contract-state">
        <div class="icon">✅</div>
        <h2>Contrato assinado</h2>
        <p style="color:var(--gray)">Assinado por <strong>${escapeHtml(data.signature.fullName)}</strong> em ${fmtSignedAt(data.signedAt)}.</p>
        <p style="color:var(--gray); font-size:0.85rem; margin-top:6px;">Guarde este link para consultar o comprovante quando precisar.</p>
      </div>
      ${signatureBlock(data, data.signature)}`;
  }

  function renderForm(data) {
    const period = data.endDate && data.endDate !== data.eventDate
      ? `${fmtDateBR(data.eventDate)} a ${fmtDateBR(data.endDate)} (${data.days || 1} dia(s))`
      : fmtDateBR(data.eventDate);

    const content = document.getElementById('contract-content');
    content.innerHTML = `
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

      <form id="sign-form">
        <div class="contract-field">
          <label>Nome completo *</label>
          <input type="text" id="f-name" value="${escapeHtml(data.customerName)}" required />
        </div>
        <div class="contract-field">
          <label>CPF *</label>
          <input type="text" id="f-cpf" placeholder="000.000.000-00" required />
        </div>
        <div class="contract-field">
          <label>Endereço completo *</label>
          <input type="text" id="f-address" value="${escapeHtml(data.address)}" required />
        </div>
        <label class="accept-row">
          <input type="checkbox" id="f-accept" required />
          <span>Li e concordo com os termos de locação apresentados acima.</span>
        </label>
        <button type="submit" class="btn btn-primary" id="sign-submit" style="width:100%">Assinar e confirmar</button>
      </form>`;

    document.getElementById('sign-form').addEventListener('submit', onSubmit);
  }

  async function onSubmit(e) {
    e.preventDefault();
    const alertEl = document.getElementById('c-alert');
    alertEl.classList.remove('show');
    const btn = document.getElementById('sign-submit');
    btn.disabled = true;
    btn.textContent = 'Enviando...';

    try {
      const res = await fetch(`/api/contract/${getToken()}/sign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName: document.getElementById('f-name').value.trim(),
          cpf: document.getElementById('f-cpf').value.trim(),
          address: document.getElementById('f-address').value.trim(),
          acceptedTerms: document.getElementById('f-accept').checked
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Não foi possível registrar a assinatura.');
      window.location.reload();
    } catch (err) {
      alertEl.textContent = err.message;
      alertEl.classList.add('show');
      btn.disabled = false;
      btn.textContent = 'Assinar e confirmar';
    }
  }

  async function init() {
    try {
      const res = await fetch(`/api/contract/${getToken()}`);
      const data = await res.json();
      if (!res.ok) return renderError(data.error || 'Contrato não encontrado.');

      document.getElementById('c-company').textContent = data.companyName || 'Pula Mania';
      document.getElementById('contract-loading').style.display = 'none';
      document.getElementById('contract-content').style.display = 'block';

      if (data.alreadySigned) renderSigned(data);
      else renderForm(data);
    } catch (err) {
      renderError('Erro de conexão. Tente novamente em instantes.');
    }
  }

  init();
})();
