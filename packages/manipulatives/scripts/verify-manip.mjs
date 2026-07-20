/**
 * verify-engine.mjs — headless verification of @bingoo/explainer against the REAL
 * engine (no test runner, no deps, NO demo lessons). Drives every registered
 * manipulative through its own render() and asserts the hard engine contracts:
 *   • registry integrity   — every kit in MANIPULATIVES is resolvable by kind
 *   • dual-aspect          — valid, NaN-free prims at 16:9 AND 9:16
 *   • determinism          — render(t) is a pure function of t (bit-identical)
 *   • math-by-code         — base10 / placevalue / money values are computed
 *   • verb surface         — every kit exposes callable verbs
 *
 * Run: node --import ./scripts/ts-hook.mjs scripts/verify-engine.mjs
 */
import { MANIPULATIVES, manipulativeKinds, getManipulative } from '../src/index';
import { value as base10Value } from '../src/base10';
import { pvValue } from '../src/placevalue';
import { moneyTotal } from '../src/money';

let passed = 0;
let failed = 0;
const fails = [];
function ok(name, cond, detail = '') {
  if (cond) passed++;
  else {
    failed++;
    fails.push(`${name}${detail ? ' — ' + detail : ''}`);
  }
}

/** Walk any value and return the path to the first non-finite number, or null. */
function firstBadNumber(obj, at = '') {
  if (typeof obj === 'number') return Number.isFinite(obj) ? null : at || '(root)';
  if (Array.isArray(obj)) {
    for (let i = 0; i < obj.length; i++) {
      const bad = firstBadNumber(obj[i], `${at}[${i}]`);
      if (bad) return bad;
    }
    return null;
  }
  if (obj && typeof obj === 'object') {
    for (const k of Object.keys(obj)) {
      const bad = firstBadNumber(obj[k], at ? `${at}.${k}` : k);
      if (bad) return bad;
    }
  }
  return null;
}

const ASPECTS = [
  { aspect: '16:9', box: { w: 1280, h: 720 } },
  { aspect: '9:16', box: { w: 720, h: 1280 } },
];
const TIMES = [0, 0.5, 1];

/* ---------------------------------------------------------- registry integrity */
const kinds = manipulativeKinds();
ok(
  'registry: kinds == MANIPULATIVES',
  kinds.length === MANIPULATIVES.length,
  `${kinds.length} vs ${MANIPULATIVES.length}`,
);
for (const m of MANIPULATIVES) {
  ok(`registry: getManipulative(${m.kind})`, getManipulative(m.kind) === m);
}

/* ---------------------------------------------- render: dual-aspect + finite + determinism */
for (const m of MANIPULATIVES) {
  try {
    const p = m.normalize(m.defaultParams);
    const state = { initial: p, final: p, schedule: [], end: 0 };
    for (const { aspect, box } of ASPECTS) {
      for (const t of TIMES) {
        const model = m.render(p, state, t, { aspect, box });
        const good =
          model &&
          Array.isArray(model.prims) &&
          model.view &&
          Number.isFinite(model.view.w) &&
          Number.isFinite(model.view.h);
        ok(`render ${m.kind} @${aspect} t=${t}: shape`, !!good);
        if (good) {
          const bad = firstBadNumber(model.prims);
          ok(`render ${m.kind} @${aspect} t=${t}: finite`, bad === null, bad ?? '');
        }
      }
      // determinism at the midpoint
      const a = JSON.stringify(m.render(p, state, 0.5, { aspect, box }).prims);
      const b = JSON.stringify(m.render(p, state, 0.5, { aspect, box }).prims);
      ok(`determinism ${m.kind} @${aspect}`, a === b);
    }
    // verb surface
    const verbs = Object.keys(m.verbs ?? {});
    ok(`verbs ${m.kind}: non-empty`, verbs.length > 0);
    ok(
      `verbs ${m.kind}: all callable`,
      verbs.every((v) => typeof m.verbs[v] === 'function'),
    );
  } catch (e) {
    ok(`render ${m.kind}: threw`, false, String(e && e.message ? e.message : e));
  }
}

/* ------------------------------------------------------------- math-by-code */
{
  const b10 = getManipulative('base10');
  ok(
    'math base10: 1H2T3O = 123',
    base10Value(b10.normalize({ hundreds: 1, tens: 2, ones: 3 })) === 123,
  );
  ok('math base10: 0 = 0', base10Value(b10.normalize({ hundreds: 0, tens: 0, ones: 0 })) === 0);

  const pv = getManipulative('placevalue');
  ok(
    'math placevalue: [1,2,3] = 123',
    pvValue(pv.normalize({ places: ['H', 'T', 'O'], digits: [1, 2, 3], expanded: false })) === 123,
  );

  const money = getManipulative('money');
  const mp = money.normalize({ coins: [50, 20, 10], target: null });
  ok('math money: 50+20+10 = 80', moneyTotal(mp) === 80);
}

/* ------------------------------------------------------------------- report */
console.log(
  `\n${passed} passed · ${failed} failed  (${MANIPULATIVES.length} kits × ${ASPECTS.length} aspects)`,
);
if (failed) {
  console.log('\nFAILURES:');
  for (const f of fails.slice(0, 60)) console.log('  ✗ ' + f);
  process.exit(1);
}
console.log('✓ engine contracts hold — deterministic, dual-aspect, math-by-code');
