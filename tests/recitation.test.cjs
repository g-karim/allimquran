const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');

const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'allimquran/website_content/pages/learn/javascript.js'), 'utf8');
const corePath = path.join(root, 'allimquran/public/js/recitation-core.js');

// Execute the shipped functions, not copies of the implementation. No DOM or microphone required.
function load(names, overrides = {}) {
  const context = vm.createContext({
    state: { recognitionMode: 'auto', strictCorrection: true },
    window: { AllimRecitation: fs.existsSync(corePath) ? require(corePath) : undefined },
    autoServerFallback: false,
    quranAsrAvailable: true,
    browserRecognitionSupported: () => true,
    quranRecognitionSupported: () => true,
    getEffectiveRecognitionMode: () => 'browser',
    currentWords: [],
    ...overrides,
  });
  for (const name of names) {
    const start = source.indexOf('  function ' + name + '(');
    assert.notEqual(start, -1, name);
    const end = source.indexOf('\n  function ', start + 1);
    vm.runInContext(source.slice(start, end < 0 ? undefined : end), context);
  }
  return context;
}

const alignmentFunctions = ['alignExpectedWords'];
function align(expected, transcript, final = true) {
  return load(alignmentFunctions).alignExpectedWords(expected.split(' '), transcript, final);
}

test('correct words match without requiring ASR to supply diacritics', () => {
  assert.equal(align('بِسْمِ اللَّهِ الرَّحْمَنِ الرَّحِيمِ', 'بسم الله الرحمن الرحيم').complete, true);
});
test('a different letter is never accepted merely because it is similar', () => {
  for (const [expected, heard] of [['نستعين', 'نستغين'], ['نعبد', 'تعبد']]) {
    assert.equal(align(expected, heard).complete, false, expected);
  }
});
test('explicit conflicting vowels cannot earn a word match', () => {
  assert.equal(align('أَنْعَمْتَ', 'أَنْعَمْتُ').complete, false);
});
test('extras at the beginning, middle and end prevent completion', () => {
  const expected = 'بسم الله الرحمن الرحيم';
  for (const heard of ['زيادة ' + expected, 'بسم زيادة الله الرحمن الرحيم', expected + ' زيادة']) {
    assert.equal(align(expected, heard).complete, false, heard);
  }
});
test('missing words and wrong order prevent completion', () => {
  assert.equal(align('بسم الله الرحمن الرحيم', 'بسم الرحمن الرحيم').complete, false);
  assert.equal(align('بسم الله الرحمن الرحيم', 'الله بسم الرحمن الرحيم').complete, false);
});
test('interim hypotheses never complete a verse', () => {
  assert.equal(align('بسم الله', 'بسم الله', false).complete, false);
});
test('choose the recognizer top hypothesis, not the one closest to the Quran', () => {
  const context = load([...alignmentFunctions, 'chooseBestTranscript'], { currentWords: ['نستعين'] });
  const result = Object.assign([
    { transcript: 'نستغفر', confidence: 0.9 },
    { transcript: 'نستعين', confidence: 0.1 },
  ], { isFinal: true });
  assert.equal(context.chooseBestTranscript({ results: [result] }).transcript, 'نستغفر');
});
test('auto mode falls back when the browser API exists but fails', () => {
  const context = load(['canAutoFallbackToServer']);
  assert.equal(context.canAutoFallbackToServer('network'), true);
  assert.equal(context.canAutoFallbackToServer('start-failed'), true);
  assert.equal(context.canAutoFallbackToServer('not-allowed'), false);
  assert.equal(context.canAutoFallbackToServer('no-speech'), false);
  context.autoServerFallback = true;
  assert.equal(context.canAutoFallbackToServer('network'), false);
});

module.exports = { load, alignmentFunctions, align };

