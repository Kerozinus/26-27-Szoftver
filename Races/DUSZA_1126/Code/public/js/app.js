/*
 * Kincskereső robot – a felület logikája.
 * Fő részek: API-hívások, nézetváltás, bejelentkezés, játék (szerkesztő +
 * futtatás), térképszerkesztő, ranglista.
 */
(function () {
  'use strict';

  const MS = window.MineScript;
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  const state = {
    user: null,
    maps: [],
  };

  // ===========================================================================
  // Általános segédfüggvények
  // ===========================================================================

  class ApiError extends Error {
    constructor(message, status, data) {
      super(message);
      this.status = status;
      this.data = data;
    }
  }

  async function api(path, body) {
    const opts = { headers: { 'X-Requested-With': 'robotszimulator' }, credentials: 'same-origin' };
    if (body !== undefined) {
      opts.method = 'POST';
      opts.headers['Content-Type'] = 'application/json';
      opts.body = JSON.stringify(body);
    }
    let res;
    try {
      res = await fetch('api/' + path, opts);
    } catch (e) {
      throw new ApiError('Nem sikerült elérni a szervert. Ellenőrizd a hálózati kapcsolatot!', 0);
    }
    let data = null;
    try { data = await res.json(); } catch (e) { /* nem JSON válasz */ }
    if (!res.ok) {
      if (res.status === 401 && state.user) {
        state.user = null;
        showAuth();
      }
      throw new ApiError((data && data.error) || `Szerverhiba (${res.status}).`, res.status, data);
    }
    return data;
  }

  function el(tag, attrs = {}, ...children) {
    const node = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (v === null || v === undefined || v === false) continue;
      if (k === 'class') node.className = v;
      else if (k === 'text') node.textContent = v;
      else if (k.startsWith('on')) node.addEventListener(k.slice(2), v);
      else node.setAttribute(k, v === true ? '' : v);
    }
    for (const c of children.flat()) {
      if (c === null || c === undefined || c === false) continue;
      node.append(c instanceof Node ? c : document.createTextNode(String(c)));
    }
    return node;
  }

  function announce(text) {
    const a = $('#announcer');
    a.textContent = '';
    setTimeout(() => { a.textContent = text; }, 30);
  }

  function toast(text, kind = 'info', ms = 4500) {
    const t = el('div', { class: `toast ${kind}`, role: kind === 'err' ? 'alert' : 'status' }, text);
    $('#toasts').append(t);
    setTimeout(() => t.remove(), ms);
  }

  function formatDate(s) {
    if (!s) return '';
    const d = new Date(String(s).replace(' ', 'T') + 'Z');
    if (isNaN(d)) return s;
    return d.toLocaleString('hu-HU', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
  }

  function download(filename, text) {
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = el('a', { href: url, download: filename });
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function safeFileName(name) {
    return (name || 'nevtelen').normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/[^A-Za-z0-9_-]+/g, '_').replace(/^_+|_+$/g, '') || 'nevtelen';
  }

  /** Szöveges fájl beolvasása (méret- és bináris-ellenőrzéssel). */
  function readTextFile(file, maxBytes) {
    return new Promise((resolve, reject) => {
      if (file.size > maxBytes) {
        reject(new Error(`A fájl túl nagy (legfeljebb ${Math.round(maxBytes / 1024)} KB lehet).`));
        return;
      }
      const reader = new FileReader();
      reader.onerror = () => reject(new Error('A fájlt nem sikerült beolvasni.'));
      reader.onload = () => {
        const text = String(reader.result);
        if (/[\u0000�]/.test(text)) {
          reject(new Error('A fájl nem olvasható szövegként (bináris vagy hibás kódolású).'));
          return;
        }
        resolve(text);
      };
      reader.readAsText(file, 'utf-8');
    });
  }

  function baseName(filename) {
    return filename.replace(/\.[^.]+$/, '').slice(0, 60);
  }

  const storage = {
    get(key) {
      try { return JSON.parse(localStorage.getItem(key)); } catch (e) { return null; }
    },
    set(key, value) {
      try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) { /* nem kritikus */ }
    },
  };

  function mapById(id) {
    return state.maps.find((m) => m.id === id) || null;
  }

  async function loadMaps() {
    const data = await api('maps.php?action=list');
    state.maps = data.maps;
    Game.refreshMapSelect();
    Leaderboard.refreshMapSelect();
    MapEditor.renderList();
  }

  // ===========================================================================
  // Rács megjelenítése (játék és szerkesztő közös része)
  // ===========================================================================

  /** A cellaméretet a rács tényleges helyéhez igazítja (rejtett nézetnél becsül). */
  function fitGrid(container) {
    const cols = +container.dataset.cols, rows = +container.dataset.rows;
    if (!cols || !rows) return;
    const stage = container.parentElement;
    const w = stage && stage.clientWidth ? stage.clientWidth - 40 : Math.min(window.innerWidth - 100, 640);
    const size = Math.max(14, Math.min(44, Math.floor((w - cols * 2) / cols), Math.floor(560 / rows)));
    container.style.setProperty('--cell', size + 'px');
  }

  function fitAllGrids() {
    $$('.grid').forEach(fitGrid);
  }

  function setupGrid(container, rows, cols, makeCell) {
    container.innerHTML = '';
    container.style.setProperty('--cols', cols);
    container.dataset.cols = cols;
    container.dataset.rows = rows;
    fitGrid(container);
    const cells = [];
    for (let r = 0; r < rows; r++) {
      const row = [];
      for (let c = 0; c < cols; c++) {
        const cell = makeCell(r, c);
        container.append(cell);
        row.push(cell);
      }
      cells.push(row);
    }
    return cells;
  }

  const CELL_NAMES = { '.': 'üres kamra', '@': 'arany', '#': 'fal' };
  const DIR_NAME = { '>': 'kelet', '<': 'nyugat', '^': 'észak', 'v': 'dél' };

  // ===========================================================================
  // Nézetváltás
  // ===========================================================================

  const VIEWS = { jatek: 'game', terkepek: 'editor', ranglista: 'leaderboard', sugo: 'help' };

  function route() {
    if (!state.user) return;
    const key = location.hash.replace('#', '') || 'jatek';
    const view = VIEWS[key] || 'game';
    for (const v of Object.values(VIEWS)) {
      $('#view-' + v).hidden = v !== view;
    }
    $$('.nav a').forEach((a) => {
      if (a.dataset.view === view) a.setAttribute('aria-current', 'page');
      else a.removeAttribute('aria-current');
    });
    const titles = { game: 'Játék', editor: 'Térképszerkesztő', leaderboard: 'Ranglista', help: 'Súgó' };
    document.title = `${titles[view]} – Kincskereső robot`;
    if (view === 'leaderboard') Leaderboard.load();
    if (view === 'editor') MapEditor.onShow();
    if (view !== 'game' && Game.isRunning()) Game.pause();
    fitAllGrids();
  }

  // ===========================================================================
  // Bejelentkezés
  // ===========================================================================

  function showAuth() {
    $('#view-app').hidden = true;
    $('#view-auth').hidden = false;
    document.title = 'Bejelentkezés – Kincskereső robot';
    setTimeout(() => $('#login-username').focus(), 0);
  }

  async function showApp(user) {
    state.user = user;
    $('#view-auth').hidden = true;
    $('#view-app').hidden = false;
    $('#user-name').innerHTML = '';
    $('#user-name').append('Belépve: ', el('strong', { text: user.username }), user.isAdmin ? ' (admin)' : '');
    try {
      await loadMaps();
    } catch (e) {
      toast(e.message, 'err');
    }
    Game.restoreDraft();
    if (!location.hash) history.replaceState(null, '', '#jatek');
    route();
  }

  function initAuth() {
    const tabs = [$('#tab-login'), $('#tab-register')];
    const selectTab = (tab) => {
      tabs.forEach((t) => {
        const on = t === tab;
        t.setAttribute('aria-selected', String(on));
        t.tabIndex = on ? 0 : -1;
        $('#' + t.getAttribute('aria-controls')).hidden = !on;
      });
      tab.focus();
    };
    tabs.forEach((t, i) => {
      t.addEventListener('click', () => selectTab(t));
      t.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
          e.preventDefault();
          selectTab(tabs[(i + 1) % 2]);
        }
      });
    });

    const showFormError = (form, msg) => {
      const p = $('.form-error', form);
      p.textContent = msg;
      p.hidden = !msg;
    };

    $('#form-login').addEventListener('submit', async (e) => {
      e.preventDefault();
      const f = e.target;
      showFormError(f, '');
      const username = f.username.value.trim();
      const password = f.password.value;
      if (!username || !password) {
        showFormError(f, 'Add meg a felhasználónevet és a jelszót!');
        return;
      }
      try {
        const data = await api('auth.php?action=login', { username, password });
        f.password.value = '';
        await showApp(data.user);
        announce(`Sikeres bejelentkezés, ${data.user.username}.`);
      } catch (err) {
        showFormError(f, err.message);
        f.password.focus();
      }
    });

    $$('[data-demo]').forEach((b) => b.addEventListener('click', () => {
      $('#login-username').value = b.dataset.demo;
      $('#login-password').value = b.dataset.pass;
      $('#form-login').requestSubmit();
    }));

    $('#form-register').addEventListener('submit', async (e) => {
      e.preventDefault();
      const f = e.target;
      showFormError(f, '');
      const username = f.username.value.trim();
      if (username.length < 3 || username.length > 30) {
        showFormError(f, 'A felhasználónév 3–30 karakter legyen.');
        f.username.focus();
        return;
      }
      if (f.password.value.length < 6) {
        showFormError(f, 'A jelszó legalább 6 karakter legyen.');
        f.password.focus();
        return;
      }
      if (f.password.value !== f.password2.value) {
        showFormError(f, 'A két jelszó nem egyezik.');
        f.password2.focus();
        return;
      }
      try {
        const data = await api('auth.php?action=register', { username, password: f.password.value });
        f.reset();
        await showApp(data.user);
        toast(`Üdv a bányában, ${data.user.username}!`, 'ok');
      } catch (err) {
        showFormError(f, err.message);
      }
    });

    $('#btn-logout').addEventListener('click', async () => {
      Game.stop(true);
      Game.saveDraft();
      Game.forgetDraftState();
      try { await api('auth.php?action=logout', {}); } catch (e) { /* mindegy */ }
      state.user = null;
      showAuth();
      announce('Kijelentkeztél.');
    });
  }

  // ===========================================================================
  // Kódszerkesztő
  // ===========================================================================

  const CodeEditor = (() => {
    const ta = () => $('#code');
    let gutterInner, hlInner;
    let currentLine = null;
    let errorLines = new Set();
    let escapeArmed = false;
    let onChange = () => {};

    function init(changeHandler) {
      onChange = changeHandler;
      gutterInner = el('div', { class: 'gutter-inner' });
      hlInner = el('div', { class: 'gutter-inner' });
      $('#gutter').append(gutterInner);
      $('#code-highlights').append(hlInner);
      const t = ta();
      t.addEventListener('input', () => { render(); onChange(); });
      t.addEventListener('scroll', syncScroll);
      t.addEventListener('keydown', onKey);
      new ResizeObserver(syncScroll).observe(t);
      render();
    }

    function lineCount() {
      return Math.max(1, ta().value.split('\n').length);
    }

    function render() {
      const n = lineCount();
      if (gutterInner.childElementCount !== n) {
        gutterInner.innerHTML = '';
        hlInner.innerHTML = '';
        for (let i = 1; i <= n; i++) {
          gutterInner.append(el('div', { class: 'ln', text: i }));
          hlInner.append(el('div', { class: 'hl' }));
        }
      }
      const gl = gutterInner.children;
      const hl = hlInner.children;
      for (let i = 0; i < n; i++) {
        const no = i + 1;
        const cur = no === currentLine;
        const err = errorLines.has(no);
        gl[i].className = 'ln' + (cur ? ' current' : '') + (err ? ' error' : '');
        hl[i].className = 'hl' + (cur ? ' current' : '') + (err ? ' error' : '');
      }
      syncScroll();
    }

    function syncScroll() {
      const t = ta();
      const y = `translateY(${-t.scrollTop}px)`;
      gutterInner.style.transform = y;
      hlInner.style.transform = `translate(${-t.scrollLeft}px, ${-t.scrollTop}px)`;
    }

    function lineHeightPx() {
      return parseFloat(getComputedStyle(ta()).lineHeight) || 22;
    }

    function scrollToLine(no) {
      const t = ta();
      const lh = lineHeightPx();
      const top = (no - 1) * lh;
      if (top < t.scrollTop || top + lh > t.scrollTop + t.clientHeight - 16) {
        t.scrollTop = Math.max(0, top - t.clientHeight / 3);
      }
    }

    function setCurrentLine(no) {
      currentLine = no;
      render();
      if (no) scrollToLine(no);
    }

    function setErrors(lines) {
      errorLines = new Set(lines);
      render();
    }

    function focusLine(no) {
      const t = ta();
      const lines = t.value.split('\n');
      let start = 0;
      for (let i = 0; i < no - 1 && i < lines.length; i++) start += lines[i].length + 1;
      const end = start + (lines[no - 1] || '').length;
      t.focus();
      t.setSelectionRange(start, end);
      scrollToLine(no);
    }

    function insertText(text) {
      const t = ta();
      // execCommand megtartja a visszavonási előzményt; ha nem elérhető, setRangeText.
      if (!document.execCommand || !document.execCommand('insertText', false, text)) {
        t.setRangeText(text, t.selectionStart, t.selectionEnd, 'end');
        t.dispatchEvent(new Event('input'));
      }
    }

    function onKey(e) {
      const t = ta();
      if (t.readOnly) return;
      if (e.key === 'Escape') { escapeArmed = true; return; }
      if (e.key === 'Tab') {
        if (escapeArmed) { escapeArmed = false; return; } // engedjük a fókuszváltást
        e.preventDefault();
        const v = t.value;
        const lineStart = v.lastIndexOf('\n', t.selectionStart - 1) + 1;
        if (e.shiftKey) {
          const spaces = /^ {1,2}/.exec(v.slice(lineStart));
          if (spaces) {
            const pos = t.selectionStart;
            t.setSelectionRange(lineStart, lineStart + spaces[0].length);
            insertText('');
            const np = Math.max(lineStart, pos - spaces[0].length);
            t.setSelectionRange(np, np);
          }
        } else {
          insertText('  ');
        }
        return;
      }
      escapeArmed = false;
      if (e.key === 'Enter' && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        const v = t.value;
        const lineStart = v.lastIndexOf('\n', t.selectionStart - 1) + 1;
        const line = v.slice(lineStart, t.selectionStart);
        let indent = /^ */.exec(line)[0];
        if (/^ *(if|while|else)\b/.test(line)) indent += '  ';
        insertText('\n' + indent);
      }
    }

    return {
      init, render, setCurrentLine, setErrors, focusLine, scrollToLine,
      get value() { return ta().value; },
      set value(v) { ta().value = v; ta().scrollTop = 0; render(); },
      setReadOnly(ro) { ta().readOnly = ro; },
    };
  })();

  // ===========================================================================
  // Játék: program szerkesztése és futtatása
  // ===========================================================================

  const Game = (() => {
    const SPEEDS = [null, 700, 380, 180, 80, 25, 0];
    const SPEED_NAMES = [null, 'nagyon lassú', 'lassú', 'közepes', 'gyors', 'nagyon gyors', 'azonnali'];
    const STATUS_TEXT = { idle: 'Kész', running: 'Fut', paused: 'Szünetel', done: 'Befejezve' };

    const g = {
      mapId: null,
      map: null,          // feldolgozott térkép {rows, cols, grid}
      cells: [],
      runner: null,
      iter: null,
      mode: 'idle',       // idle | running | paused | done
      timer: null,
      runCode: '',
      program: { id: null, name: 'Névtelen program' },
      checkTimer: null,
    };

    function draftKey() { return state.user ? `rs.draft.${state.user.id}` : null; }

    function saveDraft() {
      if (!draftKey() || !g.restored) return; // a visszatöltés előtt ne írjuk felül a piszkozatot
      storage.set(draftKey(), { code: CodeEditor.value, program: g.program, mapId: g.mapId });
    }

    function restoreDraft() {
      const d = storage.get(draftKey());
      if (d && typeof d.code === 'string') {
        CodeEditor.value = d.code;
        if (d.program) setProgram(d.program.id || null, d.program.name || 'Névtelen program');
      } else {
        CodeEditor.value = SAMPLE_PROGRAM;
        setProgram(null, 'Példaprogram');
      }
      g.restored = true;
      const mapId = d && mapById(d.mapId) ? d.mapId : (state.maps[0] && state.maps[0].id);
      if (mapId) selectMap(mapId);
      liveCheck();
    }

    function setProgram(id, name) {
      g.program = { id, name };
      $('#program-name').textContent = name + (id ? '' : ' (nincs mentve a szerverre)');
    }

    // ---- térkép ----

    function refreshMapSelect() {
      const sel = $('#game-map');
      sel.innerHTML = '';
      for (const m of state.maps) {
        sel.append(el('option', { value: m.id }, `${m.name} (${m.rows_n}×${m.cols_n}, ${m.gold_total} arany)`));
      }
      const cur = mapById(g.mapId);
      if (cur && cur.map_text === g.mapText) sel.value = g.mapId;
      else if (cur) selectMap(cur.id); // a pálya közben megváltozott a szerkesztőben
      else if (state.maps.length) selectMap(state.maps[0].id);
    }

    function selectMap(id) {
      const m = mapById(id);
      if (!m) return;
      stop(true);
      g.mapId = id;
      $('#game-map').value = id;
      const parsed = MS.parseMap(m.map_text);
      if (!parsed.ok) {
        toast('A térkép hibás, nem tölthető be.', 'err');
        return;
      }
      g.map = parsed.map;
      g.mapText = m.map_text;
      g.cells = setupGrid($('#game-grid'), g.map.rows, g.map.cols, () => el('div', { class: 'cell' }));
      resetView();
      loadMyRuns();
      saveDraft();
    }

    function resetView() {
      g.runner = g.map ? new MS.Runner({ body: [] }, g.map) : null;
      g.iter = null;
      g.mode = 'idle';
      CodeEditor.setCurrentLine(null);
      CodeEditor.setReadOnly(false);
      $('#run-result').hidden = true;
      render();
      updateButtons();
    }

    function render(lookCell) {
      const R = g.runner;
      if (!R) return;
      const dark = $('#opt-darkness').checked;
      for (let r = 0; r < R.rows; r++) {
        for (let c = 0; c < R.cols; c++) {
          const cell = g.cells[r][c];
          const ch = R.grid[r][c];
          const seen = R.discovered[r][c];
          let cls = 'cell';
          if (ch === '#') cls += ' wall';
          else if (ch === '@') cls += ' gold';
          cls += seen ? ' seen' : ' fog' + (dark ? ' dark' : '');
          if (lookCell && lookCell.r === r && lookCell.c === c) cls += ' look';
          if (cell.className !== cls) cell.className = cls;
          const hasRobot = R.robot.r === r && R.robot.c === c;
          let robot = cell.firstChild;
          if (hasRobot && !robot) {
            robot = el('div', { class: 'robot' });
            cell.append(robot);
          } else if (!hasRobot && robot) {
            robot.remove();
          }
          if (hasRobot) {
            robot.dataset.dir = R.robotChar();
            robot.classList.toggle('crashed', R.status === 'ERROR');
          }
        }
      }
      const m = mapById(g.mapId);
      const total = m ? m.gold_total : 0;
      $('#stat-gold').textContent = `${R.gold} / ${total}`;
      $('#stat-steps').textContent = R.stepCount;
      $('#stat-dir').textContent = R.robotDirName();
      $('#stat-status').textContent = R.status === 'ERROR' ? 'Hiba' : STATUS_TEXT[g.mode];
      $('#game-grid').setAttribute('aria-label',
        `Térkép, ${R.rows} sor és ${R.cols} oszlop. A robot a ${R.robot.r + 1}. sor ${R.robot.c + 1}. oszlopában áll, ${R.robotDirName()} felé néz. ` +
        `Kibányászott arany: ${R.gold} a(z) ${total}-ból.` + (lookCell && R.inBounds(lookCell.r, lookCell.c)
          ? ` Megvizsgált mező: ${lookCell.r + 1}. sor ${lookCell.c + 1}. oszlop, ${CELL_NAMES[R.grid[lookCell.r][lookCell.c]]}.` : ''));
      renderVars();
    }

    function renderVars() {
      const vars = g.runner ? g.runner.variables() : [];
      const box = $('#vars');
      box.innerHTML = '';
      if (!vars.length) {
        box.append(el('p', { class: 'muted', text: 'Még nincs változó.' }));
        return;
      }
      box.append(el('table', {},
        el('thead', {}, el('tr', {}, el('th', { scope: 'col', text: 'Név' }), el('th', { scope: 'col', text: 'Típus' }), el('th', { scope: 'col', text: 'Érték' }))),
        el('tbody', {}, vars.map((v) => el('tr', {},
          el('td', { text: v.name }), el('td', { text: v.type === 'int' ? 'egész' : 'logikai' }), el('td', { text: v.value }))))));
    }

    // ---- konzol ----

    function consoleLine(text, cls) {
      const c = $('#console');
      c.append(el('span', { class: cls || null }, text + '\n'));
      c.scrollTop = c.scrollHeight;
    }

    // ---- szintaktikai ellenőrzés ----

    function showSyntax(result) {
      const box = $('#syntax-status');
      box.innerHTML = '';
      if (result.ok) {
        CodeEditor.setErrors([]);
        box.append(el('span', { class: 'ok' }, '✓ A program szintaktikailag helyes.'));
        return;
      }
      CodeEditor.setErrors(result.errors.map((e) => e.line));
      const list = el('ul');
      for (const e of result.errors.slice(0, 8)) {
        list.append(el('li', {},
          el('button', { type: 'button', class: 'link-btn', onclick: () => CodeEditor.focusLine(e.line) }, `${e.line}. sor`),
          ': ' + e.message));
      }
      if (result.errors.length > 8) list.append(el('li', { text: `… és még ${result.errors.length - 8} hiba.` }));
      box.append(list);
    }

    function liveCheck() {
      clearTimeout(g.checkTimer);
      g.checkTimer = setTimeout(() => {
        if (g.mode === 'running' || g.mode === 'paused') return;
        showSyntax(MS.parseProgram(CodeEditor.value));
      }, 250);
    }

    function check() {
      const r = MS.parseProgram(CodeEditor.value);
      showSyntax(r);
      announce(r.ok ? 'A program szintaktikailag helyes.' : `${r.errors.length} szintaktikai hiba. Első: ${r.errors[0].line}. sor: ${r.errors[0].message}`);
      return r;
    }

    // ---- futtatás ----

    function isRunning() { return g.mode === 'running'; }

    function updateButtons() {
      const active = g.mode === 'running' || g.mode === 'paused';
      $('#btn-run').disabled = active;
      $('#btn-pause').disabled = !active;
      $('#btn-pause').innerHTML = g.mode === 'paused'
        ? '<span aria-hidden="true">▶</span> Folytatás'
        : '<span aria-hidden="true">❚❚</span> Szünet';
      $('#btn-stop').disabled = !active;
      $('#btn-step').disabled = g.mode === 'running';
      $('#game-map').disabled = active;
      for (const id of ['#btn-new-program', '#btn-open-program', '#btn-import-program']) $(id).disabled = active;
    }

    /** Új futtatás előkészítése. false, ha a program hibás. */
    function prepare() {
      if (!g.map) {
        toast('Előbb válassz pályát!', 'err');
        return false;
      }
      clearTimeout(g.checkTimer); // a függő élő ellenőrzés ne írja felül a futás jelöléseit
      const parsed = check();
      if (!parsed.ok) {
        CodeEditor.focusLine(parsed.errors[0].line);
        toast('A program szintaktikailag hibás, ezért nem futtatható. A hibás sorok pirossal jelölve.', 'err');
        return false;
      }
      stop(true);
      g.runCode = CodeEditor.value;
      g.runner = new MS.Runner(parsed.program, g.map); // térkép és robot alaphelyzetben
      g.iter = g.runner.steps();
      $('#console').innerHTML = '';
      consoleLine(`— Futtatás indul: ${mapById(g.mapId).name} —`, 'c-info');
      $('#run-result').hidden = true;
      CodeEditor.setReadOnly(true);
      return true;
    }

    function start() {
      if (g.mode === 'paused') { resume(); return; }
      if (!prepare()) return;
      g.mode = 'running';
      updateButtons();
      render();
      announce('A program fut.');
      schedule();
    }

    function delayFor(ev) {
      const base = SPEEDS[+$('#speed').value];
      if (ev && (ev.type === 'set' || ev.type === 'print')) return 0;
      if (ev && ev.type !== 'line') return Math.round(base * 0.7);
      return base;
    }

    function schedule(lastEv) {
      clearTimeout(g.timer);
      if (g.mode !== 'running') return;
      if (SPEEDS[+$('#speed').value] === 0) {
        // Azonnali futtatás: kötegelve, hogy a böngésző ne fagyjon le.
        for (let i = 0; i < 4000 && g.mode === 'running'; i++) {
          const ev = advance(false);
          if (!ev) return;
        }
        render();
        g.timer = setTimeout(schedule, 0);
        return;
      }
      g.timer = setTimeout(() => {
        const ev = advance(true);
        if (ev) schedule(ev);
      }, delayFor(lastEv));
    }

    /** Egy esemény feldolgozása. Visszaadja az eseményt, vagy null-t, ha a futás véget ért. */
    function advance(draw) {
      const { value: ev, done } = g.iter.next();
      if (done || !ev || ev.type === 'end') {
        finish();
        return null;
      }
      if (ev.type === 'print') consoleLine(ev.text);
      if (draw) {
        CodeEditor.setCurrentLine(g.runner.currentLine);
        render(ev.type === 'look' ? ev.cell : null);
      }
      return ev;
    }

    function stepOnce() {
      if (g.mode === 'running') return;
      if (g.mode === 'idle' || g.mode === 'done') {
        if (!prepare()) return;
        g.mode = 'paused';
        updateButtons();
      }
      // A kiemelt sort végrehajtja, és a következő sornál megáll.
      let ev;
      do {
        ev = advance(true);
      } while (ev && ev.type !== 'line');
    }

    function pause() {
      if (g.mode !== 'running') return;
      clearTimeout(g.timer);
      g.mode = 'paused';
      updateButtons();
      render();
      announce(`Szünet a(z) ${g.runner.currentLine || '-'}. sornál.`);
    }

    function resume() {
      if (g.mode !== 'paused') return;
      g.mode = 'running';
      updateButtons();
      schedule();
    }

    function togglePause() {
      if (g.mode === 'running') pause();
      else if (g.mode === 'paused') resume();
      else start();
    }

    /** Leállítás. silent: nem jelez és nem rögzít semmit (pl. pályaváltáskor). */
    function stop(silent) {
      clearTimeout(g.timer);
      if (g.mode !== 'running' && g.mode !== 'paused') return;
      g.mode = 'done';
      CodeEditor.setReadOnly(false);
      updateButtons();
      if (!silent) {
        render();
        consoleLine('— A futtatást leállítottad (nem került a ranglistára). —', 'c-info');
        showResult('stopped');
        announce('A futtatás leállítva.');
      }
    }

    function finish() {
      clearTimeout(g.timer);
      g.mode = 'done';
      CodeEditor.setReadOnly(false);
      updateButtons();
      const res = g.runner.result();
      CodeEditor.setCurrentLine(null);
      CodeEditor.setErrors(res.status === 'ERROR' ? [res.errorLine] : []);
      if (res.status === 'ERROR') CodeEditor.scrollToLine(res.errorLine);
      render();
      if (res.status === 'OK') {
        consoleLine(`— Sikeres futás: ${res.gold} arany, ${res.steps} lépés. —`, 'c-info');
      } else {
        consoleLine(`HIBA (${res.errorLine}. sor): ${res.errorCode} – ${res.errorMessage}`, 'c-err');
      }
      showResult('finished', res);
      submit(res);
    }

    function showResult(kind, res) {
      const box = $('#run-result');
      box.innerHTML = '';
      box.hidden = false;
      if (kind === 'stopped') {
        box.className = 'result-box';
        box.append(el('h3', { text: 'Leállítva' }),
          el('p', { text: `Eddig ${g.runner.gold} arany, ${g.runner.stepCount} lépés. A leállított futtatás nem kerül a ranglistára.` }));
        return;
      }
      const ok = res.status === 'OK';
      box.className = 'result-box ' + (ok ? 'ok' : 'err');
      box.append(el('h3', { text: ok ? 'A program sikeresen lefutott' : 'A futás hibával ért véget' }));
      if (!ok) {
        box.append(el('p', {}, el('strong', {}, el('code', { text: res.errorCode })), ` a(z) `,
          el('button', { type: 'button', class: 'link-btn', onclick: () => CodeEditor.focusLine(res.errorLine) }, `${res.errorLine}. sorban`), '.'));
        box.append(el('p', { text: res.errorMessage }));
        if (res.errorMessage !== MS.ERROR_DESCRIPTIONS[res.errorCode]) {
          box.append(el('p', { class: 'muted', text: MS.ERROR_DESCRIPTIONS[res.errorCode] }));
        }
      }
      box.append(el('p', {}, `Kibányászott arany: `, el('strong', { text: res.gold }), `, lépésszám: `, el('strong', { text: res.steps }), '.'));
      box.append(el('p', { class: 'muted', id: 'run-submit-status', text: 'Eredmény rögzítése a ranglistán…' }));
      announce(ok
        ? `A program lefutott. ${res.gold} arany, ${res.steps} lépés.`
        : `Hiba: ${res.errorCode} a(z) ${res.errorLine}. sorban. ${res.gold} arany, ${res.steps} lépés.`);
    }

    async function submit(res) {
      const status = () => $('#run-submit-status');
      try {
        const data = await api('runs.php?action=submit', { mapId: g.mapId, code: g.runCode });
        const s = data.run;
        if (s.gold !== res.gold || s.steps !== res.steps || s.status !== res.status) {
          status().textContent = `Figyelem: a szerver eltérő eredményt számolt (${s.gold} arany, ${s.steps} lépés); a ranglistára a szerver eredménye került.`;
        } else {
          status().textContent = `Eredmény rögzítve. Legjobb helyezésed ezen a pályán: ${data.rank}.`;
        }
        loadMyRuns();
      } catch (e) {
        if (status()) status().textContent = 'Az eredményt nem sikerült rögzíteni: ' + e.message;
      }
    }

    async function loadMyRuns() {
      const box = $('#my-runs');
      if (!g.mapId) return;
      try {
        const data = await api(`runs.php?action=mine&mapId=${g.mapId}`);
        box.innerHTML = '';
        if (!data.runs.length) {
          box.append(el('p', { class: 'muted', text: 'Még nincs futtatásod ezen a pályán.' }));
          return;
        }
        box.append(el('div', { class: 'table-wrap' }, el('table', { class: 'data' },
          el('thead', {}, el('tr', {},
            el('th', { scope: 'col', text: 'Időpont' }), el('th', { scope: 'col', class: 'num', text: 'Arany' }),
            el('th', { scope: 'col', class: 'num', text: 'Lépés' }), el('th', { scope: 'col', text: 'Eredmény' }),
            el('th', { scope: 'col' }, el('span', { class: 'sr-only', text: 'Művelet' })))),
          el('tbody', {}, data.runs.slice(0, 8).map((r) => el('tr', {},
            el('td', { text: formatDate(r.created_at) }), el('td', { class: 'num', text: r.gold }), el('td', { class: 'num', text: r.steps }),
            el('td', {}, statusBadge(r)),
            el('td', {}, el('button', {
              type: 'button', class: 'btn btn-ghost btn-sm', 'aria-label': `A ${formatDate(r.created_at)} futtatás programjának betöltése`,
              onclick: () => loadRunCode(r.id),
            }, 'Betöltés'))))))));
      } catch (e) {
        box.textContent = e.message;
      }
    }

    async function loadRunCode(runId) {
      if (g.mode === 'running' || g.mode === 'paused') return;
      try {
        const data = await api(`runs.php?action=code&id=${runId}`);
        CodeEditor.value = data.code;
        setProgram(null, 'Korábbi futtatás kódja');
        liveCheck();
        saveDraft();
        toast('A korábbi futtatás programja betöltve.', 'ok');
      } catch (e) {
        toast(e.message, 'err');
      }
    }

    // ---- programfájlok és mentés ----

    async function importProgram(file) {
      try {
        const text = await readTextFile(file, 100 * 1024);
        const parsed = MS.parseProgram(text);
        if (!parsed.ok) {
          const first = parsed.errors[0];
          toast(`A(z) „${file.name}” nem tölthető be, mert szintaktikailag hibás (${parsed.errors.length} hiba). ` +
            `Első: ${first.line}. sor – ${first.message}`, 'err', 9000);
          announce('A fájl hibás, nem töltöttük be.');
          return;
        }
        stop(true);
        CodeEditor.value = text.replace(/\r\n?/g, '\n');
        setProgram(null, baseName(file.name));
        resetView();
        showSyntax(parsed);
        saveDraft();
        toast(`A(z) „${file.name}” program betöltve.`, 'ok');
      } catch (e) {
        toast(e.message, 'err');
      }
    }

    function exportProgram() {
      download(safeFileName(g.program.name) + '.txt', CodeEditor.value);
    }

    async function saveProgram(name) {
      try {
        const data = await api('programs.php?action=save', {
          id: name === g.program.name ? g.program.id : null,
          name,
          code: CodeEditor.value,
        });
        setProgram(data.program.id, data.program.name);
        saveDraft();
        toast(`„${data.program.name}” elmentve.`, 'ok');
      } catch (e) {
        toast(e.message, 'err');
      }
    }

    function openSaveDialog() {
      const dlg = $('#dlg-save');
      $('#save-name').value = g.program.name === 'Névtelen program' ? '' : g.program.name;
      dlg.returnValue = '';
      dlg.showModal();
      $('#save-name').focus();
    }

    async function openProgramsDialog() {
      const dlg = $('#dlg-programs');
      const list = $('#dlg-programs-list');
      list.innerHTML = '';
      list.append(el('p', { class: 'muted', text: 'Betöltés…' }));
      dlg.showModal();
      try {
        const data = await api('programs.php?action=list');
        list.innerHTML = '';
        list.append(el('button', { type: 'button', class: 'btn', onclick: () => { loadSample(); dlg.close(); } },
          'Példaprogram (a feladatleírásból)'));
        if (!data.programs.length) {
          list.append(el('p', { class: 'muted', text: 'Még nincs mentett programod.' }));
        }
        for (const p of data.programs) {
          list.append(el('div', { class: 'row' },
            el('button', {
              type: 'button', class: 'btn', onclick: async () => {
                try {
                  const d = await api(`programs.php?action=get&id=${p.id}`);
                  CodeEditor.value = d.program.code;
                  setProgram(d.program.id, d.program.name);
                  resetView();
                  liveCheck();
                  saveDraft();
                  dlg.close();
                  $('#code').focus();
                } catch (e) { toast(e.message, 'err'); }
              },
            }, el('span', { text: p.name }), el('small', { class: 'muted', text: formatDate(p.updated_at) })),
            el('button', {
              type: 'button', class: 'btn btn-danger', 'aria-label': `„${p.name}” törlése`, onclick: async (ev) => {
                if (!confirm(`Biztosan törlöd a(z) „${p.name}” programot?`)) return;
                try {
                  await api('programs.php?action=delete', { id: p.id });
                  ev.target.closest('.row').remove();
                  if (g.program.id === p.id) setProgram(null, g.program.name);
                  toast('Program törölve.', 'ok');
                } catch (e) { toast(e.message, 'err'); }
              },
            }, 'Törlés')));
        }
      } catch (e) {
        list.innerHTML = '';
        list.append(el('p', { class: 'form-error', text: e.message }));
      }
    }

    function loadSample() {
      stop(true);
      CodeEditor.value = SAMPLE_PROGRAM;
      setProgram(null, 'Példaprogram');
      resetView();
      liveCheck();
      saveDraft();
    }

    function init() {
      CodeEditor.init(() => {
        liveCheck();
        clearTimeout(g.draftTimer);
        g.draftTimer = setTimeout(saveDraft, 600);
      });

      $('#game-map').addEventListener('change', (e) => selectMap(+e.target.value));
      $('#btn-run').addEventListener('click', start);
      $('#btn-pause').addEventListener('click', togglePause);
      $('#btn-step').addEventListener('click', stepOnce);
      $('#btn-stop').addEventListener('click', () => stop(false));
      $('#btn-reset').addEventListener('click', () => { stop(true); resetView(); liveCheck(); announce('Alaphelyzet.'); });
      $('#btn-check').addEventListener('click', check);
      $('#btn-clear-console').addEventListener('click', () => { $('#console').innerHTML = ''; });
      $('#opt-darkness').addEventListener('change', () => render());

      const speed = $('#speed');
      const syncSpeed = () => {
        const name = SPEED_NAMES[+speed.value];
        $('#speed-label').textContent = name;
        speed.setAttribute('aria-valuetext', name);
        storage.set('rs.speed', +speed.value);
      };
      const saved = storage.get('rs.speed');
      if (saved >= 1 && saved <= 6) speed.value = saved;
      speed.addEventListener('input', () => { syncSpeed(); if (g.mode === 'running') schedule(); });
      syncSpeed();

      $('#btn-new-program').addEventListener('click', () => {
        if (CodeEditor.value.trim() && !confirm('Új programot kezdesz. A szerkesztő jelenlegi tartalma (ha nincs elmentve) elvész. Folytatod?')) return;
        stop(true);
        CodeEditor.value = '';
        setProgram(null, 'Névtelen program');
        resetView();
        liveCheck();
        saveDraft();
        $('#code').focus();
      });
      $('#btn-open-program').addEventListener('click', openProgramsDialog);
      $('#btn-save-program').addEventListener('click', openSaveDialog);
      $('#btn-import-program').addEventListener('click', () => $('#file-program').click());
      $('#file-program').addEventListener('change', (e) => {
        const f = e.target.files[0];
        e.target.value = '';
        if (f) importProgram(f);
      });
      $('#btn-export-program').addEventListener('click', exportProgram);
      $('#btn-load-sample').addEventListener('click', () => { loadSample(); location.hash = '#jatek'; });

      $('#dlg-save').addEventListener('close', () => {
        const dlg = $('#dlg-save');
        const name = $('#save-name').value.trim();
        if (dlg.returnValue === 'ok' && name) saveProgram(name.slice(0, 60));
      });

      document.addEventListener('keydown', (e) => {
        if ($('#view-game').hidden || !state.user) return;
        if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
          e.preventDefault();
          togglePause();
        } else if ((e.ctrlKey || e.metaKey) && (e.key === 's' || e.key === 'S')) {
          e.preventDefault();
          if (g.program.id) saveProgram(g.program.name);
          else openSaveDialog();
        }
      });
      window.addEventListener('beforeunload', saveDraft);
      window.addEventListener('resize', fitAllGrids);
    }

    return {
      init, refreshMapSelect, selectMap, restoreDraft, saveDraft, isRunning, pause, stop,
      currentMapId: () => g.mapId,
      forgetDraftState: () => { g.restored = false; },
    };
  })();

  const SAMPLE_PROGRAM = [
    'set count to 0',
    'set fal to isThere 1',
    'set megy to not fal',
    'while megy',
    '  set arany to isThere 2',
    '  if arany',
    '    step forward 1',
    '    mine here',
    '    set count to count + 1',
    '  else',
    '    step forward 1',
    '  set fal to isThere 1',
    '  set megy to not fal',
    'print count',
  ].join('\n');

  // ===========================================================================
  // Térképszerkesztő
  // ===========================================================================

  const MapEditor = (() => {
    const e = {
      id: null,
      name: '',
      rows: 8,
      cols: 10,
      grid: [],
      owner: null,
      canEdit: true,
      runCount: 0,
      savedText: null,
      cells: [],
      focus: { r: 0, c: 0 },
      painting: false,
      initialized: false,
    };

    const tool = () => $('input[name="tool"]:checked').value;
    const text = () => MS.serializeMap({ rows: e.rows, cols: e.cols, grid: e.grid.map((r) => r.join('')) });
    const dirty = () => e.savedText !== null ? (text() !== e.savedText || $('#map-name').value.trim() !== e.name) : true;

    function blank(rows, cols) {
      const g = [];
      for (let r = 0; r < rows; r++) g.push(new Array(cols).fill('.'));
      return g;
    }

    function newMap() {
      e.id = null;
      e.name = '';
      e.rows = 8;
      e.cols = 10;
      e.grid = blank(8, 10);
      e.grid[0][0] = '>';
      e.owner = state.user ? state.user.username : null;
      e.canEdit = true;
      e.runCount = 0;
      e.savedText = text(); // érintetlen új térkép: nincs mit félteni
      $('#map-name').value = '';
      sync();
    }

    function loadMap(m) {
      const parsed = MS.parseMap(m.map_text);
      if (!parsed.ok) { toast('A térkép hibás.', 'err'); return; }
      e.id = m.id;
      e.name = m.name;
      e.rows = parsed.map.rows;
      e.cols = parsed.map.cols;
      e.grid = parsed.map.grid.map((row) => row.split(''));
      e.owner = m.owner;
      e.canEdit = m.can_edit;
      e.runCount = m.run_count;
      e.savedText = text();
      $('#map-name').value = m.name;
      sync();
    }

    function confirmDiscard() {
      return !e.initialized || !dirty() || confirm('A térkép nem mentett módosításai elvesznek. Folytatod?');
    }

    function sync() {
      e.initialized = true;
      $('#map-rows').value = e.rows;
      $('#map-cols').value = e.cols;
      $('#map-edit-owner').textContent = e.id
        ? `Készítő: ${e.owner}${e.canEdit ? '' : ' – csak a készítő módosíthatja, de menthetsz belőle újat'}`
        : 'Új, még nem mentett térkép';
      buildGrid();
      renderList();
      validate();
    }

    function buildGrid() {
      const container = $('#edit-grid');
      container.innerHTML = '';
      container.style.setProperty('--cols', e.cols);
      container.dataset.cols = e.cols;
      container.dataset.rows = e.rows;
      fitGrid(container);
      e.cells = [];
      if (e.focus.r >= e.rows) e.focus.r = 0;
      if (e.focus.c >= e.cols) e.focus.c = 0;
      for (let r = 0; r < e.rows; r++) {
        const rowEl = el('div', { role: 'row', style: 'display:contents' });
        const row = [];
        for (let c = 0; c < e.cols; c++) {
          const b = el('button', { type: 'button', class: 'cell', role: 'gridcell', 'data-r': r, 'data-c': c, tabindex: -1 });
          rowEl.append(b);
          row.push(b);
        }
        container.append(rowEl);
        e.cells.push(row);
      }
      renderGrid();
    }

    function renderCell(r, c) {
      const ch = e.grid[r][c];
      const b = e.cells[r][c];
      b.className = 'cell' + (ch === '#' ? ' wall' : ch === '@' ? ' gold' : '');
      b.innerHTML = '';
      if (MS.DIR_CHARS.includes(ch)) {
        b.append(el('div', { class: 'robot', 'data-dir': ch }));
      }
      const what = MS.DIR_CHARS.includes(ch) ? `robot, ${DIR_NAME[ch]} felé néz` : CELL_NAMES[ch];
      b.setAttribute('aria-label', `${r + 1}. sor, ${c + 1}. oszlop: ${what}`);
      b.tabIndex = (r === e.focus.r && c === e.focus.c) ? 0 : -1;
    }

    function renderGrid() {
      for (let r = 0; r < e.rows; r++) for (let c = 0; c < e.cols; c++) renderCell(r, c);
    }

    function paint(r, c, forced) {
      const t = forced || tool();
      if (t === 'robot' || MS.DIR_CHARS.includes(t)) {
        const dir = MS.DIR_CHARS.includes(t) ? t : $('#robot-dir').value;
        for (let i = 0; i < e.rows; i++) {
          for (let j = 0; j < e.cols; j++) {
            if (MS.DIR_CHARS.includes(e.grid[i][j])) { e.grid[i][j] = '.'; renderCell(i, j); }
          }
        }
        e.grid[r][c] = dir;
        $('#robot-dir').value = dir;
      } else {
        if (e.grid[r][c] === t) return;
        e.grid[r][c] = t;
      }
      renderCell(r, c);
      validate();
    }

    function moveFocus(r, c) {
      r = Math.max(0, Math.min(e.rows - 1, r));
      c = Math.max(0, Math.min(e.cols - 1, c));
      const old = e.cells[e.focus.r] && e.cells[e.focus.r][e.focus.c];
      if (old) old.tabIndex = -1;
      e.focus = { r, c };
      e.cells[r][c].tabIndex = 0;
      e.cells[r][c].focus();
    }

    function resize(rows, cols) {
      rows = Math.max(1, Math.min(15, rows | 0 || 1));
      cols = Math.max(1, Math.min(15, cols | 0 || 1));
      const g = blank(rows, cols);
      for (let r = 0; r < Math.min(rows, e.rows); r++) {
        for (let c = 0; c < Math.min(cols, e.cols); c++) g[r][c] = e.grid[r][c];
      }
      e.rows = rows;
      e.cols = cols;
      e.grid = g;
      $('#map-rows').value = rows;
      $('#map-cols').value = cols;
      buildGrid();
      validate();
    }

    function validate() {
      const box = $('#map-validation');
      box.innerHTML = '';
      const errors = MS.validateGrid(e.rows, e.cols, e.grid.map((r) => r.join(''))).map((x) => x.message);
      const name = $('#map-name').value.trim();
      if (!name) errors.push('Adj nevet a térképnek!');
      const valid = errors.length === 0;
      if (valid) {
        const gold = e.grid.flat().filter((ch) => ch === '@').length;
        box.append(el('p', { class: 'ok' }, `✓ A térkép érvényes (${e.rows}×${e.cols}, ${gold} arany).` +
          (gold === 0 ? ' Tipp: tegyél le néhány aranyat is!' : '')));
      } else {
        box.append(el('ul', {}, errors.map((m) => el('li', { text: m }))));
      }
      $('#btn-map-save').disabled = !valid;
      $('#btn-map-save').textContent = e.id && e.canEdit ? 'Mentés' : 'Mentés új térképként';
      $('#btn-map-saveas').hidden = !(e.id && e.canEdit);
      $('#btn-map-saveas').disabled = !valid;
      $('#btn-map-delete').hidden = !(e.id && e.canEdit);
      $('#map-name').setAttribute('aria-invalid', String(!name));
      return valid;
    }

    function renderList() {
      const ul = $('#map-list');
      if (!ul) return;
      ul.innerHTML = '';
      for (const m of state.maps) {
        ul.append(el('li', {}, el('button', {
          type: 'button', 'aria-current': m.id === e.id ? 'true' : null,
          onclick: () => { if (m.id !== e.id && confirmDiscard()) loadMap(m); },
        }, m.name, el('span', { class: 'meta', text: `${m.rows_n}×${m.cols_n} · ${m.gold_total} arany · ${m.owner}` }))));
      }
    }

    async function save(asNew) {
      if (!validate()) return;
      const name = $('#map-name').value.trim();
      const body = { name, text: text() };
      const updating = !asNew && e.id && e.canEdit;
      if (updating) {
        body.id = e.id;
        if (e.runCount > 0 && text() !== e.savedText &&
            !confirm(`A pálya megváltozott. Mentéskor a pálya ranglistája (${e.runCount} futtatás) törlődik, mert a régi eredmények már nem összevethetők. Folytatod?`)) {
          return;
        }
      }
      try {
        const data = await api('maps.php?action=save', body);
        await loadMaps();
        const m = mapById(data.map.id);
        if (m) loadMap(m);
        toast(data.resultsCleared ? 'Térkép mentve, a ranglistája törölve.' : 'Térkép mentve.', 'ok');
        announce('A térkép elmentve.');
      } catch (err) {
        toast(err.message, 'err');
      }
    }

    async function remove() {
      if (!e.id) return;
      if (!confirm(`Biztosan törlöd a(z) „${e.name}” térképet? A ranglistája is törlődik.`)) return;
      try {
        await api('maps.php?action=delete', { id: e.id });
        await loadMaps();
        newMap();
        toast('Térkép törölve.', 'ok');
      } catch (err) {
        toast(err.message, 'err');
      }
    }

    async function importMap(file) {
      try {
        const t = await readTextFile(file, 20 * 1024);
        const parsed = MS.parseMap(t);
        if (!parsed.ok) {
          const box = $('#map-validation');
          box.innerHTML = '';
          box.append(el('p', { class: 'form-error', text: `A(z) „${file.name}” nem tölthető be, mert hibás:` }),
            el('ul', {}, parsed.errors.map((x) => el('li', { text: (x.line ? `${x.line}. sor: ` : '') + x.message }))));
          toast('A térképfájl hibás, nem töltöttük be.', 'err');
          return;
        }
        if (!confirmDiscard()) return;
        e.id = null;
        e.owner = state.user.username;
        e.canEdit = true;
        e.runCount = 0;
        e.savedText = null;
        e.rows = parsed.map.rows;
        e.cols = parsed.map.cols;
        e.grid = parsed.map.grid.map((r) => r.split(''));
        e.name = '';
        $('#map-name').value = baseName(file.name);
        sync();
        toast('Térkép importálva. Mentsd el, hogy játszani lehessen rajta!', 'ok');
      } catch (err) {
        toast(err.message, 'err');
      }
    }

    function onShow() {
      if (!e.initialized) newMap();
      else renderList();
    }

    function init() {
      const grid = $('#edit-grid');
      grid.addEventListener('pointerdown', (ev) => {
        const b = ev.target.closest('.cell');
        if (!b) return;
        ev.preventDefault();
        e.painting = true;
        const r = +b.dataset.r, c = +b.dataset.c;
        e.focus = { r, c };
        paint(r, c);
        b.focus();
      });
      grid.addEventListener('pointermove', (ev) => {
        if (!e.painting || tool() === 'robot') return;
        const t = document.elementFromPoint(ev.clientX, ev.clientY);
        const b = t && t.closest && t.closest('#edit-grid .cell');
        if (b) paint(+b.dataset.r, +b.dataset.c);
      });
      window.addEventListener('pointerup', () => { e.painting = false; });
      grid.addEventListener('click', (ev) => {
        // billentyűzetről (Enter/szóköz) érkező "click" – egérnél a pointerdown már festett
        if (ev.detail === 0) {
          const b = ev.target.closest('.cell');
          if (b) paint(+b.dataset.r, +b.dataset.c);
        }
      });
      grid.addEventListener('keydown', (ev) => {
        const { r, c } = e.focus;
        const moves = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] };
        if (moves[ev.key]) {
          ev.preventDefault();
          moveFocus(r + moves[ev.key][0], c + moves[ev.key][1]);
          return;
        }
        if (ev.key === 'Home') { ev.preventDefault(); moveFocus(r, 0); return; }
        if (ev.key === 'End') { ev.preventDefault(); moveFocus(r, e.cols - 1); return; }
        const toolKeys = { 1: '.', 2: '@', 3: '#', 4: 'robot', r: 'robot', R: 'robot' };
        if (toolKeys[ev.key]) {
          $(`input[name="tool"][value="${toolKeys[ev.key]}"]`).checked = true;
          announce('Eszköz: ' + { '.': 'üres kamra', '@': 'arany', '#': 'fal', robot: 'robot' }[toolKeys[ev.key]]);
          return;
        }
        if ('.@#<>^v'.includes(ev.key) && ev.key.length === 1) {
          ev.preventDefault();
          paint(r, c, ev.key);
          moveFocus(r, c);
        }
      });

      $('#map-rows').addEventListener('change', (ev) => resize(+ev.target.value, e.cols));
      $('#map-cols').addEventListener('change', (ev) => resize(e.rows, +ev.target.value));
      $('#map-name').addEventListener('input', validate);
      $('#robot-dir').addEventListener('change', () => {
        // ha már van robot, csak az irányát változtatjuk
        for (let r = 0; r < e.rows; r++) {
          for (let c = 0; c < e.cols; c++) {
            if (MS.DIR_CHARS.includes(e.grid[r][c])) { e.grid[r][c] = $('#robot-dir').value; renderCell(r, c); }
          }
        }
        validate();
      });
      $('#btn-map-new').addEventListener('click', () => { if (confirmDiscard()) { newMap(); $('#map-name').focus(); } });
      $('#btn-map-save').addEventListener('click', () => save(false));
      $('#btn-map-saveas').addEventListener('click', () => save(true));
      $('#btn-map-delete').addEventListener('click', remove);
      $('#btn-map-export').addEventListener('click', () => {
        const errs = MS.validateGrid(e.rows, e.cols, e.grid.map((r) => r.join('')));
        if (errs.length) { toast('Csak érvényes térkép exportálható: ' + errs[0].message, 'err'); return; }
        download(safeFileName($('#map-name').value.trim() || 'terkep') + '.txt', text());
      });
      $('#btn-map-import').addEventListener('click', () => $('#file-map').click());
      $('#file-map').addEventListener('change', (ev) => {
        const f = ev.target.files[0];
        ev.target.value = '';
        if (f) importMap(f);
      });
      $('#btn-map-play').addEventListener('click', () => {
        if (!e.id || dirty()) { toast('Előbb mentsd el a térképet, hogy játszani lehessen rajta!', 'err'); return; }
        Game.selectMap(e.id);
        location.hash = '#jatek';
      });
      $('#btn-map-fill').addEventListener('click', () => {
        for (let r = 0; r < e.rows; r++) for (let c = 0; c < e.cols; c++) {
          if (!MS.DIR_CHARS.includes(e.grid[r][c])) e.grid[r][c] = '.';
        }
        renderGrid();
        validate();
      });
      $('#btn-map-border').addEventListener('click', () => {
        for (let r = 0; r < e.rows; r++) for (let c = 0; c < e.cols; c++) {
          const edge = r === 0 || c === 0 || r === e.rows - 1 || c === e.cols - 1;
          if (edge && !MS.DIR_CHARS.includes(e.grid[r][c])) e.grid[r][c] = '#';
        }
        renderGrid();
        validate();
      });
    }

    return { init, renderList, onShow };
  })();

  // ===========================================================================
  // Ranglista
  // ===========================================================================

  function statusBadge(r) {
    if (r.status === 'OK') return el('span', { class: 'badge badge-ok', text: 'Sikeres' });
    return el('span', { class: 'badge badge-err', title: MS.ERROR_DESCRIPTIONS[r.error_code] || '', text: r.error_code || r.status });
  }

  const Leaderboard = (() => {
    let mapId = null;
    let userChose = false;

    function refreshMapSelect() {
      const sel = $('#lb-map');
      sel.innerHTML = '';
      for (const m of state.maps) sel.append(el('option', { value: m.id, text: m.name }));
      if (!mapById(mapId)) mapId = state.maps[0] ? state.maps[0].id : null;
      if (mapId) sel.value = mapId;
    }

    async function load() {
      const box = $('#lb-table');
      const gameMap = Game.currentMapId();
      if (!userChose && mapById(gameMap)) mapId = gameMap; // alapból a játékban kiválasztott pálya
      if (!mapId) { box.textContent = 'Még nincs térkép.'; return; }
      $('#lb-map').value = mapId;
      box.innerHTML = '';
      box.append(el('p', { class: 'muted', text: 'Betöltés…' }));
      try {
        const all = $('#lb-all').checked ? '&all=1' : '';
        const data = await api(`runs.php?action=leaderboard&mapId=${mapId}${all}`);
        box.innerHTML = '';
        if (!data.entries.length) {
          box.append(el('p', { class: 'muted', text: 'Ezen a pályán még senki nem futtatott programot. Légy te az első!' }));
          return;
        }
        box.append(el('table', { class: 'data' },
          el('caption', { class: 'sr-only', text: `Ranglista: ${data.map.name}` }),
          el('thead', {}, el('tr', {},
            el('th', { scope: 'col', text: 'Hely' }),
            el('th', { scope: 'col', text: 'Játékos' }),
            el('th', { scope: 'col', class: 'num', text: 'Arany' }),
            el('th', { scope: 'col', class: 'num', text: 'Lépés' }),
            el('th', { scope: 'col', text: 'Eredmény' }),
            el('th', { scope: 'col', text: 'Időpont' }))),
          el('tbody', {}, data.entries.map((r) => el('tr', { class: r.user_id === state.user.id ? 'me' : null },
            el('td', {}, r.rank <= 3 ? el('span', { class: `medal medal-${r.rank}`, text: r.rank }) : String(r.rank)),
            el('td', {}, r.username, r.user_id === state.user.id ? el('span', { class: 'sr-only', text: ' (te)' }) : null),
            el('td', { class: 'num', text: `${r.gold} / ${data.map.gold_total}` }),
            el('td', { class: 'num', text: r.steps }),
            el('td', {}, statusBadge(r)),
            el('td', { text: formatDate(r.created_at) }))))));
      } catch (e) {
        box.innerHTML = '';
        box.append(el('p', { class: 'form-error', text: e.message }));
      }
    }

    function init() {
      $('#lb-map').addEventListener('change', (ev) => { mapId = +ev.target.value; userChose = true; load(); });
      $('#lb-all').addEventListener('change', load);
    }

    return { init, load, refreshMapSelect };
  })();

  // ===========================================================================
  // Indítás
  // ===========================================================================

  function fillHelp() {
    const dl = $('#help-errors');
    for (const [code, desc] of Object.entries(MS.ERROR_DESCRIPTIONS)) {
      dl.append(el('dt', {}, el('code', { text: code })), el('dd', { text: desc }));
    }
  }

  async function boot() {
    initAuth();
    Game.init();
    MapEditor.init();
    Leaderboard.init();
    fillHelp();
    window.addEventListener('hashchange', () => { route(); $('#main').focus({ preventScroll: true }); });
    try {
      const data = await api('auth.php?action=me');
      if (data.user) await showApp(data.user);
      else showAuth();
    } catch (e) {
      showAuth();
      const p = $('#form-login .form-error');
      p.textContent = e.message;
      p.hidden = false;
    }
  }

  boot();
})();
