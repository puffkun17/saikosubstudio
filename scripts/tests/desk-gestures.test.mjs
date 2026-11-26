import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadCore } from './_compile.mjs';

const core = loadCore();
const DG = core('core/deskGestures');

test('isEditableKeyboardTarget: input, textarea, select, and contenteditable are guarded', () => {
  assert.equal(DG.isEditableKeyboardTarget({ tagName: 'INPUT' }), true);
  assert.equal(DG.isEditableKeyboardTarget({ tagName: 'textarea' }), true);
  assert.equal(DG.isEditableKeyboardTarget({ tagName: 'SELECT' }), true);
  assert.equal(DG.isEditableKeyboardTarget({ tagName: 'DIV', isContentEditable: true }), true);
});

test('isEditableKeyboardTarget: ordinary elements and missing targets are not guarded', () => {
  assert.equal(DG.isEditableKeyboardTarget(null), false);
  assert.equal(DG.isEditableKeyboardTarget(undefined), false);
  assert.equal(DG.isEditableKeyboardTarget({ tagName: 'DIV' }), false);
  assert.equal(DG.isEditableKeyboardTarget({ tagName: 'BUTTON' }), false);
  assert.equal(DG.isEditableKeyboardTarget({ tagName: 'A' }), false);
});

test('recordShakeMove: ordinary travel and small jitters do not organize', () => {
  const state = DG.createShakeTracker();
  let now = 1_000;
  assert.equal(DG.recordShakeMove(state, 0, now), 'none');
  now += 16;
  assert.equal(DG.recordShakeMove(state, 400, now), 'none');
  now += 16;
  // 20px twitch back and forth is below SHAKE_MIN_STROKE_PX
  assert.equal(DG.recordShakeMove(state, 380, now), 'none');
  now += 16;
  assert.equal(DG.recordShakeMove(state, 400, now), 'none');
  now += 16;
  assert.equal(DG.recordShakeMove(state, 380, now), 'none');
});

test('recordShakeMove: three long reversals inside the window trigger, two only cue', () => {
  const state = DG.createShakeTracker();
  let now = 5_000;
  const step = (x) => {
    now += 40;
    return DG.recordShakeMove(state, x, now);
  };
  assert.equal(step(0), 'none');
  assert.equal(step(80), 'none');
  assert.equal(step(0), 'none'); // first counted reversal
  assert.equal(step(80), 'cue'); // second
  assert.equal(step(0), 'trigger'); // third
});

test('recordShakeMove: reversals outside the window do not accumulate to a trigger', () => {
  const state = DG.createShakeTracker();
  let now = 8_000;
  const step = (x, dt) => {
    now += dt;
    return DG.recordShakeMove(state, x, now);
  };
  assert.equal(step(0, 0), 'none');
  assert.equal(step(80, 40), 'none');
  assert.equal(step(0, 40), 'none');
  assert.equal(step(80, 40), 'cue');
  // Gap longer than SHAKE_WINDOW_MS drops earlier reversals
  assert.equal(step(0, DG.SHAKE_WINDOW_MS + 40), 'none');
});
