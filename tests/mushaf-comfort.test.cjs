/* Exercise the installed reader source, rather than a second preview implementation. */
const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const app = fs.readFileSync(path.join(__dirname, '../allimquran/website_content/pages/learn/javascript.js'), 'utf8');
const progress = require('../allimquran/public/js/account-progress.js');
function fn(name) {
  const start = app.indexOf('  function ' + name + '(');
  assert.ok(start >= 0, name);
  const end = app.indexOf('\n  function ', start + 10);
  return app.slice(start, end < 0 ? undefined : end);
}
function env(width = 390, records = []) {
  const controls = Object.fromEntries(['mushaf-size-down','mushaf-size-up','mushaf-size-value'].map(id => [id, {}]));
  const defaults = {mushafLayout:width <= 620 ? 'adaptive' : 'page', mushafTextSize:36};
  const state = progress.compose({scope:'account:a:e',records,device:{},legacy:{}}, defaults);
  let saved;
  const context = {state, Number, Math, String,
    saveState:() => { saved = progress.diff(defaults, state); },
    window:{requestAnimationFrame:f => f()},
    document:{getElementById:id => controls[id], querySelectorAll:() => []},
    formatMetric:String, fitMushafLines:() => {}
  };
  vm.createContext(context);
  for (const name of ['getMushafReadingPreferences','applyMushafReadingLayout','refreshMushafReadingLayout','changeMushafReadingPreferences']) vm.runInContext(fn(name), context);
  return {context, controls, saved:() => saved};
}
test('responsive defaults, server choices, size limits and writes use the account bridge', () => {
  assert.equal(env().context.getMushafReadingPreferences().layout, 'adaptive');
  assert.equal(env(1280).context.getMushafReadingPreferences().layout, 'page');
  const e = env(390, [{kind:'preference',id:'mushaf_text_size',value:{selected:40}}]);
  e.context.changeMushafReadingPreferences('adaptive', 2);
  assert.equal(e.context.state.mushafTextSize, 42);
  assert.equal(e.saved().find(row => row.id === 'mushaf_text_size').value.selected, 42);
  e.context.changeMushafReadingPreferences('adaptive', 100);
  e.context.applyMushafReadingLayout(null);
  assert.equal(e.context.state.mushafTextSize, 52); assert.equal(e.controls['mushaf-size-up'].disabled, true);
  e.context.changeMushafReadingPreferences('adaptive', -100);
  e.context.applyMushafReadingLayout(null);
  assert.equal(e.context.state.mushafTextSize, 28); assert.equal(e.controls['mushaf-size-down'].disabled, true);
});
test('changing layout keeps exact Unicode text and page glyphs on all four fixtures', () => {
  for (const page of [1,2,3,604]) {
    const words = JSON.parse(fs.readFileSync(path.join(__dirname, `fixtures/mushaf-comfort/page-${page}.json`))).verses.flatMap(v => v.words);
    assert.ok(words.every(word => typeof word.text_qpc_hafs === 'string' && word.text_qpc_hafs.length));
    const nodes = words.map(word => {
      const attrs = {'data-readable-text':word.text_qpc_hafs};
      return {textContent:word.code_v1,hasAttribute:key => key in attrs,getAttribute:key => attrs[key],setAttribute:(key,value) => { attrs[key] = value; }};
    });
    const container = {setAttribute(){},style:{setProperty(){}},querySelectorAll:() => nodes};
    const {context} = env();
    for (const layout of ['adaptive','page','adaptive']) {
      context.state.mushafLayout = layout; context.applyMushafReadingLayout(container);
      assert.deepEqual(nodes.map(n => n.textContent), words.map(w => layout === 'adaptive' ? w.text_qpc_hafs : w.code_v1));
    }
  }
});
test('vertical gestures, pinch zoom and adaptive scrolling never turn pages', () => {
  const events = {}, moves = [];
  const c = {window:{visualViewport:{scale:1}},getMushafReadingPreferences:() => ({layout:'page'}),document:{getElementById:() => ({addEventListener:(name,handler) => { events[name] = handler; }})},mushafSwipeStart:null,navigateMushafPage:direction => moves.push(direction)};
  const start = app.indexOf('    var mushafPage = document.getElementById("mushaf-page");');
  const end = app.indexOf('    document.getElementById("mushaf-font-select").addEventListener', start);
  vm.createContext(c); vm.runInContext(app.slice(start, end), c);
  const touch = (x,y) => ({clientX:x,clientY:y});
  events.touchstart({touches:[touch(200,100)]}); events.touchstart({touches:[touch(200,100),touch(230,100)]}); events.touchend({touches:[],changedTouches:[touch(100,100)]});
  events.touchstart({touches:[touch(200,100)]}); events.touchend({touches:[],changedTouches:[touch(120,250)]});
  c.window.visualViewport.scale = 2;
  events.touchstart({touches:[touch(200,100)]}); events.touchend({touches:[],changedTouches:[touch(100,100)]});
  assert.equal(moves.length, 0);
  c.window.visualViewport.scale = 1;
  events.touchstart({touches:[touch(200,100)]}); events.touchend({touches:[],changedTouches:[touch(100,100)]});
  assert.deepEqual(moves, [1]);
  c.getMushafReadingPreferences = () => ({layout:'adaptive'});
  events.touchstart({touches:[touch(200,100)]}); events.touchend({touches:[],changedTouches:[touch(100,100)]});
  assert.deepEqual(moves, [1]);
});
test('Enter followed by blur loads a page once, preserving a subsequent size-change anchor', () => {
  const handlers = {}, loads = [];
  const c = {Number,mushafPageNumber:2,document:{getElementById:() => ({addEventListener:(name,handler) => { handlers[name] = handler; }})}};
  c.loadMushafPage = value => { c.mushafPageNumber = Number(value); loads.push(Number(value)); };
  const start = app.indexOf('    document.getElementById("mushaf-page-number").addEventListener("change"');
  const end = app.indexOf('    var mushafPage = document.getElementById("mushaf-page");', start);
  assert.ok(start >= 0 && end > start);
  vm.createContext(c); vm.runInContext(app.slice(start, end), c);
  let prevented = false;
  const event = {key:'Enter',target:{value:'3'},preventDefault:() => { prevented = true; }};
  handlers.keydown(event); handlers.change(event);
  assert.equal(prevented, true); assert.deepEqual(loads, [3]);
  handlers.change({target:{value:'4'}}); assert.deepEqual(loads, [3,4]);
});
test('late replies and failed navigation never activate a stale verse; retry loads the failed page', async () => {
  const resolvers = [], rendered = [], activated = [], controls = {}, listeners = [];
  for (const id of ['mushaf-page','mushaf-page-number','mushaf-prev-page','mushaf-next-page','ayah-wrap']) controls[id] = {appendChild(){}};
  const c = {Math,Number,String,Promise,Array,mushafPageRequest:0,mushafPageNumber:2,mushafPageVerses:[{verse_key:'old'}],state:{mushafFont:'classic',language:'en'},document:{getElementById:id => controls[id],createElement:() => ({appendChild(){},addEventListener:(name,handler) => listeners.push(handler)})},window:{fetch:() => new Promise(resolve => resolvers.push(resolve))},loadMushafFont:() => Promise.resolve({}),loadMushafChapterNames:() => Promise.resolve({}),renderMushafPage:data => rendered.push(data.page),showToast(){},formatText(){},t:key => key,activateMushafVerse:v => activated.push(v)};
  vm.createContext(c); vm.runInContext(fn('loadMushafPage') + fn('navigateMushafPage'), c);
  const old = c.loadMushafPage(2,false), current = c.loadMushafPage(3,false);
  resolvers[1]({ok:true,json:async () => ({page:3})}); assert.equal(await current, true);
  resolvers[0]({ok:true,json:async () => ({page:2})}); assert.equal(await old, undefined); assert.deepEqual(rendered, [3]);
  c.navigateMushafPage(1); resolvers[2]({ok:false}); await new Promise(resolve => setImmediate(resolve));
  assert.equal(activated.length, 0);
  assert.equal(listeners.length, 1); listeners[0]();
  resolvers[3]({ok:true,json:async () => ({page:4})}); await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(rendered, [3,4]);
});
