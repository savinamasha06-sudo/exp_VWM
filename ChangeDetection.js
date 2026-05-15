// ================================================================
//  ПАРАМЕТРЫ  (соответствуют Python-оригиналу)
// ================================================================
const CFG = {
    trialsPerBlock:    12,
    numBlocks:         10,
    percentSame:       0.5,
    setSizes:          [4, 8],
    stimSizeDeg:       1.5,

    // Тайминги (мс)
    itiMs:             1000,
    sampleMs:          1500,
    delayMs:           10000,

    // Ограничения позиций
    allowedDegFromFix: 6,
    minDistDeg:        2.5,
    maxPerQuad:        2,

    // Пиксели на градус (90 см → ≈ 60 px/deg)
    pixPerDeg:         60,
    canvasW:           900,
    canvasH:           700,

    // Режим пробы
    singleProbe:       false,
    repeatStimColors:  false,
    repeatTestColors:  false,

    // Клавиши
    keySame:           's',
    keyDiff:           'd',

    // DataPipe / OSF
    dataPipeID:        'QtWREtyfbfLQ',   // ← замените на свой Experiment ID
    experimentName:    'ChangeDetection',
};

// ================================================================
//  ПАЛИТРА ЦВЕТОВ  (PsychoPy −1…1 → RGB 0…255)
// ================================================================
const PALETTE_RAW = [
    [1, -1, -1],   // красный
    [-1,  1, -1],  // зелёный
    [-1, -1,  1],  // синий
    [1,  1, -1],   // жёлтый
    [1, -1,  1],   // пурпурный
    [-1,  1,  1],  // голубой
    [1,  1,  1],   // белый
    [-1, -1, -1],  // чёрный
    [1,  0, -1],   // оранжевый
];

const PALETTE = PALETTE_RAW.map(c =>
    c.map(v => Math.round((v + 1) / 2 * 255))
);

// ================================================================
//  УТИЛИТЫ
// ================================================================
function toCss([r, g, b]) { return `rgb(${r},${g},${b})`; }
function colEq(a, b)      { return a[0] === b[0] && a[1] === b[1] && a[2] === b[2]; }

function shuffle(arr) {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}

function rnd(lo, hi) { return Math.random() * (hi - lo) + lo; }

function whichQuad([x, y]) {
    return (x < 0 ? 0 : 1) + (y < 0 ? 0 : 2);
}

function tooClose(pt, locs) {
    if (Math.hypot(pt[0], pt[1]) < CFG.minDistDeg) return true;
    return locs.some(l => Math.hypot(pt[0] - l[0], pt[1] - l[1]) < CFG.minDistDeg);
}

function generateLocations(n) {
    const qCount = [0, 0, 0, 0];
    const locs   = [];
    let   tries  = 0;
    while (locs.length < n) {
        if (++tries > 1000)
            throw new Error('Timeout — невозможно разместить стимулы с текущими ограничениями.');
        const pt = [
            rnd(-CFG.allowedDegFromFix, CFG.allowedDegFromFix),
            rnd(-CFG.allowedDegFromFix, CFG.allowedDegFromFix),
        ];
        if (tooClose(pt, locs)) continue;
        const q = whichQuad(pt);
        if (qCount[q] >= CFG.maxPerQuad) continue;
        qCount[q]++;
        locs.push(pt);
    }
    return locs;
}

// ================================================================
//  ГЕНЕРАЦИЯ ПРОБ И БЛОКОВ
// ================================================================
const TRIALS_PER_SS = CFG.trialsPerBlock / CFG.setSizes.length;
const SAME_PER_SS   = Math.round(TRIALS_PER_SS * CFG.percentSame);
const DIFF_PER_SS   = TRIALS_PER_SS - SAME_PER_SS;

