const express = require('express');
const cors = require('cors');

function createApp() {
  const app = express();

  const extraOrigins = process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : [];

  app.use(cors({
    origin: (origin, cb) => {
      if (!origin) return cb(null, true);                                          // curl / mobile
      if (/^https?:\/\/localhost(:\d+)?$/.test(origin)) return cb(null, true);    // local dev
      if (/^https:\/\/[a-zA-Z0-9-]+\.vercel\.app$/.test(origin)) return cb(null, true); // vercel.app (prod + preview)
      if (extraOrigins.includes(origin)) return cb(null, true);                   // dominios custom
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
