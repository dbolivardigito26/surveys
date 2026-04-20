const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const { getDb } = require('../db');
const { JWT_SECRET, authMiddleware } = require('../middleware/auth');

const router = express.Router();

router.post('/login', (req, res) => {
  const db = getDb();
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email y contraseña requeridos' });

  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
  if (!user) return res.status(401).json({ error: 'Credenciales incorrectas' });

  const valid = bcrypt.compareSync(password, user.password_hash);
  if (!valid) return res.status(401).json({ error: 'Credenciales incorrectas' });

  const token = jwt.sign(
    { id: user.id, email: user.email, name: user.name, role: user.role, position: user.position, area: user.area },
    JWT_SECRET, { expiresIn: '8h' }
  );
  res.json({ token, user: { id: user.id, email: user.email, name: user.name, role: user.role, position: user.position, area: user.area } });
});

router.get('/me', authMiddleware, (req, res) => {
  res.json(req.user);
});

// List all users
router.get('/users', authMiddleware, (req, res) => {
  const db = getDb();
  const users = db.prepare('SELECT id, email, name, role, position, area, created_at FROM users ORDER BY created_at ASC').all();
  res.json(users);
});

// Create user
router.post('/users', authMiddleware, (req, res) => {
  const db = getDb();
  const { email, password, name, role, position, area } = req.body;
  if (!email || !password || !name) return res.status(400).json({ error: 'Email, nombre y contraseña son obligatorios' });
  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
  if (existing) return res.status(409).json({ error: 'Ya existe un usuario con ese email' });
  const hash = bcrypt.hashSync(password, 10);
  const id = uuidv4();
  db.prepare('INSERT INTO users (id, email, password_hash, name, role, position, area) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .run(id, email.toLowerCase().trim(), hash, name, role || 'admin', position || null, area || null);
  res.status(201).json({ id, email, name, role: role || 'admin', position: position || null, area: area || null });
});

// Update user (name, position, area, role)
router.put('/users/:id', authMiddleware, (req, res) => {
  const db = getDb();
  const { name, role, position, area } = req.body;
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
  if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });
  db.prepare('UPDATE users SET name = ?, role = ?, position = ?, area = ? WHERE id = ?')
    .run(name ?? user.name, role ?? user.role, position !== undefined ? position : user.position, area !== undefined ? area : user.area, req.params.id);
  const updated = db.prepare('SELECT id, email, name, role, position, area, created_at FROM users WHERE id = ?').get(req.params.id);
  res.json(updated);
});

// Change password
router.put('/users/:id/password', authMiddleware, (req, res) => {
  const db = getDb();
  const { password } = req.body;
  if (!password || password.length < 6) return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres' });
  const user = db.prepare('SELECT id FROM users WHERE id = ?').get(req.params.id);
  if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });
  const hash = bcrypt.hashSync(password, 10);
  db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hash, req.params.id);
  res.json({ ok: true });
});

// Bulk create users from CSV data
router.post('/users/bulk', authMiddleware, (req, res) => {
  const db = getDb();
  const { users } = req.body; // [{ name, email, password, role?, position?, area? }]
  if (!Array.isArray(users) || users.length === 0) {
    return res.status(400).json({ error: 'Se requiere un array de usuarios' });
  }

  const results = [];
  for (const u of users) {
    if (!u.email || !u.name || !u.password) {
      results.push({ email: u.email || '?', ok: false, error: 'Faltan campos obligatorios (nombre, email, contraseña)' });
      continue;
    }
    if (u.password.length < 6) {
      results.push({ email: u.email, ok: false, error: 'Contraseña debe tener mínimo 6 caracteres' });
      continue;
    }
    const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(u.email.toLowerCase().trim());
    if (existing) {
      results.push({ email: u.email, ok: false, error: 'Email ya existe' });
      continue;
    }
    try {
      const hash = bcrypt.hashSync(u.password, 10);
      const id = uuidv4();
      db.prepare('INSERT INTO users (id, email, password_hash, name, role, position, area) VALUES (?, ?, ?, ?, ?, ?, ?)')
        .run(id, u.email.toLowerCase().trim(), hash, u.name, u.role || 'viewer', u.position || null, u.area || null);
      results.push({ email: u.email, ok: true });
    } catch (e) {
      results.push({ email: u.email, ok: false, error: 'Error interno' });
    }
  }

  const created = results.filter(r => r.ok).length;
  res.status(201).json({ created, failed: results.length - created, results });
});

// Delete user
router.delete('/users/:id', authMiddleware, (req, res) => {
  const db = getDb();
  // Cannot delete yourself
  if (req.user.id === req.params.id) return res.status(400).json({ error: 'No puedes eliminar tu propio usuario' });
  db.prepare('DELETE FROM users WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// Get list of unique positions (for filters)
router.get('/positions', authMiddleware, (req, res) => {
  const db = getDb();
  const rows = db.prepare(`
    SELECT DISTINCT position FROM users WHERE position IS NOT NULL AND position != ''
    UNION
    SELECT DISTINCT position FROM wave_participants WHERE position IS NOT NULL AND position != ''
    ORDER BY position ASC
  `).all();
  res.json(rows.map(r => r.position));
});

// Get list of unique areas (for filters)
router.get('/areas', authMiddleware, (req, res) => {
  const db = getDb();
  const rows = db.prepare(`
    SELECT DISTINCT area FROM users WHERE area IS NOT NULL AND area != ''
    ORDER BY area ASC
  `).all();
  res.json(rows.map(r => r.area));
});

module.exports = router;