function makeTrial(setSize, trialType) {
    const cresp   = trialType === 'same' ? CFG.keySame : CFG.keyDiff;
    const testLoc = Math.floor(Math.random() * setSize);

    let stimColors;
    if (CFG.repeatStimColors) {
        stimColors = Array.from({length: setSize},
            () => PALETTE[Math.floor(Math.random() * PALETTE.length)]);
    } else {
        stimColors = shuffle(PALETTE).slice(0, setSize);
    }

    let testColor;
    if (trialType === 'same') {
        testColor = stimColors[testLoc];
    } else if (CFG.repeatTestColors) {
        do { testColor = PALETTE[Math.floor(Math.random() * PALETTE.length)]; }
        while (colEq(testColor, stimColors[testLoc]));
    } else {
        const avail = PALETTE.filter(c => !stimColors.some(s => colEq(s, c)));
        if (avail.length > 0) {
            testColor = avail[Math.floor(Math.random() * avail.length)];
        } else {
            do { testColor = PALETTE[Math.floor(Math.random() * PALETTE.length)]; }
            while (colEq(testColor, stimColors[testLoc]));
        }
    }

    return {
        setSize, trialType, cresp,
        locations:  generateLocations(setSize),
        stimColors, testColor, testLoc,
    };
}

function makeBlock() {
    const trials = [];
    for (const ss of CFG.setSizes) {
        for (let i = 0; i < SAME_PER_SS; i++) trials.push(makeTrial(ss, 'same'));
        for (let i = 0; i < DIFF_PER_SS; i++) trials.push(makeTrial(ss, 'diff'));
    }
    return shuffle(trials);
}

// ================================================================
//  РИСОВАНИЕ НА ХОЛСТЕ
// ================================================================
const CX      = CFG.canvasW / 2;
const CY      = CFG.canvasH / 2;
const STIM_PX = CFG.stimSizeDeg * CFG.pixPerDeg;

function degToPx([dx, dy]) {
    // Ось Y инвертирована, как в PsychoPy
    return [CX + dx * CFG.pixPerDeg, CY - dy * CFG.pixPerDeg];
}

function drawBg(ctx) {
    ctx.fillStyle = 'rgb(128,128,128)';
    ctx.fillRect(0, 0, CFG.canvasW, CFG.canvasH);
}

function drawFix(ctx) {
    ctx.fillStyle    = 'rgb(0,0,0)';
    ctx.font         = 'bold 40px monospace';
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('+', CX, CY);
}

function drawSquares(ctx, locations, colors) {
    const half = STIM_PX / 2;
    for (let i = 0; i < locations.length; i++) {
        const [px, py] = degToPx(locations[i]);
        ctx.fillStyle = toCss(colors[i]);
        ctx.fillRect(px - half, py - half, STIM_PX, STIM_PX);
    }
}

// ================================================================
//  СОХРАНЕНИЕ НА OSF ЧЕРЕЗ DATAPIPE
// ================================================================
let subjectId = 'unknown';

function buildFilename() {
    const dt = new Date().toISOString()
        .replace('T', '_')
        .replace(/:/g, '-')
        .slice(0, 19);
    return `${subjectId}_${CFG.experimentName}_${dt}.csv`;
}

function saveToDataPipe() {
    const filename = buildFilename();
    const csvData  = jsPsych.data.get().filter({phase: 'test'}).csv();

    console.log('Saving data via DataPipe…');

    return fetch('https://pipe.jspsych.org/api/data', {
        method:  'POST',
        headers: {
            'Content-Type': 'application/json',
            Accept:         '*/*',
        },
        body: JSON.stringify({
            experimentID: CFG.dataPipeID,
            filename:     filename,
            data:         csvData,
        }),
    })
    .then(r => r.json())
    .then(result => {
        console.log('DataPipe response:', result);
        return {ok: true, result};
    })
    .catch(err => {
        console.error('DataPipe error — saving locally:', err);
        jsPsych.data.get().filter({phase: 'test'}).localSave('csv', filename);
        return {ok: false, err};
    });
}

// ================================================================
//  jsPsych TIMELINE
// ================================================================
const jsPsych = initJsPsych();

const timeline = [];

