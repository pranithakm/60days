/* =========================================================
   My 60-Day Transformation — app logic (vanilla JS)
   Google Sheets (via Apps Script) is the permanent database.
   localStorage is used only as an offline cache + unsaved-change queue.
   ========================================================= */
(function () {
  'use strict';

  /* ---------------------------------------------------------
     Constants & defaults
     --------------------------------------------------------- */
  const PROGRAM_DAYS = 60;
  const LS_CACHE = 'mt60_cache_v1';
  const LS_PENDING = 'mt60_pending_v1';
  const LS_CONN = 'mt60_connection_v1';
  const LS_UI = 'mt60_ui_v1';
  const SS_CHECKIN_SNOOZE = 'mt60_checkin_snoozed';

  const DAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
  const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const DAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  const MEALS = [
    { key: 'breakfast', label: 'Breakfast' },
    { key: 'coffee', label: '11 AM Coffee' },
    { key: 'lunch', label: 'Lunch' },
    { key: 'coconut', label: '3 PM Tender coconut' },
    { key: 'fruit', label: '5 PM Fruit' },
    { key: 'dinner', label: 'Dinner' },
    { key: 'snacks', label: 'Additional snacks' }
  ];

  // days: null = every day, otherwise list of weekday numbers (0 = Sunday)
  const DEFAULT_ROUTINES = [
    { key: 'wake', name: 'Wake up before 7 AM', time: 'Before 7:00 AM', days: null },
    { key: 'oil_pulling', name: 'Oil pulling', time: 'Morning', days: null },
    { key: 'bath', name: 'Bath', time: 'Morning', days: null },
    { key: 'hair_wash', name: 'Hair wash', time: 'Morning', days: [1, 5] },
    { key: 'oil_thu', name: 'Apply hair/body oil', time: 'Thursday morning', days: [4] },
    { key: 'oil_sun', name: 'Apply oil', time: 'Sunday night', days: [0] },
    { key: 'hot_water', name: 'Drink hot water', time: 'Morning', days: null },
    { key: 'prep_meals', name: 'Prepare breakfast and lunch', time: 'Morning', days: null },
    { key: 'coffee', name: 'Coffee', time: '11:00 AM', days: null },
    { key: 'lunch', name: 'Lunch', time: 'Before 1:30 PM', days: null },
    { key: 'coconut', name: 'Tender coconut', time: 'Before 3:00 PM', days: null },
    { key: 'fruit', name: 'Fruit', time: 'Before 5:00 PM', days: null },
    { key: 'dinner', name: 'Dinner', time: '7:00 PM', days: null },
    { key: 'soak', name: 'Soak horse gram/green gram OR knead flour', time: 'Night', days: null }
  ];

  // Nutrition values are typical home-cooked estimates. Edit them in Settings → Weekly meal schedule.
  const FOODS = {
    pesarattu: { food: 'Pesarattu', quantity: '2 medium', calories: 260, protein: 12, fibre: 6 },
    eggs: { food: 'Boiled eggs', quantity: '2 eggs', calories: 155, protein: 13, fibre: 0 },
    chapathi: { food: 'Chapathi', quantity: '2 medium', calories: 240, protein: 6, fibre: 4 },
    soya: { food: 'Soya chunks curry', quantity: '30 g dry soya', calories: 130, protein: 16, fibre: 4 },
    paneer: { food: 'Paneer', quantity: '75 g', calories: 200, protein: 14, fibre: 0 },
    kollu: { food: 'Kollu (horse gram) dosa', quantity: '2 medium', calories: 240, protein: 9, fibre: 5 },
    rice: { food: 'Rice', quantity: '1 cup cooked', calories: 200, protein: 4, fibre: 1 },
    curd: { food: 'Curd', quantity: '100 g', calories: 60, protein: 3.5, fibre: 0 },
    veg: { food: 'Vegetables (poriyal/kootu)', quantity: '1 cup', calories: 80, protein: 2.5, fibre: 4 },
    gram: { food: 'Horse gram / green gram', quantity: '½ cup cooked', calories: 110, protein: 7, fibre: 5 },
    coffee: { food: 'Milk coffee', quantity: '1 cup', calories: 110, protein: 5, fibre: 0 },
    coconut: { food: 'Tender coconut', quantity: '1 coconut', calories: 60, protein: 1, fibre: 1 },
    fruit: { food: 'Fruit', quantity: '1 medium', calories: 80, protein: 1, fibre: 4 }
  };

  const WEEK_MENU = {
    // breakfast foods, dinner foods
    mon: [['pesarattu', 'eggs'], ['pesarattu']],
    tue: [['chapathi', 'soya'], ['chapathi', 'soya']],
    wed: [['kollu', 'eggs'], ['kollu']],
    thu: [['pesarattu', 'eggs'], ['pesarattu']],
    fri: [['chapathi', 'paneer'], ['chapathi', 'paneer']],
    sat: [['kollu', 'eggs'], ['kollu']],
    sun: [['pesarattu', 'eggs'], ['pesarattu']]
  };

  const QUICK_PICKS = [
    { food: 'Banana', quantity: '1 medium', calories: 105, protein: 1.3, fibre: 3 },
    { food: 'Apple', quantity: '1 medium', calories: 95, protein: 0.5, fibre: 4.4 },
    { food: 'Guava', quantity: '1 medium', calories: 68, protein: 2.6, fibre: 5.4 },
    { food: 'Almonds', quantity: '10 pieces', calories: 70, protein: 2.5, fibre: 1.5 },
    { food: 'Walnuts', quantity: '3 whole', calories: 100, protein: 2.3, fibre: 1 },
    { food: 'Seeds laddu', quantity: '1 small', calories: 120, protein: 3, fibre: 2 }
  ];

  const EXERCISE_TYPES = ['Walking', 'Yoga', 'Strength', 'Cardio', 'Dance', 'Cycling', 'Stretching', 'Other'];

  const GOALS = [
    { key: 'routine', label: 'Routine checklist' },
    { key: 'calories', label: 'Calories within target' },
    { key: 'protein', label: 'Protein target reached' },
    { key: 'water', label: 'Water target reached' },
    { key: 'steps', label: 'Step target reached' },
    { key: 'exercise', label: 'Exercise target reached' }
  ];

  function buildDefaultMealPlan() {
    const plan = {};
    DAY_KEYS.forEach(function (dk) {
      const [bf, dn] = WEEK_MENU[dk];
      const items = [];
      const add = function (meal, fk, n) {
        items.push(Object.assign({ id: dk + '-' + meal + '-' + n, meal: meal }, FOODS[fk]));
      };
      bf.forEach(function (f, i) { add('breakfast', f, i + 1); });
      add('coffee', 'coffee', 1);
      ['rice', 'curd', 'veg', 'gram'].forEach(function (f, i) { add('lunch', f, i + 1); });
      add('coconut', 'coconut', 1);
      add('fruit', 'fruit', 1);
      dn.forEach(function (f, i) { add('dinner', f, i + 1); });
      plan[dk] = items;
    });
    return plan;
  }

  function defaultSettings() {
    return {
      start_date: '',
      calorie_target: 1600,
      protein_target: 60,
      fibre_target: 25,
      flex_calories: 300,
      water_target_l: 2.5,
      step_target: 8000,
      exercise_target: 30,
      height_cm: 161,
      weight_unit: 'kg',
      streak_rules: {
        min_goals: 4,
        routine_pct: 80,
        goals: { routine: true, calories: true, protein: true, water: true, steps: true, exercise: true }
      },
      routines: DEFAULT_ROUTINES.map(function (r) { return Object.assign({}, r); }),
      meal_plan: buildDefaultMealPlan()
    };
  }

  /* ---------------------------------------------------------
     Date helpers (always local dates, YYYY-MM-DD)
     --------------------------------------------------------- */
  const pad = function (n) { return String(n).padStart(2, '0'); };
  function fmtDate(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function parseDate(s) {
    const p = String(s).split('-').map(Number);
    return new Date(p[0], p[1] - 1, p[2]);
  }
  function todayStr() { return fmtDate(new Date()); }
  function addDays(s, n) { const d = parseDate(s); d.setDate(d.getDate() + n); return fmtDate(d); }
  function diffDays(a, b) { // b - a in whole days
    const pa = parseDate(a), pb = parseDate(b);
    return Math.round((Date.UTC(pb.getFullYear(), pb.getMonth(), pb.getDate()) - Date.UTC(pa.getFullYear(), pa.getMonth(), pa.getDate())) / 86400000);
  }
  function weekday(s) { return parseDate(s).getDay(); }
  function isValidDate(s) { return /^\d{4}-\d{2}-\d{2}$/.test(String(s || '')); }
  function prettyDate(s, withYear) {
    const d = parseDate(s);
    return DAY_SHORT[d.getDay()] + ', ' + d.getDate() + ' ' + MONTHS[d.getMonth()] + (withYear ? ' ' + d.getFullYear() : '');
  }
  function shortDate(s) { const d = parseDate(s); return d.getDate() + ' ' + MONTHS[d.getMonth()]; }
  function lastSundayOnOrBefore(s) { return addDays(s, -weekday(s)); }
  function mondayOfWeek(s) { return addDays(s, -((weekday(s) + 6) % 7)); }

  /* ---------------------------------------------------------
     Small utils
     --------------------------------------------------------- */
  const $ = function (sel, root) { return (root || document).querySelector(sel); };
  const $$ = function (sel, root) { return Array.from((root || document).querySelectorAll(sel)); };
  function esc(v) {
    return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function num(v, d) { const n = Number(v); return isFinite(n) ? n : (d === undefined ? 0 : d); }
  function round1(n) { return Math.round(n * 10) / 10; }
  function fmtInt(n) { return Math.round(num(n)).toLocaleString('en-US'); }
  function fmtL(ml) { return String(Math.round(num(ml) / 10) / 100); }
  function fmt1(n) { const r = round1(num(n)); return Number.isInteger(r) ? String(r) : r.toFixed(1); }
  function pct(a, b) { return b > 0 ? Math.max(0, Math.min(100, (a / b) * 100)) : 0; }
  function bool(v) { return v === true || v === 'TRUE' || v === 'true' || v === 1 || v === '1'; }
  function nowIso() { return new Date().toISOString(); }
  function uid(prefix) { return prefix + '-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
  function lsGet(k, fallback) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : fallback; } catch (e) { return fallback; } }
  function lsSet(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* storage full or blocked */ } }
  function debounce(fn, ms) { let t; return function () { const a = arguments; clearTimeout(t); t = setTimeout(function () { fn.apply(null, a); }, ms); }; }
  function deepMerge(base, extra) {
    const out = Array.isArray(base) ? base.slice() : Object.assign({}, base);
    Object.keys(extra || {}).forEach(function (k) {
      const v = extra[k];
      if (v && typeof v === 'object' && !Array.isArray(v) && base && typeof base[k] === 'object' && !Array.isArray(base[k])) out[k] = deepMerge(base[k], v);
      else if (v !== undefined) out[k] = v;
    });
    return out;
  }

  const ICON = {
    check: '<svg viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>',
    note: '<svg viewBox="0 0 24 24"><path d="M4 20h4L19 9l-4-4L4 16v4Z"/><path d="m13.5 6.5 4 4"/></svg>',
    edit: '<svg viewBox="0 0 24 24"><path d="M4 20h4L19 9l-4-4L4 16v4Z"/></svg>',
    trash: '<svg viewBox="0 0 24 24"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/></svg>',
    plus: '<svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>'
  };

  /* ---------------------------------------------------------
     State
     --------------------------------------------------------- */
  // db mirrors the spreadsheet tabs: each is a map of id -> record
  const SHEETS = {
    daily: 'Daily_Logs',
    routine: 'Routine_Logs',
    food: 'Food_Logs',
    exercise: 'Exercise_Logs',
    weight: 'Weight_Logs',
    checkins: 'Weekly_Checkins',
    settings: 'Settings'
  };
  const SHEET_TO_KEY = {};
  Object.keys(SHEETS).forEach(function (k) { SHEET_TO_KEY[SHEETS[k]] = k; });

  const cache = lsGet(LS_CACHE, null);
  let settings = deepMerge(defaultSettings(), (cache && cache.settings) || {});
  let db = emptyDb();
  if (cache && cache.db) Object.keys(db).forEach(function (k) { db[k] = cache.db[k] || {}; });
  let conn = lsGet(LS_CONN, { url: '', token: '' });
  let lastSynced = (cache && cache.lastSynced) || '';
  const ui = Object.assign({ tab: 'routine', routineFilter: 'all' }, lsGet(LS_UI, {}));
  let viewDate = todayStr();
  let openNotes = {}; // routine key -> bool (notes panel open)

  function emptyDb() { return { daily: {}, routine: {}, food: {}, exercise: {}, weight: {}, checkins: {} }; }
  function saveCache() { lsSet(LS_CACHE, { settings: settings, db: db, lastSynced: lastSynced }); }
  function saveUi() { lsSet(LS_UI, { tab: ui.tab, routineFilter: ui.routineFilter }); }

  /* ---------------------------------------------------------
     Sync with Google Sheets (Apps Script web app)
     --------------------------------------------------------- */
  const Sync = {
    pending: lsGet(LS_PENDING, {}),
    flushing: false,
    again: false,
    retryTimer: null,

    connected: function () { return !!(conn.url && /^https:\/\//.test(conn.url)); },

    queue: function (key, record) {
      const sheet = SHEETS[key];
      this.pending[sheet + '|' + record.id] = { op: 'upsert', sheet: sheet, record: record, ts: Date.now() + Math.random() };
      this.persist();
      this.scheduleFlush();
    },
    queueDelete: function (key, id) {
      const sheet = SHEETS[key];
      this.pending[sheet + '|' + id] = { op: 'delete', sheet: sheet, id: id, ts: Date.now() + Math.random() };
      this.persist();
      this.scheduleFlush();
    },
    persist: function () { lsSet(LS_PENDING, this.pending); },
    count: function () { return Object.keys(this.pending).length; },

    scheduleFlush: debounce(function () { Sync.flush(); }, 900),

    request: async function (payload) {
      const res = await fetch(conn.url, {
        method: 'POST',
        // text/plain avoids a CORS preflight, which Apps Script cannot answer
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(Object.assign({ token: conn.token }, payload)),
        redirect: 'follow'
      });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const json = await res.json();
      if (!json.ok) throw new Error(json.error || 'Unknown server error');
      return json;
    },

    flush: async function () {
      updateSyncPill();
      if (!this.connected() || !this.count()) return;
      if (this.flushing) { this.again = true; return; }
      if (!navigator.onLine) { setSyncPill('err', 'Offline'); return; }
      this.flushing = true;
      setSyncPill('busy', 'Saving…');
      try {
        const keys = Object.keys(this.pending);
        for (let i = 0; i < keys.length; i += 200) {
          const chunk = keys.slice(i, i + 200);
          const sent = chunk.map(function (k) { return [k, Sync.pending[k]]; });
          await this.request({
            action: 'batch',
            ops: sent.map(function (e) {
              const p = e[1];
              return p.op === 'delete' ? { op: 'delete', sheet: p.sheet, id: p.id } : { op: 'upsert', sheet: p.sheet, record: p.record };
            })
          });
          sent.forEach(function (e) {
            // only clear if nothing changed while the request was in flight
            if (Sync.pending[e[0]] && Sync.pending[e[0]].ts === e[1].ts) delete Sync.pending[e[0]];
          });
          this.persist();
        }
        lastSynced = nowIso();
        saveCache();
        setSyncPill('ok', 'Saved');
      } catch (err) {
        setSyncPill('err', 'Not saved');
        toast('Could not save to Google Sheets: ' + err.message + '. Your changes are kept on this device and will retry.', 'err', 5000);
        clearTimeout(this.retryTimer);
        this.retryTimer = setTimeout(function () { Sync.flush(); }, 20000);
      } finally {
        this.flushing = false;
        if (this.again) { this.again = false; this.flush(); }
      }
    },

    load: async function (opts) {
      opts = opts || {};
      if (!this.connected()) { updateSyncPill(); return false; }
      if (!navigator.onLine) { setSyncPill('err', 'Offline'); return false; }
      setSyncPill('busy', 'Loading…');
      try {
        const url = conn.url + (conn.url.indexOf('?') > -1 ? '&' : '?') + 'action=getAll&token=' + encodeURIComponent(conn.token) + '&t=' + Date.now();
        const res = await fetch(url, { redirect: 'follow' });
        if (!res.ok) throw new Error('HTTP ' + res.status);
        const json = await res.json();
        if (!json.ok) throw new Error(json.error || 'Unknown server error');
        applyServerData(json.data || {});
        lastSynced = nowIso();
        saveCache();
        setSyncPill('ok', 'Synced');
        if (opts.announce) toast('Loaded your data from Google Sheets', 'ok');
        if (this.count()) this.flush();
        return true;
      } catch (err) {
        setSyncPill('err', 'Sync error');
        toast('Could not load from Google Sheets: ' + err.message + '. Showing data saved on this device.', 'err', 5000);
        return false;
      }
    }
  };

  function applyServerData(data) {
    const next = emptyDb();
    Object.keys(SHEETS).forEach(function (key) {
      if (key === 'settings') return;
      (data[SHEETS[key]] || []).forEach(function (r) { if (r && r.id) next[key][String(r.id)] = normalizeRecord(key, r); });
    });

    // settings: one row per key, value is JSON
    const rows = data[SHEETS.settings] || [];
    if (rows.length) {
      const fromServer = {};
      rows.forEach(function (r) {
        try { fromServer[r.id] = JSON.parse(r.value); } catch (e) { fromServer[r.id] = r.value; }
      });
      settings = deepMerge(defaultSettings(), fromServer);
    } else if (settings.start_date) {
      // brand new sheet: upload the settings already set on this device
      queueAllSettings();
    }

    // overlay changes not yet saved to the sheet so nothing is lost
    Object.keys(Sync.pending).forEach(function (k) {
      const p = Sync.pending[k];
      const key = SHEET_TO_KEY[p.sheet];
      if (!key || key === 'settings') return;
      if (p.op === 'delete') delete next[key][p.id];
      else next[key][p.record.id] = Object.assign({}, next[key][p.record.id] || {}, p.record);
    });
    Object.keys(Sync.pending).forEach(function (k) {
      const p = Sync.pending[k];
      if (p.sheet === SHEETS.settings && p.op === 'upsert') {
        try { settings[p.record.id] = JSON.parse(p.record.value); } catch (e) { /* ignore */ }
      }
    });
    db = next;
  }

  function normalizeRecord(key, r) {
    const out = Object.assign({}, r);
    if (out.date !== undefined) out.date = String(out.date).slice(0, 10);
    if (key === 'routine') out.done = bool(out.done);
    if (key === 'daily') out.completed = bool(out.completed);
    ['calories', 'protein', 'fibre', 'water_ml', 'steps', 'walking_min', 'exercise_min', 'calories_burned', 'weight_kg', 'height_cm', 'bmi'].forEach(function (f) {
      if (out[f] !== undefined && out[f] !== '') out[f] = num(out[f]);
    });
    return out;
  }

  function queueAllSettings() {
    Object.keys(settings).forEach(function (k) {
      Sync.queue('settings', { id: k, value: JSON.stringify(settings[k]), updated_at: nowIso() });
    });
  }

  function setSyncPill(state, text) {
    const pill = $('#syncPill');
    pill.className = 'sync-pill ' + (state || '');
    $('.sync-text', pill).textContent = text;
  }
  function updateSyncPill() {
    if (!Sync.connected()) { setSyncPill('', 'Local'); return; }
    const n = Sync.count();
    if (n) setSyncPill('busy', n + ' unsaved');
    else setSyncPill('ok', 'Saved');
  }

  /* ---------------------------------------------------------
     Domain logic
     --------------------------------------------------------- */
  function startDate() { return isValidDate(settings.start_date) ? settings.start_date : ''; }
  function endDate() { return startDate() ? addDays(startDate(), PROGRAM_DAYS - 1) : ''; }
  function dayNumber(date) { return startDate() ? diffDays(startDate(), date) + 1 : 0; }
  function inProgram(date) { const n = dayNumber(date); return n >= 1 && n <= PROGRAM_DAYS; }

  function routinesFor(date) {
    const wd = weekday(date);
    return settings.routines.filter(function (r) { return !r.days || r.days.indexOf(wd) > -1; });
  }
  function routineLog(date, key) { return db.routine[date + '|' + key] || null; }

  function planItemsFor(date) { return (settings.meal_plan[DAY_KEYS[weekday(date)]] || []); }

  // Returns every food entry for the day (planned + manual) with an effective status
  function foodEntriesFor(date) {
    const entries = [];
    planItemsFor(date).forEach(function (p) {
      const log = db.food[date + '|' + p.id];
      const status = log ? log.status : 'pending';
      const base = (log && status !== 'pending') ? log : p; // consumed/skipped keep their snapshot
      entries.push({
        id: date + '|' + p.id, item_id: p.id, source: 'planned', meal: p.meal, status: status,
        food: base.food, quantity: base.quantity, calories: num(base.calories), protein: num(base.protein), fibre: num(base.fibre)
      });
    });
    Object.keys(db.food).forEach(function (id) {
      const f = db.food[id];
      if (f.date === date && f.source === 'manual') {
        entries.push(Object.assign({}, f, { calories: num(f.calories), protein: num(f.protein), fibre: num(f.fibre), status: 'consumed' }));
      }
    });
    return entries;
  }

  function computeDay(date) {
    const foods = foodEntriesFor(date);
    let calories = 0, protein = 0, fibre = 0, manualCal = 0;
    foods.forEach(function (f) {
      if (f.status !== 'consumed') return;
      calories += f.calories; protein += f.protein; fibre += f.fibre;
      if (f.source === 'manual') manualCal += f.calories;
    });
    const routines = routinesFor(date);
    const routineDone = routines.filter(function (r) { const l = routineLog(date, r.key); return l && l.done; }).length;
    const routinePct = routines.length ? Math.round((routineDone / routines.length) * 100) : 0;
    const ex = db.exercise[date] || {};
    const daily = db.daily[date] || {};
    const water = num(daily.water_ml);
    const steps = num(ex.steps);
    const exMin = num(ex.exercise_min);

    const rules = settings.streak_rules;
    const met = {
      routine: routinePct >= num(rules.routine_pct, 80),
      calories: calories > 0 && calories <= num(settings.calorie_target),
      protein: protein >= num(settings.protein_target),
      water: water >= num(settings.water_target_l) * 1000,
      steps: steps >= num(settings.step_target),
      exercise: exMin >= num(settings.exercise_target)
    };
    const enabled = GOALS.filter(function (g) { return rules.goals[g.key]; });
    const goalsMet = enabled.filter(function (g) { return met[g.key]; }).length;
    const required = Math.min(Math.max(1, num(rules.min_goals, 1)), enabled.length);
    const completed = enabled.length > 0 && goalsMet >= required;
    const hasData = calories > 0 || water > 0 || steps > 0 || exMin > 0 || routineDone > 0;

    return {
      calories: round1(calories), protein: round1(protein), fibre: round1(fibre), manualCal: manualCal,
      water_ml: water, steps: steps, exercise_min: exMin, walking_min: num(ex.walking_min),
      routine_done: routineDone, routine_total: routines.length, routine_pct: routinePct,
      met: met, goals_met: goalsMet, goals_required: required, goals_enabled: enabled.length,
      completed: completed, hasData: hasData
    };
  }

  // Keep the Daily_Logs summary row for this date in sync
  function refreshDaily(date, extra) {
    const prev = db.daily[date] || {};
    const merged = Object.assign({}, prev, extra || {});
    db.daily[date] = merged; // so computeDay sees new water value
    const c = computeDay(date);
    const rec = Object.assign({}, merged, {
      id: date, date: date, day_number: inProgram(date) ? dayNumber(date) : '',
      calories: c.calories, protein: c.protein, fibre: c.fibre, water_ml: c.water_ml,
      steps: c.steps, exercise_min: c.exercise_min,
      routine_done: c.routine_done, routine_total: c.routine_total, routine_pct: c.routine_pct,
      goals_met: c.goals_met, goals_required: c.goals_required, completed: c.completed,
      updated_at: nowIso()
    });
    db.daily[date] = rec;
    Sync.queue('daily', rec);
    saveCache();
  }

  function streakStats() {
    const s = startDate();
    const today = todayStr();
    const out = { current: 0, longest: 0, completed: 0, missed: 0, weekPct: 0, weekDone: 0, weekDays: 0, perDay: {} };
    if (!s || today < s) return out;
    const last = today < endDate() ? today : endDate();
    let run = 0;
    for (let d = s; d <= last; d = addDays(d, 1)) {
      const c = computeDay(d);
      out.perDay[d] = c;
      if (c.completed) { out.completed++; run++; out.longest = Math.max(out.longest, run); }
      else { if (d < today) out.missed++; run = d < today ? 0 : run; }
    }
    // current streak: count back from today (today still in progress doesn't break it)
    let d = last;
    if (!(out.perDay[d] && out.perDay[d].completed) && d === today) d = addDays(d, -1);
    while (d >= s && out.perDay[d] && out.perDay[d].completed) { out.current++; d = addDays(d, -1); }

    const wkStart = mondayOfWeek(today) < s ? s : mondayOfWeek(today);
    for (let w = wkStart; w <= last; w = addDays(w, 1)) {
      out.weekDays++;
      if (out.perDay[w] && out.perDay[w].completed) out.weekDone++;
    }
    out.weekPct = out.weekDays ? Math.round((out.weekDone / out.weekDays) * 100) : 0;
    return out;
  }

  function weightsSorted() {
    return Object.values(db.weight).filter(function (w) { return num(w.weight_kg) > 0; })
      .sort(function (a, b) { return a.date < b.date ? -1 : 1; });
  }
  function bmiOf(kg) { const h = num(settings.height_cm) / 100; return h > 0 ? kg / (h * h) : 0; }
  function bmiCategory(b) {
    if (!b) return { label: '—', cls: '' };
    if (b < 18.5) return { label: 'Underweight', cls: 'beige' };
    if (b < 25) return { label: 'Healthy weight', cls: 'ok' };
    if (b < 30) return { label: 'Overweight', cls: 'pink' };
    return { label: 'Obesity', cls: 'miss' };
  }
  const isLb = function () { return settings.weight_unit === 'lb'; };
  function toDisplayWeight(kg) { return isLb() ? kg * 2.20462 : kg; }
  function fromDisplayWeight(v) { return isLb() ? v / 2.20462 : v; }
  function wUnit() { return isLb() ? 'lb' : 'kg'; }
  function fmtW(kg) { return fmt1(toDisplayWeight(kg)); }
  function fmtDelta(v, unit) {
    if (v === null || v === undefined || isNaN(v)) return '—';
    const r = round1(v);
    return (r > 0 ? '+' : r < 0 ? '−' : '±') + fmt1(Math.abs(r)) + (unit ? ' ' + unit : '');
  }

  function pendingCheckinWeek() {
    const s = startDate();
    if (!s) return null;
    const today = todayStr();
    const sun = lastSundayOnOrBefore(today);
    if (sun < s) return null;
    if (sun > addDays(endDate(), 7)) return null;
    return db.checkins[sun] ? null : sun;
  }

  /* ---------------------------------------------------------
     Rendering
     --------------------------------------------------------- */
  function renderAll() {
    renderHeader();
    renderBanner();
    renderSummary();
    renderRoutine();
    renderFood();
    renderExercise();
    renderProgress();
    applyTab();
  }

  function renderHeader() {
    const t = todayStr();
    $('#dateText').innerHTML = (viewDate === t ? '<span class="today-prefix">Today · </span>' : '') + esc(prettyDate(viewDate, viewDate.slice(0, 4) !== t.slice(0, 4)));
    $('#datePicker').value = viewDate;
    $('#datePicker').max = t;
    $('#nextDay').disabled = viewDate >= t;
    $('#goToday').disabled = viewDate === t;
  }

  function renderBanner() {
    const b = $('#banner');
    if (!Sync.connected()) {
      b.className = 'banner warn';
      b.innerHTML = '<span>Not synced to Google Sheets yet — saved on this device only.</span><button class="btn sm light" data-action="open-settings" type="button">Connect</button>';
      b.hidden = false;
    } else b.hidden = true;
  }

  function ring(pctVal, label, small) {
    const r = 37, c = 2 * Math.PI * r;
    return '<div class="ring"><svg viewBox="0 0 84 84" aria-hidden="true"><defs><linearGradient id="ringGrad" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f19ab8"/><stop offset="1" stop-color="#9a86d6"/></linearGradient></defs>' +
      '<circle class="track" cx="42" cy="42" r="' + r + '"/>' +
      '<circle class="fill" cx="42" cy="42" r="' + r + '" stroke-dasharray="' + c.toFixed(1) + '" stroke-dashoffset="' + (c * (1 - pctVal / 100)).toFixed(1) + '"/></svg>' +
      '<div class="ring-label"><b>' + label + '</b><small>' + small + '</small></div></div>';
  }

  function renderSummary() {
    const s = startDate();
    const c = computeDay(viewDate);
    const st = streakStats();
    const n = dayNumber(viewDate);
    const ws = weightsSorted();
    const latest = ws.length ? ws[ws.length - 1] : null;
    let ringHtml, title, sub, pctLine;

    if (!s) {
      ringHtml = ring(0, '—', 'of 60');
      title = 'Welcome!';
      sub = 'Set your start date to begin your 60 days.';
      pctLine = '<button class="btn sm" data-action="open-settings" type="button">Set start date</button>';
    } else if (n < 1) {
      ringHtml = ring(0, '0', 'of 60');
      title = 'Starts ' + prettyDate(s);
      sub = 'Your journey begins in ' + (1 - n) + ' day' + (1 - n === 1 ? '' : 's') + '.';
      pctLine = '';
    } else {
      const shown = Math.min(n, PROGRAM_DAYS);
      const prog = Math.round(pct(shown, PROGRAM_DAYS));
      ringHtml = ring(prog, String(shown), 'of 60');
      title = n > PROGRAM_DAYS ? '60 days complete 🎉' : 'Day ' + shown + ' of 60';
      sub = prettyDate(viewDate, true);
      pctLine = '<p class="pct-line">' + prog + '% of program · ' + c.goals_met + '/' + c.goals_enabled + ' goals today</p>';
    }

    $('#summary').innerHTML =
      '<div class="summary-top">' + ringHtml +
      '<div class="summary-text"><h2>' + esc(title) + '</h2><p>' + esc(sub) + '</p>' + pctLine + '</div></div>' +
      '<div class="stat-grid">' +
      stat(fmtInt(c.calories) + '<small> / ' + fmtInt(settings.calorie_target) + '</small>', 'Calories') +
      stat(fmt1(c.protein) + '<small> g</small>', 'Protein') +
      stat(fmtL(c.water_ml) + '<small> L</small>', 'Water') +
      stat(st.current + '<small> day' + (st.current === 1 ? '' : 's') + '</small>', 'Streak') +
      stat(latest ? fmtW(latest.weight_kg) + '<small> ' + wUnit() + '</small>' : '—', 'Weight') +
      stat(c.routine_pct + '<small>%</small>', 'Routine') +
      '</div>';
  }
  function stat(v, k) { return '<div class="stat"><span class="v">' + v + '</span><span class="k">' + k + '</span></div>'; }

  function bar(p, cls) { return '<div class="bar ' + (cls || '') + '"><i style="width:' + p.toFixed(1) + '%"></i></div>'; }
  function checkbox(checked, action, attrs, label) {
    return '<label class="check"><input type="checkbox" ' + (checked ? 'checked ' : '') + 'data-action="' + action + '" ' + attrs + ' aria-label="' + esc(label) + '"><span class="box">' + ICON.check + '</span></label>';
  }

  /* ----- Section 1: Routine ----- */
  function renderRoutine() {
    const date = viewDate;
    const isPast = date < todayStr();
    const items = routinesFor(date);
    const c = computeDay(date);
    const f = ui.routineFilter;
    const shown = items.filter(function (r) {
      const done = !!(routineLog(date, r.key) || {}).done;
      return f === 'all' || (f === 'done' ? done : !done);
    });
    const missed = isPast ? items.filter(function (r) { return !(routineLog(date, r.key) || {}).done; }) : [];

    let list = shown.map(function (r) {
      const log = routineLog(date, r.key) || {};
      const done = !!log.done;
      const noteOpen = !!openNotes[r.key];
      const hasNote = !!(log.notes && String(log.notes).trim());
      const status = done ? '<span class="tag ok">Done</span>' : (isPast ? '<span class="tag miss">Missed</span>' : '');
      return '<li><div class="row ' + (done ? 'done' : '') + '">' +
        checkbox(done, 'toggle-routine', 'data-key="' + esc(r.key) + '"', r.name) +
        '<div class="row-main"><div class="row-title">' + esc(r.name) + '</div>' +
        '<div class="row-meta">🕒 ' + esc(r.time) + (r.days ? ' · ' + r.days.map(function (d) { return DAY_SHORT[d]; }).join(' & ') + ' only' : '') + ' ' + status +
        (hasNote && !noteOpen ? '<br>📝 ' + esc(log.notes) : '') + '</div></div>' +
        '<div class="row-actions"><button class="mini-btn ' + (hasNote ? 'on' : '') + '" type="button" data-action="toggle-note" data-key="' + esc(r.key) + '" aria-label="Notes for ' + esc(r.name) + '">' + ICON.note + '</button></div>' +
        '</div>' +
        (noteOpen ? '<div class="note-box"><textarea rows="2" placeholder="Add a note…" data-action="routine-note" data-key="' + esc(r.key) + '">' + esc(log.notes || '') + '</textarea></div>' : '') +
        '</li>';
    }).join('');
    if (!shown.length) {
      list = '<li class="empty"><span class="emoji">' + (f === 'done' ? '🌱' : '✨') + '</span>' +
        (f === 'done' ? 'Nothing ticked yet — you’ve got this.' : 'Everything is done. Beautiful work!') + '</li>';
    }

    $('#view-routine').innerHTML =
      '<h2 class="section-title">Routine</h2>' +
      '<div class="card">' +
      '<div class="card-head"><div><h3 class="card-title">Daily checklist</h3><p class="card-sub">' + DAY_NAMES[weekday(date)] + ' · ' + items.length + ' habits</p></div>' +
      '<div class="big-number" style="font-size:28px">' + c.routine_pct + '<small>%</small></div></div>' +
      '<div class="metric"><div class="metric-row"><b>' + c.routine_done + ' of ' + c.routine_total + ' completed</b><span>Goal ' + settings.streak_rules.routine_pct + '%</span></div>' + bar(c.routine_pct) + '</div>' +
      '</div>' +
      '<div class="card">' +
      '<div class="seg" role="tablist">' +
      ['all', 'todo', 'done'].map(function (k) {
        const lbl = { all: 'All', todo: isPast ? 'Missed' : 'To do', done: 'Done' }[k];
        return '<button type="button" class="' + (f === k ? 'on' : '') + '" data-action="routine-filter" data-filter="' + k + '">' + lbl + '</button>';
      }).join('') + '</div>' +
      '<ul class="list">' + list + '</ul>' +
      '</div>' +
      (isPast && missed.length ? '<p class="help" style="margin:0 6px 14px">Missed on this day: ' + missed.map(function (m) { return esc(m.name); }).join(', ') + '. You can still tick them if you did them.</p>' : '');
  }

  /* ----- Section 2: Food ----- */
  function renderFood() {
    const date = viewDate;
    const c = computeDay(date);
    const target = num(settings.calorie_target);
    const remaining = target - c.calories;
    const entries = foodEntriesFor(date);
    const flex = num(settings.flex_calories);
    const waterTarget = num(settings.water_target_l) * 1000;

    const groups = MEALS.map(function (m) {
      const items = entries.filter(function (e) { return e.meal === m.key; });
      if (!items.length && m.key !== 'snacks') return '';
      const mealCal = items.reduce(function (s, e) { return s + (e.status === 'consumed' ? e.calories : 0); }, 0);
      const rows = items.map(foodRow).join('') || '<li class="empty-line">No snacks added. Tap + to add something you ate.</li>';
      return '<div class="meal-group"><div class="meal-head"><h4>' + m.label + '</h4><span>' + fmtInt(mealCal) + ' kcal</span></div><ul class="list">' + rows + '</ul></div>';
    }).join('');

    $('#view-food').innerHTML =
      '<h2 class="section-title">Food &amp; Nutrition</h2>' +
      '<div class="card">' +
      '<p class="eyebrow">Calories consumed</p>' +
      '<div class="big-number">' + fmtInt(c.calories) + ' <small>/ ' + fmtInt(target) + ' kcal</small></div>' +
      '<div style="margin:10px 0 6px">' + bar(pct(c.calories, target), c.calories > target ? 'over' : '') + '</div>' +
      '<div class="metric-row"><span>' + (remaining >= 0 ? fmtInt(remaining) + ' kcal remaining' : fmtInt(-remaining) + ' kcal over target') + '</span>' +
      '<span>Flex used ' + fmtInt(c.manualCal) + ' / ' + fmtInt(flex) + '</span></div>' +
      '<div class="metric" style="margin-top:12px"><div class="metric-row"><b>Protein</b><span>' + fmt1(c.protein) + ' / ' + fmt1(settings.protein_target) + ' g</span></div>' + bar(pct(c.protein, settings.protein_target), 'lav thin') + '</div>' +
      '<div class="metric"><div class="metric-row"><b>Fibre</b><span>' + fmt1(c.fibre) + ' / ' + fmt1(settings.fibre_target) + ' g</span></div>' + bar(pct(c.fibre, settings.fibre_target), 'mint thin') + '</div>' +
      '</div>' +

      '<div class="card">' +
      '<div class="card-head"><div><h3 class="card-title">' + DAY_NAMES[weekday(date)] + '’s meals</h3><p class="card-sub">Tick what you ate · Skip what you didn’t</p></div>' +
      '<button class="btn sm light" type="button" data-action="add-food" aria-label="Add food">' + '<svg class="ico" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>Add</button></div>' +
      groups +
      '</div>' +

      '<div class="card">' +
      '<div class="card-head"><div><h3 class="card-title">Water</h3><p class="card-sub">Target ' + fmt1(settings.water_target_l) + ' L</p></div>' +
      '<div class="big-number" style="font-size:28px">' + fmtL(c.water_ml) + '<small> L</small></div></div>' +
      bar(pct(c.water_ml, waterTarget), 'lav') +
      '<div class="water-buttons">' +
      '<button class="btn secondary" type="button" data-action="water" data-ml="250">+250 ml</button>' +
      '<button class="btn secondary" type="button" data-action="water" data-ml="500">+500 ml</button>' +
      '<button class="btn secondary" type="button" data-action="water" data-ml="1000">+1 L</button>' +
      '</div>' +
      '<form class="inline-form" data-form="water">' +
      '<input type="number" inputmode="numeric" min="-5000" max="5000" step="50" name="ml" placeholder="Custom ml (e.g. 300)" aria-label="Custom water amount in ml">' +
      '<button class="btn sm" type="submit">Add</button>' +
      '</form>' +
      '<div class="btn-row" style="margin-top:8px"><button class="btn ghost sm" type="button" data-action="water" data-ml="-250" ' + (c.water_ml <= 0 ? 'disabled' : '') + '>Undo 250 ml</button>' +
      '<button class="btn ghost sm" type="button" data-action="water-reset" ' + (c.water_ml <= 0 ? 'disabled' : '') + '>Reset</button></div>' +
      '</div>';
  }

  function foodRow(e) {
    const consumed = e.status === 'consumed';
    const skipped = e.status === 'skipped';
    const macros = fmtInt(e.calories) + ' kcal · ' + fmt1(e.protein) + ' g protein · ' + fmt1(e.fibre) + ' g fibre';
    let actions;
    if (e.source === 'manual') {
      actions = '<button class="mini-btn" type="button" data-action="edit-food" data-id="' + esc(e.id) + '" aria-label="Edit ' + esc(e.food) + '">' + ICON.edit + '</button>' +
        '<button class="mini-btn" type="button" data-action="delete-food" data-id="' + esc(e.id) + '" aria-label="Delete ' + esc(e.food) + '">' + ICON.trash + '</button>';
    } else {
      actions = '<button class="mini-btn ' + (skipped ? 'on' : '') + '" type="button" data-action="skip-food" data-item="' + esc(e.item_id) + '" aria-pressed="' + skipped + '">' + (skipped ? 'Undo' : 'Skip') + '</button>';
    }
    return '<li class="row ' + (consumed && e.source !== 'manual' ? 'done' : '') + (skipped ? ' skipped' : '') + '">' +
      (e.source === 'manual'
        ? checkbox(true, 'noop', 'disabled', e.food)
        : checkbox(consumed, 'toggle-food', 'data-item="' + esc(e.item_id) + '"' + (skipped ? ' disabled' : ''), e.food)) +
      '<div class="row-main"><div class="row-title">' + esc(e.food) + (e.source === 'manual' ? ' <span class="tag">Added</span>' : '') + (skipped ? ' <span class="tag beige">Skipped</span>' : '') + '</div>' +
      '<div class="row-meta">' + (e.quantity ? esc(e.quantity) + ' · ' : '') + macros + '</div></div>' +
      '<div class="row-actions">' + actions + '</div></li>';
  }

  /* ----- Section 3: Exercise ----- */
  function exerciseStatusHtml() {
    const ex = db.exercise[viewDate] || {};
    const steps = num(ex.steps), exMin = num(ex.exercise_min);
    const stepT = num(settings.step_target), exT = num(settings.exercise_target);
    const done = steps >= stepT && exMin >= exT;
    return '<div class="metric"><div class="metric-row"><b>Steps</b><span>' + fmtInt(steps) + ' / ' + fmtInt(stepT) + '</span></div>' + bar(pct(steps, stepT), 'mint') + '</div>' +
      '<div class="metric"><div class="metric-row"><b>Exercise</b><span>' + fmtInt(exMin) + ' / ' + fmtInt(exT) + ' minutes</span></div>' + bar(pct(exMin, exT), 'lav') + '</div>' +
      '<div class="done-badge ' + (done ? '' : 'pending') + '">' + (done ? '🌸 Activity goals complete for the day!' : '🎯 ' + (steps >= stepT ? 'Steps done' : fmtInt(Math.max(0, stepT - steps)) + ' steps to go') + ' · ' + (exMin >= exT ? 'exercise done' : Math.max(0, exT - exMin) + ' min exercise to go')) + '</div>';
  }

  function renderExercise() {
    const ex = db.exercise[viewDate] || {};
    const types = String(ex.exercise_type || '').split(',').map(function (s) { return s.trim(); }).filter(Boolean);

    $('#view-exercise').innerHTML =
      '<h2 class="section-title">Exercise &amp; Activity</h2>' +
      '<div class="card" id="exStatus">' + exerciseStatusHtml() + '</div>' +
      '<div class="card">' +
      '<h3 class="card-title" style="margin-bottom:12px">Log activity</h3>' +
      '<label class="field"><span>Total steps</span><input type="number" inputmode="numeric" min="0" max="100000" step="1" data-ex="steps" value="' + (ex.steps !== undefined && ex.steps !== '' ? esc(ex.steps) : '') + '" placeholder="e.g. 6200"></label>' +
      '<div class="btn-row" style="margin:-4px 0 12px"><button class="btn secondary sm" type="button" data-action="steps-add" data-n="500">+500</button><button class="btn secondary sm" type="button" data-action="steps-add" data-n="1000">+1,000</button><button class="btn secondary sm" type="button" data-action="steps-add" data-n="2000">+2,000</button></div>' +
      '<form class="inline-form" data-form="steps" style="margin:0 0 4px">' +
      '<input type="number" inputmode="numeric" min="1" max="100000" step="1" name="n" placeholder="Add steps (e.g. 1250)" aria-label="Number of steps to add">' +
      '<button class="btn sm" type="submit">Add</button>' +
      '</form>' +
      '<p class="help" style="margin:4px 0 12px">Adds to today’s total — handy after each walk. To set an exact total, type it in “Total steps”.</p>' +
      '<div class="grid-2">' +
      '<label class="field"><span>Walking (min)</span><input type="number" inputmode="numeric" min="0" max="1440" data-ex="walking_min" value="' + (ex.walking_min !== undefined && ex.walking_min !== '' ? esc(ex.walking_min) : '') + '" placeholder="0"></label>' +
      '<label class="field"><span>Exercise (min)</span><input type="number" inputmode="numeric" min="0" max="1440" data-ex="exercise_min" value="' + (ex.exercise_min !== undefined && ex.exercise_min !== '' ? esc(ex.exercise_min) : '') + '" placeholder="0"></label>' +
      '</div>' +
      '<div class="field"><span>Exercise type</span></div>' +
      '<div class="chips">' + EXERCISE_TYPES.map(function (t) {
        return '<button type="button" class="' + (types.indexOf(t) > -1 ? 'on' : '') + '" data-action="ex-type" data-type="' + t + '" aria-pressed="' + (types.indexOf(t) > -1) + '">' + t + '</button>';
      }).join('') + '</div>' +
      '<label class="field"><span>Calories burned (optional)</span><input type="number" inputmode="numeric" min="0" max="5000" data-ex="calories_burned" value="' + (ex.calories_burned !== undefined && ex.calories_burned !== '' ? esc(ex.calories_burned) : '') + '" placeholder="From your watch, if you have it"></label>' +
      '<p class="help">Values save automatically when you leave a field.</p>' +
      '</div>' +

      '<details class="info"><summary>Automatic step sync (Google Fit / Apple Health)?</summary><div class="info-body">' +
      '<p><b>Automatic syncing isn’t possible for a website on iPhone.</b> Here is why:</p>' +
      '<ul><li><b>Google Fit APIs</b> are deprecated by Google — new sign-ups stopped in 2024 and the APIs are being shut down.</li>' +
      '<li><b>Health Connect</b> (Google’s replacement) is an on-device Android API with no web access.</li>' +
      '<li><b>Apple Health</b> has no web API — websites can’t read your iPhone steps.</li></ul>' +
      '<p>So enter steps manually from the Health app. Optional free shortcut: an iPhone <b>Shortcut</b> can read today’s steps from Apple Health and send them to your Google Sheet. See the README for steps.</p>' +
      '</div></details>';
  }

  /* ----- Section 4: Progress ----- */
  function renderProgress() {
    const s = startDate();
    const today = todayStr();
    const st = streakStats();
    const ws = weightsSorted();
    const pending = pendingCheckinWeek();
    let html = '<h2 class="section-title">Progress</h2>';

    if (pending) {
      html += '<div class="checkin-cta"><div class="txt"><b>🌷 Sunday check-in</b>Week of ' + shortDate(pending) + ' is waiting for you.</div><button class="btn sm" type="button" data-action="open-checkin">Start</button></div>';
    }

    if (!s) {
      html += '<div class="card"><div class="empty"><span class="emoji">🗓️</span>Choose your start date in Settings to begin the 60-day counter.<br><br><button class="btn" type="button" data-action="open-settings">Set start date</button></div></div>';
    } else {
      const n = dayNumber(today);
      const shown = Math.max(0, Math.min(n, PROGRAM_DAYS));
      const prog = Math.round(pct(shown, PROGRAM_DAYS));
      const remaining = Math.max(0, PROGRAM_DAYS - shown);
      const elapsed = Math.max(0, Math.min(n, PROGRAM_DAYS));
      const successRate = elapsed ? Math.round((st.completed / elapsed) * 100) : 0;
      html += '<div class="card day-hero">' +
        '<p class="eyebrow">' + (n < 1 ? 'Starting soon' : n > PROGRAM_DAYS ? 'Program complete' : 'Your journey') + '</p>' +
        '<div class="day-big">DAY ' + shown + ' <small>/ 60</small></div>' +
        '<div class="line">' + prog + '% COMPLETED · ' + remaining + ' DAYS REMAINING</div>' +
        bar(prog) +
        '<div class="kv-grid">' +
        kv(prettyDate(s, true), 'Start date') + kv(prettyDate(endDate(), true), 'Target end date') +
        kv(plural(st.completed, 'day'), 'Goal days completed') + kv(successRate + '%', 'Success rate so far') +
        '</div></div>';

      // streaks
      const rules = settings.streak_rules;
      const enabledN = GOALS.filter(function (g) { return rules.goals[g.key]; }).length;
      html += '<div class="card"><div class="card-head"><div><h3 class="card-title">Streaks</h3><p class="card-sub">A day counts when ' + Math.min(rules.min_goals, enabledN) + ' of ' + enabledN + ' goals are met</p></div><div class="big-number" style="font-size:30px">🔥' + st.current + '</div></div>' +
        '<div class="kv-grid">' + kv(plural(st.current, 'day'), 'Current streak') + kv(plural(st.longest, 'day'), 'Longest streak') + kv(st.completed, 'Total completed days') + kv(st.missed, 'Missed days') + '</div>' +
        '<div class="metric" style="margin-top:12px"><div class="metric-row"><b>This week</b><span>' + st.weekDone + ' / ' + st.weekDays + ' days · ' + st.weekPct + '%</span></div>' + bar(st.weekPct, 'lav') + '</div>' +
        '</div>';

      // calendar
      let cal = '';
      for (let i = 0; i < PROGRAM_DAYS; i++) {
        const d = addDays(s, i);
        const c = st.perDay[d];
        let cls = 'future';
        if (d <= today) cls = c && c.completed ? 'done' : (c && c.hasData ? 'partial' : (d < today ? 'missed' : ''));
        if (d === today) cls += ' today';
        if (d === viewDate) cls += ' viewing';
        cal += '<button type="button" class="cal-day ' + cls + '" data-action="goto-date" data-date="' + d + '" ' + (d > today ? 'disabled' : '') + ' aria-label="Day ' + (i + 1) + ', ' + prettyDate(d) + '">' + (i + 1) + '</button>';
      }
      html += '<div class="card"><h3 class="card-title" style="margin-bottom:12px">60-day calendar</h3><div class="calendar">' + cal + '</div>' +
        '<div class="legend"><span><i style="background:#e47fa2"></i>Completed</span><span><i style="background:#efeafb"></i>Partial</span><span><i style="background:#f1e8e8"></i>Missed</span><span><i style="border:1.5px dashed #e8dbe2"></i>Upcoming</span></div>' +
        '<p class="help" style="margin:8px 0 0">Tap a day to view or edit it.</p></div>';
    }

    // weight
    const unit = wUnit();
    const latest = ws[ws.length - 1], prev = ws[ws.length - 2], first = ws[0];
    html += '<div class="card"><div class="card-head"><div><h3 class="card-title">Weight</h3><p class="card-sub">Weekly check-in every Sunday</p></div><button class="btn sm light" type="button" data-action="log-weight">+ Log</button></div>';
    if (!ws.length) {
      html += '<div class="empty"><span class="emoji">⚖️</span>No weight recorded yet. Log your starting weight to see your trend.</div>';
    } else {
      const change = prev ? toDisplayWeight(latest.weight_kg) - toDisplayWeight(prev.weight_kg) : null;
      const total = toDisplayWeight(latest.weight_kg) - toDisplayWeight(first.weight_kg);
      html += '<div class="kv-grid">' +
        kv(fmtW(latest.weight_kg) + ' ' + unit, 'Current (' + shortDate(latest.date) + ')') +
        kv(prev ? fmtW(prev.weight_kg) + ' ' + unit : '—', 'Previous' + (prev ? ' (' + shortDate(prev.date) + ')' : '')) +
        kv(fmtDelta(change, unit), 'Change vs previous') +
        kv(fmtDelta(ws.length > 1 ? total : null, unit), 'Total since start') +
        '</div>' +
        '<div style="margin-top:14px">' + lineChart(ws.map(function (w) { return { x: w.date, y: toDisplayWeight(w.weight_kg) }; }), { color: '#d9668c', unit: unit }) + '</div>' +
        '<p class="help" style="margin:8px 0 0">Start ' + fmtW(first.weight_kg) + ' ' + unit + ' → latest ' + fmtW(latest.weight_kg) + ' ' + unit + ' · ' + trendText(ws) + '</p>';
    }
    html += '</div>';

    // BMI
    html += '<div class="card"><div class="card-head"><div><h3 class="card-title">BMI</h3><p class="card-sub">Calculated from your weight and height (' + fmt1(settings.height_cm) + ' cm)</p></div></div>';
    if (!ws.length) {
      html += '<div class="empty"><span class="emoji">📏</span>BMI appears automatically after your first weight entry.</div>';
    } else {
      const bNow = bmiOf(num(latest.weight_kg));
      const bPrev = prev ? bmiOf(num(prev.weight_kg)) : null;
      const cat = bmiCategory(bNow);
      html += '<div class="kv-grid">' +
        kv(fmt1(bNow) + ' <span class="tag ' + cat.cls + '">' + cat.label + '</span>', 'Current BMI') +
        kv(bPrev ? fmt1(bPrev) : '—', 'Previous BMI') +
        kv(bPrev ? fmtDelta(bNow - bPrev) : '—', 'BMI change') +
        kv('18.5 – 24.9', 'Healthy adult range') +
        '</div>' +
        '<div style="margin-top:14px">' + lineChart(ws.map(function (w) { return { x: w.date, y: bmiOf(num(w.weight_kg)) }; }), { color: '#7d68c3', unit: '' }) + '</div>' +
        '<p class="help" style="margin:8px 0 0">Ranges: under 18.5 underweight · 18.5–24.9 healthy · 25–29.9 overweight · 30+ obesity.</p>';
    }
    html += '</div>';

    // weight history + check-ins
    if (ws.length) {
      html += '<div class="card"><h3 class="card-title" style="margin-bottom:8px">Weight history</h3><ul class="history">' +
        ws.slice().reverse().map(function (w) {
          return '<li><div class="h-main"><b>' + fmtW(w.weight_kg) + ' ' + unit + '</b><small>' + prettyDate(w.date, true) + ' · BMI ' + fmt1(bmiOf(num(w.weight_kg))) + '</small></div>' +
            '<button class="mini-btn" type="button" data-action="delete-weight" data-id="' + esc(w.id) + '" aria-label="Delete weight entry">' + ICON.trash + '</button></li>';
        }).join('') + '</ul></div>';
    }
    const cis = Object.values(db.checkins).sort(function (a, b) { return a.id < b.id ? 1 : -1; });
    html += '<div class="card"><h3 class="card-title" style="margin-bottom:8px">Sunday check-ins</h3>';
    if (!cis.length) html += '<div class="empty"><span class="emoji">💌</span>Your weekly reflections will appear here.</div>';
    else html += '<ul class="history">' + cis.map(function (ci) {
      return '<li><div class="h-main"><b>Week of ' + shortDate(ci.id) + '</b><small>' +
        (num(ci.weight_kg) ? fmtW(ci.weight_kg) + ' ' + unit + ' · ' : '') + esc(ci.exercise_days || 0) + ' exercise days · ' + fmtInt(ci.avg_steps) + ' avg steps · sleep ' + esc(ci.sleep_consistency || '—') + '</small></div>' +
        '<button class="mini-btn" type="button" data-action="view-checkin" data-id="' + esc(ci.id) + '" aria-label="Open check-in">' + ICON.edit + '</button></li>';
    }).join('') + '</ul>';
    html += '</div>';

    $('#view-progress').innerHTML = html;
  }
  function plural(n, w) { return n + ' ' + w + (n === 1 ? '' : 's'); }
  function kv(v, k) { return '<div class="kv"><b>' + v + '</b><span>' + k + '</span></div>'; }

  function trendText(ws) {
    if (ws.length < 2) return 'add another weigh-in to see your trend';
    // least-squares slope in kg per week
    const xs = ws.map(function (w) { return diffDays(ws[0].date, w.date) / 7; });
    const ys = ws.map(function (w) { return num(w.weight_kg); });
    const mx = xs.reduce(function (a, b) { return a + b; }, 0) / xs.length;
    const my = ys.reduce(function (a, b) { return a + b; }, 0) / ys.length;
    let nume = 0, den = 0;
    xs.forEach(function (x, i) { nume += (x - mx) * (ys[i] - my); den += (x - mx) * (x - mx); });
    const slope = den ? nume / den : 0;
    const perWeek = toDisplayWeight(Math.abs(slope));
    if (Math.abs(slope) < 0.05) return 'trend: steady';
    return 'trend: ' + (slope < 0 ? 'down' : 'up') + ' ~' + fmt1(perWeek) + ' ' + wUnit() + '/week';
  }

  // Lightweight SVG line chart — only real data points are plotted
  function lineChart(points, opts) {
    const W = 340, H = 170, L = 34, R = 12, T = 16, B = 26;
    if (!points.length) return '';
    let ys = points.map(function (p) { return p.y; });
    let min = Math.min.apply(null, ys), max = Math.max.apply(null, ys);
    if (max - min < 1) { min -= 0.5; max += 0.5; }
    const padY = (max - min) * 0.15; min -= padY; max += padY;
    const x0 = points[0].x, span = Math.max(1, diffDays(x0, points[points.length - 1].x));
    const IN = 16; // inner padding so point labels don't touch the axis
    const X = function (d) { return points.length === 1 ? (L + (W - L - R) / 2) : L + IN + (diffDays(x0, d) / span) * (W - L - R - IN * 2); };
    const Y = function (v) { return T + (1 - (v - min) / (max - min)) * (H - T - B); };
    let g = '';
    for (let i = 0; i <= 3; i++) {
      const v = min + ((max - min) * i) / 3, y = Y(v);
      g += '<line class="grid-line" x1="' + L + '" x2="' + (W - R) + '" y1="' + y.toFixed(1) + '" y2="' + y.toFixed(1) + '"/>' +
        '<text class="axis-label" x="' + (L - 6) + '" y="' + (y + 3).toFixed(1) + '" text-anchor="end">' + fmt1(v) + '</text>';
    }
    const path = points.map(function (p, i) { return (i ? 'L' : 'M') + X(p.x).toFixed(1) + ' ' + Y(p.y).toFixed(1); }).join(' ');
    const area = path + ' L' + X(points[points.length - 1].x).toFixed(1) + ' ' + (H - B) + ' L' + X(points[0].x).toFixed(1) + ' ' + (H - B) + ' Z';
    const labelEvery = Math.ceil(points.length / 5);
    let dots = '', xl = '';
    points.forEach(function (p, i) {
      const cx = X(p.x), cy = Y(p.y);
      dots += '<circle class="pt" cx="' + cx.toFixed(1) + '" cy="' + cy.toFixed(1) + '" r="4.5" fill="' + opts.color + '"><title>' + shortDate(p.x) + ': ' + fmt1(p.y) + ' ' + opts.unit + '</title></circle>';
      if (i % labelEvery === 0 || i === points.length - 1) {
        xl += '<text class="axis-label" x="' + cx.toFixed(1) + '" y="' + (H - 8) + '" text-anchor="middle">' + shortDate(p.x) + '</text>';
        dots += '<text class="pt-label" x="' + cx.toFixed(1) + '" y="' + (cy - 9).toFixed(1) + '" text-anchor="middle">' + fmt1(p.y) + '</text>';
      }
    });
    return '<svg class="chart" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Line chart">' + g +
      (points.length > 1 ? '<path class="area" d="' + area + '" fill="' + opts.color + '"/><path class="line" d="' + path + '" stroke="' + opts.color + '"/>' : '') +
      dots + xl + '</svg>';
  }

  /* ---------------------------------------------------------
     Tabs
     --------------------------------------------------------- */
  function applyTab() {
    $$('.view').forEach(function (v) { v.classList.toggle('active', v.dataset.view === ui.tab); });
    $$('.nav-btn').forEach(function (b) {
      const on = b.dataset.tab === ui.tab;
      b.classList.toggle('active', on);
      b.setAttribute('aria-current', on ? 'page' : 'false');
    });
    const fab = $('#fab');
    if (fab) fab.hidden = !(ui.tab === 'food' || window.matchMedia('(min-width: 1100px)').matches);
  }

  /* ---------------------------------------------------------
     Actions
     --------------------------------------------------------- */
  function setRoutine(key, patch) {
    const r = settings.routines.find(function (x) { return x.key === key; });
    if (!r) return;
    const id = viewDate + '|' + key;
    const prev = db.routine[id] || { id: id, date: viewDate, routine_key: key, done: false, notes: '' };
    const rec = Object.assign({}, prev, { routine_name: r.name, planned_time: r.time }, patch, { updated_at: nowIso() });
    db.routine[id] = rec;
    Sync.queue('routine', rec);
    refreshDaily(viewDate);
  }

  function setPlannedFood(itemId, status) {
    const item = planItemsFor(viewDate).find(function (p) { return p.id === itemId; });
    if (!item) return;
    const id = viewDate + '|' + itemId;
    const rec = {
      id: id, date: viewDate, item_id: itemId, source: 'planned', meal: item.meal,
      food: item.food, quantity: item.quantity, calories: num(item.calories), protein: num(item.protein), fibre: num(item.fibre),
      status: status, updated_at: nowIso()
    };
    db.food[id] = rec;
    Sync.queue('food', rec);
    refreshDaily(viewDate);
  }

  function setWater(ml) {
    refreshDaily(viewDate, { water_ml: Math.max(0, Math.round(ml)) });
  }

  function setExercise(field, value) {
    const prev = db.exercise[viewDate] || { id: viewDate, date: viewDate };
    const rec = Object.assign({}, prev, { id: viewDate, date: viewDate, updated_at: nowIso() });
    rec[field] = value;
    db.exercise[viewDate] = rec;
    Sync.queue('exercise', rec);
    refreshDaily(viewDate);
  }

  function saveSettingKeys(keys) {
    keys.forEach(function (k) { Sync.queue('settings', { id: k, value: JSON.stringify(settings[k]), updated_at: nowIso() }); });
    saveCache();
  }

  document.addEventListener('click', function (ev) {
    const t = ev.target.closest('[data-action],[data-tab],[data-close]');
    if (!t) return;
    if (t.hasAttribute('data-close')) { closeModal(); return; }
    if (t.dataset.tab) { ui.tab = t.dataset.tab; saveUi(); applyTab(); window.scrollTo({ top: 0, behavior: 'smooth' }); return; }
    const a = t.dataset.action;
    switch (a) {
      case 'open-settings': openSettings(); break;
      case 'routine-filter': ui.routineFilter = t.dataset.filter; saveUi(); renderRoutine(); break;
      case 'toggle-note': openNotes[t.dataset.key] = !openNotes[t.dataset.key]; renderRoutine();
        if (openNotes[t.dataset.key]) { const ta = $('textarea[data-key="' + t.dataset.key + '"]'); if (ta) ta.focus(); }
        break;
      case 'skip-food': {
        const id = viewDate + '|' + t.dataset.item;
        const cur = db.food[id] ? db.food[id].status : 'pending';
        setPlannedFood(t.dataset.item, cur === 'skipped' ? 'pending' : 'skipped');
        renderAll();
        break;
      }
      case 'add-food': openFoodForm(null); break;
      case 'edit-food': openFoodForm(t.dataset.id); break;
      case 'delete-food': {
        const f = db.food[t.dataset.id];
        if (f && confirm('Delete "' + f.food + '"?')) {
          delete db.food[t.dataset.id];
          Sync.queueDelete('food', t.dataset.id);
          refreshDaily(viewDate);
          renderAll();
          toast('Deleted ' + f.food, 'ok');
        }
        break;
      }
      case 'water': setWater(computeDay(viewDate).water_ml + num(t.dataset.ml)); renderAll(); break;
      case 'water-reset': if (confirm('Reset water for this day to 0?')) { setWater(0); renderAll(); } break;
      case 'steps-add': {
        const cur = num((db.exercise[viewDate] || {}).steps);
        setExercise('steps', cur + num(t.dataset.n)); renderAll(); break;
      }
      case 'ex-type': {
        const cur = String((db.exercise[viewDate] || {}).exercise_type || '').split(',').map(function (s) { return s.trim(); }).filter(Boolean);
        const i = cur.indexOf(t.dataset.type);
        if (i > -1) cur.splice(i, 1); else cur.push(t.dataset.type);
        setExercise('exercise_type', cur.join(', ')); renderAll(); break;
      }
      case 'goto-date': viewDate = t.dataset.date; openNotes = {}; renderAll(); window.scrollTo({ top: 0, behavior: 'smooth' }); break;
      case 'log-weight': openWeightForm(); break;
      case 'delete-weight': {
        const w = db.weight[t.dataset.id];
        if (w && confirm('Delete the weight entry for ' + prettyDate(w.date, true) + '?')) {
          delete db.weight[t.dataset.id];
          Sync.queueDelete('weight', t.dataset.id);
          saveCache(); renderAll(); toast('Weight entry deleted', 'ok');
        }
        break;
      }
      case 'open-checkin': openCheckin(pendingCheckinWeek()); break;
      case 'view-checkin': openCheckin(t.dataset.id); break;
      case 'quick-pick': fillFoodForm(QUICK_PICKS[num(t.dataset.i)]); break;
    }
  });

  document.addEventListener('change', function (ev) {
    const t = ev.target;
    if (t.dataset.action === 'toggle-routine') { setRoutine(t.dataset.key, { done: t.checked }); renderAll(); }
    else if (t.dataset.action === 'toggle-food') { setPlannedFood(t.dataset.item, t.checked ? 'consumed' : 'pending'); renderAll(); }
    else if (t.dataset.action === 'routine-note') { setRoutine(t.dataset.key, { notes: t.value }); }
    else if (t.dataset.ex) {
      const v = t.value === '' ? '' : Math.max(0, Math.round(num(t.value)));
      setExercise(t.dataset.ex, v);
      // partial refresh so the next field keeps focus on iPhone
      $('#exStatus').innerHTML = exerciseStatusHtml();
      renderSummary(); renderProgress();
    }
  });

  const noteInput = debounce(function (key, value) { setRoutine(key, { notes: value }); }, 700);
  document.addEventListener('input', function (ev) {
    const t = ev.target;
    if (t.dataset.action === 'routine-note') noteInput(t.dataset.key, t.value);
  });

  document.addEventListener('submit', function (ev) {
    const f = ev.target;
    if (f.dataset.form === 'water') {
      ev.preventDefault();
      const ml = num(f.ml.value);
      if (!ml) return;
      setWater(computeDay(viewDate).water_ml + ml); renderAll();
    } else if (f.dataset.form === 'steps') {
      ev.preventDefault();
      const n = Math.round(num(f.n.value));
      if (!(n > 0)) { toast('Enter the number of steps to add', 'err'); f.n.focus(); return; }
      const cur = num((db.exercise[viewDate] || {}).steps);
      setExercise('steps', cur + n);
      renderAll();
      toast('Added ' + fmtInt(n) + ' steps · total ' + fmtInt(cur + n), 'ok');
    }
  });

  // date navigation
  $('#prevDay').addEventListener('click', function () { viewDate = addDays(viewDate, -1); openNotes = {}; renderAll(); });
  $('#nextDay').addEventListener('click', function () { if (viewDate < todayStr()) { viewDate = addDays(viewDate, 1); openNotes = {}; renderAll(); } });
  $('#goToday').addEventListener('click', function () { viewDate = todayStr(); openNotes = {}; renderAll(); });
  $('#datePicker').addEventListener('change', function (e) {
    if (isValidDate(e.target.value)) { viewDate = e.target.value > todayStr() ? todayStr() : e.target.value; openNotes = {}; renderAll(); }
  });
  $('#openSettings').addEventListener('click', openSettings);
  $('#closeSettings').addEventListener('click', closeSettings);
  $('#syncPill').addEventListener('click', function () {
    if (!Sync.connected()) { openSettings(); return; }
    Sync.flush().then(function () { return Sync.load({ announce: true }); }).then(renderAll);
  });

  /* ---------------------------------------------------------
     Modal helpers
     --------------------------------------------------------- */
  function openModal(html) {
    $('#sheetBody').innerHTML = html;
    $('#modal').hidden = false;
    document.body.classList.add('no-scroll');
  }
  function closeModal() {
    $('#modal').hidden = true;
    $('#sheetBody').innerHTML = '';
    if ($('#settingsPage').hidden) document.body.classList.remove('no-scroll');
  }
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !$('#modal').hidden) closeModal(); });

  /* ----- Manual food form ----- */
  function openFoodForm(id) {
    const f = id ? db.food[id] : null;
    openModal(
      '<h3 id="sheetTitle">' + (f ? 'Edit food' : 'Add food') + '</h3>' +
      '<p class="sub">' + prettyDate(viewDate, true) + ' · counts toward your flexible ' + fmtInt(settings.flex_calories) + ' kcal</p>' +
      (f ? '' : '<div class="quick-picks">' + QUICK_PICKS.map(function (q, i) { return '<button type="button" data-action="quick-pick" data-i="' + i + '">' + esc(q.food) + '</button>'; }).join('') + '</div>') +
      '<form id="foodForm" novalidate>' +
      '<label class="field"><span>Food name *</span><input type="text" name="food" required maxlength="80" autocomplete="off" value="' + esc(f ? f.food : '') + '" placeholder="e.g. Banana"></label>' +
      '<div class="grid-2">' +
      '<label class="field"><span>Quantity</span><input type="text" name="quantity" maxlength="40" value="' + esc(f ? f.quantity : '') + '" placeholder="1 medium"></label>' +
      '<label class="field"><span>Meal category</span><select name="meal">' + MEALS.map(function (m) {
        return '<option value="' + m.key + '"' + ((f ? f.meal : 'snacks') === m.key ? ' selected' : '') + '>' + m.label + '</option>';
      }).join('') + '</select></label>' +
      '</div>' +
      '<div class="grid-3">' +
      '<label class="field"><span>Calories *</span><input type="number" inputmode="decimal" name="calories" min="0" max="5000" step="any" required value="' + (f ? esc(f.calories) : '') + '" placeholder="kcal"></label>' +
      '<label class="field"><span>Protein (g)</span><input type="number" inputmode="decimal" name="protein" min="0" max="500" step="any" value="' + (f ? esc(f.protein) : '') + '" placeholder="0"></label>' +
      '<label class="field"><span>Fibre (g)</span><input type="number" inputmode="decimal" name="fibre" min="0" max="200" step="any" value="' + (f ? esc(f.fibre) : '') + '" placeholder="0"></label>' +
      '</div>' +
      '<p class="help">Don’t know the protein or fibre? Just enter calories — the rest can stay empty.</p>' +
      '<div class="btn-row"><button type="button" class="btn secondary" data-close>Cancel</button><button type="submit" class="btn">Save</button></div>' +
      '</form>'
    );
    $('#foodForm').addEventListener('submit', function (e) {
      e.preventDefault();
      const fm = e.target;
      const name = fm.food.value.trim();
      const cal = fm.calories.value;
      if (!name) { toast('Please enter a food name', 'err'); fm.food.focus(); return; }
      if (cal === '' || num(cal, -1) < 0) { toast('Please enter calories (0 or more)', 'err'); fm.calories.focus(); return; }
      const rid = f ? f.id : viewDate + '|' + uid('m');
      const rec = {
        id: rid, date: f ? f.date : viewDate, item_id: rid.split('|')[1], source: 'manual', meal: fm.meal.value,
        food: name, quantity: fm.quantity.value.trim(), calories: round1(num(cal)), protein: round1(num(fm.protein.value)), fibre: round1(num(fm.fibre.value)),
        status: 'consumed', updated_at: nowIso()
      };
      db.food[rid] = rec;
      Sync.queue('food', rec);
      refreshDaily(rec.date);
      closeModal();
      renderAll();
      toast((f ? 'Updated ' : 'Added ') + name + ' · ' + fmtInt(rec.calories) + ' kcal', 'ok');
    });
    if (!f) setTimeout(function () { const i = $('#foodForm input[name="food"]'); if (i) i.focus(); }, 250);
  }
  function fillFoodForm(q) {
    const fm = $('#foodForm');
    if (!fm || !q) return;
    fm.food.value = q.food; fm.quantity.value = q.quantity; fm.calories.value = q.calories;
    fm.protein.value = q.protein; fm.fibre.value = q.fibre; fm.meal.value = 'snacks';
  }

  /* ----- Weight form ----- */
  function openWeightForm() {
    const t = todayStr();
    openModal(
      '<h3 id="sheetTitle">Log weight</h3><p class="sub">Use your real scale reading. BMI is calculated for you.</p>' +
      '<form id="weightForm" novalidate>' +
      '<div class="grid-2">' +
      '<label class="field"><span>Date</span><input type="date" name="date" value="' + t + '" max="' + t + '" required></label>' +
      '<label class="field"><span>Weight (' + wUnit() + ')</span><input type="number" inputmode="decimal" name="weight" min="20" max="400" step="0.1" required placeholder="e.g. 62.4"></label>' +
      '</div>' +
      '<div class="btn-row"><button type="button" class="btn secondary" data-close>Cancel</button><button type="submit" class="btn">Save</button></div>' +
      '</form>'
    );
    $('#weightForm').addEventListener('submit', function (e) {
      e.preventDefault();
      const d = e.target.date.value, w = num(e.target.weight.value);
      if (!isValidDate(d)) { toast('Please choose a date', 'err'); return; }
      if (!(w > 0)) { toast('Please enter your weight', 'err'); return; }
      saveWeight(d, fromDisplayWeight(w));
      closeModal(); renderAll();
      toast('Weight saved · BMI ' + fmt1(bmiOf(fromDisplayWeight(w))), 'ok');
    });
  }
  function saveWeight(date, kg) {
    const rec = { id: date, date: date, weight_kg: Math.round(kg * 100) / 100, height_cm: num(settings.height_cm), bmi: round1(bmiOf(kg)), updated_at: nowIso() };
    db.weight[date] = rec;
    Sync.queue('weight', rec);
    saveCache();
  }

  /* ----- Sunday check-in ----- */
  function weekAverages(sunday) {
    // the 7 days ending on that Sunday (Mon–Sun), limited to program days up to today
    const out = { exDays: 0, steps: 0, cal: 0, protein: 0, waterDays: 0, days: 0 };
    let stepsN = 0, calN = 0;
    for (let i = 6; i >= 0; i--) {
      const d = addDays(sunday, -i);
      if (d > todayStr() || (startDate() && d < startDate())) continue;
      const c = computeDay(d);
      out.days++;
      if (c.exercise_min >= num(settings.exercise_target)) out.exDays++;
      if (c.steps > 0) { out.steps += c.steps; stepsN++; }
      if (c.calories > 0) { out.cal += c.calories; out.protein += c.protein; calN++; }
      if (c.met.water) out.waterDays++;
    }
    out.steps = stepsN ? Math.round(out.steps / stepsN) : '';
    out.protein = calN ? round1(out.protein / calN) : '';
    out.cal = calN ? Math.round(out.cal / calN) : '';
    return out;
  }

  function openCheckin(sunday) {
    if (!sunday) return;
    const ex = db.checkins[sunday];
    const av = weekAverages(sunday);
    const waterGuess = av.days ? (av.waterDays / av.days >= 0.85 ? 'Excellent' : av.waterDays / av.days >= 0.6 ? 'Good' : av.waterDays / av.days >= 0.3 ? 'Fair' : 'Poor') : '';
    const v = function (k, dflt) { return ex && ex[k] !== undefined && ex[k] !== '' ? ex[k] : dflt; };
    const wVal = ex && num(ex.weight_kg) ? fmt1(toDisplayWeight(num(ex.weight_kg))) : '';
    const sel = function (name, opts, cur) {
      return '<select name="' + name + '"><option value="">Select…</option>' + opts.map(function (o) { return '<option' + (o === cur ? ' selected' : '') + '>' + o + '</option>'; }).join('') + '</select>';
    };
    openModal(
      '<h3 id="sheetTitle">Sunday check-in</h3><p class="sub">Week ending ' + prettyDate(sunday, true) + '. Averages are pre-filled from your logs — adjust if needed.</p>' +
      '<form id="checkinForm" novalidate>' +
      '<label class="field"><span>1. Current weight (' + wUnit() + ') *</span><input type="number" inputmode="decimal" name="weight" min="20" max="400" step="0.1" value="' + wVal + '" placeholder="Enter your current weight" required></label>' +
      '<div class="grid-2">' +
      '<label class="field"><span>2. Exercise days</span><input type="number" inputmode="numeric" name="exercise_days" min="0" max="7" value="' + esc(v('exercise_days', av.exDays)) + '"></label>' +
      '<label class="field"><span>3. Avg daily steps</span><input type="number" inputmode="numeric" name="avg_steps" min="0" value="' + esc(v('avg_steps', av.steps)) + '"></label>' +
      '<label class="field"><span>4. Avg daily calories</span><input type="number" inputmode="numeric" name="avg_calories" min="0" value="' + esc(v('avg_calories', av.cal)) + '"></label>' +
      '<label class="field"><span>5. Avg protein (g)</span><input type="number" inputmode="decimal" name="avg_protein" min="0" step="any" value="' + esc(v('avg_protein', av.protein)) + '"></label>' +
      '</div>' +
      '<label class="field"><span>6. Water intake consistency</span>' + sel('water_consistency', ['Excellent', 'Good', 'Fair', 'Poor'], v('water_consistency', waterGuess)) + '</label>' +
      '<label class="field"><span>7. Bowel movements (BMs)</span>' + sel('bowel_movements', ['Regular – daily', 'Mostly regular', 'Irregular', 'Constipated', 'Loose']
        , v('bowel_movements', '')) + '</label>' +
      '<label class="field"><span>8. Sleep consistency</span>' + sel('sleep_consistency', ['Excellent', 'Good', 'Fair', 'Poor'], v('sleep_consistency', '')) + '</label>' +
      '<label class="field"><span>9. Period / cycle notes (optional)</span><textarea name="period_notes" rows="2" placeholder="Optional">' + esc(v('period_notes', '')) + '</textarea></label>' +
      '<label class="field"><span>10. General progress notes</span><textarea name="progress_notes" rows="3" placeholder="How did this week feel? Wins, struggles, changes…">' + esc(v('progress_notes', '')) + '</textarea></label>' +
      '<div class="btn-row"><button type="button" class="btn secondary" data-close>' + (ex ? 'Close' : 'Later') + '</button><button type="submit" class="btn">' + (ex ? 'Update' : 'Submit check-in') + '</button></div>' +
      '</form>'
    );
    $('#checkinForm').addEventListener('submit', function (e) {
      e.preventDefault();
      const fm = e.target;
      const w = num(fm.weight.value);
      if (!(w > 0)) { toast('Please enter your current weight', 'err'); fm.weight.focus(); return; }
      const kg = fromDisplayWeight(w);
      const rec = {
        id: sunday, week_date: sunday, weight_kg: Math.round(kg * 100) / 100,
        exercise_days: fm.exercise_days.value, avg_steps: fm.avg_steps.value, avg_calories: fm.avg_calories.value, avg_protein: fm.avg_protein.value,
        water_consistency: fm.water_consistency.value, bowel_movements: fm.bowel_movements.value, sleep_consistency: fm.sleep_consistency.value,
        period_notes: fm.period_notes.value.trim(), progress_notes: fm.progress_notes.value.trim(), submitted_at: nowIso()
      };
      db.checkins[sunday] = rec;
      Sync.queue('checkins', rec);
      saveWeight(sunday, kg);
      closeModal(); renderAll();
      toast('Check-in saved. Proud of you! 🌸', 'ok');
    });
  }

  function maybePromptCheckin() {
    const p = pendingCheckinWeek();
    let snoozed = null;
    try { snoozed = sessionStorage.getItem(SS_CHECKIN_SNOOZE); } catch (e) { /* ignore */ }
    if (p && snoozed !== p && $('#modal').hidden && $('#settingsPage').hidden) {
      try { sessionStorage.setItem(SS_CHECKIN_SNOOZE, p); } catch (e) { /* ignore */ }
      openCheckin(p);
    }
  }

  /* ---------------------------------------------------------
     Settings page
     --------------------------------------------------------- */
  let planDay = DAY_KEYS[new Date().getDay()];
  let draftPlan = null;

  function openSettings() {
    draftPlan = JSON.parse(JSON.stringify(settings.meal_plan));
    renderSettings();
    $('#settingsPage').hidden = false;
    $('#settingsPage').scrollTop = 0;
    document.body.classList.add('no-scroll');
  }
  function closeSettings() {
    $('#settingsPage').hidden = true;
    document.body.classList.remove('no-scroll');
    renderAll();
  }

  function renderSettings() {
    const s = settings, r = s.streak_rules;
    const numField = function (label, name, val, attrs) {
      return '<label class="field"><span>' + label + '</span><input type="number" inputmode="decimal" name="' + name + '" value="' + esc(val) + '" ' + (attrs || '') + '></label>';
    };
    $('#settingsBody').innerHTML =
      // Google Sheets
      '<form class="card" id="connForm" novalidate><h3 class="card-title">Google Sheets connection</h3>' +
      '<label class="field"><span>Apps Script web app URL</span><input type="url" name="url" inputmode="url" autocomplete="off" autocapitalize="off" spellcheck="false" value="' + esc(conn.url) + '" placeholder="https://script.google.com/macros/s/…/exec"></label>' +
      '<label class="field"><span>Access token</span><input type="password" name="token" autocomplete="off" autocapitalize="off" spellcheck="false" value="' + esc(conn.token) + '" placeholder="Paste the token from Apps Script"></label>' +
      '<p class="help">The URL and token are stored only on this device (never in the code on GitHub). Enter them on each device you use. See README → Step 2.</p>' +
      '<div class="btn-row"><button class="btn" type="submit">Save &amp; test</button><button class="btn secondary" type="button" id="syncNow">Sync now</button></div>' +
      '<p class="help" style="margin:10px 0 0">' + (Sync.connected() ? 'Last synced: ' + (lastSynced ? new Date(lastSynced).toLocaleString() : 'never') + ' · ' + Sync.count() + ' unsaved change(s)' : 'Not connected.') + '</p>' +
      '</form>' +

      // Program + targets
      '<form class="card" id="targetsForm" novalidate><h3 class="card-title">Program &amp; daily targets</h3>' +
      '<label class="field"><span>60-day start date</span><input type="date" name="start_date" value="' + esc(s.start_date) + '"></label>' +
      '<div class="grid-2">' +
      numField('Calories (kcal)', 'calorie_target', s.calorie_target, 'min="800" max="5000" step="10"') +
      numField('Flexible allowance (kcal)', 'flex_calories', s.flex_calories, 'min="0" max="2000" step="10"') +
      numField('Protein (g)', 'protein_target', s.protein_target, 'min="0" max="400" step="1"') +
      numField('Fibre (g)', 'fibre_target', s.fibre_target, 'min="0" max="200" step="1"') +
      numField('Water (litres)', 'water_target_l', s.water_target_l, 'min="0.5" max="8" step="0.1"') +
      numField('Steps', 'step_target', s.step_target, 'min="0" max="60000" step="100"') +
      numField('Exercise (minutes)', 'exercise_target', s.exercise_target, 'min="0" max="600" step="5"') +
      numField('Height (cm)', 'height_cm', s.height_cm, 'min="100" max="250" step="0.5"') +
      '</div>' +
      '<label class="field"><span>Weight unit</span><select name="weight_unit"><option value="kg"' + (s.weight_unit === 'kg' ? ' selected' : '') + '>Kilograms (kg)</option><option value="lb"' + (s.weight_unit === 'lb' ? ' selected' : '') + '>Pounds (lb)</option></select></label>' +
      '<h3 class="card-title" style="margin-top:8px">Streak rules</h3>' +
      '<p class="help" style="margin-top:-6px">A day is “completed” when at least this many of the selected goals are met.</p>' +
      GOALS.map(function (g) {
        return '<label class="switch-row">' + '<span class="check"><input type="checkbox" name="goal_' + g.key + '"' + (r.goals[g.key] ? ' checked' : '') + '><span class="box">' + ICON.check + '</span></span>' + g.label + '</label>';
      }).join('') +
      '<div class="grid-2" style="margin-top:8px">' +
      numField('Minimum goals per day', 'min_goals', r.min_goals, 'min="1" max="6" step="1"') +
      numField('Routine goal (% done)', 'routine_pct', r.routine_pct, 'min="10" max="100" step="5"') +
      '</div>' +
      '<button class="btn block" type="submit">Save targets</button>' +
      '</form>' +

      // Routine timings
      '<form class="card" id="routineForm" novalidate><h3 class="card-title">Routine timings</h3>' +
      s.routines.map(function (rt) {
        return '<div class="routine-edit"><div class="name">' + esc(rt.name) + (rt.days ? '<small>' + rt.days.map(function (d) { return DAY_NAMES[d]; }).join(' & ') + ' only</small>' : '<small>Every day</small>') + '</div>' +
          '<input type="text" name="time_' + esc(rt.key) + '" value="' + esc(rt.time) + '" maxlength="30" aria-label="Planned time for ' + esc(rt.name) + '"></div>';
      }).join('') +
      '<button class="btn block" type="submit" style="margin-top:12px">Save timings</button>' +
      '</form>' +

      // Meal plan
      '<div class="card" id="mealCard"><h3 class="card-title">Weekly meal schedule</h3>' +
      '<p class="help" style="margin-top:-6px">Repeats every week for all 60 days. Nutrition values are estimates — adjust to your portions. Past days you already ticked keep their recorded values.</p>' +
      '<div class="day-tabs">' + DAY_KEYS.map(function (dk, i) { return '<button type="button" class="' + (dk === planDay ? 'on' : '') + '" data-plan-day="' + dk + '">' + DAY_SHORT[i] + '</button>'; }).join('') + '</div>' +
      '<div id="planItems"></div>' +
      '<div class="btn-row"><button class="btn secondary" type="button" id="addPlanItem">+ Add item</button><button class="btn" type="button" id="savePlan">Save meal plan</button></div>' +
      '<button class="btn ghost block" type="button" id="copyPlan" style="margin-top:6px">Copy ' + DAY_NAMES[DAY_KEYS.indexOf(planDay)] + ' to all days</button>' +
      '</div>' +

      // Export
      '<div class="card"><h3 class="card-title">Export data (CSV)</h3>' +
      '<p class="help" style="margin-top:-6px">Downloads what’s currently loaded from your Google Sheet.</p>' +
      '<div class="btn-row">' + Object.keys(SHEETS).filter(function (k) { return k !== 'settings'; }).map(function (k) {
        return '<button class="btn secondary sm" type="button" data-export="' + k + '">' + SHEETS[k].replace('_', ' ') + '</button>';
      }).join('') + '</div></div>' +

      // Device
      '<div class="card"><h3 class="card-title">This device</h3>' +
      '<p class="help" style="margin-top:-6px">Clears the offline copy on this phone only. Your Google Sheet is not touched. Unsaved changes will be lost.</p>' +
      '<button class="btn danger block" type="button" id="clearCache">Clear local cache</button></div>' +
      '<p class="help" style="text-align:center">My 60-Day Transformation · data lives in your Google Sheet</p>';

    renderPlanItems();
    bindSettings();
  }

  function renderPlanItems() {
    const items = draftPlan[planDay] || [];
    $('#planItems').innerHTML = items.length ? items.map(function (it, i) {
      return '<div class="plan-item" data-i="' + i + '">' +
        '<div class="grid-2"><label class="field"><span>Meal</span><select data-k="meal">' + MEALS.map(function (m) { return '<option value="' + m.key + '"' + (it.meal === m.key ? ' selected' : '') + '>' + m.label + '</option>'; }).join('') + '</select></label>' +
        '<label class="field"><span>Quantity</span><input type="text" data-k="quantity" value="' + esc(it.quantity) + '" maxlength="40"></label></div>' +
        '<label class="field"><span>Food</span><input type="text" data-k="food" value="' + esc(it.food) + '" maxlength="80"></label>' +
        '<div class="grid-3"><label class="field"><span>kcal</span><input type="number" inputmode="decimal" step="any" min="0" data-k="calories" value="' + esc(it.calories) + '"></label>' +
        '<label class="field"><span>Protein g</span><input type="number" inputmode="decimal" step="any" min="0" data-k="protein" value="' + esc(it.protein) + '"></label>' +
        '<label class="field"><span>Fibre g</span><input type="number" inputmode="decimal" step="any" min="0" data-k="fibre" value="' + esc(it.fibre) + '"></label></div>' +
        '<div class="plan-item-foot"><button class="btn danger sm" type="button" data-remove-plan="' + i + '">Remove</button></div>' +
        '</div>';
    }).join('') : '<div class="empty">No items planned for this day.</div>';
    const total = items.reduce(function (s, it) { return s + num(it.calories); }, 0);
    $('#planItems').insertAdjacentHTML('beforeend', '<p class="help">Planned total: ' + fmtInt(total) + ' kcal · leaves ' + fmtInt(num(settings.calorie_target) - total) + ' kcal of your daily target for flexible choices.</p>');
  }

  function bindSettings() {
    $('#connForm').addEventListener('submit', async function (e) {
      e.preventDefault();
      const url = e.target.url.value.trim(), token = e.target.token.value.trim();
      if (url && !/^https:\/\/script\.google(usercontent)?\.com\//.test(url)) { toast('That doesn’t look like an Apps Script web app URL (it should start with https://script.google.com/)', 'err', 5000); return; }
      conn = { url: url, token: token };
      lsSet(LS_CONN, conn);
      if (!url) { toast('Disconnected from Google Sheets'); renderSettings(); updateSyncPill(); return; }
      const ok = await Sync.load({ announce: false });
      if (ok) {
        toast('Connected to Google Sheets ✓', 'ok');
        if (!lastSynced || Sync.count()) Sync.flush();
      }
      draftPlan = JSON.parse(JSON.stringify(settings.meal_plan));
      renderSettings();
    });
    $('#syncNow').addEventListener('click', async function () {
      await Sync.flush();
      await Sync.load({ announce: true });
      draftPlan = JSON.parse(JSON.stringify(settings.meal_plan));
      renderSettings();
    });

    $('#targetsForm').addEventListener('submit', function (e) {
      e.preventDefault();
      const f = e.target;
      if (f.start_date.value && !isValidDate(f.start_date.value)) { toast('Please choose a valid start date', 'err'); return; }
      const posOr = function (v, d) { const n = num(v, NaN); return isFinite(n) && n >= 0 ? n : d; };
      settings.start_date = f.start_date.value;
      ['calorie_target', 'flex_calories', 'protein_target', 'fibre_target', 'water_target_l', 'step_target', 'exercise_target', 'height_cm'].forEach(function (k) {
        settings[k] = posOr(f[k].value, settings[k]);
      });
      settings.weight_unit = f.weight_unit.value === 'lb' ? 'lb' : 'kg';
      const goals = {};
      GOALS.forEach(function (g) { goals[g.key] = f['goal_' + g.key].checked; });
      if (!Object.values(goals).some(Boolean)) { toast('Select at least one streak goal', 'err'); return; }
      settings.streak_rules = {
        goals: goals,
        min_goals: Math.max(1, Math.min(6, Math.round(posOr(f.min_goals.value, 4)))),
        routine_pct: Math.max(10, Math.min(100, Math.round(posOr(f.routine_pct.value, 80))))
      };
      saveSettingKeys(['start_date', 'calorie_target', 'flex_calories', 'protein_target', 'fibre_target', 'water_target_l', 'step_target', 'exercise_target', 'height_cm', 'weight_unit', 'streak_rules']);
      toast('Targets saved', 'ok');
      renderSettings();
    });

    $('#routineForm').addEventListener('submit', function (e) {
      e.preventDefault();
      settings.routines = settings.routines.map(function (rt) {
        const v = e.target['time_' + rt.key];
        return Object.assign({}, rt, { time: v && v.value.trim() ? v.value.trim() : rt.time });
      });
      saveSettingKeys(['routines']);
      toast('Routine timings saved', 'ok');
    });

    const mealCard = $('#mealCard');
    mealCard.addEventListener('click', function (e) {
      const dayBtn = e.target.closest('[data-plan-day]');
      if (dayBtn) { planDay = dayBtn.dataset.planDay; $$('.day-tabs button', mealCard).forEach(function (b) { b.classList.toggle('on', b === dayBtn); }); $('#copyPlan').textContent = 'Copy ' + DAY_NAMES[DAY_KEYS.indexOf(planDay)] + ' to all days'; renderPlanItems(); return; }
      const rm = e.target.closest('[data-remove-plan]');
      if (rm) { draftPlan[planDay].splice(num(rm.dataset.removePlan), 1); renderPlanItems(); }
    });
    mealCard.addEventListener('input', function (e) {
      const k = e.target.dataset.k;
      const box = e.target.closest('.plan-item');
      if (!k || !box) return;
      const it = draftPlan[planDay][num(box.dataset.i)];
      it[k] = ['calories', 'protein', 'fibre'].indexOf(k) > -1 ? num(e.target.value) : e.target.value;
    });
    mealCard.addEventListener('change', function (e) { if (e.target.dataset.k === 'meal' || ['calories'].indexOf(e.target.dataset.k) > -1) renderPlanItems(); });
    $('#addPlanItem').addEventListener('click', function () {
      draftPlan[planDay] = draftPlan[planDay] || [];
      draftPlan[planDay].push({ id: uid(planDay), meal: 'snacks', food: '', quantity: '', calories: 0, protein: 0, fibre: 0 });
      renderPlanItems();
      const last = $$('#planItems .plan-item').pop();
      if (last) { const inp = $('input[data-k="food"]', last); if (inp) inp.focus(); }
    });
    $('#copyPlan').addEventListener('click', function () {
      if (!confirm('Replace every other day’s meal plan with ' + DAY_NAMES[DAY_KEYS.indexOf(planDay)] + '’s?')) return;
      DAY_KEYS.forEach(function (dk) {
        if (dk === planDay) return;
        draftPlan[dk] = draftPlan[planDay].map(function (it) { return Object.assign({}, it, { id: uid(dk) }); });
      });
      toast('Copied — tap “Save meal plan” to keep it');
    });
    $('#savePlan').addEventListener('click', function () {
      for (const dk of DAY_KEYS) {
        const bad = (draftPlan[dk] || []).find(function (it) { return !String(it.food || '').trim(); });
        if (bad) { toast('Every item needs a food name (' + DAY_NAMES[DAY_KEYS.indexOf(dk)] + ')', 'err'); return; }
      }
      settings.meal_plan = JSON.parse(JSON.stringify(draftPlan));
      saveSettingKeys(['meal_plan']);
      toast('Meal plan saved', 'ok');
    });

    $$('[data-export]').forEach(function (b) { b.addEventListener('click', function () { exportCsv(b.dataset.export); }); });
    $('#clearCache').addEventListener('click', function () {
      if (!confirm('Clear the offline copy on this device?' + (Sync.count() ? ' ' + Sync.count() + ' unsaved change(s) will be lost.' : ''))) return;
      [LS_CACHE, LS_PENDING].forEach(function (k) { try { localStorage.removeItem(k); } catch (e) { /* ignore */ } });
      location.reload();
    });
  }

  /* ---------------------------------------------------------
     CSV export
     --------------------------------------------------------- */
  function exportCsv(key) {
    const rows = Object.values(db[key]).sort(function (a, b) { return String(a.id) < String(b.id) ? -1 : 1; });
    if (!rows.length) { toast('No ' + SHEETS[key].replace('_', ' ') + ' to export yet'); return; }
    const cols = [];
    rows.forEach(function (r) { Object.keys(r).forEach(function (c) { if (cols.indexOf(c) < 0) cols.push(c); }); });
    const cell = function (v) {
      let s = v == null ? '' : String(v);
      if (/^[=+\-@]/.test(s) && isNaN(Number(s))) s = "'" + s; // avoid spreadsheet formula injection
      return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
    };
    const csv = [cols.join(',')].concat(rows.map(function (r) { return cols.map(function (c) { return cell(r[c]); }).join(','); })).join('\r\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = SHEETS[key] + '_' + todayStr() + '.csv';
    document.body.appendChild(a);
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  }

  /* ---------------------------------------------------------
     Toasts
     --------------------------------------------------------- */
  function toast(msg, type, ms) {
    const el = document.createElement('div');
    el.className = 'toast ' + (type || '');
    el.textContent = msg;
    $('#toasts').appendChild(el);
    setTimeout(function () { el.style.opacity = '0'; el.style.transition = 'opacity .3s'; }, (ms || 2600) - 300);
    setTimeout(function () { el.remove(); }, ms || 2600);
  }

  /* ---------------------------------------------------------
     First-run welcome
     --------------------------------------------------------- */
  function maybeWelcome() {
    if (startDate() || !$('#modal').hidden) return false;
    const t = todayStr();
    openModal(
      '<h3 id="sheetTitle">Welcome 🌸</h3><p class="sub">Let’s set up your 60-day transformation. You can change anything later in Settings.</p>' +
      '<form id="welcomeForm" novalidate>' +
      '<label class="field"><span>When does Day 1 start?</span><input type="date" name="start" value="' + t + '" required></label>' +
      '<p class="help">Connect your Google Sheet any time from Settings — follow README.md for the one-time setup.</p>' +
      '<div class="btn-row"><button type="button" class="btn secondary" data-close>Later</button><button class="btn" type="submit">Start my 60 days</button></div>' +
      '</form>'
    );
    $('#welcomeForm').addEventListener('submit', function (e) {
      e.preventDefault();
      const v = e.target.start.value;
      if (!isValidDate(v)) { toast('Please choose a start date', 'err'); return; }
      settings.start_date = v;
      saveSettingKeys(['start_date']);
      closeModal(); renderAll();
      toast('Day 1 is ' + prettyDate(v, true) + '. You’ve got this!', 'ok');
    });
    return true;
  }

  /* ---------------------------------------------------------
     iOS Shortcut / URL import: ?steps=1234[&date=YYYY-MM-DD]
     --------------------------------------------------------- */
  function handleUrlParams() {
    const p = new URLSearchParams(location.search);
    if (p.has('steps')) {
      const steps = Math.max(0, Math.round(num(p.get('steps'))));
      const d = isValidDate(p.get('date')) ? p.get('date') : todayStr();
      const keep = viewDate;
      viewDate = d;
      setExercise('steps', steps);
      viewDate = keep;
      toast('Imported ' + fmtInt(steps) + ' steps for ' + prettyDate(d), 'ok');
    }
    if (p.has('tab') && ['routine', 'food', 'exercise', 'progress'].indexOf(p.get('tab')) > -1) { ui.tab = p.get('tab'); }
    if (p.toString()) history.replaceState(null, '', location.pathname);
  }

  /* ---------------------------------------------------------
     Boot
     --------------------------------------------------------- */
  function addFab() {
    const b = document.createElement('button');
    b.id = 'fab'; b.className = 'fab'; b.type = 'button';
    b.setAttribute('data-action', 'add-food');
    b.setAttribute('aria-label', 'Add food you ate');
    b.innerHTML = ICON.plus;
    document.body.appendChild(b);
  }

  async function boot() {
    addFab();
    handleUrlParams();
    renderAll();
    updateSyncPill();

    if (Sync.connected()) {
      await Sync.load();
      renderAll();
    }
    if (!maybeWelcome()) maybePromptCheckin();

    // keep "today" correct if the app stays open past midnight
    let lastToday = todayStr();
    setInterval(function () {
      const t = todayStr();
      if (t !== lastToday) { if (viewDate === lastToday) viewDate = t; lastToday = t; renderAll(); maybePromptCheckin(); }
    }, 60000);

    window.addEventListener('online', function () { Sync.flush(); });
    document.addEventListener('visibilitychange', function () {
      if (document.visibilityState === 'visible' && Sync.connected()) {
        Sync.flush().then(function () { return Sync.load(); }).then(function () {
          if ($('#settingsPage').hidden && $('#modal').hidden) renderAll();
          maybePromptCheckin();
        });
      } else if (document.visibilityState === 'hidden') {
        Sync.flush();
      }
    });
    window.matchMedia('(min-width: 1100px)').addEventListener('change', applyTab);

    if ('serviceWorker' in navigator && location.protocol === 'https:') {
      navigator.serviceWorker.register('service-worker.js').catch(function () { /* offline support unavailable */ });
    }
  }

  boot();
})();
