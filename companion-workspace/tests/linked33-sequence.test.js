"use strict";

const fs = require("fs");
const path = require("path");

const appPath = path.resolve(__dirname, "..", "app.js");
const source = fs.readFileSync(appPath, "utf8");

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
    if (char === "\"" || char === "'" || char === "`") {
      quote = char;
      continue;
    }
    if (char === "{") depth += 1;
    if (char === "}") depth -= 1;
    if (depth === 0) return source.slice(start, index + 1);
  }

  throw new Error("Unclosed function: " + name);
}

var LINKED_33_TARGET = 33;
var state = { heartMushaf: { linked33Pages: {} } };

const getHeartPageVerseKeys = eval("(" + extractFunction("getHeartPageVerseKeys") + ")");
const normalizeLinked33Page = eval("(" + extractFunction("normalizeLinked33Page") + ")");
const getLinked33PageUnit = eval("(" + extractFunction("getLinked33PageUnit") + ")");
const getLinked33PageSummary = eval("(" + extractFunction("getLinked33PageSummary") + ")");

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const pageData = {
  page: 1,
  verses: [
    { verse_key: "1:1" },
    { verse_key: "1:2" },
    { verse_key: "1:3" }
  ]
};
const page = getLinked33PageUnit(1);
let summary = getLinked33PageSummary(pageData);
assert(summary.currentTask.type === "verse" && summary.currentTask.key === "1:1", "Starts with the first verse");

page.verseCounts["1:1"] = 33;
summary = getLinked33PageSummary(pageData);
assert(summary.currentTask.type === "verse" && summary.currentTask.key === "1:2", "Moves to the second verse");

page.verseCounts["1:2"] = 33;
summary = getLinked33PageSummary(pageData);
assert(summary.currentTask.type === "segment" && summary.currentTask.key === "1:2", "Links verses 1 and 2");
assert(summary.currentTask.keys.join(",") === "1:1,1:2", "The first linked passage contains both verses");

page.segmentCounts["1:2"] = 33;
summary = getLinked33PageSummary(pageData);
assert(summary.currentTask.type === "verse" && summary.currentTask.key === "1:3", "Moves to the third verse after the first link");

page.verseCounts["1:3"] = 33;
summary = getLinked33PageSummary(pageData);
assert(summary.currentTask.type === "segment" && summary.currentTask.isPage, "The final linked step is the complete page");
assert(summary.currentTask.keys.join(",") === "1:1,1:2,1:3", "The complete-page step contains every verse");

page.segmentCounts["1:3"] = 32;
summary = getLinked33PageSummary(pageData);
assert(!summary.complete && summary.currentTask.count === 32, "The page remains incomplete at 32 readings");

page.segmentCounts["1:3"] = 33;
summary = getLinked33PageSummary(pageData);
assert(summary.complete && summary.currentTask === null, "The page completes exactly at 33 readings");
assert(summary.repetitions === 165 && summary.possible === 165 && summary.percent === 100, "All five steps contribute to page progress");

const singleVersePageData = { page: 49, verses: [{ verse_key: "2:282" }] };
const singleVersePage = getLinked33PageUnit(49);
let singleSummary = getLinked33PageSummary(singleVersePageData);
assert(singleSummary.currentTask.type === "verse", "A one-verse page starts with its verse step");

singleVersePage.verseCounts["2:282"] = 33;
singleSummary = getLinked33PageSummary(singleVersePageData);
assert(singleSummary.currentTask.type === "segment" && singleSummary.currentTask.isPage, "A one-verse page still requires a separate complete-page step");
assert(singleSummary.currentTask.key === "__page__", "The one-verse complete-page counter is stored separately");

singleVersePage.segmentCounts.__page__ = 33;
singleSummary = getLinked33PageSummary(singleVersePageData);
assert(singleSummary.complete && singleSummary.repetitions === 66 && singleSummary.possible === 66, "A one-verse page completes only after verse×33 and page×33");

console.log("linked33 sequence ok, including the separate complete-page step for a one-verse page");