// ── 1. Анкета участника ─────────────────────────────────────────
timeline.push({
    type: jsPsychSurveyHtmlForm,
    preamble: '<h2 style="color:#000;margin-bottom:16px">Информация об участнике</h2>',
    html: `
      <table style="border-spacing:10px 8px; color:#000; font-size:1em">
        <tr>
          <td>Номер участника:</td>
          <td><input name="subj" type="text" required style="width:160px;padding:4px"></td>
        </tr>
        <tr>
          <td>Возраст:</td>
          <td><input name="age" type="number" min="5" max="99" required style="width:80px;padding:4px"></td>
        </tr>
        <tr>
          <td>Пол:</td>
          <td>
            <label><input type="radio" name="gender" value="Male" required> Мужской</label>&nbsp;&nbsp;
            <label><input type="radio" name="gender" value="Female"> Женский</label>&nbsp;&nbsp;
            <label><input type="radio" name="gender" value="Other"> Другой / не указываю</label>
          </td>
        </tr>
        <tr>
          <td>Латиноамериканское<br>происхождение:</td>
          <td>
            <label><input type="radio" name="hisp" value="Yes" required> Да</label>&nbsp;&nbsp;
            <label><input type="radio" name="hisp" value="No"> Нет</label>&nbsp;&nbsp;
            <label><input type="radio" name="hisp" value="NR"> Не указываю</label>
          </td>
        </tr>
        <tr>
          <td>Раса:</td>
          <td>
            <select name="race" required style="width:270px;padding:4px">
              <option value="">— выберите —</option>
              <option>American Indian or Alaskan Native</option>
              <option>Asian</option>
              <option>Pacific Islander</option>
              <option>Black or African American</option>
              <option>White / Caucasian</option>
              <option>More Than One Race</option>
              <option>Choose Not To Respond</option>
            </select>
          </td>
        </tr>
      </table>`,
    button_label: 'Начать →',
    on_finish(data) {
        subjectId = data.response.subj || 'unknown';
        jsPsych.data.addProperties({Subject: subjectId});
    },
});

// ── 2. Инструкции ───────────────────────────────────────────────
timeline.push({
    type: jsPsychInstructions,
    pages: [
        `<div style="max-width:680px;font-size:1.15em;color:#000;text-align:center">
           <p style="font-size:1.3em"><b>Добро пожаловать в эксперимент!</b></p>
           <p>Нажмите <kbd>Далее →</kbd>, чтобы прочитать инструкцию.</p>
         </div>`,
        `<div style="max-width:680px;font-size:1.05em;color:#000;line-height:1.8;text-align:left">
           <p>В этом эксперименте вы будете <b>запоминать цвета квадратиков</b>.</p>
           <p>Каждая проба начинается с крестика фиксации&nbsp;<b style="font-size:1.3em">+</b>.
              Старайтесь удерживать на нём взгляд.</p>
           <p>Затем на экране появятся <b>4 или 8 цветных квадратиков</b>.
              Запомните как можно больше цветов.</p>
           <p>После короткой задержки квадратики появятся снова.</p>
           <p>Если все цвета <b>ТАКИЕ ЖЕ</b>, как раньше — нажмите <kbd>S</kbd>.<br>
              Если какой-то цвет <b>ИЗМЕНИЛСЯ</b> — нажмите <kbd>D</kbd>.</p>
           <p>Если не уверены — просто угадайте. Между блоками будут перерывы.</p>
         </div>`,
    ],
    show_clickable_nav:    true,
    button_label_next:     'Далее →',
    button_label_previous: '← Назад',
    post_trial_gap:        500,
});

