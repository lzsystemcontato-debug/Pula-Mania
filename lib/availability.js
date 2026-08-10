function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

// A date is unavailable for a given product if:
// - it's in the past
// - it's in the global blockedDates list
// - there is already a pending/confirmed booking for that product on that date
function getUnavailableDates(db, productId, year, month) {
  const monthStr = String(month).padStart(2, '0');
  const prefix = `${year}-${monthStr}`;
  const today = todayStr();

  const blocked = new Set(
    db.blockedDates.filter((b) => b.date.startsWith(prefix)).map((b) => b.date)
  );

  db.bookings
    .filter(
      (b) =>
        b.productId === productId &&
        (b.status === 'pending' || b.status === 'confirmed') &&
        b.eventDate.startsWith(prefix)
    )
    .forEach((b) => blocked.add(b.eventDate));

  // also mark past days within this month as unavailable
  const daysInMonth = new Date(year, month, 0).getDate();
  const pastDates = [];
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${prefix}-${String(d).padStart(2, '0')}`;
    if (dateStr < today) pastDates.push(dateStr);
  }

  return Array.from(new Set([...blocked, ...pastDates])).sort();
}

function isDateAvailable(db, productId, dateStr) {
  const today = todayStr();
  if (dateStr < today) return false;
  if (db.blockedDates.some((b) => b.date === dateStr)) return false;
  const clash = db.bookings.some(
    (b) =>
      b.productId === productId &&
      b.eventDate === dateStr &&
      (b.status === 'pending' || b.status === 'confirmed')
  );
  return !clash;
}

module.exports = { getUnavailableDates, isDateAvailable, todayStr };
