const express = require('express');
const cors = require('cors');

function createApp() {
  const app = express();

  const allowedOrigins = [
    'http://localhost:5173',
    'http://localhost:4173',
    ...(process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : []),
  ];

  app.use(cors({
    origin: (origin, cb) => {
      if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
      cb(new Error(`CORS bloqueado para: ${origin}`));
    },
    credentials: true,
  }));

  app.use(express.json({ limit: '10mb' }));

  app.use('/api/auth', require('./routes/auth'));
  app.use('/api/surveys', require('./routes/surveys'));
  app.use('/api/waves', require('./routes/waves'));
  app.use('/api/responses', require('./routes/responses'));
  app.use('/api/analytics', require('./routes/analytics'));
  app.use('/api/participants', require('./routes/participants'));

  app.get('/api/health', (req, res) => res.json({ ok: true, env: process.env.NODE_ENV }));

  return app;
}

module.exports = createApp;
