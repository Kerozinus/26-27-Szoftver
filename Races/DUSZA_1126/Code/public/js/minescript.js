/*
 * MineScript – térképkezelés, szintaktikai elemző és futtató.
 *
 * Böngészőben a `window.MineScript` objektumon érhető el, Node.js alatt
 * `require('./minescript.js')`-sel tölthető be (a tesztek így használják).
 *
 * A szerveroldali PHP változat (api/lib/MineScript.php) ugyanezt a logikát
 * követi; a tests/cases.json tesztesetei mindkettőn lefutnak.
 */
(function (root, factory) {

  const api = factory();

  if (typeof module === 'object' && module.exports) {
    module.exports = api;

  } else { //hibakezeles
    root.MineScript = api;
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // ---------------------------------------------------------------------------
  // Állandók
  // ---------------------------------------------------------------------------

  const KEYWORDS = [
    'and', 'by', 'else', 'false', 'forward', 'here', 'if', 'isThere', 'mine',
    'not', 'or', 'print', 'set', 'step', 'to', 'true', 'turn', 'while',
  ];
  const KEYWORDS_LOWER = new Set(KEYWORDS.map((k) => k.toLowerCase()));

  const ARITH_OPS = new Set(['+', '-', '*']);
  const COMPARE_OPS = new Set(['<', '<=', '>', '>=']);
  const EQUALITY_OPS = new Set(['=', '<>']);
  const LOGIC_OPS = new Set(['and', 'or']);

  const MAX_STEPS = 1000;
  const MAX_LITERAL = 100;
  const MAP_MIN = 1;
  const MAP_MAX = 15;

  // Az irányok sorrendje az óramutatóval ELLENTÉTES (balra fordulás = +1).
  const DIR_CHARS = ['^', '<', 'v', '>'];
  const DIR_DELTA = [[-1, 0], [0, -1], [1, 0], [0, 1]];
  const DIR_NAMES = ['észak', 'nyugat', 'dél', 'kelet'];

  const CELL_EMPTY = '.';
  const CELL_GOLD = '@';
  const CELL_WALL = '#';

  const ERROR_DESCRIPTIONS = {
    E_TYPE_MISMATCH: 'Típust váltó értékadás: a változó típusa már rögzült, más típusú érték nem adható neki.',
    E_UNINITIALIZED: 'Nem inicializált változó olvasása: a változónak még nem adtál értéket.',
    E_NON_BOOL_CONDITION: 'Az if vagy while feltétele nem logikai érték.',
    E_BAD_OPERAND: 'Rossz operandustípus a műveletben.',
    E_BEDROCK_HIT: 'A robot falnak ütközött vagy lelépett volna a térképről.',
    E_NO_GOLD: 'Bányászás arany nélkül: ezen a mezőn nincs (már) arany.',
    E_BAD_ARG: 'Érvénytelen paraméter egy robotparancsnál.',
    INSTRUCTION_COUNT_LIMIT_EXCEEDED: 'A program túllépte az 1000 feldolgozható programsoros limitet.',
  };

  // ---------------------------------------------------------------------------
  // Térkép
  // ---------------------------------------------------------------------------

  /**
   * Térképfájl szövegének feldolgozása.
   * @returns {{ok: true, map: {rows:number, cols:number, grid:string[]}} | {ok:false, errors: {line:number|null, message:string}[]}}
   */
  function parseMap(text) {
    if (typeof text !== 'string') {
      return { ok: false, errors: [{ line: null, message: 'A térkép nem szöveg.' }] };
    }

    let src = text.replace(/^﻿/, '').replace(/\r\n?/g, '\n');
    src = src.replace(/\n+$/, '');

    if (src.trim() === '') {
      return { ok: false, errors: [{ line: null, message: 'A térképfájl üres.' }] };
    }

    const lines = src.split('\n').map((l) => l.replace(/[ \t]+$/, ''));
    const errors = [];

    const head = /^(\d+) (\d+)$/.exec(lines[0]);

    if (!head) {
      return {
        ok: false,
        errors: [{ line: 1, message: 'Az első sorban a térkép méretének kell állnia két, egy szóközzel elválasztott egész számként (pl. „3 15”).' }],
      };
    }

    const rows = parseInt(head[1], 10);
    const cols = parseInt(head[2], 10);

    if (rows < MAP_MIN || rows > MAP_MAX || cols < MAP_MIN || cols > MAP_MAX) {
      return { ok: false, errors: [{ line: 1, message: `A térkép mindkét mérete ${MAP_MIN} és ${MAP_MAX} között kell legyen (megadva: ${rows} × ${cols}).` }] };
    }

    const body = lines.slice(1);

    if (body.length !== rows) {
      errors.push({ line: null, message: `A fejléc szerint ${rows} sornak kellene lennie, de ${body.length} sor található.` });
    }

    const grid = [];

    for (let i = 0; i < Math.min(body.length, MAP_MAX + 5); i++) {
      
      const line = body[i];
      const lineNo = i + 2;
      
      if (line.length !== cols) {
        errors.push({ line: lineNo, message: `A sor hossza ${line.length}, de ${cols} karakternek kellene lennie.` });
      }
      
      for (let c = 0; c < line.length; c++) {

        if ('.@#<>^v'.indexOf(line[c]) === -1) {

          errors.push({ line: lineNo, message: `Ismeretlen karakter: „${line[c]}” (${c + 1}. oszlop). Megengedett: . @ # > < ^ v` });
          break;

        }
      }

      grid.push(line);

    }

    if (errors.length === 0) {

      errors.push(...validateGrid(rows, cols, grid));
    
    }

    if (errors.length) return { ok: false, errors };

    return { ok: true, map: { rows, cols, grid } };
  
  }


  /** Egy már rácsként megadott térkép szabályainak ellenőrzése (szerkesztő is használja). */

  function validateGrid(rows, cols, grid) {

    // Létrehozunk egy üres tömböt, amelyben a térképpel kapcsolatos hibákat tároljuk.
    const errors = [];


    // KORLÁTOK ELLENŐRZÉSE | EGESZ SZAM E

    if (!Number.isInteger(rows) || !Number.isInteger(cols) ||
        rows < MAP_MIN || rows > MAP_MAX || cols < MAP_MIN || cols > MAP_MAX) {

      //Hibauzenet
      
      errors.push({
        line: null,
        message: `A térkép mindkét mérete ${MAP_MIN} és ${MAP_MAX} között kell legyen.`
      });

      return errors;

    }

    // HIBAKEZELÉS – A SOROK SZÁMÁNAK ELLENŐRZÉSE

    if (!Array.isArray(grid) || grid.length !== rows) {

      // Ha nem megfelelő a sorok száma, hibaüzenetet adunk hozzá.
      errors.push({
        line: null,
        message: 'A térkép sorainak száma nem egyezik a mérettel.'
      });

      return errors;
    }


    // ROBOTOK SZÁMOLÁSA

    let robots = 0;

    // A TÉRKÉP SORAINAK ÉS MEZŐINEK ELLENŐRZÉSE

    // A külső for ciklus végigmegy a térkép összes során.
    // Az r változó az aktuális sor sorszámát tárolja.
    // Az r = 0 miatt az első sortól kezdjük az ellenőrzést.
    for (let r = 0; r < rows; r++) {

      // Ellenőrizzük, hogy az aktuális sor szöveg (string) típusú-e,
      // és hogy a sor hossza megegyezik-e a megadott oszlopszámmal.
      if (typeof grid[r] !== 'string' || grid[r].length !== cols) {

        // Ha a sor nem megfelelő hosszúságú, hibaüzenetet adunk hozzá.
        // Az r + 1 azért szükséges, mert a tömb indexelése 0-tól kezdődik,
        // de a felhasználónak 1-től szeretnénk megjeleníteni a sorszámot.
        errors.push({
          line: null,
          message: `A(z) ${r + 1}. sor hossza hibás.`
        });

        // Visszaadjuk a hibát, és leállítjuk a függvény futását.
        return errors;
      }


      // A belső for ciklus végigmegy az aktuális sor összes oszlopán.
      // A c változó az aktuális oszlop indexét jelöli.
      for (let c = 0; c < cols; c++) {

        // Kiolvassuk az aktuális mező karakterét a grid tömbből.
        // A grid[r] kiválasztja az aktuális sort,
        // a [c] pedig az adott sor megfelelő karakterét.
        const ch = grid[r][c];


        // ÉRVÉNYTELEN KARAKTER ELLENŐRZÉSE

        // Megnézzük, hogy az aktuális karakter megtalálható-e
        // az engedélyezett karaktereket tartalmazó szövegben.
        // Engedélyezett karakterek: . @ # < > ^ v
        // Az indexOf() -1 értéket ad vissza, ha nem találja a karaktert.
        if ('.@#<>^v'.indexOf(ch) === -1) {

          // Ha a karakter nem szerepel az engedélyezettek között,
          // hozzáadunk egy hibaüzenetet.
          // Az r + 1 és c + 1 miatt a sor és oszlop számozása 1-től indul.
          errors.push({
            line: null,
            message: `Érvénytelen mező a(z) ${r + 1}. sor ${c + 1}. oszlopában.`
          });

          // Visszaadjuk a hibát, és befejezzük a függvény futását.
          return errors;
        }


        // ROBOTOK MEGSZÁMOLÁSA

        // Megnézzük, hogy az aktuális karakter szerepel-e a DIR_CHARS változóban.
        // Ez a változó tartalmazza a robot lehetséges irányait:
        // > jobbra, < balra, ^ felfelé, v lefelé.
        if (DIR_CHARS.indexOf(ch) !== -1) {

          // Ha az aktuális karakter robotot jelöl,
          // eggyel növeljük a robots változó értékét.
          robots++;
        }
      }
    }


    // A ROBOTOK SZÁMÁNAK ELLENŐRZÉSE

    // Ha a robots értéke 0, akkor egyetlen robot sincs a térképen.
    // Ebben az esetben hibaüzenetet adunk hozzá.
    if (robots === 0) {
      errors.push({
        line: null,
        message: 'A térképen nincs robot. Pontosan egy robotot (>, <, ^, v) kell elhelyezni.'
      });
    }

    // Ha a robots értéke nagyobb, mint 1,
    // akkor több robot található a térképen, mint amennyi megengedett.
    if (robots > 1) {
      // A ${robots} segítségével a hibaüzenetben megjelenítjük
      // a megtalált robotok tényleges számát.
      errors.push({
        line: null,
        message: `A térképen ${robots} robot van, de pontosan egynek kell lennie.`
      });
    }

    // A függvény végén visszaadjuk az errors tömböt.
    // Ha nem találtunk hibát, akkor egy üres tömböt kapunk vissza.
    return errors;
}


// TÉRKÉP SZÖVEGGÉ ALAKÍTÁSA

function serializeMap(map) {

    // A térkép adatait egyetlen szöveges formátummá alakítjuk.
    // Először kiírjuk a sorok és oszlopok számát.
    // A \n sortörést jelent.
    // A map.grid.join('\n') összefűzi a térkép sorait úgy,
    // hogy minden sor közé egy sortörés kerül.
    // Az utolsó \n egy sortörést tesz a szöveg végére.
    return `${map.rows} ${map.cols}\n${map.grid.join('\n')}\n`;
}


// ARANYAK MEGSZÁMOLÁSA

function countGold(map) {

    // Létrehozunk egy n változót, amely az aranyak számát tárolja.
    // Kezdetben 0, mert még nem számoltunk meg egyetlen aranyat sem.
    let n = 0;

    // A külső for...of ciklus végigmegy a térkép összes sorában.
    for (const row of map.grid)

      // A belső for...of ciklus végigmegy az aktuális sor összes karakterén.
      for (const ch of row)

        // Megnézzük, hogy az aktuális karakter megegyezik-e
        // a CELL_GOLD változóban tárolt arany karakterével.
        if (ch === CELL_GOLD)

          // Ha igen, eggyel növeljük az aranyak számát.
          n++;

    // Visszaadjuk a megszámolt aranyak darabszámát.
    return n;
}

  // ---------------------------------------------------------------------------
  // Szintaktikai elemzés
  // ---------------------------------------------------------------------------

  class MineScriptSyntaxError extends Error {
    constructor(line, message) {
      super(message);
      this.line = line;
    }
  }

  function parseSimpleval(tok, line) {
    if (/^[0-9]+$/.test(tok)) {
      const value = parseInt(tok, 10);
      if (value > MAX_LITERAL) {
        throw new MineScriptSyntaxError(line, `A(z) ${tok} szám kívül esik a megengedett 0–${MAX_LITERAL} tartományon.`);
      }
      return { kind: 'int', value };
    }
    if (tok === 'true' || tok === 'false') return { kind: 'bool', value: tok === 'true' };
    if (/^[A-Za-z][A-Za-z0-9]*$/.test(tok)) {
      if (KEYWORDS_LOWER.has(tok.toLowerCase())) {
        throw new MineScriptSyntaxError(line, `„${tok}” itt nem állhat: kulcsszó, ezért nem használható értékként vagy változónévként.`);
      }
      return { kind: 'var', name: tok };
    }
    throw new MineScriptSyntaxError(line, `„${tok}” nem érvényes érték (változónév, 0–100 közötti szám, true vagy false várható).`);
  }

  function parseIdent(tok, line) {
    if (tok === undefined) throw new MineScriptSyntaxError(line, 'Hiányzik a változó neve.');
    if (!/^[A-Za-z][A-Za-z0-9]*$/.test(tok)) {
      throw new MineScriptSyntaxError(line, `„${tok}” nem érvényes változónév (betűvel kell kezdődnie, csak betűt és számjegyet tartalmazhat).`);
    }
    if (KEYWORDS_LOWER.has(tok.toLowerCase())) {
      throw new MineScriptSyntaxError(line, `„${tok}” kulcsszó, nem használható változónévként.`);
    }
    return tok;
  }

  function expectCount(tokens, n, line, usage) {
    if (tokens.length !== n) {
      throw new MineScriptSyntaxError(line, `Hibás utasítás. Helyes alak: ${usage}`);
    }
  }

  function expectKeyword(tokens, i, kw, line, usage) {
    if (tokens[i] !== kw) {
      throw new MineScriptSyntaxError(line, `„${kw}” kulcsszó várható${tokens[i] !== undefined ? `, de „${tokens[i]}” áll itt` : ''}. Helyes alak: ${usage}`);
    }
  }

  function parseCalculated(tokens, line) {
    if (tokens.length === 0) throw new MineScriptSyntaxError(line, 'A „to” után hiányzik az érték.');
    if (tokens.length === 1) {
      if (tokens[0] === 'isThere' || tokens[0] === 'not') {
        throw new MineScriptSyntaxError(line, `A(z) „${tokens[0]}” után hiányzik a paraméter.`);
      }
      return { type: 'value', value: parseSimpleval(tokens[0], line) };
    }
    if (tokens.length === 2) {
      if (tokens[0] === 'isThere') return { type: 'isThere', arg: parseSimpleval(tokens[1], line) };
      if (tokens[0] === 'not') return { type: 'not', arg: parseSimpleval(tokens[1], line) };
      throw new MineScriptSyntaxError(line, 'Két tagú kifejezés csak „isThere x” vagy „not x” lehet.');
    }
    if (tokens.length === 3) {
      const op = tokens[1];
      const isOp = ARITH_OPS.has(op) || COMPARE_OPS.has(op) || EQUALITY_OPS.has(op) || LOGIC_OPS.has(op);
      if (!isOp) {
        throw new MineScriptSyntaxError(line, `„${op}” nem ismert művelet. Lehetséges: + - * = <> < <= > >= and or`);
      }
      return {
        type: 'binop',
        op,
        left: parseSimpleval(tokens[0], line),
        right: parseSimpleval(tokens[2], line),
      };
    }
    throw new MineScriptSyntaxError(line, 'Túl hosszú kifejezés: egy sorban legfeljebb egy művelet állhat (pl. „a + b”).');
  }

  /** Egy sor (behúzás nélküli) tokenjeiből utasítás-csomópontot készít. */
  function parseCommand(tokens, line) {
    const head = tokens[0];
    switch (head) {
      case 'step':
        expectKeyword(tokens, 1, 'forward', line, 'step forward n');
        expectCount(tokens, 3, line, 'step forward n');
        return { kind: 'step', arg: parseSimpleval(tokens[2], line) };
      case 'turn':
        expectKeyword(tokens, 1, 'by', line, 'turn by n');
        expectCount(tokens, 3, line, 'turn by n');
        return { kind: 'turn', arg: parseSimpleval(tokens[2], line) };
      case 'mine':
        expectKeyword(tokens, 1, 'here', line, 'mine here');
        expectCount(tokens, 2, line, 'mine here');
        return { kind: 'mine' };
      case 'print':
        expectCount(tokens, 2, line, 'print x');
        return { kind: 'print', arg: parseSimpleval(tokens[1], line) };
      case 'set': {
        const name = parseIdent(tokens[1], line);
        expectKeyword(tokens, 2, 'to', line, 'set változó to érték');
        return { kind: 'set', name, expr: parseCalculated(tokens.slice(3), line) };
      }
      case 'if':
        expectCount(tokens, 2, line, 'if feltétel');
        return { kind: 'if', cond: parseSimpleval(tokens[1], line) };
      case 'while':
        expectCount(tokens, 2, line, 'while feltétel');
        return { kind: 'while', cond: parseSimpleval(tokens[1], line) };
      case 'else':
        expectCount(tokens, 1, line, 'else (egyedül a sorban)');
        return { kind: 'else' };
      default: {
        const lower = head.toLowerCase();
        const known = ['step', 'turn', 'mine', 'print', 'set', 'if', 'while', 'else'];
        const hint = known.find((k) => k === lower);
        throw new MineScriptSyntaxError(line, hint
          ? `Ismeretlen utasítás: „${head}”. A kulcsszavak kis- és nagybetűérzékenyek, helyesen: „${hint}”.`
          : `Ismeretlen utasítás: „${head}”. Lehetséges: step, turn, mine, print, set, if, else, while.`);
      }
    }
  }

  function splitSourceLines(source) {
    let src = String(source).replace(/^﻿/, '').replace(/\r\n?/g, '\n');
    if (src === '') return [];
    const lines = src.split('\n');
    // A fájl végi egyetlen sortörést elfogadjuk (szövegszerkesztők gyakran odateszik).
    if (lines[lines.length - 1] === '') lines.pop();
    return lines;
  }

  /**
   * A forráskód teljes szintaktikai ellenőrzése és AST felépítése.
   * @returns {{ok:true, program:{body:Array}} | {ok:false, errors:{line:number, message:string}[]}}
   */
  function parseProgram(source) {
    const rawLines = splitSourceLines(source);
    const errors = [];
    const lines = [];

    // 1. lépés: soronkénti (lexikai + utasítás-szintű) ellenőrzés – minden hibát összegyűjtünk.
    rawLines.forEach((raw, i) => {
      const no = i + 1;
      try {
        if (raw.indexOf('\t') !== -1) {
          throw new MineScriptSyntaxError(no, 'Tabulátor nem használható, a behúzást szóközökkel kell jelölni.');
        }
        if (raw.trim() === '') {
          throw new MineScriptSyntaxError(no, 'Üres sor nem szerepelhet a programban.');
        }
        if (/[^\x21-\x7E ]/.test(raw)) {
          throw new MineScriptSyntaxError(no, 'A sor nem megengedett (pl. ékezetes vagy láthatatlan) karaktert tartalmaz.');
        }
        const indent = raw.length - raw.replace(/^ +/, '').length;
        const rest = raw.slice(indent);
        if (/ $/.test(rest)) {
          throw new MineScriptSyntaxError(no, 'A sor végén felesleges szóköz áll.');
        }
        if (rest.indexOf('  ') !== -1) {
          throw new MineScriptSyntaxError(no, 'A tokenek között pontosan egy szóköz állhat.');
        }
        const tokens = rest.split(' ');
        const cmd = parseCommand(tokens, no);
        lines.push({ no, indent, cmd });
      } catch (e) {
        if (!(e instanceof MineScriptSyntaxError)) throw e;
        errors.push({ line: e.line, message: e.message });
      }
    });
    if (errors.length) return { ok: false, errors };

    // 2. lépés: blokkszerkezet a behúzások alapján.
    const ctx = { lines, pos: 0 };
    try {
      if (lines.length && lines[0].indent !== 0) {
        throw new MineScriptSyntaxError(lines[0].no, 'A program legfelső szintű sorai nem lehetnek behúzva.');
      }
      const body = parseBlock(ctx, 0);
      if (ctx.pos < lines.length) {
        // Elvileg nem fordulhat elő (0 alá nem mehet a behúzás), de biztos, ami biztos.
        throw new MineScriptSyntaxError(lines[ctx.pos].no, 'Hibás behúzás.');
      }
      return { ok: true, program: { body, lineCount: rawLines.length } };
    } catch (e) {
      if (!(e instanceof MineScriptSyntaxError)) throw e;
      return { ok: false, errors: [{ line: e.line, message: e.message }] };
    }
  }

  function parseBlock(ctx, blockIndent) {
    const body = [];
    const { lines } = ctx;
    while (ctx.pos < lines.length) {
      const ln = lines[ctx.pos];
      if (ln.indent < blockIndent) break;
      if (ln.indent > blockIndent) {
        throw new MineScriptSyntaxError(ln.no, `Hibás behúzás: ebben a blokkban ${blockIndent} szóköz a behúzás, itt ${ln.indent} áll. (Behúzott blokk csak if, else vagy while után kezdődhet.)`);
      }
      if (ln.cmd.kind === 'else') {
        throw new MineScriptSyntaxError(ln.no, 'Az „else” előtt nem áll vele azonos behúzású „if”.');
      }
      ctx.pos++;
      const cmd = Object.assign({ line: ln.no }, ln.cmd);
      if (cmd.kind === 'if' || cmd.kind === 'while') {
        cmd.body = parseChildBlock(ctx, blockIndent);
        if (cmd.kind === 'if' && ctx.pos < lines.length &&
            lines[ctx.pos].indent === blockIndent && lines[ctx.pos].cmd.kind === 'else') {
          cmd.elseLine = lines[ctx.pos].no;
          ctx.pos++;
          cmd.elseBody = parseChildBlock(ctx, blockIndent);
        }
      }
      body.push(cmd);
      // Ha a következő sor kisebb behúzású, de nem egyezik egyik nyitott blokkéval sem,
      // azt a hívó blokk fogja "Hibás behúzás"-ként jelezni.
    }
    return body;
  }

  function parseChildBlock(ctx, parentIndent) {
    if (ctx.pos < ctx.lines.length && ctx.lines[ctx.pos].indent > parentIndent) {
      return parseBlock(ctx, ctx.lines[ctx.pos].indent);
    }
    return []; // a nyelvtan szerint üres blokk is megengedett
  }

  // ---------------------------------------------------------------------------
  // Futtatás
  // ---------------------------------------------------------------------------

  class MineScriptRuntimeError extends Error {
    constructor(code, line, detail) {
      super(detail || ERROR_DESCRIPTIONS[code] || code);
      this.code = code;
      this.line = line;
      this.detail = detail || '';
    }
  }

  // 32 bites, előjeles egész aritmetika túlcsordulással (a feladat nem rögzíti,
  // mi történjen túlcsorduláskor; a determinisztikus viselkedés a cél).
  const wrap32 = (x) => x | 0;

  function typeName(t) {
    return t === 'int' ? 'egész' : 'logikai';
  }

  function formatValue(v) {
    return v.type === 'bool' ? (v.value ? 'true' : 'false') : String(v.value);
  }

  /**
   * A futtató állapota. A `steps()` generátor minden feldolgozott programsor
   * és minden robotlépés után eseményt ad vissza, így a felület tetszőleges
   * sebességgel animálhatja a futást.
   */
  class Runner {
    constructor(program, map) {
      this.program = program;
      this.rows = map.rows;
      this.cols = map.cols;
      this.grid = [];
      this.discovered = [];
      for (let r = 0; r < map.rows; r++) {
        const row = [];
        for (let c = 0; c < map.cols; c++) {
          const ch = map.grid[r][c];
          const dir = DIR_CHARS.indexOf(ch);
          if (dir !== -1) {
            this.robot = { r, c, dir };
            row.push(CELL_EMPTY);
          } else {
            row.push(ch);
          }
        }
        this.grid.push(row);
        this.discovered.push(new Array(map.cols).fill(false));
      }
      if (!this.robot) throw new Error('A térképen nincs robot.');
      this.discovered[this.robot.r][this.robot.c] = true;
      this.vars = new Map();
      this.stepCount = 0;
      this.gold = 0;
      this.output = [];
      this.currentLine = null;
      this.status = 'READY'; // READY | RUNNING | OK | ERROR
      this.error = null;
    }

    *steps() {
      this.status = 'RUNNING';
      try {
        yield* this.execBlock(this.program.body);
        this.status = 'OK';
        this.currentLine = null;
      } catch (e) {
        if (!(e instanceof MineScriptRuntimeError)) throw e;
        this.status = 'ERROR';
        this.error = { code: e.code, line: e.line, message: e.message };
        this.currentLine = e.line;
      }
      yield { type: 'end' };
    }

    /** Végigfuttatja a programot animáció nélkül. */
    runToEnd() {
      const it = this.steps();
      while (!it.next().done) { /* tovább */ }
      return this.result();
    }

    result() {
      return {
        status: this.status,
        errorCode: this.error ? this.error.code : null,
        errorLine: this.error ? this.error.line : null,
        errorMessage: this.error ? this.error.message : null,
        gold: this.gold,
        steps: this.stepCount,
        output: this.output.slice(),
        robot: { r: this.robot.r, c: this.robot.c, dir: DIR_CHARS[this.robot.dir] },
      };
    }

    *tick(line) {
      this.lastLook = null;
      if (this.stepCount >= MAX_STEPS) {
        throw new MineScriptRuntimeError('INSTRUCTION_COUNT_LIMIT_EXCEEDED', line);
      }
      this.stepCount++;
      this.currentLine = line;
      yield { type: 'line', line };
    }

    *execBlock(body) {
      for (const cmd of body) {
        yield* this.execCommand(cmd);
      }
    }

    *execCommand(cmd) {
      const line = cmd.line;
      switch (cmd.kind) {
        case 'step': {
          yield* this.tick(line);
          const n = this.readApiInt(cmd.arg, line, 'step forward', (v) => v >= 0, 'nemnegatív egész');
          for (let i = 0; i < n; i++) {
            const [dr, dc] = DIR_DELTA[this.robot.dir];
            const nr = this.robot.r + dr;
            const nc = this.robot.c + dc;
            if (!this.inBounds(nr, nc)) {
              throw new MineScriptRuntimeError('E_BEDROCK_HIT', line, `A robot lelépett volna a térképről (${i + 1}. lépésnél).`);
            }
            if (this.grid[nr][nc] === CELL_WALL) {
              this.discovered[nr][nc] = true;
              throw new MineScriptRuntimeError('E_BEDROCK_HIT', line, `A robot falnak ütközött (${i + 1}. lépésnél).`);
            }
            this.robot.r = nr;
            this.robot.c = nc;
            this.discovered[nr][nc] = true;
            yield { type: 'move', line };
          }
          return;
        }
        case 'turn': {
          yield* this.tick(line);
          const n = this.readApiInt(cmd.arg, line, 'turn by', (v) => v >= 0, 'nemnegatív egész');
          this.robot.dir = (this.robot.dir + (n % 4)) % 4;
          yield { type: 'turn', line };
          return;
        }
        case 'mine': {
          yield* this.tick(line);
          const { r, c } = this.robot;
          if (this.grid[r][c] !== CELL_GOLD) {
            throw new MineScriptRuntimeError('E_NO_GOLD', line);
          }
          this.grid[r][c] = CELL_EMPTY;
          this.gold++;
          yield { type: 'mine', line };
          return;
        }
        case 'print': {
          yield* this.tick(line);
          const v = this.read(cmd.arg, line);
          const text = formatValue(v);
          this.output.push(text);
          yield { type: 'print', line, text };
          return;
        }
        case 'set': {
          yield* this.tick(line);
          const v = this.evaluate(cmd.expr, line);
          const existing = this.vars.get(cmd.name);
          if (existing && existing.type !== v.type) {
            throw new MineScriptRuntimeError('E_TYPE_MISMATCH', line,
              `A(z) „${cmd.name}” változó ${typeName(existing.type)} típusú, nem kaphat ${typeName(v.type)} értéket.`);
          }
          this.vars.set(cmd.name, v);
          if (cmd.expr.type === 'isThere') yield { type: 'look', line, cell: this.lastLook };
          else yield { type: 'set', line };
          return;
        }
        case 'if': {
          yield* this.tick(line);
          if (this.condition(cmd.cond, line)) {
            yield* this.execBlock(cmd.body);
          } else if (cmd.elseBody) {
            yield* this.tick(cmd.elseLine);
            yield* this.execBlock(cmd.elseBody);
          }
          return;
        }
        case 'while': {
          for (;;) {
            yield* this.tick(line);
            if (!this.condition(cmd.cond, line)) break;
            yield* this.execBlock(cmd.body);
          }
          return;
        }
        default:
          throw new Error('Ismeretlen csomópont: ' + cmd.kind);
      }
    }

    inBounds(r, c) {
      return r >= 0 && r < this.rows && c >= 0 && c < this.cols;
    }

    read(sv, line) {
      if (sv.kind === 'int') return { type: 'int', value: sv.value };
      if (sv.kind === 'bool') return { type: 'bool', value: sv.value };
      const v = this.vars.get(sv.name);
      if (!v) {
        throw new MineScriptRuntimeError('E_UNINITIALIZED', line, `A(z) „${sv.name}” változónak még nincs értéke.`);
      }
      return v;
    }

    readApiInt(sv, line, apiName, okFn, expected) {
      const v = this.read(sv, line);
      if (v.type !== 'int' || !okFn(v.value)) {
        throw new MineScriptRuntimeError('E_BAD_ARG', line,
          `A(z) „${apiName}” paramétere ${expected} kell legyen, de ${formatValue(v)} (${typeName(v.type)}) érkezett.`);
      }
      return v.value;
    }

    condition(sv, line) {
      const v = this.read(sv, line);
      if (v.type !== 'bool') {
        throw new MineScriptRuntimeError('E_NON_BOOL_CONDITION', line, `A feltétel értéke ${formatValue(v)}, ami nem logikai érték.`);
      }
      return v.value;
    }

    /** A robot előtti mező vizsgálata: 0 üres, 1 fal (vagy térképen kívül), 2 arany. */
    lookAhead() {
      const [dr, dc] = DIR_DELTA[this.robot.dir];
      const r = this.robot.r + dr;
      const c = this.robot.c + dc;
      this.lastLook = { r, c };
      if (!this.inBounds(r, c)) return 1;
      this.discovered[r][c] = true;
      const cell = this.grid[r][c];
      if (cell === CELL_WALL) return 1;
      if (cell === CELL_GOLD) return 2;
      return 0;
    }

    evaluate(expr, line) {
      switch (expr.type) {
        case 'value':
          return this.read(expr.value, line);
        case 'isThere': {
          const w = this.readApiInt(expr.arg, line, 'isThere', (v) => v >= 0 && v <= 2, '0, 1 vagy 2');
          return { type: 'bool', value: this.lookAhead() === w };
        }
        case 'not': {
          const v = this.read(expr.arg, line);
          if (v.type !== 'bool') this.badOperand('not', v, line);
          return { type: 'bool', value: !v.value };
        }
        case 'binop':
          return this.evaluateBinop(expr, line);
        default:
          throw new Error('Ismeretlen kifejezés: ' + expr.type);
      }
    }

    badOperand(op, v, line) {
      throw new MineScriptRuntimeError('E_BAD_OPERAND', line,
        `A(z) „${op}” művelet nem alkalmazható ${typeName(v.type)} értékre (${formatValue(v)}).`);
    }

    checkOperand(op, v, line) {
      if ((ARITH_OPS.has(op) || COMPARE_OPS.has(op)) && v.type !== 'int') this.badOperand(op, v, line);
      if (LOGIC_OPS.has(op) && v.type !== 'bool') this.badOperand(op, v, line);
    }

    evaluateBinop(expr, line) {
      const { op } = expr;
      // Balról jobbra: az első operandus beolvasása és azonnali ellenőrzése...
      const a = this.read(expr.left, line);
      this.checkOperand(op, a, line);
      // ...majd a másodiké (rövidzár nincs, a második mindig beolvasásra kerül).
      const b = this.read(expr.right, line);
      this.checkOperand(op, b, line);
      if (EQUALITY_OPS.has(op) && a.type !== b.type) {
        throw new MineScriptRuntimeError('E_BAD_OPERAND', line,
          `A(z) „${op}” két oldala eltérő típusú (${typeName(a.type)} és ${typeName(b.type)}).`);
      }
      switch (op) {
        case '+': return { type: 'int', value: wrap32(a.value + b.value) };
        case '-': return { type: 'int', value: wrap32(a.value - b.value) };
        case '*': return { type: 'int', value: Math.imul(a.value, b.value) };
        case '<': return { type: 'bool', value: a.value < b.value };
        case '<=': return { type: 'bool', value: a.value <= b.value };
        case '>': return { type: 'bool', value: a.value > b.value };
        case '>=': return { type: 'bool', value: a.value >= b.value };
        case '=': return { type: 'bool', value: a.value === b.value };
        case '<>': return { type: 'bool', value: a.value !== b.value };
        case 'and': return { type: 'bool', value: a.value && b.value };
        case 'or': return { type: 'bool', value: a.value || b.value };
        default: throw new Error('Ismeretlen operátor: ' + op);
      }
    }

    /** A felületnek: a robot iránya karakterként. */
    robotChar() {
      return DIR_CHARS[this.robot.dir];
    }

    robotDirName() {
      return DIR_NAMES[this.robot.dir];
    }

    variables() {
      return Array.from(this.vars.entries()).map(([name, v]) => ({ name, type: v.type, value: formatValue(v) }));
    }
  }

  /** Kényelmi függvény: forráskód + térkép -> eredmény (tesztekhez). */
  function run(source, map) {
    const parsed = parseProgram(source);
    if (!parsed.ok) return { status: 'SYNTAX_ERROR', errors: parsed.errors };
    return new Runner(parsed.program, map).runToEnd();
  }

  return {
    KEYWORDS,
    MAX_STEPS,
    MAP_MIN,
    MAP_MAX,
    DIR_CHARS,
    DIR_NAMES,
    ERROR_DESCRIPTIONS,
    parseMap,
    validateGrid,
    serializeMap,
    countGold,
    parseProgram,
    Runner,
    run,
  };
});
