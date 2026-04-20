const express = require('express');
const { getDb } = require('../db');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

function computeStats(values, qType, totalResponses) {
  let stats = {};
  if (['multiple_choice', 'yes_no'].includes(qType)) {
    const counts = {};
    values.forEach(v => { counts[v] = (counts[v] || 0) + 1; });
    stats = { type: 'distribution', counts, total: values.length };
  } else if (qType === 'multiple_select') {
    const counts = {};
    values.forEach(v => {
      const arr = Array.isArray(v) ? v : [v];
      arr.forEach(item => { counts[item] = (counts[item] || 0) + 1; });
    });
    stats = { type: 'distribution', counts, total: values.length };
  } else if (['likert', 'nps', 'rating'].includes(qType)) {
    const nums = values.map(Number).filter(n => !isNaN(n));
    const avg = nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : 0;
    const counts = {};
    nums.forEach(v => { counts[v] = (counts[v] || 0) + 1; });
    let nps = null;
    if (qType === 'nps') {
      const promoters = nums.filter(n => n >= 9).length;
      const detractors = nums.filter(n => n <= 6).length;
      nps = nums.length ? Math.round(((promoters - detractors) / nums.length) * 100) : 0;
    }
    stats = { type: 'numeric', avg: Math.round(avg * 100) / 100, counts, total: nums.length, nps };
  } else if (qType === 'ranking') {
    const scoreMap = {};
    values.forEach(v => {
      const arr = Array.isArray(v) ? v : [v];
      arr.forEach((item, idx) => {
        if (!scoreMap[item]) scoreMap[item] = { totalScore: 0, count: 0 };
        scoreMap[item].totalScore += arr.length - idx;
        scoreMap[item].count += 1;
      });
    });
    const ranked = Object.entries(scoreMap)
      .map(([item, s]) => ({ item, avgScore: Math.round((s.totalScore / s.count) * 100) / 100 }))
      .sort((a, b) => b.avgScore - a.avgScore);
    stats = { type: 'ranking', ranked, total: values.length };
  } else {
    stats = { type: 'text', responses: values.filter(v => v && String(v).trim()).slice(0, 100), total: values.length };
  }
  return stats;
}

function getWaveStats(waveId, positionFilter = null) {
  const db = getDb();
  const wave = db.prepare('SELECT * FROM waves WHERE id = ?').get(waveId);
  if (!wave) return null;

  const survey = db.prepare('SELECT * FROM surveys WHERE id = ?').get(wave.survey_id);
  const questions = db.prepare('SELECT * FROM questions WHERE survey_id = ? ORDER BY order_index').all(wave.survey_id);
  questions.forEach(q => { if (q.options) q.options = JSON.parse(q.options); });

  // Base query with optional position filter via participant join
  const positionClause = positionFilter
    ? `AND EXISTS (SELECT 1 FROM wave_participants p WHERE p.response_id = r.id AND p.position = '${positionFilter.replace(/'/g, "''")}')`
    : '';

  const totalResponses = parseInt(db.prepare(`
    SELECT COUNT(*) as count FROM responses r
    WHERE r.wave_id = ? AND r.completed_at IS NOT NULL ${positionClause}
  `).get(waveId).count || 0);

  const totalParticipants = positionFilter
    ? parseInt(db.prepare(`SELECT COUNT(*) as count FROM wave_participants WHERE wave_id = ? AND position = ?`).get(waveId, positionFilter).count || 0)
    : parseInt(db.prepare(`SELECT COUNT(*) as count FROM wave_participants WHERE wave_id = ?`).get(waveId).count || 0);

  const participationRate = totalParticipants > 0 ? Math.round((totalResponses / totalParticipants) * 100) : null;

  // Available positions for this wave
  const availablePositions = db.prepare(`
    SELECT DISTINCT position FROM wave_participants
    WHERE wave_id = ? AND position IS NOT NULL AND position != ''
    ORDER BY position ASC
  `).all(waveId).map(r => r.position);

  const questionStats = questions.map(q => {
    const answers = db.prepare(`
      SELECT a.value FROM answers a
      JOIN responses r ON r.id = a.response_id
      WHERE a.question_id = ? AND r.wave_id = ? AND r.completed_at IS NOT NULL ${positionClause}
    `).all(q.id, waveId);

    const values = answers.map(a => {
      try { return JSON.parse(a.value); } catch { return a.value; }
    });

    const stats = computeStats(values, q.type, totalResponses);
    return { question: q, stats, answered: values.length, skipped: totalResponses - values.length };
  });

  return { wave, survey, totalResponses, totalParticipants, participationRate, availablePositions, questionStats };
}

// Single wave analytics (supports ?position= filter)
router.get('/wave/:waveId', authMiddleware, (req, res) => {
  const position = req.query.position || null;
  const stats = getWaveStats(req.params.waveId, position);
  if (!stats) return res.status(404).json({ error: 'Oleada no encontrada' });
  res.json(stats);
});

// Compare waves (supports position filter, returns newest first)
router.post('/compare', authMiddleware, (req, res) => {
  const { wave_ids, position } = req.body;
  if (!wave_ids || !Array.isArray(wave_ids) || wave_ids.length < 2) {
    return res.status(400).json({ error: 'Se necesitan al menos 2 oleadas para comparar' });
  }

  const results = wave_ids.map(id => getWaveStats(id, position || null)).filter(Boolean);
  if (results.length === 0) return res.status(404).json({ error: 'No se encontraron oleadas' });

  // Sort newest first
  results.sort((a, b) => new Date(b.wave.created_at).getTime() - new Date(a.wave.created_at).getTime());

  const questions = results[0].questionStats.map(qs => qs.question);
  const comparison = questions.map(q => {
    const waveData = results.map(r => {
      const qs = r.questionStats.find(s => s.question.id === q.id);
      return { wave: r.wave, stats: qs?.stats || null, answered: qs?.answered || 0 };
    });
    return { question: q, waveData };
  });

  // Collect all available positions across all waves
  const allPositions = [...new Set(results.flatMap(r => r.availablePositions))].sort();

  res.json({
    waves: results.map(r => ({
      wave: r.wave,
      totalResponses: r.totalResponses,
      totalParticipants: r.totalParticipants,
      participationRate: r.participationRate
    })),
    comparison,
    availablePositions: allPositions
  });
});

