const { initDb } = require('../backend/src/db');
const createApp = require('../backend/src/app');

let app;
const ready = initDb()
  .then(() => { app = createApp(); })
  .catch(err => { console.error('DB init failed:', err); });

module.exports = async (req, res) => {
  await ready;
  return app(req, res);
};
