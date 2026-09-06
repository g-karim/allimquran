// Evaluate the exact production matching core, without DOM or external requests.
const fs = require('node:fs');
const core = require('../public/js/recitation-core.js');
const rows = JSON.parse(fs.readFileSync(0, 'utf8'));
const results = rows.map(row => {
  if (row.response.status === 'error') return { id: row.id, outcome: 'technical_error' };
  try {
    const parsed = core.parseResponse(row.response);
    if (parsed.issue) return { id: row.id, outcome: 'uncertain', reason: parsed.issue };
    return { id: row.id, ...core.align(row.expected_words, parsed.transcript, true) };
  } catch {
    return { id: row.id, outcome: 'technical_error', reason: 'invalid_response' };
  }
});
process.stdout.write(JSON.stringify(results));
