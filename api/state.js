import { put, list, del } from '@vercel/blob';

function normalizeUser(rawUser) {
  if (!rawUser || typeof rawUser !== 'string') return 'johnnyhoang';
  const clean = rawUser.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '');
  return clean || 'johnnyhoang';
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

      // Fallback cho johnnyhoang nếu chưa có prefix user mới
      if ((!blobs || blobs.length === 0) && user === 'johnnyhoang') {
        const legacyResult = await list({ prefix: legacyPrefix });
        blobs = legacyResult.blobs || [];
      }

      if (!blobs || blobs.length === 0) {
        return res.status(200).json({ empty: true, user });
      }

      blobs.sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime());
      const latestBlob = blobs[0];

      const response = await fetch(latestBlob.url, { cache: 'no-store' });
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

      const payload = {
        user,
        streakStartMs: Number(body.streakStartMs) || Date.now(),
        lastCheckInMs: Number(body.lastCheckInMs) || Date.now(),
        logs: Array.isArray(body.logs) ? body.logs.slice(0, 1000) : [],
        lastAlertedHourCycle: Number(body.lastAlertedHourCycle) || 0,
        updatedAt: Number(body.updatedAt) || Date.now()
      };

      const { blobs: existingUserBlobs } = await list({ prefix: userPrefix });
      let blobsToDelete = existingUserBlobs ? [...existingUserBlobs.map((b) => b.url)] : [];

      if (user === 'johnnyhoang') {
        const { blobs: legacyBlobs } = await list({ prefix: legacyPrefix });
        if (legacyBlobs && legacyBlobs.length > 0) {
          blobsToDelete.push(...legacyBlobs.map((b) => b.url));
        }
      }

      await put(`${userPrefix}${payload.updatedAt}.json`, JSON.stringify(payload), {
        access: 'public',
        addRandomSuffix: true,
        contentType: 'application/json',
        cacheControlMaxAge: 0
      });

      if (blobsToDelete.length > 0) {
        await del(blobsToDelete);
      }

      return res.status(200).json({ ok: true, state: payload });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('API /api/state error:', err);
    return res.status(500).json({ error: err.message || 'Internal Server Error' });
  }
}
