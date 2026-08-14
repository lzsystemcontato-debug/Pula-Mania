// Computes the per-day subtotal for a set of selected products, applying combo
// pricing when a product and its declared combo partner are both selected.
// Order-independent: only products that declare `comboPartnerId` attempt to
// claim their partner (phase 1); everything left over is priced normally
// (phase 2). This means a partner product (e.g. the pool) never needs to
// declare the relationship itself, and selecting two units of the same combo
// item (e.g. two bouncy castles) with the partner only discounts one pair.
function computeDailySubtotal(selectedProducts) {
  const selectedIds = new Set(selectedProducts.map((p) => p.id));
  const handled = new Set();
  let subtotal = 0;

  selectedProducts.forEach((p) => {
    if (handled.has(p.id) || !p.comboPartnerId) return;
    if (selectedIds.has(p.comboPartnerId) && !handled.has(p.comboPartnerId)) {
      subtotal += Number(p.comboPrice) || 0;
      handled.add(p.id);
      handled.add(p.comboPartnerId);
    }
  });

  selectedProducts.forEach((p) => {
    if (handled.has(p.id)) return;
    subtotal += p.price;
    handled.add(p.id);
  });

  return Math.round(subtotal * 100) / 100;
}

module.exports = { computeDailySubtotal };
