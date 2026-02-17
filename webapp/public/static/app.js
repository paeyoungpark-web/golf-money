/* ========================================================
   Golf Settlement Pro — App JavaScript
   ======================================================== */

(function () {
  'use strict';

  // ============ STATE ============
  const STATE = {
    players: ['플레이어1', '플레이어2', '플레이어3', '플레이어4'],
    amountPerStroke: 1000,
    inputMode: 'manual', // 'manual' | 'camera'
    showSettings: false,
    showHoleDetails: false,
    uploadedImage: null,
    isProcessing: false,
    ocrProgress: 0,
    ocrResult: null,
    ocrCards: [],
    expectMoreCard: false,
    ocrTotalsCheck: null,
    ocrIssues: [],
    scores: initScores()
  };

  function initScores() {
    const pars = [4, 4, 3, 5, 4, 4, 5, 3, 4, 4, 4, 3, 5, 4, 4, 5, 3, 4];
    return pars.map((par, idx) => ({
      hole: idx + 1,
      par,
      nearest: false,
      scores: [0, 0, 0, 0],
      isDouble: false
    }));
  }

  // ============ ICONS (SVG strings) ============
  const ICONS = {
    golf: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="8" r="7"/><polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88"/></svg>`,
    settings: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>`,
    camera: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>`,
    edit: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>`,
    upload: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>`,
    image: `<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>`,
    dollar: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>`,
    trophy: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/></svg>`
  };

  // ============ HELPERS ============
  function $(sel, parent) { return (parent || document).querySelector(sel); }
  function $$(sel, parent) { return Array.from((parent || document).querySelectorAll(sel)); }
  function el(tag, attrs, ...children) {
    const e = document.createElement(tag);
    if (attrs) {
      for (const [k, v] of Object.entries(attrs)) {
        if (k === 'className') e.className = v;
        else if (k === 'innerHTML') e.innerHTML = v;
        else if (k.startsWith('on')) e.addEventListener(k.slice(2).toLowerCase(), v);
        else if (k === 'style' && typeof v === 'object') Object.assign(e.style, v);
        else e.setAttribute(k, v);
      }
    }
    for (const c of children) {
      if (typeof c === 'string') e.appendChild(document.createTextNode(c));
      else if (c) e.appendChild(c);
    }
    return e;
  }

  function formatAmount(n) {
    const abs = Math.abs(n);
    if (abs >= 10000) return (n >= 0 ? '+' : '-') + (abs / 10000).toFixed(abs % 10000 === 0 ? 0 : 1) + '만';
    return (n >= 0 ? '+' : '') + n.toLocaleString();
  }

  function formatAmountFull(n) {
    return (n >= 0 ? '+' : '') + n.toLocaleString() + '원';
  }

  // ============ DOUBLE CONDITION ============
  function checkDoubleCondition(hole) {
    const valid = hole.scores.filter(s => s > 0);
    if (valid.length === 0) return false;
    // Birdie or Eagle
    if (valid.some(s => s <= hole.par - 1)) return true;
    // Triple+ on Par 4,5
    if (hole.par >= 4 && valid.some(s => s >= hole.par + 3)) return true;
    // Double+ on Par 3
    if (hole.par === 3 && valid.some(s => s >= hole.par + 2)) return true;
    // 3+ tie
    const counts = {};
    valid.forEach(s => counts[s] = (counts[s] || 0) + 1);
    if (Object.values(counts).some(c => c >= 3)) return true;
    return false;
  }

  function recalcDoubles() {
    STATE.scores.forEach(h => { h.isDouble = checkDoubleCondition(h); });
  }

  // ============ SETTLEMENT CALCULATION ============
  function calculateSettlement() {
    const settlements = [0, 0, 0, 0];

    STATE.scores.forEach(hole => {
      const { scores: hs, par, nearest, isDouble } = hole;
      const valid = hs.map((s, idx) => ({ score: s, idx })).filter(p => p.score > 0);
      if (valid.length === 0) return;

      const mult = isDouble ? 2 : 1;

      for (let i = 0; i < valid.length; i++) {
        for (let j = i + 1; j < valid.length; j++) {
          const p1 = valid[i], p2 = valid[j];
          let diff = p2.score - p1.score;
          if (p1.score === par - 1) diff += 1;
          else if (p2.score === par - 1) diff -= 1;
          if (p1.score === par - 2) diff += 2;
          else if (p2.score === par - 2) diff -= 2;
          const amt = diff * STATE.amountPerStroke * mult;
          settlements[p1.idx] += amt;
          settlements[p2.idx] -= amt;
        }
      }

      // Birdie → Eagle extra
      const birdies = valid.filter(({ score }) => score === par - 1);
      const eagles = valid.filter(({ score }) => score === par - 2);
      if (birdies.length > 0 && eagles.length > 0) {
        const extra = 2 * STATE.amountPerStroke * mult;
        birdies.forEach(({ idx: bi }) => {
          eagles.forEach(({ idx: ei }) => {
            settlements[bi] -= extra;
            settlements[ei] += extra;
          });
        });
      }

      // Nearest (Par 3 only)
      if (par === 3 && nearest !== false) {
        const nAmt = 1 * STATE.amountPerStroke * mult;
        valid.forEach(({ idx }) => {
          if (idx !== nearest) {
            settlements[nearest] += nAmt;
            settlements[idx] -= nAmt;
          }
        });
      }
    });

    return settlements;
  }

  function calculateHoleDetails() {
    return STATE.scores.map(hole => {
      const { hole: holeNum, scores: hs, par, nearest, isDouble } = hole;
      const valid = hs.map((s, idx) => ({ score: s, idx })).filter(p => p.score > 0);
      if (valid.length === 0) {
        return { hole: holeNum, par, scores: hs, settlements: [0, 0, 0, 0], details: [], isDouble };
      }

      const holeS = [0, 0, 0, 0];
      const details = [];
      const mult = isDouble ? 2 : 1;

      for (let i = 0; i < valid.length; i++) {
        for (let j = i + 1; j < valid.length; j++) {
          const p1 = valid[i], p2 = valid[j];
          let diff = p2.score - p1.score;
          let bonus = '';
          if (p1.score === par - 1) { diff += 1; bonus = ' (버디 축하금 +1타)'; }
          else if (p2.score === par - 1) { diff -= 1; bonus = ' (버디 축하금 -1타)'; }
          if (p1.score === par - 2) { diff += 2; bonus = ' (이글 축하금 +2타)'; }
          else if (p2.score === par - 2) { diff -= 2; bonus = ' (이글 축하금 -2타)'; }
          const amt = diff * STATE.amountPerStroke * mult;
          if (amt !== 0) {
            holeS[p1.idx] += amt;
            holeS[p2.idx] -= amt;
            let desc = `${STATE.players[p1.idx]}(${p1.score}타) vs ${STATE.players[p2.idx]}(${p2.score}타)`;
            if (bonus) desc += bonus;
            desc += ` → ${STATE.players[p1.idx]} ${formatAmountFull(amt)}`;
            details.push(desc);
          }
        }
      }

      const birdies = valid.filter(({ score }) => score === par - 1);
      const eagles = valid.filter(({ score }) => score === par - 2);
      if (birdies.length > 0 && eagles.length > 0) {
        const extra = 2 * STATE.amountPerStroke * mult;
        birdies.forEach(({ idx: bi }) => {
          eagles.forEach(({ idx: ei }) => {
            holeS[bi] -= extra;
            holeS[ei] += extra;
            details.push(`${STATE.players[bi]} → ${STATE.players[ei]} 추가 ${extra.toLocaleString()}원`);
          });
        });
      }

      if (par === 3 && nearest !== false) {
        const nAmt = 1 * STATE.amountPerStroke * mult;
        const totalN = nAmt * (valid.length - 1);
        details.push(`⭐ ${STATE.players[nearest]} 니어리스트! 1타 × ${valid.length - 1}명 = +${totalN.toLocaleString()}원`);
        valid.forEach(({ idx }) => {
          if (idx !== nearest) {
            holeS[nearest] += nAmt;
            holeS[idx] -= nAmt;
          }
        });
      }

      return { hole: holeNum, par, scores: hs, settlements: holeS, details, isDouble };
    });
  }

  // ============ OCR NORMALIZER (same logic from original) ============
  const parseIntLoose = (v) => {
    if (v === null || v === undefined) return null;
    if (typeof v === 'number' && Number.isFinite(v)) return Math.trunc(v);
    const s = String(v).trim();
    if (!s) return null;
    const m = s.match(/[+-]?\d+/);
    return m ? Math.trunc(Number(m[0])) : null;
  };

  const isFiniteInt = (n) => Number.isFinite(n) && Number.isInteger(n);

  const rangeForPar = (par) => ({
    minDiff: -3, maxDiff: par, minScore: Math.max(1, par - 3), maxScore: par * 2
  });

  const sanitizeDiff = (diff, par, holeNo, name, issues) => {
    if (diff === null || !isFiniteInt(diff) || !Number.isFinite(par)) return null;
    const { minDiff, maxDiff } = rangeForPar(par);
    if (diff < minDiff || diff > maxDiff) {
      issues.push({ type: 'OUT_OF_RANGE_DIFF', hole: holeNo, player: name, value: diff });
      return null;
    }
    return diff;
  };

  const sanitizeScore = (score, par, holeNo, name, issues) => {
    if (score === null || !isFiniteInt(score) || !Number.isFinite(par)) return null;
    const { minScore, maxScore } = rangeForPar(par);
    if (score < minScore || score > maxScore) {
      issues.push({ type: 'OUT_OF_RANGE_SCORE', hole: holeNo, player: name, value: score });
      return null;
    }
    return score;
  };

  const normalizePlayersList = (players) => {
    const names = Array.isArray(players) ? players.map(p => (typeof p === 'string' ? p.trim() : '')).filter(Boolean) : [];
    return names.length ? names : ['Player1', 'Player2'];
  };

  const normalizeHoles = (holes, issues) => {
    const out = Array.from({ length: 18 }, (_, i) => ({ hole: i + 1, par: null, kind: null, values: [] }));
    if (!Array.isArray(holes) || holes.length === 0) {
      issues.push({ type: 'NO_HOLES' });
      return out;
    }
    for (let i = 0; i < Math.min(18, holes.length); i++) {
      const h = holes[i] || {};
      const holeNo = parseIntLoose(h.hole) ?? (i + 1);
      const par = parseIntLoose(h.par) ?? parseIntLoose(h.PAR) ?? parseIntLoose(h.p);
      const diffsRaw = Array.isArray(h.diffs) ? h.diffs : null;
      const scoresRaw = Array.isArray(h.scores) ? h.scores : null;
      let kind = null, raw = null;
      if (diffsRaw && diffsRaw.length) { kind = 'diffs'; raw = diffsRaw; }
      else if (scoresRaw && scoresRaw.length) { kind = 'scores'; raw = scoresRaw; }
      else if (Array.isArray(h.values) && h.values.length) { kind = 'values'; raw = h.values; }
      else { kind = 'empty'; raw = []; }
      out[i] = { hole: holeNo, par: Number.isFinite(par) ? par : null, kind, values: raw.map(parseIntLoose) };
    }
    const validPars = out.map(x => x.par).filter(Number.isFinite).length;
    if (validPars < 9) {
      issues.push({ type: 'LOW_PAR_CONFIDENCE' });
      const fallback = [4, 4, 3, 5, 4, 4, 5, 3, 4, 4, 4, 3, 5, 4, 4, 5, 3, 4];
      for (let i = 0; i < 18; i++) if (!Number.isFinite(out[i].par)) out[i].par = fallback[i];
    }
    return out;
  };

  const decideValuesType = (values, par) => {
    const nums = values.filter(Number.isFinite);
    if (!nums.length || !Number.isFinite(par)) return 'diffs';
    const inStrokeRange = nums.every(n => n >= 1 && n <= 20);
    const nearPar = nums.filter(n => n >= par - 3 && n <= par + 6).length >= Math.ceil(nums.length * 0.6);
    const inDiffRange = nums.every(n => n >= -6 && n <= 9);
    const mostlySmall = nums.filter(n => Math.abs(n) <= 3).length >= Math.ceil(nums.length * 0.6);
    const { minDiff, maxDiff, minScore, maxScore } = rangeForPar(par);
    const withinRuleDiff = nums.filter(n => n >= minDiff && n <= maxDiff).length >= Math.ceil(nums.length * 0.7);
    if (inStrokeRange && nearPar && !(inDiffRange && mostlySmall)) return 'scores';
    if (inDiffRange && mostlySmall && withinRuleDiff && !(inStrokeRange && nearPar)) return 'diffs';
    let scoreOk = 0, diffOk = 0;
    for (const v of nums) { if (v >= minScore && v <= maxScore) scoreOk++; if (v >= minDiff && v <= maxDiff) diffOk++; }
    return scoreOk >= diffOk ? 'scores' : 'diffs';
  };

  const normalizeOneCard = (parsed) => {
    const issues = [];
    const players = normalizePlayersList(parsed?.players);
    const holesNorm = normalizeHoles(parsed?.holes, issues);
    const pc = players.length;
    const pars = holesNorm.map(h => h.par);
    const strokesTable = Array.from({ length: pc }, () => Array(18).fill(null));
    const diffsTable = Array.from({ length: pc }, () => Array(18).fill(null));

    for (let hi = 0; hi < 18; hi++) {
      const h = holesNorm[hi];
      const par = h.par;
      const rawVals = (h.values || []).slice(0, pc);
      let kind = h.kind;
      if (kind === 'values') kind = decideValuesType(rawVals, par);
      for (let pi = 0; pi < pc; pi++) {
        const name = players[pi] ?? `P${pi + 1}`;
        const v = rawVals[pi] ?? null;
        if (!Number.isFinite(par)) { strokesTable[pi][hi] = null; diffsTable[pi][hi] = null; continue; }
        let stroke = null, diff = null;
        if (kind === 'scores') { stroke = sanitizeScore(v, par, hi + 1, name, issues); diff = stroke === null ? null : sanitizeDiff(stroke - par, par, hi + 1, name, issues); }
        else if (kind === 'diffs') { diff = sanitizeDiff(v, par, hi + 1, name, issues); stroke = diff === null ? null : sanitizeScore(par + diff, par, hi + 1, name, issues); }
        strokesTable[pi][hi] = stroke;
        diffsTable[pi][hi] = diff;
      }
    }

    const totals = Array.isArray(parsed?.totals) ? parsed.totals.map(parseIntLoose) : null;
    return { players, pars, strokesTable, diffsTable, totals, issues };
  };

  const padToFour = (card) => {
    const players = [...card.players];
    while (players.length < 4) players.push(`P${players.length + 1}`);
    const st = [...card.strokesTable];
    const dt = [...card.diffsTable];
    while (st.length < 4) st.push(Array(18).fill(null));
    while (dt.length < 4) dt.push(Array(18).fill(null));
    return { ...card, players, strokesTable: st, diffsTable: dt };
  };

  const sumNonNull = (arr) => { let t = 0, f = 0; for (const x of arr) { if (Number.isFinite(x)) { t += x; f++; } } return { t, f }; };

  const buildTotalsCheck = (players, st, targetTotals) => {
    if (!Array.isArray(targetTotals)) return null;
    const out = [];
    for (let i = 0; i < players.length; i++) {
      const row = st[i] ?? Array(18).fill(null);
      const front = sumNonNull(row.slice(0, 9));
      const back = sumNonNull(row.slice(9, 18));
      const total = front.t + back.t;
      const filled = front.f + back.f;
      const target = parseIntLoose(targetTotals[i]);
      const canCompare = filled === 18 && Number.isFinite(target);
      out.push({ player: players[i], front: front.t, back: back.t, total, targetTotal: Number.isFinite(target) ? target : null, match: canCompare ? total === target : null });
    }
    return out;
  };

  const convertOne = (parsed) => {
    const one = normalizeOneCard(parsed);
    const padded = padToFour(one);
    const totalsCheck = buildTotalsCheck(padded.players, padded.strokesTable, padded.totals || Array(4).fill(null));
    return { ...padded, totalsCheck };
  };

  const mergeTwoCards = (cardA, cardB) => {
    const A = padToFour(normalizeOneCard(cardA));
    const B = padToFour(normalizeOneCard(cardB));
    const issues = [...A.issues, ...B.issues];
    const pars = Array.from({ length: 18 }, (_, i) => A.pars[i] ?? B.pars[i] ?? null);
    const players = ['P1', 'P2', 'P3', 'P4'];
    for (let i = 0; i < Math.min(2, A.players.length); i++) if (A.players[i]) players[i] = A.players[i];
    for (let i = 0; i < Math.min(2, B.players.length); i++) if (B.players[i]) players[2 + i] = B.players[i];
    const st = Array.from({ length: 4 }, () => Array(18).fill(null));
    const dt = Array.from({ length: 4 }, () => Array(18).fill(null));
    const copy = (src, si, di) => { for (let hi = 0; hi < 18; hi++) { st[di][hi] = src.strokesTable?.[si]?.[hi] ?? null; dt[di][hi] = src.diffsTable?.[si]?.[hi] ?? null; } };
    copy(A, 0, 0); copy(A, 1, 1); copy(B, 0, 2); copy(B, 1, 3);
    const targetTotals = [null, null, null, null];
    if (Array.isArray(A.totals)) { targetTotals[0] = parseIntLoose(A.totals[0]); targetTotals[1] = parseIntLoose(A.totals[1]); }
    if (Array.isArray(B.totals)) { targetTotals[2] = parseIntLoose(B.totals[0]); targetTotals[3] = parseIntLoose(B.totals[1]); }
    const totalsCheck = buildTotalsCheck(players, st, targetTotals);
    return { players, pars, strokesTable: st, diffsTable: dt, totalsCheck, issues };
  };

  const convertTwo = (a, b) => mergeTwoCards(a, b);

  function applyNormalizedResult(norm) {
    if (norm?.players?.length) STATE.players = norm.players.slice(0, 4);
    while (STATE.players.length < 4) STATE.players.push(`P${STATE.players.length + 1}`);

    STATE.scores = Array(18).fill(null).map((_, idx) => ({
      hole: idx + 1,
      par: Number.isFinite(norm?.pars?.[idx]) ? norm.pars[idx] : STATE.scores[idx]?.par ?? 4,
      nearest: false,
      scores: [0, 0, 0, 0],
      isDouble: false
    }));

    for (let hi = 0; hi < 18; hi++) {
      for (let pi = 0; pi < 4; pi++) {
        const v = norm?.strokesTable?.[pi]?.[hi];
        STATE.scores[hi].scores[pi] = Number.isFinite(v) ? v : 0;
      }
    }
    recalcDoubles();
  }

  // ============ OCR PROCESSING ============
  async function processImageWithOCR(imageData) {
    STATE.isProcessing = true;
    STATE.ocrResult = null;
    STATE.ocrProgress = 0;
    render();

    try {
      STATE.ocrProgress = 30;
      render();

      const resp = await fetch('/api/ocr-scorecard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageData })
      });

      STATE.ocrProgress = 70;
      render();

      if (!resp.ok) {
        let err = {};
        try { err = await resp.json(); } catch { }
        throw new Error(err.error || 'OCR API 호출 실패');
      }

      const parsedData = await resp.json();
      STATE.ocrProgress = 90;
      render();

      if (parsedData && parsedData.holes && parsedData.holes.length > 0) {
        const base = STATE.expectMoreCard ? STATE.ocrCards : [];
        const nextCards = [...base, parsedData].slice(0, 2);
        STATE.ocrCards = nextCards;

        if (nextCards.length === 1) {
          const norm1 = convertOne(nextCards[0]);
          STATE.ocrResult = { players: norm1.players, holes: Array(18).fill(0) };
          applyNormalizedResult(norm1);
          STATE.ocrTotalsCheck = norm1.totalsCheck;
          STATE.ocrIssues = norm1.issues;
          STATE.ocrProgress = 100;

          if (Array.isArray(parsedData.players) && parsedData.players.length >= 4) {
            STATE.expectMoreCard = false;
          } else {
            const more = confirm('추가 하실 스코어 카드가 있나요?\n(2명+2명 카드라면 [확인]을 눌러 두 번째 카드를 추가하세요)');
            if (more) {
              STATE.expectMoreCard = true;
              render();
              setTimeout(() => { const fi = $('#file-input'); if (fi) { fi.value = ''; fi.click(); } }, 100);
            } else {
              STATE.expectMoreCard = false;
            }
          }
        }

        if (nextCards.length === 2) {
          const norm2 = convertTwo(nextCards[0], nextCards[1]);
          STATE.ocrResult = { players: norm2.players, holes: Array(18).fill(0) };
          applyNormalizedResult(norm2);
          STATE.ocrTotalsCheck = norm2.totalsCheck;
          STATE.ocrIssues = norm2.issues;
          STATE.expectMoreCard = false;
          STATE.ocrProgress = 100;
        }
      } else {
        throw new Error('스코어 정보를 찾을 수 없습니다.');
      }
    } catch (error) {
      alert(`스코어카드 인식에 실패했습니다.\n오류: ${error.message}\n\n팁:\n- 이미지가 선명한지 확인하세요\n- 스코어카드 전체가 보이는지 확인하세요\n\n또는 직접 입력 모드를 사용해주세요.`);
    } finally {
      STATE.isProcessing = false;
      STATE.ocrProgress = 0;
      render();
    }
  }

  // ============ RENDER ============
  function render() {
    const app = $('#app');
    app.innerHTML = '';

    const container = el('div', { className: 'app-container' });

    // --- HEADER CARD ---
    const headerCard = el('div', { className: 'glass-card' });

    const header = el('div', { className: 'app-header' });
    const logo = el('div', { className: 'app-logo' },
      el('div', { className: 'logo-icon', innerHTML: '⛳' }),
      el('div', { className: 'logo-text' },
        el('h1', {}, 'Golf Settlement'),
        el('p', {}, 'premium score tracker')
      )
    );
    const btnSettings = el('button', {
      className: 'btn-settings',
      innerHTML: ICONS.settings,
      onClick: () => { STATE.showSettings = !STATE.showSettings; render(); }
    });
    header.append(logo, btnSettings);
    headerCard.appendChild(header);

    // Settings panel
    if (STATE.showSettings) {
      const panel = el('div', { className: 'settings-panel' });

      // Amount setting
      const amountSection = el('div', { className: 'settings-section' });
      amountSection.appendChild(el('div', { className: 'settings-label', innerHTML: ICONS.dollar + ' <span>1타당 금액 (원)</span>' }));
      const amtInput = el('input', {
        className: 'input-field',
        type: 'number',
        value: STATE.amountPerStroke,
        style: { maxWidth: '200px' }
      });
      amtInput.addEventListener('input', (e) => { STATE.amountPerStroke = parseInt(e.target.value) || 0; render(); });
      amountSection.appendChild(amtInput);
      panel.appendChild(amountSection);

      // Player names
      const namesSection = el('div', { className: 'settings-section' });
      namesSection.appendChild(el('div', { className: 'settings-label' }, '👤 플레이어 이름'));
      const namesGrid = el('div', { className: 'player-names-grid' });
      STATE.players.forEach((name, idx) => {
        const item = el('div', { className: 'player-name-item' });
        item.appendChild(el('div', { className: 'player-name-label' }, `Player ${idx + 1}`));
        const ni = el('input', { className: 'input-player-name', type: 'text', value: name });
        ni.addEventListener('change', (e) => { STATE.players[idx] = e.target.value || `P${idx + 1}`; render(); });
        item.appendChild(ni);
        namesGrid.appendChild(item);
      });
      namesSection.appendChild(namesGrid);
      panel.appendChild(namesSection);

      // Rules
      const rulesBox = el('div', { className: 'rules-box' });
      rulesBox.innerHTML = `<h4>🔥 2배판 자동 적용 조건</h4>
        <ul>
          <li>버디 또는 이글이 있을 때</li>
          <li>트리플 이상 (Par 4,5에서 +3타 이상)</li>
          <li>더블 이상 (Par 3에서 +2타 이상)</li>
          <li>3명 이상 동타일 때</li>
        </ul>`;
      panel.appendChild(rulesBox);
      headerCard.appendChild(panel);
    }

    // Mode tabs
    const tabs = el('div', { className: 'mode-tabs' });
    const manualTab = el('button', {
      className: 'mode-tab' + (STATE.inputMode === 'manual' ? ' active' : ''),
      innerHTML: ICONS.edit + ' <span>직접 입력</span>',
      onClick: () => { STATE.inputMode = 'manual'; render(); }
    });
    const cameraTab = el('button', {
      className: 'mode-tab' + (STATE.inputMode === 'camera' ? ' active' : ''),
      innerHTML: ICONS.camera + ' <span>스코어카드 인식</span>',
      onClick: () => { STATE.inputMode = 'camera'; render(); }
    });
    tabs.append(manualTab, cameraTab);
    headerCard.appendChild(tabs);
    container.appendChild(headerCard);

    // --- CAMERA MODE ---
    if (STATE.inputMode === 'camera') {
      const cameraCard = el('div', { className: 'glass-card' });

      if (!STATE.uploadedImage) {
        const uploadArea = el('div', { className: 'upload-area' });
        uploadArea.appendChild(el('div', { className: 'upload-icon-wrapper', innerHTML: ICONS.image }));
        uploadArea.appendChild(el('h3', { className: 'upload-title' }, '스코어카드 업로드'));
        uploadArea.appendChild(el('p', { className: 'upload-desc' }, 'GPT-4o Vision이 스코어카드를 자동으로 인식합니다'));

        const fileInput = el('input', { type: 'file', id: 'file-input', accept: 'image/*', className: 'hidden' });
        fileInput.addEventListener('change', (e) => {
          if (!STATE.expectMoreCard) {
            STATE.ocrCards = [];
            STATE.ocrTotalsCheck = null;
            STATE.ocrIssues = [];
          }
          const file = e.target.files[0];
          if (!file) return;
          const reader = new FileReader();
          reader.onload = (ev) => {
            STATE.uploadedImage = ev.target.result;
            render();
            processImageWithOCR(ev.target.result);
          };
          reader.readAsDataURL(file);
        });
        uploadArea.appendChild(fileInput);

        const btnUpload = el('button', {
          className: 'btn-primary',
          innerHTML: ICONS.upload + ' <span>이미지 선택</span>',
          onClick: () => fileInput.click()
        });
        uploadArea.appendChild(btnUpload);
        uploadArea.appendChild(el('div', { className: 'upload-badge' }, '🤖 OpenAI GPT-4o 고급 이미지 인식'));
        cameraCard.appendChild(uploadArea);
      } else {
        // Preview
        const title = el('h3', { style: { textAlign: 'center', fontSize: '18px', fontWeight: '700', marginBottom: '16px' } },
          STATE.isProcessing ? `스코어 인식 중... ${STATE.ocrProgress}%` : '스코어카드 미리보기');
        cameraCard.appendChild(title);

        if (STATE.isProcessing) {
          const progressBar = el('div', { className: 'ocr-progress-bar' });
          progressBar.appendChild(el('div', { className: 'ocr-progress-fill', style: { width: STATE.ocrProgress + '%' } }));
          cameraCard.appendChild(progressBar);
        }

        const imgWrapper = el('div', { className: 'preview-image-wrapper' });
        const img = el('img', { src: STATE.uploadedImage, alt: 'Scorecard', className: STATE.isProcessing ? 'processing' : '' });
        imgWrapper.appendChild(img);
        if (STATE.isProcessing) {
          const overlay = el('div', { className: 'ocr-overlay' });
          overlay.appendChild(el('div', { className: 'ocr-spinner' }));
          overlay.appendChild(el('div', { className: 'ocr-status-text' }, `GPT-4o 분석 중: ${STATE.ocrProgress}%`));
          imgWrapper.appendChild(overlay);
        }
        cameraCard.appendChild(imgWrapper);

        // Hidden file input for second card
        const fileInput2 = el('input', { type: 'file', id: 'file-input', accept: 'image/*', className: 'hidden' });
        fileInput2.addEventListener('change', (e) => {
          const file = e.target.files[0];
          if (!file) return;
          const reader = new FileReader();
          reader.onload = (ev) => {
            STATE.uploadedImage = ev.target.result;
            render();
            processImageWithOCR(ev.target.result);
          };
          reader.readAsDataURL(file);
        });
        cameraCard.appendChild(fileInput2);

        // OCR Result
        if (STATE.ocrResult && !STATE.isProcessing) {
          const resultBox = el('div', { className: 'ocr-result-box' });
          resultBox.appendChild(el('div', { className: 'ocr-result-title' }, '✓ 인식 완료'));
          resultBox.appendChild(el('div', { className: 'ocr-result-row', innerHTML: `<strong>플레이어:</strong> ${STATE.ocrResult.players?.join(', ')}` }));
          resultBox.appendChild(el('div', { className: 'ocr-result-row', innerHTML: `<strong>인식된 홀 수:</strong> 18홀` }));

          if (STATE.expectMoreCard) {
            resultBox.appendChild(el('div', { className: 'ocr-result-row', style: { color: 'var(--gold)' }, innerHTML: '<strong>추가 카드:</strong> 대기 중 (2명+2명)' }));
          }

          if (Array.isArray(STATE.ocrTotalsCheck)) {
            const tcDiv = el('div', { style: { marginTop: '10px' } });
            tcDiv.appendChild(el('div', { className: 'ocr-result-row', innerHTML: '<strong>합계 검증:</strong>' }));
            STATE.ocrTotalsCheck.slice(0, 4).forEach(r => {
              let text = `- ${r.player}: 전반 ${r.front}, 후반 ${r.back}, 전체 ${r.total}`;
              if (r.targetTotal !== null) {
                text += ` / 카드TOTAL ${r.targetTotal} ${r.match === null ? '(미완성)' : (r.match ? '✓' : '✗')}`;
              }
              tcDiv.appendChild(el('div', { className: 'ocr-result-row', style: { fontSize: '13px' } }, text));
            });
            resultBox.appendChild(tcDiv);
          }

          if (Array.isArray(STATE.ocrIssues) && STATE.ocrIssues.length > 0) {
            resultBox.appendChild(el('div', { className: 'ocr-result-row ocr-issue-text', innerHTML: `<strong>인식 이슈:</strong> ${STATE.ocrIssues.length}건` }));
          }
          cameraCard.appendChild(resultBox);
        }

        // Buttons
        const btnGroup = el('div', { className: 'btn-group' });
        btnGroup.appendChild(el('button', {
          className: 'btn-secondary',
          onClick: () => { STATE.uploadedImage = null; STATE.ocrResult = null; STATE.isProcessing = false; render(); }
        }, '다시 선택'));
        if (STATE.ocrResult) {
          btnGroup.appendChild(el('button', {
            className: 'btn-primary',
            onClick: () => { STATE.inputMode = 'manual'; render(); }
          }, '스코어 확인하기'));
        }
        cameraCard.appendChild(btnGroup);
      }
      container.appendChild(cameraCard);
    }

    // --- MANUAL MODE: SCORE TABLE ---
    if (STATE.inputMode === 'manual') {
      const tableCard = el('div', { className: 'glass-card' });
      const wrapper = el('div', { className: 'score-table-wrapper' });
      const table = el('table', { className: 'score-table' });

      // Thead
      const thead = el('thead');
      const headRow = el('tr');
      headRow.appendChild(el('th', {}, '홀'));
      headRow.appendChild(el('th', {}, 'Par'));
      STATE.players.forEach(p => headRow.appendChild(el('th', { className: 'th-player' }, p)));
      headRow.appendChild(el('th', {}, '상태'));
      thead.appendChild(headRow);
      table.appendChild(thead);

      // Tbody
      const tbody = el('tbody');
      let frontTotals = [0, 0, 0, 0];
      let backTotals = [0, 0, 0, 0];

      STATE.scores.forEach((hole, hi) => {
        const rowClass = 'row' + (hole.isDouble ? ' row-double' : '') + (hi === 8 ? ' half-separator' : '');
        const tr = el('tr', { className: rowClass.trim() });

        tr.appendChild(el('td', {}, el('span', { className: 'hole-number' }, String(hole.hole))));
        tr.appendChild(el('td', {}, el('span', { className: 'par-number' }, String(hole.par))));

        STATE.players.forEach((_, pi) => {
          const td = el('td', {});
          const cellDiv = el('div', { className: 'score-input-cell' });
          const score = hole.scores[pi];
          let inputClass = 'score-input';
          if (score > 0 && hole.par > 0) {
            const diff = score - hole.par;
            if (diff <= -2) inputClass += ' score-eagle';
            else if (diff === -1) inputClass += ' score-birdie';
            else if (diff === 1) inputClass += ' score-bogey';
            else if (diff >= 2) inputClass += ' score-double-plus';
          }

          const input = el('input', {
            className: inputClass,
            type: 'number',
            value: score || ''
          });
          input.addEventListener('change', (e) => {
            STATE.scores[hi].scores[pi] = parseInt(e.target.value) || 0;
            recalcDoubles();
            render();
          });
          cellDiv.appendChild(input);

          // Nearest button for Par 3
          if (hole.par === 3) {
            const nearBtn = el('button', {
              className: 'btn-nearest' + (hole.nearest === pi ? ' active' : ''),
              onClick: () => {
                STATE.scores[hi].nearest = STATE.scores[hi].nearest === pi ? false : pi;
                render();
              }
            }, hole.nearest === pi ? '★ NEAR' : 'NEAR');
            cellDiv.appendChild(nearBtn);
          }

          td.appendChild(cellDiv);
          tr.appendChild(td);

          // Track totals
          if (score > 0) {
            if (hi < 9) frontTotals[pi] += score;
            else backTotals[pi] += score;
          }
        });

        // Status column
        const statusTd = el('td', {});
        if (hole.isDouble) {
          statusTd.appendChild(el('span', { className: 'badge-double' }, '🔥 2배'));
        }
        tr.appendChild(statusTd);
        tbody.appendChild(tr);
      });

      // Front 9 total row
      const frontRow = el('tr', { className: 'totals-row' });
      frontRow.appendChild(el('td', { colspan: '2', style: { textAlign: 'right' } }, '전반'));
      frontTotals.forEach(t => frontRow.appendChild(el('td', {}, t > 0 ? String(t) : '-')));
      frontRow.appendChild(el('td', {}));
      tbody.appendChild(frontRow);

      // Back 9 total row
      const backRow = el('tr', { className: 'totals-row' });
      backRow.appendChild(el('td', { colspan: '2', style: { textAlign: 'right' } }, '후반'));
      backTotals.forEach(t => backRow.appendChild(el('td', {}, t > 0 ? String(t) : '-')));
      backRow.appendChild(el('td', {}));
      tbody.appendChild(backRow);

      // Grand total row
      const grandRow = el('tr', { className: 'totals-row' });
      grandRow.appendChild(el('td', { colspan: '2', style: { textAlign: 'right' } }, '합계'));
      frontTotals.forEach((f, i) => {
        const total = f + backTotals[i];
        grandRow.appendChild(el('td', {}, total > 0 ? String(total) : '-'));
      });
      grandRow.appendChild(el('td', {}));
      tbody.appendChild(grandRow);

      table.appendChild(tbody);
      wrapper.appendChild(table);
      tableCard.appendChild(wrapper);
      container.appendChild(tableCard);
    }

    // --- SETTLEMENT RESULTS ---
    const settlements = calculateSettlement();
    const sorted = settlements.map((amt, idx) => ({ amt, idx })).sort((a, b) => b.amt - a.amt);

    const resultCard = el('div', { className: 'glass-card glass-card-accent' });
    resultCard.appendChild(el('div', { className: 'section-header' },
      el('div', { className: 'section-title' },
        el('span', { className: 'emoji', innerHTML: ICONS.trophy }),
        el('span', {}, '최종 정산 결과')
      )
    ));

    const grid = el('div', { className: 'settlement-grid' });
    sorted.forEach(({ amt, idx }, rank) => {
      const positive = amt >= 0;
      const card = el('div', { className: 'settlement-card ' + (positive ? 'positive' : 'negative') });
      card.appendChild(el('div', { className: 'settlement-rank' }, rank === 0 ? '🥇 1st' : rank === 1 ? '🥈 2nd' : rank === 2 ? '🥉 3rd' : '4th'));
      card.appendChild(el('div', { className: 'settlement-name' }, STATE.players[idx]));
      card.appendChild(el('div', { className: 'settlement-amount' }, formatAmount(amt)));
      card.appendChild(el('div', { className: 'settlement-label' }, formatAmountFull(amt)));
    });
    grid.childNodes.forEach || sorted.forEach(({ amt, idx }, rank) => {
      // Already appended above — fix:
    });
    // Rebuild grid properly
    grid.innerHTML = '';
    sorted.forEach(({ amt, idx }, rank) => {
      const positive = amt >= 0;
      const card = el('div', { className: 'settlement-card ' + (positive ? 'positive' : 'negative') });
      card.appendChild(el('div', { className: 'settlement-rank' }, rank === 0 ? '🥇 1ST' : rank === 1 ? '🥈 2ND' : rank === 2 ? '🥉 3RD' : '4TH'));
      card.appendChild(el('div', { className: 'settlement-name' }, STATE.players[idx]));
      card.appendChild(el('div', { className: 'settlement-amount' }, formatAmount(amt)));
      card.appendChild(el('div', { className: 'settlement-label' }, formatAmountFull(amt)));
      grid.appendChild(card);
    });
    resultCard.appendChild(grid);
    container.appendChild(resultCard);

    // --- HOLE DETAILS ---
    const detailCard = el('div', { className: 'glass-card' });
    const detailHeader = el('div', { className: 'section-header' });
    detailHeader.appendChild(el('div', { className: 'section-title' },
      el('span', { className: 'emoji' }, '📊'),
      el('span', {}, '홀별 상세 정산')
    ));
    detailHeader.appendChild(el('button', {
      className: 'btn-toggle-details',
      onClick: () => { STATE.showHoleDetails = !STATE.showHoleDetails; render(); }
    }, STATE.showHoleDetails ? '숨기기 ▲' : '자세히 보기 ▼'));
    detailCard.appendChild(detailHeader);

    if (STATE.showHoleDetails) {
      const holeDetails = calculateHoleDetails();
      holeDetails.forEach((detail, hdi) => {
        const hasScores = detail.scores.some(s => s > 0);
        if (!hasScores) return;

        const hCard = el('div', { className: 'hole-detail-card ' + (detail.isDouble ? 'double' : 'normal'), style: { animationDelay: (hdi * 0.03) + 's' } });

        const hHeader = el('div', { className: 'hole-detail-header' });
        hHeader.appendChild(el('span', { className: 'hole-badge hole-badge-number' }, `${detail.hole}번 홀`));
        hHeader.appendChild(el('span', { className: 'hole-badge hole-badge-par' }, `Par ${detail.par}`));
        if (detail.isDouble) hHeader.appendChild(el('span', { className: 'badge-double' }, '🔥 2배'));
        hCard.appendChild(hHeader);

        const playersGrid = el('div', { className: 'hole-players-grid' });
        STATE.players.forEach((player, pIdx) => {
          if (detail.scores[pIdx] === 0) return;
          const s = detail.settlements[pIdx];
          const cls = s > 0 ? 'positive' : s < 0 ? 'negative' : 'neutral';
          const row = el('div', { className: 'hole-player-row ' + cls });

          const left = el('div', {});
          left.appendChild(el('div', { className: 'hole-player-name' }, player));
          const diff = detail.scores[pIdx] - detail.par;
          left.appendChild(el('div', { className: 'hole-player-score' }, `${detail.scores[pIdx]}타 (${diff >= 0 ? '+' : ''}${diff})`));
          row.appendChild(left);

          row.appendChild(el('div', { className: 'hole-player-amount' }, formatAmountFull(s)));
          playersGrid.appendChild(row);
        });
        hCard.appendChild(playersGrid);

        if (detail.details.length > 0) {
          const breakdown = el('div', { className: 'hole-breakdown' });
          breakdown.appendChild(el('div', { className: 'hole-breakdown-title' }, '💡 정산 내역'));
          detail.details.forEach(d => {
            breakdown.appendChild(el('div', { className: 'hole-breakdown-item' }, d));
          });
          hCard.appendChild(breakdown);
        }
        detailCard.appendChild(hCard);
      });
    }
    container.appendChild(detailCard);

    // --- RULES FOOTER ---
    const rulesCard = el('div', { className: 'glass-card rules-footer' });
    rulesCard.innerHTML = `<h3>📋 정산 규칙</h3>
      <ul class="rules-list">
        <li>기본: 1:n 방식으로 각 플레이어를 다른 모든 플레이어와 1:1 비교</li>
        <li>버디: 실제 타수 차이 + 축하금 1타 (예: 버디 vs 파 = 2타)</li>
        <li>이글: 실제 타수 차이 + 축하금 2타 (예: 이글 vs 파 = 4타)</li>
        <li>버디→이글: 버디는 이글에게 추가로 2타 제공</li>
        <li>니어리스트: Par3 홀에서 지정 시 1타 × 나머지 인원 보상</li>
        <li>2배판: 버디/이글, 트리플(Par4,5), 더블(Par3), 3명 동타 시 자동 적용</li>
      </ul>`;
    container.appendChild(rulesCard);

    app.appendChild(container);
  }

  // ============ INIT ============
  document.addEventListener('DOMContentLoaded', () => {
    render();
  });

})();
