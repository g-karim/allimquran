/* Word-sequence assessment, NOT acoustic pronunciation/tajwid verification.
   Pure functions shared by the Companion and offline regression tests. */
(function (root, factory) {
  var api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.AllimRecitation = api;
}(typeof window === "object" ? window : this, function () {
  "use strict";

  function raw(word) { return String(typeof word === "string" ? word : word && word.ar || ""); }

  function letters(word, expandSmallAlif) {
    return raw(word).normalize("NFKC")
      .replace(/\u0640/g, "")
      .replace(/\u0670/g, expandSmallAlif ? "ا" : "")
      .replace(/[\u0610-\u061A\u064B-\u065F\u06D6-\u06ED]/g, "")
      .replace(/ٱ/g, "ا")
      .replace(/[^\u0621-\u063A\u0641-\u064A]/g, "");
  }

  function tokens(text) {
    return raw(text).normalize("NFKC").replace(/[،؛؟.!?\u06DD\u06DE\u06E9\d٠-٩]/g, " ")
      .split(/\s+/).filter(function (word) { return /[\p{L}]/u.test(word); });
  }

  function distance(a, b) {
    var previous = Array.from({ length: b.length + 1 }, function (_, i) { return i; });
    for (var i = 1; i <= a.length; i += 1) {
      var current = [i];
      for (var j = 1; j <= b.length; j += 1) {
        current[j] = Math.min(current[j - 1] + 1, previous[j] + 1,
          previous[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      }
      previous = current;
    }
    return previous[b.length];
  }

  function similarity(a, b) {
    a = letters(a); b = letters(b);
    return a && b ? 1 - distance(a, b) / Math.max(a.length, b.length) : 0;
  }

  function vowelClusters(word) {
    return (raw(word).normalize("NFKC").replace(/\u0640/g, "")
      .match(/[\u0621-\u063A\u0641-\u064Aٱ][\u064B-\u065F\u0670\u06D6-\u06ED]*/g) || [])
      .map(function (cluster) { return (cluster.match(/[\u064B-\u0650\u0652]/g) || []).sort().join(""); });
  }

  function compare(expected, heard) {
    var a = letters(expected), b = letters(heard);
    // Only documented orthographic equivalence. Never collapse different consonants
    // (ة/ه, ؤ/و, ئ/ي), nor use edit distance to accept a word.
    var same = a && b && (a === b || letters(expected, true) === letters(heard, true));
    if (same) {
      var av = vowelClusters(expected), bv = vowelClusters(heard);
      if (av.length === bv.length && av.some(function (vowel, i) { return vowel && bv[i] && vowel !== bv[i]; })) {
        return "warning"; // Contradictory ASR diacritics, not proof of a spoken vowel error.
      }
      return "recognized"; // Word spelling only; missing diacritics never prove pronunciation.
    }
    return similarity(expected, heard) >= 0.5 ? "warning" : "error";
  }

  function summarize(statuses, extras, isFinal, repeats, corrections) {
    var count = function (status) { return statuses.filter(function (item) { return item === status; }).length; };
    var matched = count("recognized"), warnings = count("warning"), errors = count("error");
    extras = Number(extras) || 0;
    var complete = Boolean(isFinal) && statuses.length > 0 && matched === statuses.length && extras === 0;
    return { statuses: statuses.slice(), matched: matched, warnings: warnings, errors: errors,
      extras: extras, repeats: repeats || 0, corrections: corrections || 0,
      score: matched * 4 - warnings - errors * 2 - extras * 2,
      complete: complete, assessment: "word_sequence_only", pronunciationVerified: false,
      outcome: complete ? "matched" : (isFinal && (errors || extras) ? "mismatch" : "uncertain") };
  }

  function align(expectedWords, transcript, isFinal) {
    var expected = expectedWords.map(raw), heard = tokens(transcript);
    // Bound untrusted recognizer output before allocating a quadratic table.
    if (!heard.length || expected.length > 256 || heard.length > 512) {
      return summarize(expected.map(function () { return "pending"; }), 0, false);
    }
    var rows = expected.length + 1, columns = heard.length + 1;
    var costs = Array.from({ length: rows }, function () { return Array(columns).fill(Infinity); });
    var moves = Array.from({ length: rows }, function () { return Array(columns).fill(null); });
    var comparisons = expected.map(function (word) { return heard.map(function (token) { return compare(word, token); }); });
    var i, j;
    costs[0][0] = 0;
    for (i = 1; i < rows; i += 1) { costs[i][0] = i; moves[i][0] = ["delete", 1]; }
    for (j = 1; j < columns; j += 1) { costs[0][j] = j; moves[0][j] = ["insert", 1]; }
    for (i = 1; i < rows; i += 1) {
      for (j = 1; j < columns; j += 1) {
        var status = comparisons[i - 1][j - 1];
        costs[i][j] = costs[i - 1][j - 1] + (status === "recognized" ? 0 : status === "warning" ? 0.75 : 1.25);
        moves[i][j] = ["substitute", 1];
        function offer(cost, move, length) {
          if (cost < costs[i][j]) { costs[i][j] = cost; moves[i][j] = [move, length]; }
        }
        offer(costs[i - 1][j] + 1, "delete", 1);
        offer(costs[i][j - 1] + 1, "insert", 1);
        // ASR may omit a space. Only an exact concatenation can credit both words;
        // phonetic guesses such as dropping a nun are deliberately not accepted.
        if (i >= 2 && compare(expected[i - 2] + expected[i - 1], heard[j - 1]) === "recognized") {
          offer(costs[i - 2][j - 1], "join", 1);
        }
        // An immediate exact repetition of an already aligned word/phrase is a
        // restart, not an arbitrary extra. Required Quran repetitions remain required.
        for (var length = 1; length <= Math.min(i, Math.floor(j / 2), 32); length += 1) {
          var repeated = true;
          for (var k = 0; k < length; k += 1) {
            if (comparisons[i - length + k][j - length + k] !== "recognized" ||
                comparisons[i - length + k][j - 2 * length + k] !== "recognized") { repeated = false; break; }
          }
          if (repeated) offer(costs[i][j - length] + 0.1, "repeat", length);
        }
        // A nearby wrong word followed immediately by its exact correction. Do
        // not consume another expected word this way: that could hide reordering.
        if (j >= 2 && status === "recognized" && comparisons[i - 1][j - 2] === "warning" &&
            !expected.some(function (_, e) { return comparisons[e][j - 2] === "recognized"; })) {
          offer(costs[i - 1][j - 2] + 0.35, "correction", 2);
        }
      }
    }
    var statuses = expected.map(function () { return "pending"; });
    var extras = 0, repeats = 0, corrections = 0;
    i = expected.length; j = heard.length;
    while (i > 0 || j > 0) {
      var move = moves[i][j];
      if (move[0] === "repeat") { repeats += move[1]; j -= move[1]; }
      else if (move[0] === "join") { statuses[--i] = "recognized"; statuses[--i] = "recognized"; j -= 1; }
      else if (move[0] === "correction") { statuses[--i] = "recognized"; j -= 2; corrections += 1; }
      else if (move[0] === "substitute") {
        statuses[i - 1] = isFinal ? comparisons[i - 1][j - 1] : "pending";
        i -= 1; j -= 1;
      } else if (move[0] === "delete") { statuses[--i] = isFinal ? "error" : "pending"; }
      else { extras += 1; j -= 1; }
    }
    // No interim path, including repetitions/corrections, may commit progress.
    if (!isFinal) statuses = statuses.map(function () { return "pending"; });
    return summarize(statuses, extras, isFinal, repeats, corrections);
  }

  function chooseTranscript(event) {
    var texts = [], finalResult = Boolean(event.results.length);
    for (var i = 0; i < event.results.length; i += 1) {
      var result = event.results[i];
      if (!result.isFinal) finalResult = false;
      // Preserve the provider's ordering. Expected text must not rerank hypotheses.
      if (result.length && result[0]) texts.push(String(result[0].transcript || ""));
    }
    return { transcript: texts.join(" ").trim(), isFinal: finalResult };
  }

  function alignCorrection(expected, transcript, previous, isFinal, requireFullVerse) {
    var full = align(expected, transcript, isFinal);
    if (full.complete || requireFullVerse) return full;
    var start = previous.findIndex(function (status) { return status !== "recognized"; });
    if (start < 0) return full;
    var heard = tokens(transcript);
    // A retry may include the exact already-confirmed prefix, but never discard
    // arbitrary mismatching words before the requested correction.
    if (start > 0 && heard.length > start && expected.slice(0, start).every(function (word, i) {
      return compare(word, heard[i]) === "recognized";
    })) heard = heard.slice(start);
    var tail = align(expected.slice(start), heard.join(" "), isFinal);
    return summarize(previous.slice(0, start).concat(tail.statuses), tail.extras,
      isFinal, tail.repeats, tail.corrections);
  }

  function parseResponse(data) {
    if (!data || typeof data.transcript !== "string") throw new Error("invalid-asr-response");
    if (data.status === "no_speech") return { transcript: "", issue: "no-speech" };
    if (data.status === "uncertain") return {
      transcript: typeof data.preview_transcript === "string" ? data.preview_transcript : data.transcript,
      issue: "uncertain"
    };
    if (data.status && data.status !== "transcribed") throw new Error("invalid-asr-status");
    // A legacy server's empty response could be a swallowed exception, not silence.
    if (!data.transcript.trim()) return { transcript: "", issue: "uncertain" };
    return { transcript: data.transcript.trim(), issue: null };
  }

  return { align: align, alignCorrection: alignCorrection, compare: compare, summarize: summarize, tokens: tokens,
    chooseTranscript: chooseTranscript, parseResponse: parseResponse };
}));
