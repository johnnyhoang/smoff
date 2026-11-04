import { put, list, del } from '@vercel/blob';

const PREFIX = 'smoff-state-';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');

  try {
    if (req.method === 'GET') {
      const { blobs } = await list({ prefix: PREFIX });
      if (!blobs || blobs.length === 0) {
        return res.status(200).json({ empty: true });
      }

      blobs.sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime());
      const latestBlob = blobs[0];

      const response = await fetch(latestBlob.url, { cache: 'no-store' });
      if (!response.ok) {
        return res.status(200).json({ empty: true });
      }
      const data = await response.json();
      return res.status(200).json(data);
    }

    if (req.method === 'POST') {
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      if (!body || typeof body !== 'object') {
        return res.status(400).json({ error: 'Invalid state payload' });
      }

      const payload = {
        streakStartMs: Number(body.streakStartMs) || Date.now(),
        lastCheckInMs: Number(body.lastCheckInMs) || Date.now(),
        logs: Array.isArray(body.logs) ? body.logs.slice(0, 1000) : [],
        lastAlertedHourCycle: Number(body.lastAlertedHourCycle) || 0,
        updatedAt: Number(body.updatedAt) || Date.now()
      };

      const { blobs: existingBlobs } = await list({ prefix: PREFIX });

      await put(`${PREFIX}${payload.updatedAt}.json`, JSON.stringify(payload), {
        access: 'public',
        addRandomSuffix: true,
        contentType: 'application/json',
        cacheControlMaxAge: 0
      });

      if (existingBlobs && existingBlobs.length > 0) {
        await del(existingBlobs.map((b) => b.url));
      }

      return res.status(200).json({ ok: true, state: payload });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('API /api/state error:', err);
    return res.status(500).json({ error: err.message || 'Internal Server Error' });
  }
}