const core = require(corePath);
test('explicit uncertainty and text scope are part of the result', () => {
  const result = align('نستعين', 'نستغين');
  assert.equal(result.outcome, 'uncertain');
  assert.equal(result.assessment, 'word_sequence_only');
  assert.equal(result.pronunciationVerified, false);
  assert.equal(result.matched, 0);
});
test('text matches never claim acoustic pronunciation verification', () => {
  assert.equal(align('بسم الله', 'بسم الله').pronunciationVerified, false);
});
test('empty text is uncertain rather than a list of reading errors', () => {
  const result = align('بسم الله', '');
  assert.equal(result.outcome, 'uncertain');
  assert.equal(result.errors, 0);
});
test('word and phrase repetitions are allowed but not lost', () => {
  const expected = 'بسم الله الرحمن الرحيم';
  for (const [heard, repeats] of [
    ['بسم بسم الله الرحمن الرحيم', 1],
    ['بسم الله بسم الله الرحمن الرحيم', 2],
    [expected + ' ' + expected, 4],
  ]) {
    const result = align(expected, heard);
    assert.equal(result.complete, true, heard);
    assert.equal(result.repeats, repeats);
  }
});
test('required repeated words cannot be omitted', () => {
  assert.equal(align('نعبد نعبد', 'نعبد').complete, false);
});
test('an immediate correction is tracked instead of an unexplained extra', () => {
  const result = align('إياك نعبد وإياك نستعين', 'إياك تعبد نعبد وإياك نستعين');
  assert.equal(result.complete, true);
  assert.equal(result.corrections, 1);
});
test('reordering is not disguised as a self-correction', () => {
  assert.equal(align('نعبد نستعين', 'نستعين نعبد نستعين').complete, false);
});
test('interim corrections and repeats never commit any recognized words', () => {
  for (const heard of ['نستغين نستعين', 'نستعين نستعين']) {
    const result = align('نستعين', heard, false);
    assert.equal(result.complete, false);
    assert.equal(result.matched, 0);
  }
});
test('non-Arabic extra words are not silently discarded', () => {
  assert.equal(align('بسم الله', 'بسم الله hello').complete, false);
});
test('small alif, presentation forms, tatweel and wasla are spelling equivalents', () => {
  for (const [expected, heard] of [['الرَّحْمَٰنِ', 'الرحمان'], ['اللَّه', 'ﷲ'], ['ٱللَّه', 'الله'], ['بسم', 'بـسم']]) {
    assert.equal(align(expected, heard).complete, true, expected);
  }
});
test('different consonants are not merged by spelling normalization', () => {
  for (const [expected, heard] of [['رحمة', 'رحمه'], ['سأل', 'سال'], ['يؤمن', 'يومن'], ['نعبد', 'تعبد']]) {
    assert.equal(align(expected, heard).complete, false, expected);
  }
});
test('an unverified final vowel or stop is uncertain, not a pronunciation verdict', () => {
  assert.equal(align('الرَّحِيمِ', 'الرَّحِيمْ').outcome, 'uncertain');
});
test('hostile long hypotheses are bounded and never credited', () => {
  assert.equal(align('بسم الله', 'الله '.repeat(600)).complete, false);
});
test('punctuation and verse markers do not count as spoken extras', () => {
  assert.equal(align('بسم الله', 'بسم، الله ۝ ١').complete, true);
});
test('an exact joined spelling can match, but a guessed dropped consonant cannot', () => {
  assert.equal(align('بسم الله', 'بسمالله').complete, true);
  assert.equal(align('من ربهم', 'مربهم').complete, false);
  assert.equal(align('بسم الله', 'بسمالله', false).matched, 0);
});
test('a vowel conflict cannot be hidden by joining words', () => {
  assert.equal(align('أَنْعَمْتَ عَلَيْهِمْ', 'أَنْعَمْتُعَلَيْهِمْ').complete, false);
});
test('a correction retry cannot discard a wrong leading word', () => {
  const result = core.alignCorrection(['بسم', 'الله'], 'زيادة الله', ['recognized', 'error'], true, false);
  assert.equal(result.complete, false);
  assert.equal(result.extras, 1);
});
test('a retry can include the confirmed prefix or only the requested tail', () => {
  for (const heard of ['الله الرحمن الرحيم', 'بسم الله الرحمن الرحيم']) {
    const result = core.alignCorrection('بسم الله الرحمن الرحيم'.split(' '), heard,
      ['recognized', 'error', 'recognized', 'recognized'], true, false);
    assert.equal(result.complete, true, heard);
  }
});
test('extras require a full verse retry and are not cleared by one correct word', () => {
  const result = core.alignCorrection(['بسم', 'الله'], 'الله', ['recognized', 'recognized'], true, true);
  assert.equal(result.complete, false);
});
test('hypothesis selection respects finality across every result', () => {
  const results = [Object.assign([{ transcript: 'بسم' }], { isFinal: true }),
    Object.assign([{ transcript: 'الله' }], { isFinal: false })];
  assert.deepEqual(core.chooseTranscript({ results }), { transcript: 'بسم الله', isFinal: false });
});
test('API silence, uncertainty, legacy emptiness and invalid responses are distinct', () => {
  assert.equal(core.parseResponse({ transcript: '', status: 'no_speech' }).issue, 'no-speech');
  assert.equal(core.parseResponse({ transcript: 'بسم', status: 'uncertain' }).issue, 'uncertain');
  assert.deepEqual(core.parseResponse({ transcript: '', preview_transcript: 'بسم', status: 'uncertain' }),
    { transcript: 'بسم', issue: 'uncertain' });
  assert.equal(core.parseResponse({ transcript: '' }).issue, 'uncertain');
  assert.equal(core.parseResponse({ transcript: 'بسم', status: 'transcribed' }).issue, null);
  assert.throws(() => core.parseResponse({ transcript: null }));
  assert.throws(() => core.parseResponse({ transcript: 'بسم', status: 'failed' }));
});
test('explicit browser mode does not silently change engines', () => {
  const context = load(['canAutoFallbackToServer'], { state: { recognitionMode: 'browser' } });
  assert.equal(context.canAutoFallbackToServer('network'), false);
});

