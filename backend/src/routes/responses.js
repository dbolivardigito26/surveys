const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { getDb } = require('../db');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

router.post('/public', async (req, res) => {
  const db = getDb();
  const { wave_id, respondent_email, respondent_name, answers, participant_token } = req.body;
  if (!wave_id || !answers) return res.status(400).json({ error: 'Faltan datos' });

  const wave = await db.prepare('SELECT * FROM waves WHERE id = ?').get(wave_id);
  if (!wave || wave.status !== 'open') return res.status(403).json({ error: 'Encuesta no disponible' });

  const survey = await db.prepare('SELECT * FROM surveys WHERE id = ?').get(wave.survey_id);

  let participant = null;
  if (participant_token) {
    participant = await db.prepare('SELECT * FROM wave_participants WHERE token = ? AND wave_id = ?').get(participant_token, wave_id);
    if (!participant) return res.status(400).json({ error: 'Token inválido' });
    if (participant.response_id) return res.status(409).json({ error: 'Ya has respondido esta encuesta' });
  }

  if (!survey.anonymous && !respondent_email && !participant) {
    return res.status(400).json({ error: 'Esta encuesta requiere identificación' });
  }

  const email = participant?.email || respondent_email || null;
  const name = participant?.name || respondent_name || null;

  const responseId = uuidv4();
  await db.prepare('INSERT INTO responses (id, wave_id, respondent_email, respondent_name, completed_at) VALUES (?, ?, ?, ?, ?)')
    .run(responseId, wave_id, email, name, new Date().toISOString());

  for (const [questionId, value] of Object.entries(answers)) {
    await db.prepare('INSERT INTO answers (id, response_id, question_id, value) VALUES (?, ?, ?, ?)')
      .run(uuidv4(), responseId, questionId, Array.isArray(value) ? JSON.stringify(value) : String(value));
  }

  if (participant) {
    await db.prepare('UPDATE wave_participants SET response_id = ? WHERE id = ?').run(responseId, participant.id);
  }

  res.status(201).json({ ok: true, response_id: responseId });
});

router.get('/wave/:waveId', authMiddleware, async (req, res) => {
  const db = getDb();
  const responses = await db.prepare(`
    SELECT r.id, r.wave_id, r.respondent_email, r.respondent_name, r.started_at, r.completed_at,
      (SELECT COUNT(*) FROM answers a WHERE a.response_id = r.id) as answer_count
    FROM responses r
    WHERE r.wave_id = ?
    ORDER BY r.completed_at DESC
  `).all(req.params.waveId);
  res.json(responses);
});

router.get('/:id', authMiddleware, async (req, res) => {
  const db = getDb();
  const response = await db.prepare('SELECT * FROM responses WHERE id = ?').get(req.params.id);
  if (!response) return res.status(404).json({ error: 'No encontrada' });
  const answers = await db.prepare('SELECT a.id, a.value, a.question_id, q.text as question_text, q.type as question_type FROM answers a LEFT JOIN questions q ON q.id = a.question_id WHERE a.response_id = ?').all(req.params.id);
  answers.forEach(a => { try { a.value = JSON.parse(a.value); } catch { } });
  res.json({ ...response, answers });
});

module.exports = router;
