const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { getDb } = require('../db');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

function makeSlug(name) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') + '-' + Math.random().toString(36).slice(2, 7);
}

router.get('/survey/:surveyId', authMiddleware, async (req, res) => {
  const db = getDb();
  const waves = await db.prepare(`
    SELECT w.id, w.survey_id, w.name, w.slug, w.opens_at, w.closes_at, w.status, w.created_at,
      (SELECT COUNT(*) FROM responses r WHERE r.wave_id = w.id AND r.completed_at IS NOT NULL) as response_count
    FROM waves w
    WHERE w.survey_id = ?
    ORDER BY w.created_at DESC
  `).all(req.params.surveyId);
  res.json(waves);
});

router.get('/:id', authMiddleware, async (req, res) => {
  const db = getDb();
  const wave = await db.prepare('SELECT * FROM waves WHERE id = ?').get(req.params.id);
  if (!wave) return res.status(404).json({ error: 'No encontrada' });
  res.json(wave);
});

router.post('/', authMiddleware, async (req, res) => {
  const db = getDb();
  const { survey_id, name, opens_at, closes_at } = req.body;
  if (!survey_id || !name) return res.status(400).json({ error: 'survey_id y nombre requeridos' });
  const survey = await db.prepare('SELECT id FROM surveys WHERE id = ?').get(survey_id);
  if (!survey) return res.status(404).json({ error: 'Encuesta no encontrada' });

  const id = uuidv4();
  const slug = makeSlug(name);
  await db.prepare('INSERT INTO waves (id, survey_id, name, slug, opens_at, closes_at, status) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .run(id, survey_id, name, slug, opens_at || null, closes_at || null, 'draft');

  res.status(201).json(await db.prepare('SELECT * FROM waves WHERE id = ?').get(id));
});

router.put('/:id', authMiddleware, async (req, res) => {
  const db = getDb();
  const { name, opens_at, closes_at, status } = req.body;
  const wave = await db.prepare('SELECT * FROM waves WHERE id = ?').get(req.params.id);
  if (!wave) return res.status(404).json({ error: 'No encontrada' });
  await db.prepare('UPDATE waves SET name = ?, opens_at = ?, closes_at = ?, status = ? WHERE id = ?')
    .run(name ?? wave.name, opens_at !== undefined ? opens_at : wave.opens_at, closes_at !== undefined ? closes_at : wave.closes_at, status ?? wave.status, req.params.id);
  res.json(await db.prepare('SELECT * FROM waves WHERE id = ?').get(req.params.id));
});

router.delete('/:id', authMiddleware, async (req, res) => {
  const db = getDb();
  await db.prepare('DELETE FROM waves WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

router.get('/public/:slug', async (req, res) => {
  const db = getDb();
  const wave = await db.prepare('SELECT * FROM waves WHERE slug = ?').get(req.params.slug);
  if (!wave) return res.status(404).json({ error: 'Encuesta no encontrada' });
  if (wave.status === 'draft') return res.status(403).json({ error: 'Esta encuesta no está disponible aún' });
  if (wave.status === 'closed') return res.status(403).json({ error: 'Esta encuesta ya está cerrada' });

  const now = new Date().toISOString();
  if (wave.opens_at && now < wave.opens_at) return res.status(403).json({ error: 'Esta encuesta aún no está abierta' });
  if (wave.closes_at && now > wave.closes_at) return res.status(403).json({ error: 'Esta encuesta ya cerró' });

  const survey = await db.prepare('SELECT * FROM surveys WHERE id = ?').get(wave.survey_id);
  const questions = await db.prepare('SELECT * FROM questions WHERE survey_id = ? ORDER BY order_index').all(wave.survey_id);
  questions.forEach(q => { if (q.options) q.options = JSON.parse(q.options); });

  let participant = null;
  if (req.query.token) {
    const p = await db.prepare('SELECT * FROM wave_participants WHERE token = ? AND wave_id = ?').get(req.query.token, wave.id);
    if (p) {
      if (p.response_id) return res.status(409).json({ error: 'Ya has respondido esta encuesta anteriormente.' });
      participant = { email: p.email, name: p.name, token: p.token };
    }
  }

  res.json({ wave, survey, questions, participant });
});

module.exports = router;
