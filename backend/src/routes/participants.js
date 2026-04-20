const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { getDb } = require('../db');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

// Get all positions with user counts (for role selector)
router.get('/roles', authMiddleware, (req, res) => {
  const db = getDb();
  const roles = db.prepare(`
    SELECT position, COUNT(*) as user_count
    FROM users
    WHERE position IS NOT NULL AND position != ''
    GROUP BY position
    ORDER BY position ASC
  `).all();
  res.json(roles);
});

// Add all users of a position as wave participants
router.post('/:waveId/from-role', authMiddleware, (req, res) => {
  const db = getDb();
  const { position } = req.body;
  if (!position) return res.status(400).json({ error: 'Se requiere el puesto/rol' });

  const wave = db.prepare('SELECT * FROM waves WHERE id = ?').get(req.params.waveId);
  if (!wave) return res.status(404).json({ error: 'Oleada no encontrada' });

  const users = db.prepare('SELECT * FROM users WHERE position = ?').all(position);
  if (users.length === 0) return res.status(404).json({ error: 'No hay usuarios con ese puesto' });

  const insert = db.prepare('INSERT OR IGNORE INTO wave_participants (id, wave_id, email, name, position, token) VALUES (?, ?, ?, ?, ?, ?)');
  const added = [];

  for (const u of users) {
    const existing = db.prepare('SELECT id FROM wave_participants WHERE wave_id = ? AND email = ?').get(req.params.waveId, u.email);
    if (existing) continue;
    const id = uuidv4();
    const token = uuidv4().replace(/-/g, '');
    insert.run(id, req.params.waveId, u.email, u.name || null, u.position || null, token);
    added.push({ id, email: u.email, name: u.name, position: u.position, token });
  }

  res.status(201).json({ added: added.length, total: users.length, participants: added });
});

// List participants for a wave
router.get('/:waveId', authMiddleware, (req, res) => {
  const db = getDb();
  const participants = db.prepare(`
    SELECT p.*, r.completed_at as responded_at
    FROM wave_participants p
    LEFT JOIN responses r ON r.id = p.response_id
    WHERE p.wave_id = ?
    ORDER BY p.invited_at ASC
  `).all(req.params.waveId);
  res.json(participants);
});

// Add participants (array of emails/names)
router.post('/:waveId', authMiddleware, (req, res) => {
  const db = getDb();
  const { participants } = req.body; // [{ email, name? }]
  if (!Array.isArray(participants) || participants.length === 0) {
    return res.status(400).json({ error: 'Se requiere un array de participantes' });
  }

  const wave = db.prepare('SELECT * FROM waves WHERE id = ?').get(req.params.waveId);
  if (!wave) return res.status(404).json({ error: 'Oleada no encontrada' });

  const insert = db.prepare('INSERT OR IGNORE INTO wave_participants (id, wave_id, email, name, position, token) VALUES (?, ?, ?, ?, ?, ?)');
  const added = [];

  for (const p of participants) {
    if (!p.email || !p.email.includes('@')) continue;
    const existing = db.prepare('SELECT id FROM wave_participants WHERE wave_id = ? AND email = ?').get(req.params.waveId, p.email.toLowerCase().trim());
    if (existing) continue;
    const id = uuidv4();
    const token = uuidv4().replace(/-/g, '');
    insert.run(id, req.params.waveId, p.email.toLowerCase().trim(), p.name || null, p.position || null, token);
    added.push({ id, email: p.email, name: p.name || null, position: p.position || null, token });
  }

  res.status(201).json({ added: added.length, participants: added });
});

// Delete participant
router.delete('/:waveId/:participantId', authMiddleware, (req, res) => {
  const db = getDb();
  db.prepare('DELETE FROM wave_participants WHERE id = ? AND wave_id = ?').run(req.params.participantId, req.params.waveId);
  res.json({ ok: true });
});

// PUBLIC: validate token and get participant info
router.get('/token/:token', (req, res) => {
  const db = getDb();
  const p = db.prepare('SELECT * FROM wave_participants WHERE token = ?').get(req.params.token);
  if (!p) return res.status(404).json({ error: 'Token inválido' });
  if (p.response_id) return res.status(409).json({ error: 'Ya respondiste esta encuesta' });
  res.json({ email: p.email, name: p.name, wave_id: p.wave_id });
});

module.exports = router;
