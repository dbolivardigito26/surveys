const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { getDb } = require('../db');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

const VALID_TYPES = ['individual', 'waves', 'continuous'];

router.get('/', authMiddleware, (req, res) => {
  const db = getDb();
  const surveys = db.prepare(`
    SELECT s.id, s.title, s.description, s.anonymous, s.measurement_type, s.created_by, s.created_at,
      u.name as creator_name,
      (SELECT COUNT(*) FROM waves w WHERE w.survey_id = s.id) as wave_count
    FROM surveys s
    LEFT JOIN users u ON u.id = s.created_by
    ORDER BY s.created_at DESC
  `).all();
  res.json(surveys);
});

router.get('/:id', authMiddleware, (req, res) => {
  const db = getDb();
  const survey = db.prepare('SELECT * FROM surveys WHERE id = ?').get(req.params.id);
  if (!survey) return res.status(404).json({ error: 'No encontrada' });
  const questions = db.prepare('SELECT * FROM questions WHERE survey_id = ? ORDER BY order_index').all(req.params.id);
  questions.forEach(q => { if (q.options) q.options = JSON.parse(q.options); });
  res.json({ ...survey, questions });
});

router.post('/', authMiddleware, (req, res) => {
  const db = getDb();
  const { title, description, anonymous, measurement_type, questions } = req.body;
  if (!title) return res.status(400).json({ error: 'Título requerido' });
  const mtype = VALID_TYPES.includes(measurement_type) ? measurement_type : 'waves';
  const id = uuidv4();
  db.prepare('INSERT INTO surveys (id, title, description, anonymous, measurement_type, created_by) VALUES (?, ?, ?, ?, ?, ?)')
    .run(id, title, description || '', anonymous ? 1 : 0, mtype, req.user.id);

  if (questions && questions.length > 0) {
    const insertQ = db.prepare('INSERT INTO questions (id, survey_id, type, text, options, required, order_index) VALUES (?, ?, ?, ?, ?, ?, ?)');
    questions.forEach((q, i) => {
      insertQ.run(uuidv4(), id, q.type, q.text, q.options ? JSON.stringify(q.options) : null, q.required ? 1 : 0, i);
    });
  }

  // For continuous: auto-create a permanent open wave
  if (mtype === 'continuous') {
    const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') + '-' + Math.random().toString(36).slice(2, 7);
    db.prepare('INSERT INTO waves (id, survey_id, name, slug, status) VALUES (?, ?, ?, ?, ?)')
      .run(uuidv4(), id, 'Medición continua', slug, 'open');
  }

  const survey = db.prepare('SELECT * FROM surveys WHERE id = ?').get(id);
  const qs = db.prepare('SELECT * FROM questions WHERE survey_id = ? ORDER BY order_index').all(id);
  qs.forEach(q => { if (q.options) q.options = JSON.parse(q.options); });
  res.status(201).json({ ...survey, questions: qs });
});

router.put('/:id', authMiddleware, (req, res) => {
  const db = getDb();
  const { title, description, anonymous, measurement_type, questions } = req.body;
  const survey = db.prepare('SELECT * FROM surveys WHERE id = ?').get(req.params.id);
  if (!survey) return res.status(404).json({ error: 'No encontrada' });

  const mtype = VALID_TYPES.includes(measurement_type) ? measurement_type : survey.measurement_type;
  db.prepare('UPDATE surveys SET title = ?, description = ?, anonymous = ?, measurement_type = ? WHERE id = ?')
    .run(title || survey.title, description ?? survey.description, anonymous ? 1 : 0, mtype, req.params.id);

  if (questions) {
    db.prepare('DELETE FROM questions WHERE survey_id = ?').run(req.params.id);
    const insertQ = db.prepare('INSERT INTO questions (id, survey_id, type, text, options, required, order_index) VALUES (?, ?, ?, ?, ?, ?, ?)');
    questions.forEach((q, i) => {
      insertQ.run(q.id || uuidv4(), req.params.id, q.type, q.text, q.options ? JSON.stringify(q.options) : null, q.required ? 1 : 0, i);
    });
  }

  const updated = db.prepare('SELECT * FROM surveys WHERE id = ?').get(req.params.id);
  const qs = db.prepare('SELECT * FROM questions WHERE survey_id = ? ORDER BY order_index').all(req.params.id);
  qs.forEach(q => { if (q.options) q.options = JSON.parse(q.options); });
  res.json({ ...updated, questions: qs });
});

router.delete('/:id', authMiddleware, (req, res) => {
  const db = getDb();
  db.prepare('DELETE FROM surveys WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

module.exports = router;
