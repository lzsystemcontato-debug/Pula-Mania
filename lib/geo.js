const USER_AGENT = 'PulaMania-Site/1.0 (contato: pulamaniafesta.rp@gmail.com)';

const geocodeCache = new Map();

// Nominatim's free-text search expects every term to roughly match a single
// place hierarchy. A neighborhood name that doesn't exactly match what
// OpenStreetMap has on file for that street (common with CEP-autofilled
// bairros) makes the whole query fail even though the street itself is
// findable. Build progressively simpler fallback queries — drop the CEP,
// then drop the " - Bairro" segment — so a mismatched detail doesn't block
// geocoding of an otherwise valid address.
function addressVariants(address) {
  const variants = [address];

  const withoutCep = address.replace(/,?\s*CEP\s+\d{5}-?\d{3}/i, '').trim();
  if (withoutCep && withoutCep !== address) variants.push(withoutCep);

  const withoutNeighborhood = withoutCep.replace(/\s-\s[^,]+/, '').trim();
  if (withoutNeighborhood && withoutNeighborhood !== withoutCep) variants.push(withoutNeighborhood);

  return variants;
}

async function geocodeOnce(address) {
  const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=br&q=${encodeURIComponent(address)}`;
  const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
  if (!res.ok) throw new Error('Falha ao consultar o serviço de mapas.');
  const data = await res.json();
  if (!data.length) return null;
  return { lat: Number(data[0].lat), lon: Number(data[0].lon) };
}

async function geocodeAddress(address) {
  const key = address.trim().toLowerCase();
  if (geocodeCache.has(key)) return geocodeCache.get(key);

  for (const variant of addressVariants(address)) {
    const result = await geocodeOnce(variant);
    if (result) {
      geocodeCache.set(key, result);
      return result;
    }
  }

  throw new Error('Endereço não encontrado.');
}

async function routeDistanceKm(origin, destination) {
  const url = `https://router.project-osrm.org/route/v1/driving/${origin.lon},${origin.lat};${destination.lon},${destination.lat}?overview=false`;
  const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
  if (!res.ok) throw new Error('Falha ao calcular a rota.');
  const data = await res.json();
  if (data.code !== 'Ok' || !data.routes || !data.routes.length) {
    throw new Error('Não foi possível calcular a rota entre os endereços.');
  }
  return data.routes[0].distance / 1000;
}

async function distanceBetweenAddresses(originAddress, destinationAddress) {
  const [origin, destination] = await Promise.all([
    geocodeAddress(originAddress),
    geocodeAddress(destinationAddress)
  ]);
  const km = await routeDistanceKm(origin, destination);
  return Math.round(km * 10) / 10;
}

module.exports = { geocodeAddress, routeDistanceKm, distanceBetweenAddresses };
