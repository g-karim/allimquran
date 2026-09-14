"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const { fresh, validate, summary } = require("../proposals/account-storage/reading-journal-v1.cjs");

const today = "2026-09-14";
const full = page => ({ page, full: true, total: 0, keys: [], letters: null });
const entry = (id, parts, cycle = 1, date = today) => ({ id, date, cycle, source: "paper", parts });

test("a new journal starts empty and independent of another journal", () => {
  const first = fresh();
  first.entries.push(entry("first", [full(1)]));
  assert.equal(summary(fresh(), today).current, 0);
  assert.equal(summary(first, today).current, 1);
});

test("reading ten pages twice advances the khatm by ten and reading volume by twenty", () => {
  const pages = Array.from({ length: 10 }, (_, i) => full(i + 1));
  const book = { ...fresh(), entries: [entry("first", pages), entry("repeat", pages)] };
  validate(book);
  const result = summary(book, today);
  assert.equal(result.current, 10);
  assert.equal(result.fullPages, 10);
  assert.equal(result.volume, 20);
  assert.equal(result.todayVolume, 20);
  assert.equal(result.completed, 0);
});

test("overlapping partial pages count unique coverage and keep repeated volume", () => {
  const half = { page: 1, full: false, total: 4, keys: ["1:1:1", "1:1:2"], letters: null };
  const book = { ...fresh(), entries: [entry("first", [half]), entry("repeat", [half])] };
  assert.equal(summary(book, today).current, 0.5);
  assert.equal(summary(book, today).volume, 1);
  assert.equal(summary(book, today).fullPages, 0);
  book.entries.push(entry("remainder", [{ ...half, keys: ["1:1:3", "1:1:4"] }]));
  assert.equal(summary(book, today).current, 1);
  assert.equal(summary(book, today).fullPages, 1);
  book.entries.push(entry("whole-page-repeat", [full(1)]));
  assert.equal(summary(book, today).current, 1);
  assert.equal(summary(book, today).volume, 2.5);
});

test("all 604 pages complete a khatm; a new cycle preserves completed and past khatms", () => {
  const pages = Array.from({ length: 604 }, (_, i) => full(i + 1));
  const book = { ...fresh(), past: 3, entries: [entry("all-pages", pages)] };
  assert.equal(summary(book, today).completed, 1);
  assert.equal(summary(book, today).lifetime, 4);
  book.cycle = 2;
  assert.equal(summary(book, today).current, 0);
  assert.equal(summary(book, today).lifetime, 4);
  book.entries.push(entry("next-cycle", [full(1)], 2));
  assert.equal(summary(book, today).current, 1);
});

test("removing the last reading recalculates progress without changing earlier readings", () => {
  const book = { ...fresh(), entries: [entry("first", [full(1)]), entry("second", [full(2)])] };
  assert.equal(summary(book, today).current, 2);
  book.entries.pop();
  assert.equal(summary(book, today).current, 1);
  assert.equal(summary(book, today).volume, 1);
});

test("today's volume excludes earlier days without losing lifetime coverage", () => {
  const book = { ...fresh(), entries: [entry("earlier", [full(1)], 1, "2026-09-13")] };
  assert.equal(summary(book, today).todayVolume, 0);
  assert.equal(summary(book, today).current, 1);
});

test("legacy backups survive JSON round trips and letter metadata does not affect coverage", () => {
  const book = { ...fresh(), entries: [entry("with-metadata", [{ ...full(1), letters: 123 }])] };
  const restored = validate(JSON.parse(JSON.stringify(book)));
  assert.deepEqual(restored, book);
  assert.equal(summary(restored, today).current, 1);
  assert.equal(summary(restored, today).volume, 1);
});

test("invalid dates, page ranges and repeated entry IDs are rejected", () => {
  assert.throws(() => validate({ ...fresh(), deadline: "2026-02-30" }));
  assert.throws(() => validate({ ...fresh(), past: -1 }));
  assert.throws(() => validate({ ...fresh(), entries: [entry("range", [full(605)])] }));
  const reading = entry("duplicate", [full(1)]);
  assert.throws(() => validate({ ...fresh(), entries: [reading, reading] }));
});