function submissionHarness() {
  const requests = [], timers = new Map(), applied = [], errors = [];
  let timerId = 0;
  const element = { textContent: '', disabled: false };
  const context = load(['setRecognitionControlsDisabled', 'readQuranAsrResponse', 'submitQuranAudio'], {
    FormData, Blob, contribution: null,
    window: { AllimRecitation: core, AbortController,
      setTimeout: fn => { timers.set(++timerId, fn); return timerId; },
      clearTimeout: id => timers.delete(id),
      fetch: (_url, options) => new Promise((resolve, reject) => requests.push({ resolve, reject, options })),
    },
    document: { getElementById: () => element },
    recognitionRequestId: 1, currentSurah: { id: 1 }, currentVerse: { ayah: 1 },
    quranSubmitController: null, quranSubmitTimer: null, quranSubmitting: false,
    correctionLocked: false, continuousFailureCount: 0, continuousSessionActive: false,
    userStoppedRecognition: false, clearContinuousRestart: () => {},
    setRecognitionStatus: (...args) => errors.push(args), setRecognitionButton: () => {},
    handleRecognitionError: code => errors.push(code), t: key => key,
    applyTranscript: text => { applied.push(text); return core.align(['بسم', 'الله'], text, true); },
    recordRecognitionSession: () => {}, queueContinuousRestart: () => {},
    showQuranSubmissionError: error => errors.push(error.message),
  });
  return { context, requests, timers, applied, errors,
    submit: () => context.submitQuranAudio(new Blob(['audio']), 'audio/webm'),
    respond: (index, data = { transcript: 'بسم الله', verse_key: '1:1', status: 'transcribed' }) => {
      requests[index].resolve({ ok: true, json: () => Promise.resolve(data) });
    },
  };
}
test('a late response cannot assess a different verse', async () => {
  const h = submissionHarness(), task = h.submit();
  h.context.currentVerse = { ayah: 2 };
  h.respond(0); await task;
  assert.equal(h.applied.length, 0);
});
test('a canceled response cannot credit progress even if fetch already resolved', async () => {
  const h = submissionHarness(), task = h.submit();
  h.context.quranSubmitController.abort();
  h.context.quranSubmitController = null;
  h.respond(0); await task;
  assert.equal(h.applied.length, 0);
});
test('an older response cannot replace or clean up a newer submission', async () => {
  const h = submissionHarness(), old = h.submit(), newer = h.submit();
  h.respond(0); await old;
  assert.equal(h.applied.length, 0);
  assert.equal(h.context.quranSubmitting, true);
  h.respond(1); await newer;
  assert.equal(h.applied.length, 1);
  assert.equal(h.context.quranSubmitting, false);
  assert.equal(h.timers.size, 0);
});
test('server uncertainty cannot become a successful alignment', async () => {
  const h = submissionHarness(), task = h.submit();
  h.respond(0, { transcript: 'بسم الله', verse_key: '1:1', status: 'uncertain' });
  await task;
  assert.equal(h.applied.length, 0);
  assert.equal(h.context.quranSubmitting, false);
});
test('a mismatched response verse is an error, not a successful alignment', async () => {
  const h = submissionHarness(), task = h.submit();
  h.respond(0, { transcript: 'بسم الله', verse_key: '1:2', status: 'transcribed' });
  await task;
  assert.equal(h.applied.length, 0);
  assert.ok(h.errors.includes('stale-asr-verse'));
});
test('processing failure never becomes no-speech', async () => {
  const h = submissionHarness(), task = h.submit();
  h.requests[0].resolve({ ok: false, status: 503, json: () => Promise.resolve({ detail: { code: 'asr_failed' } }) });
  await task;
  assert.equal(h.applied.length, 0);
  assert.ok(h.errors.includes('quran-asr-unavailable'));
  assert.ok(!h.errors.includes('no-speech'));
});
