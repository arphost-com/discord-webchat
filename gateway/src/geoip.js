const cache = new Map();
const MAX_CACHE = 1000;

function cacheGet(key) {
  return cache.get(key);
}

function cacheSet(key, value) {
  if (cache.size >= MAX_CACHE) {
    const firstKey = cache.keys().next().value;
    if (firstKey) cache.delete(firstKey);
  }
  cache.set(key, value);
}

function isPrivateIp(ip) {
  if (!ip) return true;
  if (ip.startsWith('10.')) return true;
  if (ip.startsWith('127.')) return true;
  if (ip.startsWith('192.168.')) return true;
  if (ip.startsWith('172.16.') || ip.startsWith('172.17.') || ip.startsWith('172.18.') || ip.startsWith('172.19.') ||
      ip.startsWith('172.2') || ip.startsWith('172.30.') || ip.startsWith('172.31.')) return true;
  if (ip === '::1') return true;
  return false;
}

function normalizeGeo(data) {
  if (!data) return null;
  return {
    country: data.country || data.country_code || null,
    region: data.region || data.regionName || data.region_name || null,
    city: data.city || null,
    lat: typeof data.lat === 'number' ? data.lat : (data.latitude ? Number(data.latitude) : null),
    lng: typeof data.lng === 'number' ? data.lng : (data.longitude ? Number(data.longitude) : null),
    timezone: data.timezone || data.time_zone || null,
  };
}

export async function lookupGeo(ip, opts = {}) {
  const testIp = String(opts.testIp || process.env.GEOIP_TEST_IP || '').trim();
  let targetIp = ip;
  if ((!targetIp || isPrivateIp(targetIp)) && testIp) targetIp = testIp;
  if (!targetIp || isPrivateIp(targetIp)) return null;
  const cached = cacheGet(targetIp);
  if (cached) return cached;

  const provider = (opts.provider || process.env.GEOIP_PROVIDER || 'ipapi').toLowerCase();
  const apiKey = opts.apiKey || process.env.GEOIP_API_KEY || '';
  let url = '';

  if (provider === 'ipinfo') {
    const token = apiKey ? `?token=${encodeURIComponent(apiKey)}` : '';
    url = `https://ipinfo.io/${encodeURIComponent(targetIp)}/json${token}`;
  } else {
    const key = apiKey ? `?key=${encodeURIComponent(apiKey)}` : '';
    url = `https://ipapi.co/${encodeURIComponent(targetIp)}/json/${key}`;
  }

  try {
    const res = await fetch(url, { method: 'GET' });
    if (!res.ok) return null;
    const json = await res.json();
    if (provider === 'ipinfo' && json.loc) {
      const [lat, lng] = String(json.loc).split(',').map(n => Number(n));
      json.lat = lat;
      json.lng = lng;
      json.region = json.region || json.region_name || null;
    }
    const geo = normalizeGeo(json);
    cacheSet(targetIp, geo);
    return geo;
  } catch {
    return null;
  }
}