// ── 3. Блоки с пробами ──────────────────────────────────────────
for (let blockIdx = 0; blockIdx < CFG.numBlocks; blockIdx++) {
    const block = makeBlock();

    for (let trialIdx = 0; trialIdx < block.length; trialIdx++) {
        const tr = block[trialIdx];

        // ITI — крестик
        timeline.push({
            type:           jsPsychCanvasKeyboardResponse,
            canvas_size:    [CFG.canvasH, CFG.canvasW],
            stimulus(c)     { const ctx = c.getContext('2d'); drawBg(ctx); drawFix(ctx); },
            choices:        'NO_KEYS',
            trial_duration: CFG.itiMs,
            data:           {phase: 'iti'},
        });

        // Sample — квадратики + крестик
        timeline.push({
            type:           jsPsychCanvasKeyboardResponse,
            canvas_size:    [CFG.canvasH, CFG.canvasW],
            stimulus(c) {
                const ctx = c.getContext('2d');
                drawBg(ctx); drawFix(ctx);
                drawSquares(ctx, tr.locations, tr.stimColors);
            },
            choices:        'NO_KEYS',
            trial_duration: CFG.sampleMs,
            data:           {phase: 'sample'},
        });

        // Задержка — только крестик
        timeline.push({
            type:           jsPsychCanvasKeyboardResponse,
            canvas_size:    [CFG.canvasH, CFG.canvasW],
            stimulus(c)     { const ctx = c.getContext('2d'); drawBg(ctx); drawFix(ctx); },
            choices:        'NO_KEYS',
            trial_duration: CFG.delayMs,
            data:           {phase: 'delay'},
        });

        // Test — ответ участника
        timeline.push({
            type:        jsPsychCanvasKeyboardResponse,
            canvas_size: [CFG.canvasH, CFG.canvasW],
            stimulus(c) {
                const ctx = c.getContext('2d');
                drawBg(ctx); drawFix(ctx);
                if (CFG.singleProbe) {
                    const col = tr.trialType === 'diff'
                        ? tr.testColor : tr.stimColors[tr.testLoc];
                    drawSquares(ctx, [tr.locations[tr.testLoc]], [col]);
                } else {
                    const cols = [...tr.stimColors];
                    if (tr.trialType === 'diff') cols[tr.testLoc] = tr.testColor;
                    drawSquares(ctx, tr.locations, cols);
                }
            },
            choices:  [CFG.keySame, CFG.keyDiff],
            data:     {phase: 'test'},
            on_finish(data) {
                data.Subject        = subjectId;
                data.Block          = blockIdx;
                data.Trial          = trialIdx;
                data.Timestamp      = Date.now();
                data.TrialType      = tr.trialType;
                data.SetSize        = tr.setSize;
                data.RT             = data.rt;
                data.CRESP          = tr.cresp;
                data.RESP           = data.response;
                data.ACC            = data.response === tr.cresp ? 1 : 0;
                data.LocationTested = tr.testLoc;
                data.Locations      = JSON.stringify(tr.locations);
                data.SampleColors   = JSON.stringify(tr.stimColors);
                data.TestColors     = JSON.stringify(tr.testColor);
            },
        });
    }

    // Перерыв (кроме последнего блока)
    if (blockIdx + 1 < CFG.numBlocks) {
        timeline.push({
            type:     jsPsychHtmlKeyboardResponse,
            stimulus: `
              <div style="color:#000;font-size:1.2em;text-align:center;line-height:2">
                <p><b>Блок ${blockIdx + 1} из ${CFG.numBlocks} завершён.</b></p>
                <p>Сделайте небольшой перерыв.<br>
                   Когда будете готовы, нажмите <kbd>пробел</kbd>.</p>
              </div>`,
            choices:  [' '],
            data:     {phase: 'break'},
        });
    }
}

// ── 4. Отправка данных на OSF через DataPipe ────────────────────
timeline.push({
    type:     jsPsychHtmlKeyboardResponse,
    stimulus: `
      <div style="background:rgb(0,0,80);color:#fff;padding:60px 80px;
                  font-size:1.3em;text-align:center;border-radius:10px;min-width:400px">
          ⏳ Сохранение данных…<br>
          <small style="font-size:.7em;opacity:.8">Пожалуйста, не закрывайте вкладку.</small>
      </div>`,
    choices:        'NO_KEYS',
    trial_duration: null,
    data:           {phase: 'saving'},
    on_load() {
        saveToDataPipe().then(() => jsPsych.finishTrial());
    },
});

// ── 5. Финальный экран ──────────────────────────────────────────
timeline.push({
    type:     jsPsychHtmlKeyboardResponse,
    stimulus: `
      <div style="background:rgb(0,0,255);color:#fff;padding:60px 80px;
                  font-size:1.4em;text-align:center;border-radius:10px">
          ✅ Эксперимент завершён.<br>
          Пожалуйста, позовите экспериментатора.
      </div>`,
    choices:        'NO_KEYS',
    trial_duration: null,
    data:           {phase: 'end'},
});

// ── Запуск ──────────────────────────────────────────────────────
jsPsych.run(timeline);
