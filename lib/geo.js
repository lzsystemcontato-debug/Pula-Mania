const USER_AGENT = 'PulaMania-Site/1.0 (contato: pulamaniafesta.rp@gmail.com)';

const geocodeCache = new Map();

async function geocodeAddress(address) {
  const key = address.trim().toLowerCase();
  if (geocodeCache.has(key)) return geocodeCache.get(key);

  const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=br&q=${encodeURIComponent(address)}`;
  const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
  if (!res.ok) throw new Error('Falha ao consultar o serviço de mapas.');
  const data = await res.json();
  if (!data.length) throw new Error('Endereço não encontrado.');

  const result = { lat: Number(data[0].lat), lon: Number(data[0].lon) };
  geocodeCache.set(key, result);
  return result;
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
