/* Native built LMS and real HTTP/DB. No mocked quiz, lesson or progress responses. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const pw = require(process.env.ALLIM_PLAYWRIGHT || 'playwright');
const base = process.env.ALLIM_TEST_URL || 'http://127.0.0.1:18643';
assert.ok(['localhost','127.0.0.1'].includes(new URL(base).hostname));
const credentials = JSON.parse(fs.readFileSync(process.env.ALLIM_TEST_CREDENTIALS));
const fixture = JSON.parse(fs.readFileSync(process.env.ALLIM_YOUTH_REPORT));
const artifacts = process.env.ALLIM_YOUTH_ARTIFACT_DIR || path.dirname(process.env.ALLIM_YOUTH_REPORT);
fs.mkdirSync(artifacts, {recursive:true});
assert.equal(fixture.fixture_course, 'allim-y1-youth-fixture');
for (const who of ['teacher','student','other']) assert.equal(credentials[who].user, `allim-youth-${who}@example.invalid`);
const source = JSON.parse(fs.readFileSync(path.join(__dirname, '../allimquran/youth_curriculum/courses.json')));
const question = source[0].chapters[0].lessons[0].questions[0];
const errors = [], checks = [];
function passed(message) { checks.push(message); console.log('PASS ' + message); }
const lessonURL = (course, number = '1-1') => `${base}/lms/courses/${course}/learn/${number}`;
async function session(browser, who, width = 1280) {
  const ctx = await browser.newContext({viewport:{width,height:900},serviceWorkers:'block'});
  const login = await ctx.request.post(base + '/api/method/login', {data:{usr:credentials[who].user,pwd:credentials[who].password}});
  assert.equal(login.status(), 200);
  const warm = await ctx.request.get(base + '/api/method/allimquran.account_storage.context');
  assert.equal((await warm.json()).message.legacy_owner, credentials[who].user);
  const page = await ctx.newPage();
  page.on('pageerror', error => errors.push(error.message));
  await page.exposeFunction('youthUnhandled', error => errors.push(error));
  await page.addInitScript(() => window.addEventListener('unhandledrejection', event => window.youthUnhandled(String(event.reason))));
  await page.goto(lessonURL(fixture.fixture_course), {waitUntil:'domcontentloaded'});
  await page.waitForFunction(() => document.querySelector('#app')?.children.length > 0);
  return {ctx,page};
}
async function call(page, method, values = {}) {
  return page.evaluate(async ({method,values}) => {
    const response = await fetch('/api/method/' + method, {method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json','X-Frappe-CSRF-Token':window.csrf_token},body:JSON.stringify(values)});
    const data = await response.json();
    return {status:response.status,message:data.message};
  }, {method,values});
}
async function lesson(page, number = 1, course = fixture.fixture_course) {
  const response = await call(page, 'lms.lms.utils.get_lesson', {course,chapter:1,lesson:number});
  assert.equal(response.status, 200); return response.message;
}
async function answer(page, option) {
  await page.getByRole('radio', {name:option,exact:true}).check();
  const checked = page.waitForResponse(response => response.url().endsWith('lms_quiz.check_answer'));
  await page.getByRole('button', {name:'Check',exact:true}).click();
  assert.equal((await checked).status(), 200);
  const submitted = page.waitForResponse(response => response.url().endsWith('lms_quiz.submit_quiz'));
  await page.getByRole('button', {name:'Submit',exact:true}).click();
  const response = await submitted;
  assert.equal(response.status(), 200); return (await response.json()).message;
}
(async () => {
  const browser = await pw.chromium.launch({headless:true,channel:'chrome'});
  try {
    const {ctx,page} = await session(browser, 'student');
    await page.getByRole('button', {name:/^(Start Quiz|Start)$/}).waitFor();
    assert.equal(await page.getByRole('button', {name:/^(Start Quiz|Start)$/}).count(), 1, 'one embedded quiz per lesson');
    const first = await lesson(page);
    assert.equal(first.name, fixture.fixture_lessons[0]);
    assert.equal(first.instructor_notes, null);
    assert.ok(!first.progress);
    assert.equal((await lesson(page, 2)).locked, 1);
    const forced = await call(page, 'lms.lms.doctype.course_lesson.course_lesson.save_progress', {course:fixture.fixture_course,lesson:fixture.fixture_lessons[0]});
    assert.equal(forced.status, 200);
    assert.ok(!(await lesson(page)).progress, 'calling progress directly cannot skip the quiz');
    assert.equal((await lesson(page, 2)).locked, 1);
    passed('ordinary student sees one quiz, no teacher notes; unanswered quiz prevents completion and the next lesson');

    await page.getByRole('button', {name:/^(Start Quiz|Start)$/}).click();
    const wrongIndex = (question.answer + 1) % question.options.length;
    const wrong = await answer(page, question.options[wrongIndex]);
    assert.equal(wrong.pass, false);
    assert.ok(!(await lesson(page)).progress);
    assert.equal((await lesson(page, 2)).locked, 1);
    passed('wrong answer is saved by the native quiz API and leaves the lesson and next lesson incomplete');

    await page.getByRole('button', {name:'Try Again',exact:true}).click();
    await page.getByRole('button', {name:/^(Start Quiz|Start)$/}).click();
    const correct = await answer(page, question.options[question.answer]);
    assert.equal(correct.pass, true);
    assert.ok((await lesson(page)).progress);
    const next = await lesson(page, 2);
    assert.equal(next.name, fixture.fixture_lessons[1]); assert.ok(!next.locked && !next.progress);
    passed('successful retry completes exactly the first lesson and unlocks the next lesson');

    await page.reload({waitUntil:'domcontentloaded'});
    assert.ok((await lesson(page)).progress);
    await page.goto(lessonURL(fixture.fixture_course, '1-2'), {waitUntil:'domcontentloaded'});
    await page.getByRole('button', {name:/^(Start Quiz|Start)$/}).waitFor();
    assert.equal(await page.getByRole('button', {name:/^(Start Quiz|Start)$/}).count(), 1);
    passed('reload retains server progress and the next lesson renders its own single quiz');

    const remote = await session(browser, 'student', 390);
    await remote.page.getByRole('button', {name:/^(Start Quiz|Start)$/}).waitFor();
    assert.ok((await lesson(remote.page)).progress);
    assert.equal((await lesson(remote.page, 2)).name, fixture.fixture_lessons[1]);
    assert.ok(await remote.page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'mobile lesson overflow');
    await remote.page.screenshot({path:path.join(artifacts,'student-mobile.png'),fullPage:true});
    passed('a clean mobile browser restores student progress from the server');

    const other = await session(browser, 'other');
    const inaccessible = await call(other.page, 'lms.lms.utils.get_quiz_with_questions', {quiz:fixture.fixture_quizzes[0]});
    assert.equal(inaccessible.status, 403);
    assert.equal((await lesson(other.page)).no_preview, 1);
    for (const draft of fixture.draft_courses) {
      const hidden = await lesson(other.page, 1, draft);
      assert.ok(hidden.no_preview || hidden.redirect_to || hidden.locked, 'unpublished course is inaccessible to an ordinary learner');
    }
    passed('a different student cannot access the quiz or imported drafts without enrollment');

    const teacher = await session(browser, 'teacher');
    await teacher.page.goto(lessonURL(fixture.draft_courses[0]), {waitUntil:'domcontentloaded'});
    await teacher.page.getByRole('button', {name:/^(Start Quiz|Start)$/}).waitFor();
    const preview = await lesson(teacher.page, 1, fixture.draft_courses[0]);
    assert.ok(preview.body.includes('{{ Quiz(') && preview.instructor_notes);
    assert.equal(await teacher.page.getByRole('button', {name:/^(Start Quiz|Start)$/}).count(), 1);
    await teacher.page.screenshot({path:path.join(artifacts,'teacher-draft.png'),fullPage:true});
    passed('the instructor can review an unpublished original lesson and its embedded quiz');

    assert.deepEqual(errors, [], 'unhandled browser errors');
    for (const current of [teacher,other,remote,{ctx}]) await current.ctx.close();
    if (process.env.ALLIM_YOUTH_BROWSER_OUTPUT) fs.writeFileSync(process.env.ALLIM_YOUTH_BROWSER_OUTPUT, JSON.stringify({checks,unhandled_errors:errors},null,2)+'\n');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
