// Futtatás: node tests/run-js.js
const MS = require('../public/js/minescript.js');
const data = require('./cases.json');
let fail = 0, pass = 0;
const check = (name, cond, msg) => { if (cond) pass++; else { fail++; console.log('FAIL', name, msg); } };

for (const tc of data.runCases) {
  const m = MS.parseMap(data.maps[tc.map]);
  const res = MS.run(tc.code, m.map);
  const e = tc.expect;
  const errs = [];
  for (const k of ['status', 'errorCode', 'errorLine', 'steps', 'gold']) {
    if (k in e && e[k] !== res[k]) errs.push(`${k}: várt ${e[k]}, kapott ${res[k]}`);
  }
  if (e.output && JSON.stringify(e.output) !== JSON.stringify(res.output)) errs.push(`output: ${JSON.stringify(res.output)}`);
  if (e.robot && JSON.stringify(e.robot) !== JSON.stringify([res.robot.r, res.robot.c, res.robot.dir])) errs.push(`robot: ${JSON.stringify(res.robot)}`);
  if (res.status === 'SYNTAX_ERROR') errs.push(JSON.stringify(res.errors));
  check(tc.name, errs.length === 0, errs.join('; '));
}
for (const tc of data.syntaxCases) {
  const p = MS.parseProgram(tc.code);
  const lines = p.ok ? [] : p.errors.map((x) => x.line);
  check(tc.name, !p.ok && JSON.stringify(lines) === JSON.stringify(tc.lines), `sorok: ${JSON.stringify(lines)} ${p.ok ? '' : p.errors[0].message}`);
}
for (const tc of data.mapCases) {
  const r = MS.parseMap(tc.text);
  check(tc.name, r.ok === tc.ok, JSON.stringify(r.errors || r.map));
}
console.log(`JS: ${pass} sikeres, ${fail} hibás`);
process.exit(fail ? 1 : 0);
