const { initDb } = require('../backend/src/db');
const createApp = require('../backend/src/app');

let app;
let initError;

const ready = initDb()
  .then(() => { app = createApp(); })
  .catch(err => {
    initError = err;
    console.error('DB init failed:', err);
  });

module.exports = async (req, res) => {
  await ready;
  if (initError) {
    return res.status(500).json({
      error: 'DB init failed',
      message: initError.message,
    });
  }
  return app(req, res);
};
