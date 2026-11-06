import { put, list, del } from '@vercel/blob';

function normalizeUser(rawUser) {
  if (!rawUser || typeof rawUser !== 'string') return 'johnnyhoang';
  const clean = rawUser.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '');
  return clean || 'johnnyhoang';
}

function extractBlobTimestamp(pathname, prefix) {
  const match = pathname.match(new RegExp(`${prefix}(\\d+)`));
  return match ? Number(match[1]) : 0;
}

function mergePayloads(existing, incoming) {
  if (!existing || typeof existing.streakStartMs !== 'number') return incoming;
  if (!incoming || typeof incoming.streakStartMs !== 'number') return existing;

  const logMap = new Map();
  (existing.logs || []).forEach((l) => {
    if (l && l.timestamp) logMap.set(l.id || String(l.timestamp), l);
  });
  (incoming.logs || []).forEach((l) => {
    if (l && l.timestamp) logMap.set(l.id || String(l.timestamp), l);
  });

  const mergedLogs = Array.from(logMap.values());
  mergedLogs.sort((a, b) => b.timestamp - a.timestamp);

  let streakStartMs = Math.max(existing.streakStartMs || 0, incoming.streakStartMs || 0);
  if (mergedLogs.length > 0) {
    streakStartMs = Math.max(streakStartMs, mergedLogs[0].timestamp);
  }

  return {
    user: incoming.user || existing.user,
    streakStartMs,
    lastCheckInMs: Math.max(existing.lastCheckInMs || 0, incoming.lastCheckInMs || 0, streakStartMs),
    logs: mergedLogs.slice(0, 1000),
    lastAlertedHourCycle: Math.max(existing.lastAlertedHourCycle || 0, incoming.lastAlertedHourCycle || 0),
    updatedAt: Math.max(existing.updatedAt || 0, incoming.updatedAt || 0, Date.now())
  };
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');

  try {
    const rawUser = req.method === 'GET' ? req.query.user : (req.body?.user || req.query.user);
    const user = normalizeUser(rawUser);
    const userPrefix = `smoff-u-${user}-`;
    const legacyPrefix = 'smoff-state-';

    if (req.method === 'GET') {
      let { blobs } = await list({ prefix: userPrefix });

      if ((!blobs || blobs.length === 0) && user === 'johnnyhoang') {
        const legacyResult = await list({ prefix: legacyPrefix });
        blobs = legacyResult.blobs || [];
      }

      if (!blobs || blobs.length === 0) {
        return res.status(200).json({ empty: true, user });
      }

      blobs.sort((a, b) => {
        const tsA = extractBlobTimestamp(a.pathname, userPrefix) || new Date(a.uploadedAt).getTime();
        const tsB = extractBlobTimestamp(b.pathname, userPrefix) || new Date(b.uploadedAt).getTime();
        return tsB - tsA;
      });
      const latestBlob = blobs[0];

      const response = await fetch(`${latestBlob.url}?t=${Date.now()}`, { cache: 'no-store' });
      if (!response.ok) {
        return res.status(200).json({ empty: true, user });
      }
      const data = await response.json();
      return res.status(200).json({ ...data, user });
    }

    if (req.method === 'POST') {
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      if (!body || typeof body !== 'object') {
        return res.status(400).json({ error: 'Invalid state payload' });
      }

      const incoming = {
        user,
        streakStartMs: Number(body.streakStartMs) || Date.now(),
        lastCheckInMs: Number(body.lastCheckInMs) || Date.now(),
        logs: Array.isArray(body.logs) ? body.logs.slice(0, 1000) : [],
        lastAlertedHourCycle: Number(body.lastAlertedHourCycle) || 0,
        updatedAt: Number(body.updatedAt) || Date.now()
      };

      // Đọc blob hiện tại để merge chống đè mất dữ liệu giữa các thiết bị
      const { blobs: existingUserBlobs } = await list({ prefix: userPrefix });
      let currentCloudData = null;
      let blobsToDelete = existingUserBlobs ? [...existingUserBlobs.map((b) => b.url)] : [];

      if (existingUserBlobs && existingUserBlobs.length > 0) {
        existingUserBlobs.sort((a, b) => {
          const tsA = extractBlobTimestamp(a.pathname, userPrefix) || new Date(a.uploadedAt).getTime();
          const tsB = extractBlobTimestamp(b.pathname, userPrefix) || new Date(b.uploadedAt).getTime();
          return tsB - tsA;
        });
        try {
          const prevRes = await fetch(`${existingUserBlobs[0].url}?t=${Date.now()}`, { cache: 'no-store' });
          if (prevRes.ok) {
            currentCloudData = await prevRes.json();
          }
        } catch (e) {}
      }

      const mergedPayload = mergePayloads(currentCloudData, incoming);

      if (user === 'johnnyhoang') {
        const { blobs: legacyBlobs } = await list({ prefix: legacyPrefix });
        if (legacyBlobs && legacyBlobs.length > 0) {
          blobsToDelete.push(...legacyBlobs.map((b) => b.url));
        }
      }

      await put(`${userPrefix}${mergedPayload.updatedAt}.json`, JSON.stringify(mergedPayload), {
        access: 'public',
        addRandomSuffix: true,
        contentType: 'application/json',
        cacheControlMaxAge: 0
      });

      if (blobsToDelete.length > 0) {
        await del(blobsToDelete);
      }

      return res.status(200).json({ ok: true, state: mergedPayload });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('API /api/state error:', err);
    return res.status(500).json({ error: err.message || 'Internal Server Error' });
  }
}
