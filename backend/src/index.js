const path = require('path');
const { initDb } = require('./db');
const createApp = require('./app');

async function start() {
  await initDb();

  const app = createApp();

  // Serve frontend static files in production (non-Vercel deployments)
  if (process.env.NODE_ENV === 'production') {
    const express = require('express');
    const distPath = path.join(__dirname, '../../frontend/dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      if (!req.path.startsWith('/api')) {
        res.sendFile(path.join(distPath, 'index.html'));
      }
    });
  }

  const PORT = process.env.PORT || 3060;
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Backend corriendo en http://0.0.0.0:${PORT} [${process.env.NODE_ENV || 'development'}]`);
  });
}

start().catch(err => {
  console.error('Error al iniciar:', err);
  process.exit(1);
});
