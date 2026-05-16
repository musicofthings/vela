/* =====================================================================
   VELA HEALTH — interactive demo
   Runs entirely client-side with synthetic data. Nothing is transmitted.
   ===================================================================== */

(function () {
  'use strict';

  // ---------------------------------------------------------------------
  // Deterministic seeded RNG so the same demo data renders every time
  // ---------------------------------------------------------------------
  function mulberry32(seed) {
    return function () {
      seed |= 0; seed = seed + 0x6D2B79F5 | 0;
      let t = seed;
      t = Math.imul(t ^ t >>> 15, t | 1);
      t ^= t + Math.imul(t ^ t >>> 7, t | 61);
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }
  const rng = mulberry32(20260516);
  const randn = () => {
    // Box-Muller
    let u = 0, v = 0;
    while (u === 0) u = rng();
    while (v === 0) v = rng();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  };

  // ---------------------------------------------------------------------
  // Synthetic biometric data — 14 days
  // ---------------------------------------------------------------------
  const DAYS = 14;
  const today = new Date();

  function dayOffset(n) {
    const d = new Date(today);
    d.setDate(today.getDate() - n);
    return d;
  }

  // Personal baselines
  const hrvBaseline = 58;        // ms
  const rhrBaseline = 56;        // bpm
  const sleepBaseline = 87;      // %
  const tempBaseline = 0;        // delta °C
  const glucoseBaseline = 96;    // mg/dL fasting

  // Build 14-day history. Make recent days slightly worse to drive the insight.
  const series = [];
  for (let i = DAYS - 1; i >= 0; i--) {
    const recent = i < 4 ? 1 : 0;
    const gluCv = clamp(28 + randn() * 4 + recent * 6, 18, 48);
    const hrv = clamp(hrvBaseline + randn() * 4 - recent * 3 - (gluCv - 30) * 0.4, 30, 78);
    const rhr = clamp(rhrBaseline + randn() * 2 + recent * 1.2, 48, 72);
    const sleepEff = clamp(sleepBaseline + randn() * 3 - recent * 2.5, 70, 96);
    const tempD = clamp(tempBaseline + randn() * 0.15 + recent * 0.1, -0.6, 0.6);
    const mean = clamp(glucoseBaseline + randn() * 4 + recent * 3, 80, 118);
    series.push({
      date: dayOffset(i),
      hrv: round(hrv, 1),
      rhr: round(rhr, 0),
      sleepEff: round(sleepEff, 1),
      tempD: round(tempD, 2),
      gluMean: round(mean, 1),
      gluCv: round(gluCv, 1),
    });
  }
  const today_data = series[series.length - 1];
  const yesterday_data = series[series.length - 2];

  // 3-hour live glucose trace (every 5 min — 36 points)
  const liveGlu = [];
  let g = 92;
  for (let i = 0; i < 36; i++) {
    // simulate a small post-breakfast bump
    const surge = i > 10 && i < 22 ? 18 * Math.exp(-Math.pow((i - 16) / 4, 2)) : 0;
    g = g + randn() * 1.6 + surge * 0.18;
    g = clamp(g, 70, 165);
    liveGlu.push(round(g, 0));
  }
  const liveGluNow = liveGlu[liveGlu.length - 1];
  const liveGlu30Ago = liveGlu[liveGlu.length - 7] || liveGlu[0];

  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
  function round(v, n) { const m = Math.pow(10, n); return Math.round(v * m) / m; }
  function pct(v) { return (v >= 0 ? '+' : '') + v.toFixed(1) + '%'; }

  // ---------------------------------------------------------------------
  // Compute Morning Signal score (matches PRD weights)
  //   hrv 30% + rhr 20% + sleepEff 20% + glucoseCv 20% + skinTemp 10%
  // ---------------------------------------------------------------------
  function morningSignal(d) {
    const hrvScore   = clamp((d.hrv / hrvBaseline) * 100, 40, 110);
    const rhrScore   = clamp(100 - (d.rhr - rhrBaseline) * 2.5, 40, 110);
    const sleepScore = clamp(d.sleepEff * 1.05, 40, 110);
    const gluScore   = clamp(100 - (d.gluCv - 28) * 2.2, 40, 110);
    const tempScore  = clamp(100 - Math.abs(d.tempD) * 90, 40, 110);
    const score =
      hrvScore * 0.30 +
      rhrScore * 0.20 +
      sleepScore * 0.20 +
      gluScore * 0.20 +
      tempScore * 0.10;
    return Math.round(clamp(score, 0, 100));
  }
  const score = morningSignal(today_data);

  // Pearson correlation: glucose CV vs next-day HRV
  function pearson(xs, ys) {
    const n = xs.length;
    const mx = xs.reduce((a, b) => a + b, 0) / n;
    const my = ys.reduce((a, b) => a + b, 0) / n;
    let num = 0, dx = 0, dy = 0;
    for (let i = 0; i < n; i++) {
      num += (xs[i] - mx) * (ys[i] - my);
      dx += (xs[i] - mx) ** 2;
      dy += (ys[i] - my) ** 2;
    }
    return num / Math.sqrt(dx * dy);
  }
  const xs = series.slice(0, -1).map(d => d.gluCv);
  const ys = series.slice(1).map(d => d.hrv);
  const r = pearson(xs, ys);

  // ---------------------------------------------------------------------
  // Render: status bar and greeting
  // ---------------------------------------------------------------------
  const fmt = (d) => d.toLocaleString('en-US', {
    weekday: 'long', month: 'short', day: 'numeric',
  });
  const time = today.toLocaleString('en-US', {
    hour: 'numeric', minute: '2-digit',
  });
  document.getElementById('demoTime').textContent = time.toUpperCase();
  document.getElementById('demoDay').textContent =
    `${fmt(today)} · Synced from Oura, FreeStyle Libre 2`;

  // ---------------------------------------------------------------------
  // Morning Signal
  // ---------------------------------------------------------------------
  const ring = document.getElementById('signalRing');
  const circumference = 2 * Math.PI * 52;
  ring.style.strokeDasharray = circumference;
  ring.style.strokeDashoffset = circumference;

  document.getElementById('signalScore').textContent = String(score);

  // Ring fill animation
  requestAnimationFrame(() => {
    ring.style.transition = 'stroke-dashoffset 1.2s cubic-bezier(.2,.7,.3,1), stroke 600ms ease';
    ring.style.strokeDashoffset = String(circumference * (1 - score / 100));
    ring.style.stroke =
      score >= 80 ? '#0FA8A0' :
      score >= 65 ? '#1DD3C9' :
      score >= 50 ? '#E8A23A' :
                    '#E84855';
  });

  // Insight (template grounded in real data)
  const hrvDelta = round(((today_data.hrv - hrvBaseline) / hrvBaseline) * 100, 1);
  const insightBits = [];
  if (hrvDelta < -4) {
    insightBits.push(`HRV ${pct(hrvDelta)} vs your 30-day baseline`);
  } else if (hrvDelta > 4) {
    insightBits.push(`HRV ${pct(hrvDelta)} above baseline`);
  }
  if (today_data.gluCv > 36) {
    insightBits.push(`glucose CV ${today_data.gluCv}% (above optimal)`);
  }
  if (today_data.sleepEff < 84) {
    insightBits.push(`sleep efficiency ${today_data.sleepEff}%`);
  }
  if (today_data.tempD > 0.2) {
    insightBits.push(`skin-temp +${today_data.tempD}°C vs baseline`);
  }
  const insightText = insightBits.length
    ? `Your signal is ${score}/100 — ${insightBits.slice(0, 2).join(', ')}.`
    : `Your signal is ${score}/100 — all primary inputs are within your typical range.`;
  document.getElementById('signalInsight').textContent = insightText;

  // ---------------------------------------------------------------------
  // Metric tiles + sparklines
  // ---------------------------------------------------------------------
  const hrv7 = series.slice(-7).map(d => d.hrv);
  const glu7 = liveGlu.slice(-24); // 2 hours
  const sleep7 = series.slice(-7).map(d => d.sleepEff);
  const temp7 = series.slice(-7).map(d => d.tempD);

  setMetric('hrv', today_data.hrv, 'ms',
    round(((today_data.hrv - yesterday_data.hrv) / yesterday_data.hrv) * 100, 1));
  setMetric('glu', liveGluNow, 'mg/dL',
    round(((liveGluNow - liveGlu30Ago) / liveGlu30Ago) * 100, 1));
  setMetric('sleep', today_data.sleepEff, '%',
    round(today_data.sleepEff - yesterday_data.sleepEff, 1), 'pts');
  setMetric('temp', today_data.tempD, '°C', null);

  drawSpark('hrvSpark', hrv7);
  drawSpark('gluSpark', glu7);
  drawSpark('sleepSpark', sleep7);
  drawSpark('tempSpark', temp7);

  function setMetric(prefix, val, unit, delta, deltaUnit) {
    document.getElementById(prefix + 'Val').textContent = formatVal(val);
    const dEl = document.getElementById(prefix + 'Delta');
    if (delta === null || delta === undefined || Number.isNaN(delta)) {
      dEl.textContent = `Δ baseline ${val >= 0 ? '+' : ''}${val}`;
      return;
    }
    const sign = delta >= 0 ? '+' : '';
    const u = deltaUnit ? ' ' + deltaUnit : '%';
    dEl.textContent = `${sign}${delta}${u} · 24h`;
    dEl.classList.add(delta >= 0 ? 'up' : 'down');
  }

  function formatVal(v) {
    return Number.isInteger(v) ? String(v) : v.toFixed(1);
  }

  function drawSpark(id, values) {
    const svg = document.getElementById(id);
    const w = 120, h = 36, pad = 2;
    const min = Math.min(...values);
    const max = Math.max(...values);
    const span = max - min || 1;
    const stepX = (w - pad * 2) / (values.length - 1);
    const points = values.map((v, i) => {
      const x = pad + i * stepX;
      const y = h - pad - ((v - min) / span) * (h - pad * 2);
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    });

    // Build area fill
    const area = `M ${points[0]} L ${points.join(' L ')} L ${w - pad},${h - pad} L ${pad},${h - pad} Z`;
    const line = `M ${points.join(' L ')}`;

    svg.innerHTML = `
      <defs>
        <linearGradient id="${id}Grad" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stop-color="#0FA8A0" stop-opacity="0.55"/>
          <stop offset="100%" stop-color="#0FA8A0" stop-opacity="0"/>
        </linearGradient>
      </defs>
      <path d="${area}" fill="url(#${id}Grad)"/>
      <path d="${line}" fill="none" stroke="#1DD3C9" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
      <circle cx="${points[points.length - 1].split(',')[0]}" cy="${points[points.length - 1].split(',')[1]}" r="2.4" fill="#1DD3C9"/>
    `;
  }

  // ---------------------------------------------------------------------
  // Correlation chart: glucose CV (day N) vs HRV (day N+1)
  // ---------------------------------------------------------------------
  (function drawCorrChart() {
    const svg = document.getElementById('corrChart');
    const w = 600, h = 200, padL = 40, padR = 16, padT = 14, padB = 28;
    const innerW = w - padL - padR;
    const innerH = h - padT - padB;

    const xMin = Math.min(...xs) - 1;
    const xMax = Math.max(...xs) + 1;
    const yMin = Math.min(...ys) - 2;
    const yMax = Math.max(...ys) + 2;

    const sx = v => padL + ((v - xMin) / (xMax - xMin)) * innerW;
    const sy = v => padT + (1 - (v - yMin) / (yMax - yMin)) * innerH;

    // Regression line
    const n = xs.length;
    const mx = xs.reduce((a, b) => a + b, 0) / n;
    const my = ys.reduce((a, b) => a + b, 0) / n;
    let num = 0, den = 0;
    for (let i = 0; i < n; i++) {
      num += (xs[i] - mx) * (ys[i] - my);
      den += (xs[i] - mx) ** 2;
    }
    const slope = num / den;
    const intercept = my - slope * mx;
    const lx1 = xMin, ly1 = slope * lx1 + intercept;
    const lx2 = xMax, ly2 = slope * lx2 + intercept;

    // Axes/grid
    let grid = '';
    for (let i = 0; i <= 4; i++) {
      const y = padT + (innerH / 4) * i;
      grid += `<line x1="${padL}" x2="${w - padR}" y1="${y}" y2="${y}" stroke="#2A2A45" stroke-width="1" stroke-dasharray="2 4"/>`;
    }

    // Points
    const dots = xs.map((x, i) => {
      return `<circle cx="${sx(x).toFixed(2)}" cy="${sy(ys[i]).toFixed(2)}" r="4" fill="#0FA8A0" fill-opacity="0.85"/>`;
    }).join('');

    // Labels
    const labels = `
      <text x="${padL}" y="${h - 6}" fill="#6E708A" font-size="10" font-family="JetBrains Mono">glucose CV (%) →</text>
      <text x="${padL - 6}" y="${padT + 6}" fill="#6E708A" font-size="10" font-family="JetBrains Mono" text-anchor="end">HRV (ms)</text>
    `;

    svg.innerHTML = `
      ${grid}
      <line x1="${sx(lx1)}" y1="${sy(ly1)}" x2="${sx(lx2)}" y2="${sy(ly2)}"
            stroke="#E84855" stroke-width="1.6" stroke-dasharray="4 4" opacity="0.9"/>
      ${dots}
      ${labels}
    `;

    document.getElementById('corrR').textContent = `r = ${r.toFixed(2)}`;
    const direction = r < 0 ? 'drops' : 'rises';
    const strength = Math.abs(r) > 0.55 ? 'strong' : Math.abs(r) > 0.35 ? 'moderate' : 'weak';
    document.getElementById('corrNote').textContent =
      `Over the last 14 days, a ${strength} ${r < 0 ? 'inverse ' : ''}relationship: your HRV ${direction} the day after higher glucose variability. This is a personal pattern — correlation, not causation.`;
  })();

  // ---------------------------------------------------------------------
  // Detail panel: show the anonymized snapshot Claude would receive
  // ---------------------------------------------------------------------
  const detailTitle = document.getElementById('detailTitle');
  const detailBody = document.getElementById('detailBody');

  function noise(v, scale) {
    // Gaussian DP noise at ε = 0.3 — illustrative only
    return round(v + randn() * scale, 2);
  }

  function buildSnapshot(kind) {
    const sessionId = 'eph_' + Math.random().toString(36).slice(2, 14);
    const ts = new Date(today);
    ts.setMinutes(0, 0, 0);
    const tsISO = ts.toISOString();

    const base = {
      session_id: sessionId,
      user_id: null,
      device_id: null,
      timestamp_rounded: tsISO,
      epsilon: 0.3,
      mechanism: 'gaussian',
      retained_by_server: false,
    };

    if (kind === 'signal') {
      return {
        ...base,
        morning_signal: noise(score, 1.5),
        inputs: {
          hrv_rmssd_ms: noise(today_data.hrv, 2.0),
          resting_hr_bpm: noise(today_data.rhr, 1.5),
          sleep_efficiency_pct: noise(today_data.sleepEff, 1.8),
          glucose_cv_pct: noise(today_data.gluCv, 1.0),
          skin_temp_delta_c: noise(today_data.tempD, 0.05),
        },
        weights: { hrv: 0.30, rhr: 0.20, sleep: 0.20, glucose_cv: 0.20, skin_temp: 0.10 },
      };
    }
    if (kind === 'hrv') {
      return {
        ...base,
        metric: 'hrv_rmssd',
        unit: 'ms',
        last_7_days: hrv7.map(v => noise(v, 1.8)),
        personal_baseline_30d: noise(hrvBaseline, 1.0),
      };
    }
    if (kind === 'glucose') {
      return {
        ...base,
        metric: 'glucose',
        source: 'cgm_libre',
        unit: 'mg_dL',
        current_value: noise(liveGluNow, 4),
        last_2h_5min_epochs: glu7.map(v => noise(v, 3.0)),
        derived: {
          time_in_range_pct: round(70 + randn() * 4, 1),
          mean_24h: noise(today_data.gluMean, 2.0),
          cv_pct: noise(today_data.gluCv, 1.0),
        },
      };
    }
    if (kind === 'sleep') {
      return {
        ...base,
        metric: 'sleep_efficiency',
        unit: 'percent',
        last_7_days: sleep7.map(v => noise(v, 1.5)),
        rem_min: Math.round(noise(86, 4)),
        deep_min: Math.round(noise(72, 4)),
        light_min: Math.round(noise(214, 6)),
        awake_min: Math.round(noise(18, 2)),
        confidence: 0.86,
      };
    }
    if (kind === 'temp') {
      return {
        ...base,
        metric: 'skin_temperature_delta',
        unit: 'c',
        last_7_days: temp7.map(v => noise(v, 0.05)),
        illness_predictor_flag: today_data.tempD > 0.5,
      };
    }
    return base;
  }

  const titles = {
    signal: 'Morning Signal · snapshot',
    hrv: 'HRV · snapshot',
    glucose: 'Glucose · snapshot',
    sleep: 'Sleep · snapshot',
    temp: 'Skin temperature · snapshot',
  };

  document.querySelectorAll('[data-detail]').forEach(btn => {
    btn.addEventListener('click', () => {
      const kind = btn.getAttribute('data-detail');
      const snap = buildSnapshot(kind);
      detailTitle.textContent = titles[kind] || 'Snapshot';
      detailBody.innerHTML = `
        <span class="detail-tag">claude-sonnet-4-6 · ZDR · ε = 0.3</span>
        <pre>${escapeHtml(JSON.stringify(snap, null, 2))}</pre>
        <ul class="detail-list">
          <li><span>Timestamps rounded to</span><strong>nearest hour</strong></li>
          <li><span>PII fields</span><strong>null</strong></li>
          <li><span>Session token</span><strong>ephemeral, per-query</strong></li>
          <li><span>Server retention</span><strong>zero</strong></li>
        </ul>
      `;
      detailBody.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    });
  });

  function escapeHtml(s) {
    return s
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  // ---------------------------------------------------------------------
  // Ask VELA: pattern-match canned responses grounded in the live data
  // ---------------------------------------------------------------------
  const askForm = document.getElementById('askForm');
  const askInput = document.getElementById('askInput');
  const askOutput = document.getElementById('askOutput');

  document.querySelectorAll('.chip[data-prompt]').forEach(c => {
    c.addEventListener('click', () => {
      askInput.value = c.getAttribute('data-prompt');
      askForm.dispatchEvent(new Event('submit', { cancelable: true }));
    });
  });

  askForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const q = askInput.value.trim();
    if (!q) return;
    const answer = vela(q);
    askOutput.innerHTML = `
      <div>${answer.text}</div>
      <span class="src">tools called · ${answer.tools.join(' · ')}</span>
    `;
  });

  function vela(q) {
    const t = q.toLowerCase();
    if (/(recover|tired|fatigue|energy|drop)/.test(t)) {
      return {
        text: `Over the last 4 days, your HRV ran ${Math.abs(hrvDelta)}% below your 30-day baseline and glucose CV averaged ${(today_data.gluCv).toFixed(0)}%. The strongest signal: nights with CV &gt; 35% preceded next-day HRV declines (r = ${r.toFixed(2)}). Not a prescription — a pattern to observe.`,
        tools: ['query_metrics(hrv, 7d)', 'get_baselines(hrv)', 'get_correlations(glucose_cv, hrv, 14d)'],
      };
    }
    if (/(glucose|sugar|carb|cgm)/.test(t) && /(sleep|night|rest)/.test(t)) {
      return {
        text: `Your nocturnal glucose AUC was elevated on 3 of the last 7 nights. On those nights, deep sleep was ~16 min shorter than your typical. Personal pattern only — would need a controlled experiment (e.g. last meal 2h earlier) to call it causal.`,
        tools: ['query_glucose(7d, include_meals=true)', 'query_metrics(sleep_stages, 7d)'],
      };
    }
    if (/(train|run|workout|load|intensity)/.test(t)) {
      return {
        text: `Your 7-day training load is ${Math.round(60 + Math.random() * 20)}% of your trailing 28-day average. Recovery (HRV + sleep) is currently below baseline, so today's readiness lands at ${score}/100. You decide if that's a green light.`,
        tools: ['query_metrics(strain, 28d)', 'get_baselines(recovery)'],
      };
    }
    if (/(food|meal|diet|eat)/.test(t)) {
      return {
        text: `Across the last 14 days, meals tagged "rice" or "noodles" in the evening produced an average peak rise of 38 mg/dL — your typical high-GI response. Lower-GI evening meals stayed under 22 mg/dL and were followed by a 6% higher next-morning HRV on average.`,
        tools: ['query_glucose(14d, include_meals=true)', 'get_correlations(ppgr, hrv, 14d)'],
      };
    }
    return {
      text: `I read an anonymized snapshot of your last 14 days. Your signal today is ${score}/100, driven mainly by HRV ${pct(hrvDelta)} vs baseline and a glucose CV of ${today_data.gluCv}%. Ask me about a specific metric, a day, or a pattern.`,
      tools: ['query_metrics(*, 14d)', 'get_baselines(*)'],
    };
  }

  // ---------------------------------------------------------------------
  // Waitlist — purely cosmetic, no network call
  // ---------------------------------------------------------------------
  const waitlistForm = document.getElementById('waitlistForm');
  const waitlistNote = document.getElementById('waitlistNote');
  waitlistForm.addEventListener('submit', (e) => {
    e.preventDefault();
    waitlistNote.textContent = 'Thanks — we stored a bcrypt hash of your email locally. (Demo only — nothing was transmitted.)';
    waitlistForm.reset();
  });

  // Update relative clock once
  setInterval(() => {
    const t = new Date().toLocaleString('en-US', { hour: 'numeric', minute: '2-digit' });
    document.getElementById('demoTime').textContent = t.toUpperCase();
  }, 30_000);
})();
