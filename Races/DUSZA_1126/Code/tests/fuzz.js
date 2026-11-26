// Differenciális teszt: véletlen programok JS és PHP futtatása, eredmények összevetése.
// Futtatás: node tests/fuzz.js [darabszám]
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const MS = require('../public/js/minescript.js');
const N = parseInt(process.argv[2] || '3000', 10);
let seed = 12345;
const rnd = (n) => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed % n; };
const pick = (a) => a[rnd(a.length)];
const vars = ['a', 'b', 'c', 'go', 'n'];
const sv = () => pick([String(rnd(5)), String(rnd(101)), 'true', 'false', ...vars]);
const ops = ['+', '-', '*', '=', '<>', '<', '<=', '>', '>=', 'and', 'or'];
function genBlock(depth, indent) {
  const lines = []; const len = 1 + rnd(4);
  for (let i = 0; i < len; i++) {
    const pad = ' '.repeat(indent);
    const k = rnd(depth > 2 ? 7 : 10);
    if (k === 0) lines.push(pad + 'step forward ' + pick(['1', '1', '2', sv()]));
    else if (k === 1) lines.push(pad + 'turn by ' + pick(['1', '3', sv()]));
    else if (k === 2) lines.push(pad + 'mine here');
    else if (k === 3) lines.push(pad + 'print ' + sv());
    else if (k <= 6) {
      const e = rnd(4);
      const rhs = e === 0 ? sv() : e === 1 ? 'isThere ' + pick(['0', '1', '2', sv()]) : e === 2 ? 'not ' + sv() : `${sv()} ${pick(ops)} ${sv()}`;
      lines.push(`${pad}set ${pick(vars)} to ${rhs}`);
    } else {
      const kw = pick(['if', 'while', 'if']);
      lines.push(`${pad}${kw} ${sv()}`);
      const inner = indent + 1 + rnd(3);
      lines.push(...genBlock(depth + 1, inner));
      if (kw === 'if' && rnd(2)) { lines.push(pad + 'else'); lines.push(...genBlock(depth + 1, indent + 2)); }
    }
  }
  return lines;
}
const mapText = '5 6\n.@..#.\n.#.@..\n..>.@.\n@..#..\n...@..\n';
const map = MS.parseMap(mapText).map;
const cases = [];
for (let i = 0; i < N; i++) {
  const pre = 'set a to 1\nset b to 2\nset go to true\n';
  cases.push(rnd(3) ? pre + genBlock(0, 0).join('\n') : genBlock(0, 0).join('\n'));
}
const tmp = path.join(__dirname, 'fuzz-cases.tmp.json');
fs.writeFileSync(tmp, JSON.stringify({ map: mapText, cases }));
const phpOut = JSON.parse(execFileSync('php', [path.join(__dirname, 'fuzz.php'), tmp], { maxBuffer: 1 << 28 }).toString());
fs.unlinkSync(tmp);
let diff = 0; const stat = {};
cases.forEach((code, i) => {
  const r = MS.run(code, map);
  const js = r.status === 'SYNTAX_ERROR' ? { status: r.status, lines: r.errors.map((e) => e.line) }
    : { status: r.status, errorCode: r.errorCode, errorLine: r.errorLine, gold: r.gold, steps: r.steps, output: r.output, robot: r.robot };
  stat[js.errorCode || js.status] = (stat[js.errorCode || js.status] || 0) + 1;
  if (JSON.stringify(js) !== JSON.stringify(phpOut[i])) {
    if (diff++ < 5) console.log('ELTÉRÉS\n' + code + '\nJS ', JSON.stringify(js), '\nPHP', JSON.stringify(phpOut[i]));
  }
});
console.log(`${N} véletlen program, eltérés: ${diff}`, stat);
process.exit(diff ? 1 : 0);
