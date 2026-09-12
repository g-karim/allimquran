"use strict";

const fs = require("fs");
const path = require("path");

const source = fs.readFileSync(path.resolve(__dirname, "..", "app.js"), "utf8");

function extractFunction(name) {
  const start = source.indexOf("function " + name + "(");
  if (start < 0) throw new Error("Missing function: " + name);
  const braceStart = source.indexOf("{", start);
  let depth = 0;
  let quote = "";
  let escaped = false;
  for (let index = braceStart; index < source.length; index += 1) {
    const char = source[index];
    if (quote) {
      if (escaped) escaped = false;
      else if (char === "\\") escaped = true;
      else if (char === quote) quote = "";
      continue;
    }
    if (char === "\"" || char === "'" || char === "`") { quote = char; continue; }
    if (char === "{") depth += 1;
    if (char === "}") depth -= 1;
    if (depth === 0) return source.slice(start, index + 1);
  }
  throw new Error("Unclosed function: " + name);
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

var LINKED_33_TARGET = 33;
var state = { heartMushaf: { turkishWallPages: {} } };
const getHeartPageVerseKeys = eval("(" + extractFunction("getHeartPageVerseKeys") + ")");
const normalizeTurkishWallPage = eval("(" + extractFunction("normalizeTurkishWallPage") + ")");
const getTurkishWallPageUnit = eval("(" + extractFunction("getTurkishWallPageUnit") + ")");
const buildTurkishWallTasks = eval("(" + extractFunction("buildTurkishWallTasks") + ")");
const getTurkishWallPageSummary = eval("(" + extractFunction("getTurkishWallPageSummary") + ")");

const pageData = {
  page: 10,
  verses: ["1:1", "1:2", "1:3", "1:4", "1:5", "1:6"].map((verse_key) => ({ verse_key }))
};
const page = getTurkishWallPageUnit(10);
let summary = getTurkishWallPageSummary(pageData);
const expected = [
  "verse:1:6:foundation",
  "verse:1:4:jump",
  "verse:1:5:gap",
  "segment:1:4:wall",
  "verse:1:2:jump",
  "verse:1:3:gap",
  "segment:1:2:wall",
  "verse:1:1:foundation",
  "segment:1:1:wall"
];
assert(summary.tasks.map((task) => [task.type, task.key, task.role].join(":")).join("|") === expected.join("|"), "Builds bottom foundation, skip, gap and connected-wall sequence");
assert(summary.currentTask.key === "1:6" && summary.currentTask.role === "foundation", "Starts from the bottom verse");

for (const task of summary.tasks) {
  if (task.type === "verse") page.verseCounts[task.key] = 33;
  else page.wallCounts[task.key] = 33;
  summary = getTurkishWallPageSummary(pageData);
}
assert(summary.complete && summary.currentTask === null, "Completes only after every brick and wall reaches 33");
assert(summary.repetitions === expected.length * 33 && summary.percent === 100, "Counts every task in total progress");

const singleData = { page: 49, verses: [{ verse_key: "2:282" }] };
const singlePage = getTurkishWallPageUnit(49);
let single = getTurkishWallPageSummary(singleData);
assert(single.tasks.length === 2 && single.tasks[1].key === "__page__", "A one-verse page still has a separate complete-page reading");
singlePage.verseCounts["2:282"] = 33;
singlePage.wallCounts.__page__ = 33;
single = getTurkishWallPageSummary(singleData);
assert(single.complete && single.repetitions === 66, "One-verse page completes after 66 accepted readings");

console.log("turkish wall sequence ok: bottom-up skip, fill and connected wall");
