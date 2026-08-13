function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function addDays(dateStr, n) {
  const d = new Date(dateStr + 'T00:00:00');
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

function bookingEndDate(booking) {
  return booking.endDate || booking.eventDate;
}

function bookingBlocksDate(booking, productId, dateStr) {
  if (booking.status !== 'pending' && booking.status !== 'confirmed') return false;
  if (!booking.items.some((item) => item.productId === productId)) return false;
  return dateStr >= booking.eventDate && dateStr <= bookingEndDate(booking);
}

// A date is unavailable for a given product if:
// - it's in the past
// - it's in the global blockedDates list
// - it falls within the date range of an existing pending/confirmed booking that includes this product
function getUnavailableDatesForProduct(db, productId, year, month) {
  const monthStr = String(month).padStart(2, '0');
  const prefix = `${year}-${monthStr}`;
  const today = todayStr();

  const blocked = new Set(
    db.blockedDates.filter((b) => b.date.startsWith(prefix)).map((b) => b.date)
  );

  const daysInMonth = new Date(year, month, 0).getDate();
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${prefix}-${String(d).padStart(2, '0')}`;
    if (dateStr < today) {
      blocked.add(dateStr);
      continue;
    }
    if (db.bookings.some((b) => bookingBlocksDate(b, productId, dateStr))) {
      blocked.add(dateStr);
    }
  }

  return blocked;
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
  return !db.bookings.some((b) => ids.some((id) => bookingBlocksDate(b, id, dateStr)));
}

// Every day in [startDate, startDate + days - 1] must be available for all product ids.
function isRangeAvailable(db, productIds, startDate, days) {
  for (let i = 0; i < days; i++) {
    if (!isDateAvailable(db, productIds, addDays(startDate, i))) return false;
  }
  return true;
}

module.exports = { getUnavailableDates, isDateAvailable, isRangeAvailable, addDays, todayStr };