// ─── Continuous measurement analytics ────────────────────────────────────────
// GET /analytics/continuous/:surveyId?groupBy=day|week|month&from=YYYY-MM-DD&to=YYYY-MM-DD&position=
router.get('/continuous/:surveyId', authMiddleware, (req, res) => {
  const db = getDb();
  const { groupBy = 'week', from, to, position } = req.query;

  const survey = db.prepare('SELECT * FROM surveys WHERE id = ?').get(req.params.surveyId);
  if (!survey) return res.status(404).json({ error: 'Encuesta no encontrada' });
  if (survey.measurement_type !== 'continuous') return res.status(400).json({ error: 'Solo para encuestas de medición continua' });

  const wave = db.prepare('SELECT * FROM waves WHERE survey_id = ? LIMIT 1').get(req.params.surveyId);
  if (!wave) return res.status(404).json({ error: 'Sin oleada continua' });

  const questions = db.prepare('SELECT * FROM questions WHERE survey_id = ? ORDER BY order_index').all(req.params.surveyId);
  questions.forEach(q => { if (q.options) q.options = JSON.parse(q.options); });

  // SQLite strftime format per groupBy
  const fmtMap = { day: '%Y-%m-%d', week: '%Y-%W', month: '%Y-%m' };
  const fmt = fmtMap[groupBy] || '%Y-%W';

  // Date range filter
  const dateClause = [
    from ? `AND r.completed_at >= '${from}'` : '',
    to   ? `AND r.completed_at <= '${to} 23:59:59'` : '',
  ].join(' ');

  const posClause = position
    ? `AND EXISTS (SELECT 1 FROM wave_participants p WHERE p.response_id = r.id AND p.position = '${position.replace(/'/g,"''")}')`
    : '';

  // All periods with at least one response
  const periodRows = db.prepare(`
    SELECT strftime('${fmt}', r.completed_at) as period, COUNT(*) as count
    FROM responses r
    WHERE r.wave_id = ? AND r.completed_at IS NOT NULL ${dateClause} ${posClause}
    GROUP BY period ORDER BY period ASC
  `).all(wave.id);

  // Label formatter helpers
  function periodLabel(p) {
    if (groupBy === 'day') return p;
    if (groupBy === 'month') { const [y, m] = p.split('-'); const mn = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']; return `${mn[parseInt(m)-1]} ${y}`; }
    if (groupBy === 'week') { const [y, w] = p.split('-'); return `Sem ${parseInt(w)} · ${y}`; }
    return p;
  }

  // Per-question trend: for each question compute stats per period
  const questionTrends = questions.map(q => {
    const periodStats = periodRows.map(pr => {
      const answers = db.prepare(`
        SELECT a.value FROM answers a
        JOIN responses r ON r.id = a.response_id
        WHERE a.question_id = ? AND r.wave_id = ?
          AND strftime('${fmt}', r.completed_at) = ?
          AND r.completed_at IS NOT NULL ${dateClause} ${posClause}
      `).all(q.id, wave.id, pr.period);

      const values = answers.map(a => { try { return JSON.parse(a.value); } catch { return a.value; } });
      const stats = computeStats(values, q.type, parseInt(pr.count));
      return { period: pr.period, label: periodLabel(pr.period), responses: parseInt(pr.count), stats };
    });
    return { question: q, periodStats };
  });

  // Available positions for filter
  const availablePositions = db.prepare(`
    SELECT DISTINCT position FROM wave_participants
    WHERE wave_id = ? AND position IS NOT NULL AND position != ''
    ORDER BY position ASC
  `).all(wave.id).map(r => r.position);

  // Date range of responses (for the range picker)
  const dateRange = db.prepare(`
    SELECT MIN(date(completed_at)) as minDate, MAX(date(completed_at)) as maxDate
    FROM responses WHERE wave_id = ? AND completed_at IS NOT NULL
  `).get(wave.id);

  res.json({
    survey,
    wave,
    groupBy,
    periods: periodRows.map(p => ({ ...p, label: periodLabel(p.period) })),
    questionTrends,
    availablePositions,
    dateRange
  });
});

// Survey overview — newest first
router.get('/survey/:surveyId', authMiddleware, (req, res) => {
  const db = getDb();
  const waves = db.prepare('SELECT * FROM waves WHERE survey_id = ? ORDER BY created_at DESC').all(req.params.surveyId);
  const summary = waves.map(w => {
    const totalResponses = parseInt(db.prepare('SELECT COUNT(*) as count FROM responses WHERE wave_id = ? AND completed_at IS NOT NULL').get(w.id).count || 0);
    const totalParticipants = parseInt(db.prepare('SELECT COUNT(*) as count FROM wave_participants WHERE wave_id = ?').get(w.id).count || 0);
    const participationRate = totalParticipants > 0 ? Math.round((totalResponses / totalParticipants) * 100) : null;
    return { wave: w, totalResponses, totalParticipants, participationRate };
  });
  res.json(summary);
});

module.exports = router;
