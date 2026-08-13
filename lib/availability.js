function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function bookingBlocksProduct(booking, productId) {
  if (booking.status !== 'pending' && booking.status !== 'confirmed') return false;
  return booking.items.some((item) => item.productId === productId);
}

// A date is unavailable for a given product if:
// - it's in the past
// - it's in the global blockedDates list
// - there is already a pending/confirmed booking that includes this product on that date
function getUnavailableDatesForProduct(db, productId, year, month) {
  const monthStr = String(month).padStart(2, '0');
  const prefix = `${year}-${monthStr}`;
  const today = todayStr();

  const blocked = new Set(
    db.blockedDates.filter((b) => b.date.startsWith(prefix)).map((b) => b.date)
  );

  db.bookings
    .filter((b) => b.eventDate.startsWith(prefix) && bookingBlocksProduct(b, productId))
    .forEach((b) => blocked.add(b.eventDate));

  const daysInMonth = new Date(year, month, 0).getDate();
  const pastDates = [];
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${prefix}-${String(d).padStart(2, '0')}`;
    if (dateStr < today) pastDates.push(dateStr);
  }

  return new Set([...blocked, ...pastDates]);
}

// Union of unavailable dates across all given product ids (a date is unavailable
// for the whole booking if it's unavailable for ANY of the selected products).
function getUnavailableDates(db, productIds, year, month) {
  const ids = Array.isArray(productIds) ? productIds : [productIds];
  const combined = new Set();
  ids.forEach((id) => {
    getUnavailableDatesForProduct(db, id, year, month).forEach((d) => combined.add(d));
  });
  return Array.from(combined).sort();
}

function isDateAvailable(db, productIds, dateStr) {
  const ids = Array.isArray(productIds) ? productIds : [productIds];
  const today = todayStr();
  if (dateStr < today) return false;
  if (db.blockedDates.some((b) => b.date === dateStr)) return false;
  const clash = db.bookings.some(
    (b) => b.eventDate === dateStr && ids.some((id) => bookingBlocksProduct(b, id))
  );
  return !clash;
}

module.exports = { getUnavailableDates, isDateAvailable, todayStr };
