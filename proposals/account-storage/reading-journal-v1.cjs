/* Extracted from GRAISS's PR #1 at f94fb7f.
 * Preparation only: legacy v1 validation and page accounting, no browser integration.
 * Letter fields remain accepted for compatibility; reward calculations and UI are excluded.
 * See ../../docs/account-storage/selection.json for provenance and scope. */
'use strict';

const TOTAL = 604;
const fresh = () => ({ version: 1, past: 0, cycle: 1, deadline: '', entries: [] });
const integer = (n, lo, hi) => Number.isInteger(n) && n >= lo && n <= hi;
const validDate = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value+'T12:00:00Z')) && new Date(value+'T12:00:00Z').toISOString().slice(0,10) === value;
function validate(book) {
  if (!book || book.version !== 1 || !integer(book.past, 0, 100000) || !integer(book.cycle, 1, 100000) || !Array.isArray(book.entries)) throw Error('invalid');
  if (typeof book.deadline !== 'string' || (book.deadline && !validDate(book.deadline))) throw Error('invalid');
  const ids = new Set();
  book.entries.forEach(e => {
    if (!e || typeof e.id !== 'string' || ids.has(e.id) || !integer(e.cycle, 1, book.cycle) || !validDate(e.date) || !['paper', 'digital', 'mic'].includes(e.source) || !Array.isArray(e.parts) || !e.parts.length) throw Error('invalid');
    ids.add(e.id);
    e.parts.forEach(p => {
      if (!integer(p.page, 1, TOTAL) || typeof p.full !== 'boolean' || !(p.letters === null || integer(p.letters, 0, 100000)) || !Array.isArray(p.keys) || !p.keys.every(k => /^\d+:\d+:\d+$/.test(k)) || !integer(p.total, 0, 1000) || (!p.full && (!p.total || !p.keys.length || p.keys.length > p.total))) throw Error('invalid');
    });
  });
  return book;
}
function summary(book, today) {
  const cycles = new Map(); let volume = 0, todayVolume = 0;
  book.entries.forEach(e => {
    if (!cycles.has(e.cycle)) cycles.set(e.cycle, new Map());
    const pages = cycles.get(e.cycle);
    e.parts.forEach(p => {
      if (!pages.has(p.page)) pages.set(p.page, { full: false, keys: new Set(), total: p.total });
      const covered = pages.get(p.page);
      covered.full = covered.full || p.full;
      covered.total = Math.max(covered.total, p.total);
      p.keys.forEach(k => covered.keys.add(k));
      const amount = p.full ? 1 : p.keys.length / p.total;
      volume += amount; if (e.date === today) todayVolume += amount;
    });
  });
  const count = pages => !pages ? 0 : Array.from(pages.values()).reduce((n, p) => n + (p.full ? 1 : Math.min(1, p.keys.size / p.total)), 0);
  const current = count(cycles.get(book.cycle));
  const completed = Array.from(cycles.values()).filter(p => count(p) >= TOTAL).length;
  const fullPages = Array.from((cycles.get(book.cycle) || new Map()).values()).filter(p => p.full || p.keys.size >= p.total).length;
  return { current, fullPages, percent: current / TOTAL * 100, completed, lifetime: book.past + completed, volume, todayVolume };
}

module.exports = { fresh, validate, summary };
