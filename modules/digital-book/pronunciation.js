(function () {
  "use strict";

  const languageNames = {
    en: "English", es: "Español", fr: "Français", id: "Bahasa Indonesia",
    ja: "日本語", ko: "한국어", lo: "ລາວ", ms: "Bahasa Melayu",
    my: "မြန်မာ", ru: "Русский", th: "ไทย",
  };
  const toneNames = {
    0: ["轻声", "Neutral tone"], 1: ["一声", "1st tone"], 2: ["二声", "2nd tone"],
    3: ["三声", "3rd tone"], 4: ["四声", "4th tone"],
  };
  const featureLabels = {
    aspiration: ["送气对比", "Aspiration"], place: ["发音位置", "Place of articulation"],
    airflow: ["气流通道", "Airflow"], vowel: ["口形与舌位", "Vowel shape"],
    nasal: ["鼻音位置", "Nasal ending"],
  };
  const comparisonLabels = {
    en: { mandarin: "Mandarin system", native: "My language system", differences: "Key differences", errors: "Common errors", advice: "Practice advice" },
    es: { mandarin: "Sistema del mandarín", native: "Sistema de mi idioma", differences: "Diferencias principales", errors: "Errores frecuentes", advice: "Consejos de práctica" },
    fr: { mandarin: "Système du mandarin", native: "Système de ma langue", differences: "Différences principales", errors: "Erreurs fréquentes", advice: "Conseils de pratique" },
    id: { mandarin: "Sistem bahasa Mandarin", native: "Sistem bahasa saya", differences: "Perbedaan utama", errors: "Kesalahan umum", advice: "Saran latihan" },
    ja: { mandarin: "中国語の発音体系", native: "母語の発音体系", differences: "主な違い", errors: "よくある誤り", advice: "練習のポイント" },
    ko: { mandarin: "중국어 발음 체계", native: "모국어 발음 체계", differences: "주요 차이", errors: "자주 하는 오류", advice: "연습 방법" },
    lo: { mandarin: "ລະບົບສຽງພາສາຈີນ", native: "ລະບົບສຽງພາສາແມ່", differences: "ຄວາມແຕກຕ່າງຫຼັກ", errors: "ຂໍ້ຜິດພາດທີ່ພົບເລື້ອຍ", advice: "ຄຳແນະນຳການຝຶກ" },
    ms: { mandarin: "Sistem bahasa Mandarin", native: "Sistem bahasa ibunda", differences: "Perbezaan utama", errors: "Kesilapan lazim", advice: "Cadangan latihan" },
    my: { mandarin: "တရုတ်အသံထွက်စနစ်", native: "မိခင်ဘာသာအသံထွက်စနစ်", differences: "အဓိကကွာခြားချက်များ", errors: "အဖြစ်များသောအမှားများ", advice: "လေ့ကျင့်ရန်အကြံပြုချက်" },
    ru: { mandarin: "Фонетическая система китайского", native: "Система родного языка", differences: "Основные различия", errors: "Типичные ошибки", advice: "Советы по тренировке" },
    th: { mandarin: "ระบบเสียงภาษาจีน", native: "ระบบเสียงภาษาแม่", differences: "ความแตกต่างสำคัญ", errors: "ข้อผิดพลาดที่พบบ่อย", advice: "คำแนะนำในการฝึก" },
  };

  const state = {
    model: null,
    contentModel: null,
    practiceModel: null,
    cues: new Map(),
    textCues: new Map(),
    units: [],
    unitIndex: 0,
    activePart: "phonetics",
    textItemIndex: 0,
    textGroupId: "greetings",
    oralAnswerChoices: {},
    assessmentUsage: {},
    characterIndex: 0,
    practiceIndex: 0,
    groupIndices: {},
    selectedItems: {},
    locale: localStorage.getItem("digitalBookLocale") || "en",
    assistMode: localStorage.getItem("digitalBookAssistMode") || "assist",
    audioSegment: null,
    audioQueue: [],
    audioReadyPromise: null,
    loop: false,
    challenge: null,
    toneAnswers: {},
    comparisonId: "",
    pinyinRecording: {
      active: false, stream: null, context: null, source: null, processor: null, mute: null,
      samples: [], inputRate: 48000, wavBlob: null, previewUrl: "", timer: null,
      target: null, status: "idle", message: "", result: null,
    },
    characterWriting: {
      writer: null, drawing: false, lastPoint: null, strokeCount: 0,
      artifactUrl: "", artifactBlob: null,
      assessment: { status: "idle", result: null, message: "" },
    },
  };

  const strokeDataRoot = "https://hsk-1311686407.cos.ap-guangzhou.myqcloud.com/hanzi-companion/stroke-data/v2.0.1/characters";

  let elements;

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function localize(value, locale = state.locale) {
    if (!value || typeof value !== "object") return String(value || "");
    return value[locale] || value.en || value["zh-CN"] || "";
  }

  function bilingual(zh, en) {
    return `<span class="bilingual-button-label"><strong>${escapeHtml(zh)}</strong><small>${escapeHtml(en)}</small></span>`;
  }

  function currentUnit() {
    return state.units[state.unitIndex];
  }

  function textPart() {
    return state.contentModel?.parts?.find((part) => part.id === "texts") || null;
  }

  function characterPart() {
    return state.contentModel?.parts?.find((part) => part.id === "characters") || null;
  }

  function practiceSections() {
    return state.practiceModel?.sections || [];
  }

  function practiceItems() {
    return practiceSections().flatMap((section) => (section.items || []).map((item) => ({
      ...item,
      sectionId: section.id,
      sectionTitle: section.title,
    })));
  }

  function currentPracticeItem() {
    return practiceItems()[state.practiceIndex] || practiceItems()[0] || null;
  }

  function textSections() {
    return textPart()?.sections || [];
  }

  function textItems() {
    return textSections().flatMap((section) => section.items || []);
  }

  function currentTextItem() {
    return textItems()[state.textItemIndex] || textItems()[0] || null;
  }

  function textSection() {
    const item = currentTextItem();
    return textSections().find((section) => section.items?.some((entry) => entry.id === item?.id)) || textSections()[0] || null;
  }

  function currentCharacter() {
    const items = characterPart()?.items || [];
    return items[state.characterIndex] || items[0] || null;
  }

  function currentGroup(unit = currentUnit()) {
    const groups = unit.groups || [];
    return groups[state.groupIndices[unit.id] || 0] || groups[0] || null;
  }

  function groupKey(unit = currentUnit(), group = currentGroup(unit)) {
    return `${unit.id}:${group?.id || "none"}`;
  }

  function selectableItems(unit = currentUnit(), group = currentGroup(unit)) {
    if (!group) return unit.items || unit.examples || [];
    if (unit.type === "soundDiscrimination" || unit.type === "toneDiscrimination") {
      return group.pairs.flatMap((pair) => [
        { ...pair.left, pairId: pair.id, side: "left" },
        { ...pair.right, pairId: pair.id, side: "right" },
      ]);
    }
    if (unit.type === "toneSeries") return group.items || [];
    if (unit.type === "toneMarking") return group.items || [];
    return group.items || unit.items || [];
  }

  function itemKey(item) {
    return item.id || `${item.pairId || "item"}:${item.side || "single"}:${item.cueId || item.display}`;
  }

  function selectedItem(unit = currentUnit(), group = currentGroup(unit)) {
    const items = selectableItems(unit, group);
    const selectedKey = state.selectedItems[groupKey(unit, group)];
    return items.find((item) => itemKey(item) === selectedKey) || items[0] || null;
  }

  function setSelectedItem(item) {
    dismissPinyinAssessment();
    stopAudio();
    state.audioSegment = null;
    state.selectedItems[groupKey()] = itemKey(item);
    state.challenge = null;
    render();
  }

  function analysisForItem(item, unit = currentUnit()) {
    if (!item) return null;
    if (unit.type === "toneMarking") {
      const result = state.toneAnswers[item.id];
      if (result?.correct || result?.revealed) return item.answer;
      return { ...item.answer, display: item.prompt, tone: 0, toneMark: "", toneShown: false };
    }
    if (item.initial !== undefined || item.final !== undefined) return item;
    const display = String(item.display || "").split(/[［\[]/)[0].trim();
    if (item.category === "initial") return { display, initial: display, final: "", tone: 0, toneShown: false };
    if (item.category === "final") return { display, initial: "", final: display, tone: 0, toneShown: false };
    return { display, initial: "", final: display, tone: 0, toneShown: false };
  }

  function pinyinAssessmentTarget(unit = currentUnit(), item = selectedItem(unit, currentGroup(unit))) {
    if (state.activePart === "texts") {
      const word = currentTextItem();
      if (!word) return null;
      const isSentence = textSection()?.type === "text";
      return {
        id: word.id,
        display: word.hanzi,
        referencePinyin: word.pinyin,
        referenceText: word.hanzi,
        cueId: word.cueId,
        mode: "sentence",
        unitType: isSentence ? "text-sentence-pronunciation" : "vocabulary-pronunciation",
        title: isSentence ? "课文句子跟读测评" : "生词与短语跟读测评",
      };
    }
    const analysis = analysisForItem(item, unit);
    if (!analysis?.final || unit.type === "soundChart") return null;
    if (unit.type === "toneMarking" && !(state.toneAnswers[item.id]?.correct || state.toneAnswers[item.id]?.revealed)) return null;
    const initial = String(analysis.initial || "").trim().toLowerCase();
    const final = String(analysis.final || "").trim().toLowerCase();
    const tone = Number(analysis.tone || 0);
    return {
      id: `${unit.id}-${item.id || item.cueId || itemKey(item)}`.replace(/[^a-zA-Z0-9_-]+/g, "-"),
      display: String(analysis.display || item.display || ""),
      referencePinyin: `${initial ? `${initial} ` : ""}${final}${tone || ""}`,
      toneDetection: tone > 0,
      referenceText: String(analysis.display || item.display || ""),
      cueId: item.cueId,
      mode: "pinyin",
      unitType: "pinyin-syllable",
      title: "完整音节跟读测评",
      analysis,
    };
  }

  function oralAnswer(section, item) {
    const country = section?.countryOptions?.find((entry) => entry.id === state.oralAnswerChoices[item?.id]);
    if (!country || !item?.answerPrefix) return null;
    return {
      country,
      hanzi: `${item.answerPrefix.hanzi}${country.hanzi}人。`,
      pinyin: `${item.answerPrefix.pinyin} ${country.pinyin} rén.`,
    };
  }

  function oralAssessmentTarget(kind) {
    const section = textSection();
    const item = currentTextItem();
    if (section?.type !== "oralPractice" || !item) return null;
    if (kind === "answer") {
      const answer = oralAnswer(section, item);
      if (!answer) return null;
      return {
        id: item.id, display: answer.hanzi, referencePinyin: answer.pinyin,
        referenceText: answer.hanzi, cueId: "", mode: "sentence",
        unitType: "oral-question-answer", title: "回答问题口语测评",
        contextLabel: "我的回答",
      };
    }
    return {
      id: item.id, display: item.hanzi, referencePinyin: item.pinyin,
      referenceText: item.hanzi, cueId: item.cueId, mode: "sentence",
      unitType: "oral-question-repeat", title: "跟读问题口语测评",
      contextLabel: "当前问题",
    };
  }

  function tonePath(tone) {
    return {
      1: "M 22 36 L 178 36",
      2: "M 22 126 L 178 34",
      3: "M 22 66 C 55 122, 94 142, 178 54",
      4: "M 22 34 L 178 130",
    }[tone] || "M 22 84 L 178 84";
  }

  function renderToneCurve(tone, compact = false) {
    if (!tone) return "";
    return `<div class="pron-tone-visual${compact ? " compact" : ""}" aria-label="${toneNames[tone][0]}">
      <svg viewBox="0 0 200 160" role="img" aria-hidden="true">
        <line x1="16" y1="34" x2="184" y2="34"></line>
        <line x1="16" y1="82" x2="184" y2="82"></line>
        <line x1="16" y1="130" x2="184" y2="130"></line>
        <path class="pron-tone-path" d="${tonePath(tone)}"></path>
        <circle class="pron-tone-dot" cx="22" cy="${tone === 2 ? 126 : tone === 3 ? 66 : 34}" r="7"></circle>
      </svg>
      <span><strong>${toneNames[tone][0]}</strong><small>${toneNames[tone][1]}</small></span>
    </div>`;
  }

  function renderDecomposition(analysis) {
    if (!analysis) return "";
    const initial = analysis.initial || "";
    const final = analysis.final || "";
    if (!final) {
      return `<div class="pron-single-component"><strong>${escapeHtml(analysis.display)}</strong><span>声母 <small>Initial</small></span></div>`;
    }
    if (!initial && !analysis.toneShown) {
      return `<div class="pron-single-component final"><strong>${escapeHtml(analysis.display)}</strong><span>韵母 <small>Final</small></span></div>`;
    }
    const components = [
      `<div class="pron-equation-part initial" data-pron-component="initial"><strong>${escapeHtml(initial || "∅")}</strong><span>${initial ? "声母" : "无声母"}<small>${initial ? "Initial" : "No initial"}</small></span></div>`,
      `<b class="pron-equation-symbol">+</b>`,
      `<div class="pron-equation-part final" data-pron-component="final"><strong>${escapeHtml(final)}</strong><span>韵母<small>Final</small></span></div>`,
    ];
    if (analysis.toneShown && analysis.tone) {
      components.push(
        `<b class="pron-equation-symbol">+</b>`,
        `<div class="pron-equation-part tone" data-pron-component="tone"><strong>${escapeHtml(analysis.toneMark)}</strong><span>${toneNames[analysis.tone][0]}<small>${toneNames[analysis.tone][1]}</small></span></div>`,
      );
    }
    components.push(
      `<b class="pron-equation-symbol">=</b>`,
      `<div class="pron-equation-part result" data-pron-component="result"><strong>${escapeHtml(analysis.display)}</strong><span>完整音节<small>Syllable</small></span></div>`,
    );
    return `<div class="pron-equation">${components.join("")}</div>`;
  }

  function renderChapterNavigation(unit) {
    return `<div class="pron-learning-map">
      ${state.model.chapters.map((chapter) => `<button type="button" class="${chapter.id === unit.chapterId ? "active" : ""}" data-pron-chapter="${chapter.id}">
        ${bilingual(localize(chapter.title, "zh-CN"), localize(chapter.title, "en"))}
        <span>${chapter.units.length}</span>
      </button>`).join("")}
    </div>
    <div class="pron-unit-tabs">
      ${state.units.filter((item) => item.chapterId === unit.chapterId).map((item) => `<button type="button" class="${item.id === unit.id ? "active" : ""}" data-pron-unit="${item.id}">
        <b>${String(item.number).padStart(2, "0")}</b>${bilingual(localize(item.title, "zh-CN"), localize(item.title, "en"))}
      </button>`).join("")}
    </div>`;
  }

  function renderGroupNavigation(unit, group) {
    if (!unit.groups?.length) return "";
    return `<div class="pron-group-tabs" aria-label="学习分组">
      ${unit.groups.map((item, index) => `<button type="button" class="${item.id === group?.id ? "active" : ""}" data-pron-group="${index}">${escapeHtml(item.title || item.base || `第${index + 1}组`)}</button>`).join("")}
    </div>`;
  }

  function renderItemSelector(unit, group, selected) {
    if (unit.type === "soundDiscrimination" || unit.type === "toneDiscrimination") {
      return `<div class="pron-pair-grid">${group.pairs.map((pair) => `
        <div class="pron-pair-row">
          ${renderItemButton({ ...pair.left, pairId: pair.id, side: "left" }, selected, undefined)}
          <span aria-hidden="true">↔</span>
          ${renderItemButton({ ...pair.right, pairId: pair.id, side: "right" }, selected, undefined)}
        </div>`).join("")}</div>`;
    }
    const items = selectableItems(unit, group);
    return `<div class="pron-item-strip">${items.map((item, index) => renderItemButton(item, selected, index)).join("")}</div>`;
  }

  function renderItemButton(item, selected, index) {
    const active = itemKey(item) === itemKey(selected || {});
    const display = item.prompt || item.display;
    const toneResult = item.answer ? state.toneAnswers[item.id] : null;
    const tone = item.answer
      ? toneResult?.correct || toneResult?.revealed ? item.answer.tone : 0
      : item.tone;
    return `<button type="button" class="pron-item-button${active ? " active" : ""}" data-pron-select="${escapeHtml(itemKey(item))}">
      ${index !== undefined ? `<small>${String(index + 1).padStart(2, "0")}</small>` : ""}
      <strong>${escapeHtml(display)}</strong>${tone ? `<span>${tone}</span>` : ""}
    </button>`;
  }

  function currentPair(unit, group, selected) {
    return group?.pairs?.find((pair) => pair.id === selected?.pairId) || group?.pairs?.[0] || null;
  }

  function renderFocusStage(unit, group, selected) {
    const analysis = analysisForItem(selected, unit);
    const pair = currentPair(unit, group, selected);
    const feature = group?.comparison?.feature;
    const tone = analysis?.tone || 0;
    const assessmentTarget = pinyinAssessmentTarget(unit, selected);
    return `<section class="pron-focus-stage${tone ? " has-tone" : ""}">
      <header>
        <span>${unit.type === "soundChart" ? "发音项目" : "当前学习音"}<small>${unit.type === "soundChart" ? "Sound item" : "Current sound"}</small></span>
        ${feature ? `<b>${featureLabels[feature][0]} <small>${featureLabels[feature][1]}</small></b>` : ""}
      </header>
      <div class="pron-focus-main">
        <div class="pron-focus-content">
          <h2>${escapeHtml(analysis?.display || "")}</h2>
          ${renderDecomposition(analysis)}
          ${!tone && analysis?.final ? `<p class="pron-tone-note">本练习暂不标声调 <small>Tones are not marked in this exercise.</small></p>` : ""}
        </div>
        ${renderToneCurve(tone)}
      </div>
      <div class="pron-focus-actions">
        <button type="button" class="pron-action primary" data-pron-play="${escapeHtml(selected?.cueId || "")}">▶ ${bilingual("播放", "Play")}</button>
        ${pair ? `<button type="button" class="pron-action compare" data-pron-compare="${pair.id}">⇄ ${bilingual("对比播放", "Compare")}</button>` : ""}
        <button type="button" class="pron-action record" data-pron-record${assessmentTarget ? "" : " disabled"} title="${assessmentTarget ? "录音并进行拼音测评 / Record and assess pinyin" : "请选择完整音节 / Select a complete syllable"}">● ${bilingual("跟读", "Repeat")}</button>
      </div>
    </section>`;
  }

  function renderChallenge(unit, group, selected) {
    if (!["soundDiscrimination", "toneDiscrimination"].includes(unit.type)) return "";
    const pair = currentPair(unit, group, selected);
    if (!pair) return "";
    const challenge = state.challenge?.pairId === pair.id ? state.challenge : null;
    const options = [pair.left, pair.right];
    return `<section class="pron-challenge">
      <div><span>听辨小挑战 <small>Listening challenge</small></span><p>${challenge ? "选择刚才听到的拼音。" : "系统随机播放一个音，听完后选择答案。"}</p></div>
      ${challenge ? `<div class="pron-challenge-options">${options.map((item) => `<button type="button" class="${challenge.answer === item.cueId ? (item.cueId === challenge.correct ? "correct" : "wrong") : ""}" data-pron-challenge-answer="${item.cueId}">${escapeHtml(item.display)}</button>`).join("")}</div>` : ""}
      <button type="button" class="pron-challenge-start" data-pron-challenge="${pair.id}">${challenge ? "再听一题" : "开始挑战"}<small>${challenge ? "Try again" : "Start"}</small></button>
      ${challenge?.answer ? `<strong class="pron-challenge-feedback ${challenge.answer === challenge.correct ? "correct" : "wrong"}">${challenge.answer === challenge.correct ? "听对了，继续保持！" : "再比较一次，注意两个音的关键差别。"}</strong>` : ""}
    </section>`;
  }

  function renderToneMarking(unit, group, selected) {
    const result = state.toneAnswers[selected.id] || { attempts: 0 };
    const display = result.correct || result.revealed ? selected.answer.display : selected.prompt;
    return `<section class="pron-focus-stage has-tone tone-marking-stage">
      <header><span>听后标上声调<small>Listen and add the tone</small></span><b>第 ${group.items.indexOf(selected) + 1} / ${group.items.length} 题</b></header>
      <div class="pron-focus-main">
        <div class="pron-focus-content"><h2>${escapeHtml(display)}</h2>${renderDecomposition(analysisForItem(selected, unit))}</div>
        ${(result.correct || result.revealed) ? renderToneCurve(selected.answer.tone) : ""}
      </div>
      <div class="pron-focus-actions"><button type="button" class="pron-action primary" data-pron-play="${selected.cueId}">▶ ${bilingual("播放题目", "Play")}</button></div>
      <div class="pron-tone-options">${[1, 2, 3, 4].map((tone) => `<button type="button" class="${result.choice === tone ? (tone === selected.answer.tone ? "correct" : "wrong") : ""}" data-pron-tone-answer="${tone}"><b>${tone}</b><span>${toneNames[tone][0]}<small>${toneNames[tone][1]}</small></span></button>`).join("")}</div>
      ${result.choice ? `<p class="pron-answer-feedback ${result.correct ? "correct" : "wrong"}">${result.correct ? `正确：${selected.answer.display}` : result.revealed ? `正确答案是 ${selected.answer.display}。请结合声调曲线再听一次。` : "再听一次，注意声音的起点和走向。"}</p>` : ""}
    </section>`;
  }

  function renderExercise(unit) {
    const group = currentGroup(unit);
    const selected = selectedItem(unit, group);
    return `${renderChapterNavigation(unit)}${renderGroupNavigation(unit, group)}
      <div class="pron-exercise-layout">
        <section class="pron-selector-panel">
          <header><span>${unit.type === "soundDiscrimination" ? "选择对比音" : unit.type === "toneSeries" ? "选择声调" : "选择练习项"}</span><small>点击后进入语音学习台</small></header>
          ${renderItemSelector(unit, group, selected)}
        </section>
        ${unit.type === "toneMarking" ? renderToneMarking(unit, group, selected) : renderFocusStage(unit, group, selected)}
        ${renderChallenge(unit, group, selected)}
      </div>`;
  }

  function comparisonButtons(unit) {
    if (!unit.comparisonIds?.length || state.assistMode === "immersion") return "";
    return `<div class="pron-comparison-buttons">${unit.comparisonIds.map((id) => {
      const concept = state.model.comparisonConcepts[id];
      return `<button type="button" data-pron-comparison="${id}">◎ ${escapeHtml(localize(concept.title, "zh-CN"))}<small>${escapeHtml(localize(concept.title, "en"))}</small></button>`;
    }).join("")}</div>`;
  }

  function renderKnowledge(unit) {
    const translationClass = state.assistMode === "bilingual" ? " bilingual" : "";
    const examples = unit.examples || [];
    const selected = selectedItem(unit, null);
    return `${renderChapterNavigation(unit)}<article class="pron-knowledge${translationClass}">
      <header><span>语音知识 <small>Phonetic Notes</small></span><h2>${escapeHtml(localize(unit.title, "zh-CN"))}</h2><p>${escapeHtml(localize(unit.title, "en"))}</p></header>
      ${comparisonButtons(unit)}
      ${unit.paragraphs ? `<div class="pron-knowledge-copy">${unit.paragraphs.map((paragraph) => `<section><p class="zh">${escapeHtml(paragraph.texts["zh-CN"] || "")}</p>${state.assistMode !== "immersion" ? `<p class="translation">${escapeHtml(localize(paragraph.texts))}</p>` : ""}${paragraph.cueId ? `<button type="button" data-pron-play="${paragraph.cueId}" aria-label="播放本段">▶</button>` : ""}</section>`).join("")}</div>` : ""}
      ${examples.length ? `<div class="pron-example-grid">${examples.map((example) => `<section><h3>${escapeHtml(example.display)}</h3>${renderDecomposition(example)}${renderToneCurve(example.tone, true)}</section>`).join("")}</div>` : ""}
      ${unit.items ? `<section class="pron-chart-section"><div class="pron-chart-grid">${unit.items.map((item) => `<button type="button" class="${itemKey(item) === itemKey(selected || {}) ? "active" : ""}" data-pron-select="${escapeHtml(itemKey(item))}"><strong>${escapeHtml(item.display)}</strong><span>选择 <small>Select</small></span></button>`).join("")}</div>${selected ? renderFocusStage(unit, null, selected) : ""}</section>` : ""}
    </article>`;
  }

  function setAudioSource(source) {
    if (!source) return;
    const resolved = new URL(source, window.location.href).href;
    if (elements.audio.src === resolved) return;
    stopAudio();
    state.audioSegment = null;
    state.audioReadyPromise = null;
    elements.audio.src = source;
    elements.audio.load();
  }

  function textGroupForItem(item) {
    return textSection()?.groups?.find((group) => group.itemIds?.includes(item?.id)) || null;
  }

  function renderTextSectionTabs(section) {
    return `<nav class="beginner-section-tabs" aria-label="课文学习内容">
      ${textSections().map((entry) => `<button type="button" class="${entry.id === section.id ? "active" : ""}" data-text-section="${escapeHtml(entry.id)}"><strong>${escapeHtml(localize(entry.title, "zh-CN"))}</strong><small>${escapeHtml(localize(entry.title, "en"))}</small></button>`).join("")}
    </nav>`;
  }

  function renderOralPractice(part, section, items, item, meaning, note) {
    return `<article class="beginner-text-stage beginner-oral-stage">
      ${renderTextSectionTabs(section)}
      <div class="beginner-oral-focus">
        <div class="beginner-word-index">${String(state.textItemIndex + 1).padStart(2, "0")} / ${String(items.length).padStart(2, "0")}</div>
        <span class="beginner-sentence-label">口语问答 <small>Oral questions</small></span>
        <h2>${escapeHtml(item.hanzi)}</h2>
        <p class="beginner-pinyin">${escapeHtml(item.pinyin)}</p>
        ${meaning ? `<p class="beginner-meaning">${escapeHtml(meaning)}</p>` : ""}
        <div class="beginner-text-actions">
          <button type="button" class="pron-action primary" data-content-play="${escapeHtml(item.cueId)}">▶ ${bilingual("播放问题", "Play")}</button>
          <button type="button" class="pron-action record" data-oral-assessment="repeat">● ${bilingual("跟读问题", "Repeat")}</button>
          <button type="button" class="pron-action submit" data-oral-answer-prepare>● ${bilingual("回答问题", "Answer")}</button>
          ${note ? `<button type="button" class="pron-action note" data-content-note="${escapeHtml(note.id)}">i ${bilingual("综合注释", "Note")}</button>` : ""}
        </div>
      </div>
      <nav class="beginner-item-strip beginner-oral-strip" aria-label="选择口语问题">
        ${section.items.map((entry, questionIndex) => { const index = items.indexOf(entry); return `<button type="button" class="${index === state.textItemIndex ? "active" : ""}" data-text-item="${index}" aria-label="第${questionIndex + 1}题 ${escapeHtml(entry.hanzi)}" title="${escapeHtml(entry.hanzi)}"><strong>${String(questionIndex + 1).padStart(2, "0")}</strong><small>题</small></button>`; }).join("")}
      </nav>
    </article>`;
  }

  function renderOralAnswerPreparation() {
    const section = textSection();
    const item = currentTextItem();
    if (section?.type !== "oralPractice" || !item) return;
    const selectedCountryId = state.oralAnswerChoices[item.id] || "";
    const answer = oralAnswer(section, item);
    elements.assistContent.innerHTML = `<article class="oral-answer-preparation">
      <header>
        <span>当前问题 <small>Current question</small></span>
        <strong>${escapeHtml(item.hanzi)}</strong>
        <code>${escapeHtml(item.pinyin)}</code>
      </header>
      <label class="oral-answer-select">
        <span>选择回答中的国家 <small>Choose the country in your answer</small></span>
        <select data-oral-answer-country>
          <option value="">请选择 / Select</option>
          ${section.countryOptions.map((country) => `<option value="${escapeHtml(country.id)}"${country.id === selectedCountryId ? " selected" : ""}>${escapeHtml(country.hanzi)} · ${escapeHtml(localize(country.meanings))}</option>`).join("")}
        </select>
      </label>
      <section class="oral-answer-selected ${answer ? "ready" : ""}">
        <span>完整回答 <small>Complete answer</small></span>
        <strong>${escapeHtml(answer?.hanzi || `${item.answerPrefix.hanzi}______人。`)}</strong>
        <p>${escapeHtml(answer?.pinyin || `${item.answerPrefix.pinyin} ______ rén.`)}</p>
      </section>
      <button type="button" class="pron-action submit oral-answer-continue" data-oral-answer-start${answer ? "" : " disabled"}>● ${bilingual("进入录音", "Continue")}</button>
    </article>`;
  }

  function openOralAnswerPreparation() {
    const section = textSection();
    const item = currentTextItem();
    if (section?.type !== "oralPractice" || !item) return;
    dismissPinyinAssessment();
    elements.assistContext.textContent = `回答准备 · ${languageNames[state.locale] || "English"}`;
    elements.assistTitle.textContent = "回答问题";
    elements.assistTabs.innerHTML = "";
    renderOralAnswerPreparation();
    elements.assistZone.hidden = false;
  }

  function renderTextPart() {
    const part = textPart();
    const section = textSection();
    const items = textItems();
    const item = currentTextItem();
    if (!part || !section || !item) return `<p class="load-error">本课课文数据尚未准备好。</p>`;
    const group = textGroupForItem(item);
    state.textGroupId = group?.id || state.textGroupId;
    const meaning = state.assistMode === "immersion" ? "" : localize(item.meanings);
    const note = part.notes?.find((entry) => entry.id === item.noteId);
    if (section.type === "oralPractice") return renderOralPractice(part, section, items, item, meaning, note);
    if (section.type === "text") {
      return `<article class="beginner-text-stage beginner-sentence-stage">
        ${renderTextSectionTabs(section)}
        <div class="beginner-text-focus beginner-sentence-focus">
          <div class="beginner-word-index">${String(state.textItemIndex + 1).padStart(2, "0")} / ${String(items.length).padStart(2, "0")}</div>
          <span class="beginner-sentence-label">课文句子 <small>Text sentence</small></span>
          <h2>${escapeHtml(item.hanzi)}</h2>
          <p class="beginner-pinyin">${escapeHtml(item.pinyin)}</p>
          ${meaning ? `<p class="beginner-meaning">${escapeHtml(meaning)}</p>` : ""}
          <div class="beginner-text-actions">
            <button type="button" class="pron-action primary" data-content-play="${escapeHtml(item.cueId || "")}">▶ ${bilingual("播放", "Play")}</button>
            <button type="button" class="pron-action record" data-text-repeat>● ${bilingual("跟读", "Repeat")}</button>
            ${note ? `<button type="button" class="pron-action note" data-content-note="${escapeHtml(note.id)}">i ${bilingual("综合注释", "Note")}</button>` : ""}
          </div>
        </div>
        <nav class="beginner-item-strip beginner-sentence-strip" aria-label="选择课文句子">
          ${section.items.map((entry, sentenceIndex) => { const index = items.indexOf(entry); return `<button type="button" class="${index === state.textItemIndex ? "active" : ""}" data-text-item="${index}"><strong>${String(sentenceIndex + 1).padStart(2, "0")}</strong><small>${escapeHtml(entry.hanzi)}</small></button>`; }).join("")}
        </nav>
      </article>`;
    }
    return `<article class="beginner-text-stage">
      ${renderTextSectionTabs(section)}
      <nav class="beginner-group-tabs" aria-label="生词分组">
        ${section.groups.map((entry) => `<button type="button" class="${entry.id === state.textGroupId ? "active" : ""}" data-text-group="${escapeHtml(entry.id)}"><strong>${escapeHtml(localize(entry.title, "zh-CN"))}</strong><small>${escapeHtml(localize(entry.title, "en"))}</small></button>`).join("")}
      </nav>
      <div class="beginner-text-focus">
        <div class="beginner-word-index">${String(state.textItemIndex + 1).padStart(2, "0")} / ${String(items.length).padStart(2, "0")}</div>
        <h2>${escapeHtml(item.hanzi)}</h2>
        <p class="beginner-pinyin">${escapeHtml(item.pinyin)}</p>
        <span class="beginner-pos">${escapeHtml(localize(item.partOfSpeech, "zh-CN"))}<small>${escapeHtml(localize(item.partOfSpeech, "en"))}</small></span>
        ${meaning ? `<p class="beginner-meaning">${escapeHtml(meaning)}</p>` : ""}
        <div class="beginner-text-actions">
          <button type="button" class="pron-action primary" data-content-play="${escapeHtml(item.cueId || "")}">▶ ${bilingual("播放", "Play")}</button>
          <button type="button" class="pron-action record" data-text-repeat>● ${bilingual("跟读", "Repeat")}</button>
          ${note ? `<button type="button" class="pron-action note" data-content-note="${escapeHtml(note.id)}">i ${bilingual("综合注释", "Note")}</button>` : ""}
        </div>
      </div>
      <nav class="beginner-item-strip" aria-label="选择生词">
        ${group.itemIds.map((id) => { const entry = items.find((candidate) => candidate.id === id); const index = items.indexOf(entry); return `<button type="button" class="${index === state.textItemIndex ? "active" : ""}" data-text-item="${index}"><strong>${escapeHtml(entry.hanzi)}</strong><small>${escapeHtml(entry.pinyin)}</small></button>`; }).join("")}
      </nav>
    </article>`;
  }

  function renderCharacterPart() {
    const part = characterPart();
    const items = part?.items || [];
    const item = currentCharacter();
    if (!item) return `<p class="load-error">本课汉字数据尚未准备好。</p>`;
    const meaning = state.assistMode === "immersion" ? "" : localize(item.meanings);
    return `<article class="beginner-character-stage">
      <nav class="beginner-character-tabs" aria-label="选择汉字">
        ${items.map((entry, index) => `<button type="button" class="${index === state.characterIndex ? "active" : ""}" data-character-item="${index}"><strong>${escapeHtml(entry.hanzi)}</strong><small>${escapeHtml(entry.pinyin)}</small></button>`).join("")}
      </nav>
      <div class="beginner-character-focus">
        <span>本课汉字 <small>Character ${state.characterIndex + 1} of ${items.length}</small></span>
        <h2>${escapeHtml(item.hanzi)}</h2>
        <p>${escapeHtml(item.pinyin)}</p>
        ${meaning ? `<strong>${escapeHtml(meaning)}</strong>` : ""}
        <div class="beginner-character-actions">
          ${item.cueId ? `<button type="button" class="pron-action primary" data-content-play="${escapeHtml(item.cueId)}">▶ ${bilingual("听读音", "Listen")}</button>` : ""}
          <button type="button" class="pron-action record" data-character-write>✎ ${bilingual("笔顺与跟写", "Write")}</button>
        </div>
      </div>
      <p class="beginner-character-tip">先看笔顺，再在田字格中独立书写。确认后可保存图片，并自愿提交 AI 书写评价。</p>
    </article>`;
  }

  function renderGuidedDialoguePractice(item) {
    const saved = localStorage.getItem(`beginnerPractice:${state.model.lessonId}:${item.id}`) || "";
    return `<div class="beginner-practice-dialogue">
      ${(item.prompts || []).map((line) => `<div class="practice-dialogue-line"><b>${escapeHtml(line.role)}</b><span><strong>${escapeHtml(line.hanzi)}</strong><small>${escapeHtml(line.pinyin)}</small></span></div>`).join("")}
      <label class="practice-open-field"><span>写下你和同学的对话 <small>Write your dialogue</small></span><textarea rows="4" data-practice-open placeholder="A：……\nB：……">${escapeHtml(saved)}</textarea></label>
    </div>`;
  }

  function renderNameSplitPractice(item) {
    return `<div class="practice-name-grid">
      ${(item.people || []).map((person) => `<article class="practice-name-card" data-name-person="${escapeHtml(person.id)}">
        <header><strong>${escapeHtml(person.name)}</strong><small>${escapeHtml(person.pinyin)}</small></header>
        <label><span>姓 <small>Surname</small></span><input data-name-surname autocomplete="off"></label>
        <label><span>名字 <small>Given name</small></span><input data-name-given autocomplete="off"></label>
      </article>`).join("")}
    </div>`;
  }

  function renderPinyinTonePractice(item) {
    return `<p class="practice-instruction">${escapeHtml(localize(item.instruction, "zh-CN"))}<small>${escapeHtml(localize(item.instruction, "en"))}</small></p>
      <div class="practice-pinyin-grid">
        ${(item.items || []).map((entry) => `<article class="practice-pinyin-card" data-pinyin-item="${escapeHtml(entry.id)}">
          <strong>${escapeHtml(entry.hanzi)}</strong>
          <label><span>拼音</span><input data-pinyin-syllable inputmode="text" autocomplete="off" placeholder="例如 qing"></label>
          <label><span>声调</span><select data-pinyin-tone><option value="">选择</option><option value="0">轻声</option><option value="1">1声</option><option value="2">2声</option><option value="3">3声</option><option value="4">4声</option></select></label>
          <p class="practice-item-feedback" aria-live="polite"></p>
        </article>`).join("")}
      </div>`;
  }

  function renderDialogueFillPractice(item) {
    return `<div class="practice-dialogue-list">
      ${(item.dialogues || []).map((dialogue, dialogueIndex) => `<article class="practice-fill-dialogue" data-dialogue-id="${escapeHtml(dialogue.id)}">
        <h3>对话 ${dialogueIndex + 1} <small>Dialogue ${dialogueIndex + 1}</small></h3>
        <div class="practice-dialogue-copy">${dialogue.lines.map((line) => `<p>${escapeHtml(line)}</p>`).join("")}</div>
        <div class="practice-blank-list">${dialogue.blanks.map((blank, index) => `<label data-dialogue-blank="${escapeHtml(blank.id)}"><span>第 ${index + 1} 空</span><input autocomplete="off"></label>`).join("")}</div>
      </article>`).join("")}
    </div>`;
  }

  function renderOpenResponsePractice(item) {
    const saved = localStorage.getItem(`beginnerPractice:${state.model.lessonId}:${item.id}`) || "";
    return `<div class="practice-open-response"><p>${escapeHtml(localize(item.prompt, "zh-CN"))}</p><small>${escapeHtml(localize(item.prompt, "en"))}</small><textarea rows="6" data-practice-open placeholder="例如：他姓成，叫成龙。">${escapeHtml(saved)}</textarea></div>`;
  }

  function renderPracticeBody(item) {
    if (item.type === "guidedDialogue") return renderGuidedDialoguePractice(item);
    if (item.type === "nameSplit") return renderNameSplitPractice(item);
    if (item.type === "pinyinTone") return renderPinyinTonePractice(item);
    if (item.type === "dialogueFill") return renderDialogueFillPractice(item);
    return renderOpenResponsePractice(item);
  }

  function renderPracticePart() {
    const items = practiceItems();
    const item = currentPracticeItem();
    if (!item) return `<p class="load-error">本课练习数据尚未准备好。</p>`;
    return `<article class="beginner-practice-stage">
      <header class="beginner-practice-heading"><span>${escapeHtml(localize(item.sectionTitle, "zh-CN"))}<small>${escapeHtml(localize(item.sectionTitle, "en"))}</small></span><h2>${escapeHtml(localize(item.title, "zh-CN"))}</h2><p>${escapeHtml(localize(item.title, "en"))}</p></header>
      <div class="beginner-practice-body">${renderPracticeBody(item)}</div>
      <footer class="beginner-practice-actions"><button type="button" class="pron-action primary" data-practice-submit>✓ ${bilingual(item.type === "openResponse" || item.type === "guidedDialogue" ? "保存练习" : "确认答案", item.type === "openResponse" || item.type === "guidedDialogue" ? "Save" : "Check answers")}</button><p id="practiceResult" aria-live="polite"></p></footer>
      <nav class="beginner-item-strip practice-item-strip" aria-label="选择练习">${items.map((entry, index) => `<button type="button" class="${index === state.practiceIndex ? "active" : ""}" data-practice-item="${index}"><strong>${String(index + 1).padStart(2, "0")}</strong><small>${escapeHtml(localize(entry.title, "zh-CN"))}</small></button>`).join("")}</nav>
    </article>`;
  }

  function normalizePracticeAnswer(value) {
    return String(value || "").trim().toLowerCase().replace(/[\s，。！？、,.!?]/g, "");
  }

  function submitPracticeAnswer() {
    const item = currentPracticeItem();
    const result = document.querySelector("#practiceResult");
    if (!item || !result) return;
    if (item.type === "guidedDialogue" || item.type === "openResponse") {
      const value = elements.unitContent.querySelector("[data-practice-open]")?.value.trim() || "";
      if (!value) { result.textContent = "请先完成内容。 / Please complete the activity first."; result.className = "is-error"; return; }
      localStorage.setItem(`beginnerPractice:${state.model.lessonId}:${item.id}`, value);
      result.textContent = "已保存本次练习。 / Saved.";
      result.className = "is-correct";
      return;
    }
    let correct = 0;
    let total = 0;
    if (item.type === "nameSplit") {
      (item.people || []).forEach((person) => {
        const card = elements.unitContent.querySelector(`[data-name-person="${person.id}"]`);
        const surnameOk = normalizePracticeAnswer(card?.querySelector("[data-name-surname]")?.value) === normalizePracticeAnswer(person.surname);
        const givenValue = normalizePracticeAnswer(card?.querySelector("[data-name-given]")?.value);
        const givenOk = [person.givenName, person.name].some((answer) => normalizePracticeAnswer(answer) === givenValue);
        card?.classList.toggle("is-correct", surnameOk && givenOk);
        card?.classList.toggle("is-wrong", !(surnameOk && givenOk));
        correct += Number(surnameOk) + Number(givenOk);
        total += 2;
      });
    } else if (item.type === "pinyinTone") {
      (item.items || []).forEach((entry) => {
        const card = elements.unitContent.querySelector(`[data-pinyin-item="${entry.id}"]`);
        const syllableOk = normalizePracticeAnswer(card?.querySelector("[data-pinyin-syllable]")?.value) === normalizePracticeAnswer(entry.answer.syllable);
        const toneOk = Number(card?.querySelector("[data-pinyin-tone]")?.value) === Number(entry.answer.tone);
        const ok = syllableOk && toneOk;
        card?.classList.toggle("is-correct", ok);
        card?.classList.toggle("is-wrong", !ok);
        const feedback = card?.querySelector(".practice-item-feedback");
        if (feedback) feedback.textContent = ok ? `正确：${entry.answer.display}` : `再想一想。提示答案：${entry.answer.display}`;
        correct += Number(ok);
        total += 1;
      });
    } else if (item.type === "dialogueFill") {
      (item.dialogues || []).forEach((dialogue) => dialogue.blanks.forEach((blank) => {
        const field = elements.unitContent.querySelector(`[data-dialogue-blank="${blank.id}"]`);
        const value = normalizePracticeAnswer(field?.querySelector("input")?.value);
        const ok = blank.answers.some((answer) => normalizePracticeAnswer(answer) === value);
        field?.classList.toggle("is-correct", ok);
        field?.classList.toggle("is-wrong", !ok);
        correct += Number(ok);
        total += 1;
      }));
    }
    result.textContent = `完成 ${correct} / ${total}。${correct === total ? " 全部正确！" : " 请根据标记修改后再试。"} / ${correct} of ${total} correct.`;
    result.className = correct === total ? "is-correct" : "is-error";
  }

  function renderPracticeWorkspace() {
    const items = practiceItems();
    const item = currentPracticeItem();
    elements.unitKicker.textContent = `${localize(item?.sectionTitle, "zh-CN")} · 课后练习`;
    elements.unitTitle.textContent = localize(item?.title, "zh-CN");
    elements.unitProgress.textContent = `第 ${state.practiceIndex + 1} / ${items.length} 个练习`;
    elements.footerProgress.textContent = `${state.practiceIndex + 1} / ${items.length}`;
    elements.unitSelect.innerHTML = items.map((entry, index) => `<option value="${index}">${String(index + 1).padStart(2, "0")} ${escapeHtml(localize(entry.title, "zh-CN"))}</option>`).join("");
    elements.unitSelect.value = String(state.practiceIndex);
    elements.previous.disabled = state.practiceIndex === 0;
    elements.next.disabled = state.practiceIndex === items.length - 1;
    elements.unitContent.innerHTML = renderPracticePart();
    elements.audioDock.hidden = true;
    state.audioSegment = null;
  }

  function renderPartNavigationState() {
    document.querySelectorAll(".section-tabs [data-pron-part]").forEach((button) => {
      button.classList.toggle("active", button.dataset.pronPart === state.activePart);
    });
  }

  function renderContentPart() {
    const isText = state.activePart === "texts";
    const part = isText ? textPart() : characterPart();
    const items = isText ? textItems() : (part?.items || []);
    const index = isText ? state.textItemIndex : state.characterIndex;
    const item = items[index] || items[0];
    const currentSection = isText ? textSection() : null;
    const audioModel = currentSection?.audio || part?.audio || state.contentModel?.audio;
    const textAudio = audioModel?.cos || audioModel?.local;
    setAudioSource(textAudio);
    state.cues = state.textCues;
    elements.unitKicker.textContent = `${part?.part || ""} · ${localize(part?.title, "zh-CN")}`;
    elements.unitTitle.textContent = isText ? localize(currentSection?.title, "zh-CN") : "学写汉字";
    elements.unitProgress.textContent = `第 ${index + 1} / ${items.length} 个学习单元`;
    elements.footerProgress.textContent = `${index + 1} / ${items.length}`;
    elements.unitSelect.innerHTML = items.map((entry, itemIndex) => `<option value="${itemIndex}">${String(itemIndex + 1).padStart(2, "0")} ${escapeHtml(entry.hanzi)} · ${escapeHtml(entry.pinyin)}</option>`).join("");
    elements.unitSelect.value = String(index);
    elements.previous.disabled = index === 0;
    elements.next.disabled = index === items.length - 1;
    elements.unitContent.innerHTML = isText ? renderTextPart() : renderCharacterPart();
    elements.audioDock.hidden = !textAudio;
    state.audioSegment = item?.cueId ? cueFor(item.cueId) : null;
    updateAudioLabels();
  }

  function render() {
    renderPartNavigationState();
    if (state.activePart === "practice") {
      document.querySelectorAll("[data-assist-mode]").forEach((button) => button.classList.toggle("active", button.dataset.assistMode === state.assistMode));
      renderPracticeWorkspace();
      return;
    }
    if (state.activePart !== "phonetics") {
      document.querySelectorAll("[data-assist-mode]").forEach((button) => button.classList.toggle("active", button.dataset.assistMode === state.assistMode));
      renderContentPart();
      return;
    }
    setAudioSource(state.model.audio.cos || state.model.audio.local);
    state.cues = new Map(state.model.cues.map((cue) => [cue.id, cue]));
    const unit = currentUnit();
    if (!unit) return;
    document.querySelectorAll("[data-assist-mode]").forEach((button) => button.classList.toggle("active", button.dataset.assistMode === state.assistMode));
    elements.unitKicker.textContent = `${unit.chapterPart} · 学习语音`;
    elements.unitTitle.textContent = localize(unit.title, "zh-CN");
    elements.unitProgress.textContent = `${localize(unit.chapterTitle, "zh-CN")} · 第 ${state.unitIndex + 1} / ${state.units.length} 个学习单元`;
    elements.footerProgress.textContent = `${state.unitIndex + 1} / ${state.units.length}`;
    elements.unitSelect.innerHTML = state.units.map((item, index) => `<option value="${index}">${item.number}. ${escapeHtml(localize(item.title, "zh-CN"))}</option>`).join("");
    elements.unitSelect.value = String(state.unitIndex);
    elements.previous.disabled = state.unitIndex === 0;
    elements.next.disabled = state.unitIndex === state.units.length - 1;
    elements.unitContent.innerHTML = unit.type === "knowledge" || unit.type === "soundChart" ? renderKnowledge(unit) : renderExercise(unit);
    elements.audioDock.hidden = false;
    updateAudioLabels();
  }

  function resetLearningScroll() {
    if (elements?.unitContent) elements.unitContent.scrollTop = 0;
  }

  function cueFor(id) {
    return state.cues.get(id);
  }

  function currentPlayableCue() {
    if (state.activePart === "practice") return null;
    if (state.activePart === "texts") {
      const item = currentTextItem();
      return item?.cueId ? cueFor(item.cueId) : null;
    }
    if (state.activePart === "characters") {
      const item = currentCharacter();
      return item?.cueId ? cueFor(item.cueId) : null;
    }
    const item = selectedItem();
    return item?.cueId ? cueFor(item.cueId) : null;
  }

  async function ensureAudio() {
    if (elements.audio.readyState >= HTMLMediaElement.HAVE_METADATA) return true;
    if (state.audioReadyPromise) return state.audioReadyPromise;
    const source = elements.audio.getAttribute("src") || state.model.audio.cos || state.model.audio.local;
    if (!source) return false;
    state.audioReadyPromise = new Promise((resolve) => {
      const finish = (ready) => {
        elements.audio.removeEventListener("loadedmetadata", onReady);
        elements.audio.removeEventListener("error", onError);
        state.audioReadyPromise = null;
        resolve(ready);
      };
      const onReady = () => finish(true);
      const onError = () => finish(false);
      elements.audio.addEventListener("loadedmetadata", onReady, { once: true });
      elements.audio.addEventListener("error", onError, { once: true });
      if (!elements.audio.getAttribute("src")) elements.audio.src = source;
      elements.audio.load();
    });
    return state.audioReadyPromise;
  }

  function seekAudio(time) {
    if (Math.abs(elements.audio.currentTime - time) < .12) return Promise.resolve(true);
    return new Promise((resolve) => {
      let timeoutId;
      const finish = () => {
        clearTimeout(timeoutId);
        elements.audio.removeEventListener("seeked", onSeeked);
        resolve(Math.abs(elements.audio.currentTime - time) < .5);
      };
      const onSeeked = () => finish();
      elements.audio.addEventListener("seeked", onSeeked, { once: true });
      timeoutId = setTimeout(finish, 8000);
      try {
        elements.audio.currentTime = time;
        if (!elements.audio.seeking && Math.abs(elements.audio.currentTime - time) < .12) finish();
      } catch {
        finish();
      }
    });
  }

  async function playCue(cueId, keepQueue = false) {
    const target = cueFor(cueId);
    if (!target || !(await ensureAudio())) return;
    if (!keepQueue) state.audioQueue = [];
    state.audioSegment = target;
    elements.audioStatus.textContent = "正在定位音频 / Loading audio";
    const positioned = await seekAudio(target.start);
    if (!positioned) {
      elements.audioStatus.textContent = "音频仍在载入，请稍后再试 / Audio is still loading";
      return;
    }
    elements.audio.playbackRate = Number(elements.speed.value);
    document.body.classList.add("pron-audio-playing");
    await elements.audio.play().catch(() => {});
    updateAudioLabels();
  }

  function playQueue(cueIds) {
    const valid = cueIds.filter((id) => cueFor(id));
    if (!valid.length) return;
    state.audioQueue = valid.slice(1);
    void playCue(valid[0], true);
  }

  function stopAudio(reset = false) {
    elements.audio.pause();
    state.audioQueue = [];
    if (reset && state.audioSegment) elements.audio.currentTime = state.audioSegment.start;
    document.body.classList.remove("pron-audio-playing");
    updateAudioLabels();
  }

  function syncToneCurve() {
    const path = elements.unitContent.querySelector(".pron-focus-stage .pron-tone-path");
    const dot = elements.unitContent.querySelector(".pron-focus-stage .pron-tone-dot");
    if (!path || !dot || !state.audioSegment) return;
    const duration = Math.max(.01, state.audioSegment.end - state.audioSegment.start);
    const progress = Math.max(0, Math.min(1, (elements.audio.currentTime - state.audioSegment.start) / duration));
    const point = path.getPointAtLength(path.getTotalLength() * progress);
    dot.setAttribute("cx", String(point.x));
    dot.setAttribute("cy", String(point.y));
  }

  function handleTimeUpdate() {
    if (Number.isFinite(elements.audio.duration)) {
      elements.seek.value = String(Math.round(elements.audio.currentTime / elements.audio.duration * 1000));
      elements.audioTime.textContent = `${formatTime(elements.audio.currentTime)} / ${formatTime(elements.audio.duration)}`;
    }
    syncToneCurve();
    const segment = state.audioSegment;
    if (!segment || elements.audio.currentTime < segment.end + .14) return;
    if (state.audioQueue.length) {
      const next = state.audioQueue.shift();
      elements.audio.pause();
      setTimeout(() => void playCue(next, true), 240);
    } else if (state.loop) {
      elements.audio.currentTime = segment.start;
      void elements.audio.play().catch(() => {});
    } else {
      elements.audio.pause();
      elements.audio.currentTime = segment.end;
      document.body.classList.remove("pron-audio-playing");
    }
    updateAudioLabels();
  }

  function updateAudioLabels() {
    const cue = state.audioSegment || currentPlayableCue();
    const tonePrompt = state.activePart === "phonetics" && currentUnit()?.type === "toneMarking" ? selectedItem()?.prompt : "";
    const text = tonePrompt || cue?.text || cue?.texts?.pinyin || cue?.texts?.["zh-CN"] || (state.activePart === "characters" ? currentCharacter()?.hanzi : state.activePart === "texts" ? currentTextItem()?.hanzi : "当前语音学习项");
    elements.audioLabel.textContent = text;
    elements.audioStatus.textContent = elements.audio.paused ? "准备播放 / Ready" : state.audioQueue.length ? "对比连播 / Comparing" : "播放当前读音 / Playing";
    elements.play.textContent = elements.audio.paused ? "▶" : "Ⅱ";
    elements.loop.classList.toggle("active", state.loop);
    elements.loop.setAttribute("aria-pressed", String(state.loop));
  }

  function formatTime(value) {
    const seconds = Math.max(0, Math.floor(Number(value) || 0));
    return `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
  }

  function findItemByKey(key) {
    return selectableItems().find((item) => itemKey(item) === key);
  }

  function selectUnit(id) {
    const index = state.units.findIndex((item) => item.id === id);
    if (index < 0) return;
    dismissPinyinAssessment();
    stopAudio();
    state.audioSegment = null;
    state.unitIndex = index;
    state.challenge = null;
    render();
  }

  function selectChapter(id) {
    const unit = state.units.find((item) => item.chapterId === id);
    if (unit) selectUnit(unit.id);
  }

  function beginChallenge(pairId) {
    const pair = currentGroup()?.pairs?.find((item) => item.id === pairId);
    if (!pair) return;
    const correct = Math.random() < .5 ? pair.left.cueId : pair.right.cueId;
    state.challenge = { pairId, correct, answer: "" };
    render();
    void playCue(correct);
  }

  function answerChallenge(cueId) {
    if (!state.challenge || state.challenge.answer) return;
    state.challenge.answer = cueId;
    render();
    if (cueId !== state.challenge.correct) {
      const pair = currentGroup()?.pairs?.find((item) => item.id === state.challenge.pairId);
      if (pair) setTimeout(() => playQueue([pair.left.cueId, pair.right.cueId]), 450);
    }
  }

  function answerTone(tone) {
    const item = selectedItem();
    if (!item?.answer) return;
    const previous = state.toneAnswers[item.id] || { attempts: 0 };
    const correct = tone === item.answer.tone;
    state.toneAnswers[item.id] = {
      attempts: previous.attempts + 1,
      choice: tone,
      correct,
      revealed: correct || previous.attempts + 1 >= 2,
    };
    render();
    if (correct) setTimeout(() => void playCue(item.cueId), 300);
  }

  function releasePinyinRecording({ keepResult = false } = {}) {
    const recording = state.pinyinRecording;
    if (recording.timer) clearTimeout(recording.timer);
    recording.timer = null;
    recording.processor?.disconnect();
    recording.source?.disconnect();
    recording.mute?.disconnect();
    recording.stream?.getTracks().forEach((track) => track.stop());
    if (recording.context) void recording.context.close().catch(() => {});
    if (recording.previewUrl) URL.revokeObjectURL(recording.previewUrl);
    Object.assign(recording, {
      active: false, stream: null, context: null, source: null, processor: null, mute: null,
      samples: [], wavBlob: null, previewUrl: "", status: "idle", message: "",
      result: keepResult ? recording.result : null,
    });
  }

  function dismissPinyinAssessment() {
    if (!state.pinyinRecording.target) return;
    releasePinyinRecording();
    state.pinyinRecording.target = null;
    if (elements?.assistZone) elements.assistZone.hidden = true;
  }

  function downsamplePinyinAudio(input, inputRate, outputRate = 16000) {
    if (inputRate === outputRate) return input;
    const ratio = inputRate / outputRate;
    const output = new Float32Array(Math.max(1, Math.floor(input.length / ratio)));
    for (let index = 0; index < output.length; index += 1) {
      const start = Math.floor(index * ratio);
      const end = Math.min(input.length, Math.floor((index + 1) * ratio));
      let sum = 0;
      for (let cursor = start; cursor < end; cursor += 1) sum += input[cursor];
      output[index] = sum / Math.max(1, end - start);
    }
    return output;
  }

  function encodePinyinWav(samples, sampleRate = 16000) {
    const buffer = new ArrayBuffer(44 + samples.length * 2);
    const view = new DataView(buffer);
    const writeText = (offset, value) => Array.from(value).forEach((character, index) => view.setUint8(offset + index, character.charCodeAt(0)));
    writeText(0, "RIFF"); view.setUint32(4, 36 + samples.length * 2, true); writeText(8, "WAVE"); writeText(12, "fmt ");
    view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true);
    view.setUint32(24, sampleRate, true); view.setUint32(28, sampleRate * 2, true); view.setUint16(32, 2, true); view.setUint16(34, 16, true);
    writeText(36, "data"); view.setUint32(40, samples.length * 2, true);
    samples.forEach((sample, index) => {
      const value = Math.max(-1, Math.min(1, sample));
      view.setInt16(44 + index * 2, value < 0 ? value * 0x8000 : value * 0x7fff, true);
    });
    return new Blob([buffer], { type: "audio/wav" });
  }

  function scoreValue(value) {
    const number = Number(value);
    return Number.isFinite(number) ? Math.round(number) : "--";
  }

  function assessmentUsageKey(target) {
    return target ? `${state.model?.lessonId || "lesson"}:${target.unitType}:${target.id}` : "";
  }

  function assessmentQuota(target = state.pinyinRecording.target) {
    const key = assessmentUsageKey(target);
    const used = Math.min(2, Number(state.assessmentUsage[key] || 0));
    return { key, used, limit: 2, remaining: Math.max(0, 2 - used) };
  }

  async function loadAssessmentUsage() {
    if (!window.LearningApi?.isConfigured() || !window.LearningApi.token()) return;
    try {
      const history = await window.LearningApi.assessmentHistory();
      const usage = {};
      (history.records || []).filter((record) => record.type === "pronunciation-assess" && record.status === "completed" && record.lessonId === state.model.lessonId).forEach((record) => {
        const key = `${record.lessonId}:${record.unitType}:${record.unitId}`;
        usage[key] = Math.min(2, Number(usage[key] || 0) + 1);
      });
      state.assessmentUsage = usage;
    } catch {
      state.assessmentUsage = {};
    }
  }

  function renderPinyinAssessment() {
    const recording = state.pinyinRecording;
    const target = recording.target;
    if (!target) return;
    const quota = assessmentQuota(target);
    const exhausted = quota.remaining <= 0;
    const result = recording.result;
    const advice = result?.advice || {};
    const statusText = {
      idle: "先听标准音，再开始录音。", recording: "正在录音，请清楚地读出这个音节……",
      ready: "录音完成，可以试听或提交正式测评。", working: "录音已提交，正在测评。",
      error: recording.message || "测评没有完成，请保留录音后重试。", complete: "测评完成。",
    }[recording.status] || "";
    elements.assistContent.innerHTML = `<article class="pron-assessment">
      <header class="pron-assessment-target">
        <span>${escapeHtml(target.contextLabel || "当前学习内容")} <small>Current target</small></span>
        <strong>${escapeHtml(target.display)}</strong>
        <code>${escapeHtml(target.referencePinyin)}</code>
      </header>
      <div class="pron-assessment-status ${escapeHtml(recording.status)}"><i></i><span>${escapeHtml(statusText)}</span></div>
      <div class="pron-assessment-actions">
        <button type="button" class="pron-action primary" data-pron-play="${escapeHtml(target.cueId || "")}"${target.cueId ? "" : " disabled"}>▶ ${bilingual(target.cueId ? "听标准音" : "自主回答", target.cueId ? "Model" : "My answer")}</button>
        <button type="button" class="pron-action record" data-pinyin-record>${recording.active ? "■ " + bilingual("停止录音", "Stop") : "● " + bilingual("开始录音", "Record")}</button>
        <button type="button" class="pron-action compare" data-pinyin-preview${recording.previewUrl ? "" : " disabled"}>▶ ${bilingual("试听录音", "Playback")}</button>
        <button type="button" class="pron-action submit" data-pinyin-submit${recording.wavBlob && !recording.active && !exhausted ? "" : " disabled"}>✓ ${bilingual(exhausted ? "次数已用完" : "正式测评", exhausted ? "No attempts left" : "Assess")}</button>
      </div>
      <label class="pron-assessment-consent"><input type="checkbox" data-pinyin-consent><span>我同意将本次录音保存到个人 COS 学习记录并用于 AI 测评。<small>I consent to saving and assessing this recording.</small></span></label>
      <p class="pron-assessment-policy"><strong>剩余 ${quota.remaining} / 2 次正式测评</strong>；录音和试听不计次数。<small>${quota.remaining} of 2 formal assessments remaining; recording and playback do not count.</small></p>
      ${result ? `<section class="pron-assessment-result">
        <header><span>智聆测评 <small>Pronunciation assessment</small></span><strong>${scoreValue(result.scores?.suggestedScore)}</strong></header>
        <div class="pron-score-grid">
          <div><b>${scoreValue(result.scores?.accuracy)}</b><span>准确度<small>Accuracy</small></span></div>
          <div><b>${scoreValue(result.scores?.fluency)}</b><span>流利度<small>Fluency</small></span></div>
          <div><b>${scoreValue(result.scores?.completion)}</b><span>完成度<small>Completion</small></span></div>
        </div>
        ${advice.summary ? `<p class="pron-advice-summary">${escapeHtml(advice.summary)}</p>` : ""}
        ${advice.strengths?.length ? `<section><h3>做得好的地方 <small>Strengths</small></h3><ul>${advice.strengths.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul></section>` : ""}
        ${advice.priorities?.length ? `<section><h3>优先改进 <small>Priorities</small></h3><ul>${advice.priorities.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul></section>` : ""}
        ${advice.practiceSteps?.length ? `<section><h3>练习建议 <small>Practice steps</small></h3><ol>${advice.practiceSteps.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ol></section>` : ""}
      </section>` : ""}
    </article>`;
  }

  function openPinyinAssessment(targetOverride = null) {
    const target = targetOverride || pinyinAssessmentTarget();
    if (!target) return;
    if (assessmentUsageKey(state.pinyinRecording.target) !== assessmentUsageKey(target)) releasePinyinRecording();
    state.pinyinRecording.target = target;
    elements.assistContext.textContent = `${target.contextLabel || (target.mode === "pinyin" ? "拼音跟读" : "口语跟读")} · ${languageNames[state.locale] || "English"}`;
    elements.assistTitle.textContent = target.title;
    elements.assistTabs.innerHTML = "";
    renderPinyinAssessment();
    elements.assistZone.hidden = false;
  }

  async function startPinyinRecording() {
    const recording = state.pinyinRecording;
    if (!navigator.mediaDevices?.getUserMedia) throw new Error("当前浏览器不支持录音");
    releasePinyinRecording({ keepResult: true });
    recording.target = recording.target || pinyinAssessmentTarget();
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) throw new Error("当前浏览器不支持标准录音格式");
    recording.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    recording.context = new AudioContextClass();
    await recording.context.resume();
    recording.source = recording.context.createMediaStreamSource(recording.stream);
    recording.processor = recording.context.createScriptProcessor(4096, 1, 1);
    recording.mute = recording.context.createGain();
    recording.mute.gain.value = 0;
    recording.samples = [];
    recording.inputRate = recording.context.sampleRate;
    recording.active = true;
    recording.status = "recording";
    recording.processor.onaudioprocess = (event) => {
      if (recording.active) recording.samples.push(new Float32Array(event.inputBuffer.getChannelData(0)));
    };
    recording.source.connect(recording.processor); recording.processor.connect(recording.mute); recording.mute.connect(recording.context.destination);
    recording.timer = setTimeout(() => void stopPinyinRecording(), 8000);
    renderPinyinAssessment();
  }

  async function stopPinyinRecording() {
    const recording = state.pinyinRecording;
    if (!recording.active) return;
    recording.active = false;
    if (recording.timer) clearTimeout(recording.timer);
    recording.timer = null;
    const samples = recording.samples;
    recording.processor?.disconnect(); recording.source?.disconnect(); recording.mute?.disconnect();
    recording.stream?.getTracks().forEach((track) => track.stop());
    if (recording.context) await recording.context.close().catch(() => {});
    Object.assign(recording, { stream: null, context: null, source: null, processor: null, mute: null });
    const total = samples.reduce((sum, item) => sum + item.length, 0);
    if (!total) {
      recording.status = "error"; recording.message = "没有录到有效声音，请重新录制。"; return renderPinyinAssessment();
    }
    const merged = new Float32Array(total);
    let offset = 0;
    samples.forEach((item) => { merged.set(item, offset); offset += item.length; });
    recording.wavBlob = encodePinyinWav(downsamplePinyinAudio(merged, recording.inputRate));
    recording.previewUrl = URL.createObjectURL(recording.wavBlob);
    recording.status = "ready";
    renderPinyinAssessment();
  }

  function pinyinWorkIndicator(active, phase = "assessing") {
    const indicator = document.querySelector("#aiWorkIndicator");
    document.documentElement.classList.toggle("ai-working", active);
    if (!indicator) return;
    indicator.hidden = !active;
    if (!active) { indicator.innerHTML = ""; return; }
    const now = new Date();
    const labels = { preparing: ["正在准备录音", "Preparing recording"], uploading: ["正在安全上传", "Uploading securely"], submitting: ["正在提交任务", "Submitting task"], assessing: ["智聆测评中", "Assessing pronunciation"], advising: ["正在生成母语建议", "Preparing feedback"], saving: ["正在保存结果", "Saving results"] };
    const [zh, en] = labels[phase] || labels.assessing;
    const marks = Array.from({ length: 12 }, (_, index) => `<i style="--mark:${index}">${[0, 3, 6, 9].includes(index) ? [12, 3, 6, 9][[0, 3, 6, 9].indexOf(index)] : ""}</i>`).join("");
    indicator.innerHTML = `<div class="ai-mechanical-clock" role="status"><div class="clock-face" style="--second-angle:${now.getSeconds() * 6}deg;--minute-angle:${now.getMinutes() * 6}deg;--hour-angle:${(now.getHours() % 12) * 30}deg">${marks}<span class="clock-hand hour-hand"></span><span class="clock-hand minute-hand"></span><span class="clock-hand second-hand"></span><b class="clock-pin"></b></div><div class="clock-status"><strong>${zh}</strong><small>${en}</small></div></div>`;
  }

  async function submitPinyinAssessment() {
    const recording = state.pinyinRecording;
    const consent = elements.assistContent.querySelector("[data-pinyin-consent]")?.checked;
    if (!consent) { recording.status = "error"; recording.message = "请先勾选同意上传和测评。"; return renderPinyinAssessment(); }
    if (!window.LearningApi?.isConfigured() || !window.LearningApi.token()) { recording.status = "error"; recording.message = "请先登录，再使用正式拼音测评。"; return renderPinyinAssessment(); }
    if (!recording.wavBlob || !recording.target) return;
    if (assessmentQuota(recording.target).remaining <= 0) { recording.status = "error"; recording.message = "本学习点的两次正式口语测评已经用完。"; return renderPinyinAssessment(); }
    try {
      recording.status = "working"; renderPinyinAssessment(); pinyinWorkIndicator(true, "preparing");
      recording.result = await window.LearningApi.assessArtifact(recording.wavBlob, {
        kind: "recording", artifactId: `${recording.target.mode}-${Date.now()}-${Math.random().toString(16).slice(2)}`,
        lessonId: state.model.lessonId, unitType: recording.target.unitType, unitId: recording.target.id,
        referenceText: recording.target.referenceText, referencePinyin: recording.target.mode === "pinyin" ? recording.target.referencePinyin : "",
        toneDetection: recording.target.toneDetection, locale: state.locale, mode: recording.target.mode,
      }, { onProgress: (phase) => pinyinWorkIndicator(true, phase) });
      if (recording.result.quota) state.assessmentUsage[assessmentUsageKey(recording.target)] = recording.result.quota.limit - recording.result.quota.remaining;
      recording.status = "complete";
    } catch (error) {
      recording.status = "error"; recording.message = error.message || "拼音测评失败";
    } finally {
      pinyinWorkIndicator(false); renderPinyinAssessment();
    }
  }

  function openContentNote(noteId) {
    const note = textPart()?.notes?.find((entry) => entry.id === noteId);
    if (!note) return;
    elements.assistContext.textContent = `课文注释 · ${languageNames[state.locale] || "English"}`;
    elements.assistTitle.textContent = localize(note.title, "zh-CN");
    elements.assistTabs.innerHTML = "";
    elements.assistContent.innerHTML = `<article class="beginner-note">
      <header><span>${escapeHtml(note.target)}</span><div><strong>${escapeHtml(localize(note.title, "zh-CN"))}</strong><small>${escapeHtml(localize(note.title, "en"))}</small></div></header>
      <section><h3>中文解释 <small>Chinese explanation</small></h3><p>${escapeHtml(note.content["zh-CN"])}</p></section>
      ${state.assistMode !== "immersion" ? `<section class="native"><h3>${escapeHtml(languageNames[state.locale] || "English")}</h3><p>${escapeHtml(localize(note.content))}</p></section>` : ""}
    </article>`;
    elements.assistZone.hidden = false;
  }

  function loadCharacterData(character, onComplete, onError) {
    const bundled = window.DIGITAL_BOOK_STROKE_DATA?.[character];
    if (bundled) return Promise.resolve().then(() => onComplete(bundled));
    fetch(`${strokeDataRoot}/${encodeURIComponent(character)}.json`)
      .then((response) => { if (!response.ok) throw new Error(`笔顺数据加载失败：${response.status}`); return response.json(); })
      .then(onComplete).catch((error) => onError?.(error));
  }

  function renderCharacterAssessment() {
    const assessment = state.characterWriting.assessment;
    if (assessment.status === "working") return `<div class="character-assessment working">AI 正在分析书写图片，请稍候。</div>`;
    if (assessment.status === "error") return `<div class="character-assessment error">${escapeHtml(assessment.message)}</div>`;
    if (assessment.status !== "ready") return "";
    const result = assessment.result || {};
    const advice = result.advice || result.handwritingAdvice || {};
    const score = result.scores?.total ?? result.scores?.suggestedScore ?? result.score;
    return `<section class="character-assessment ready">
      <header><strong>AI 书写建议</strong>${score !== undefined ? `<b>${escapeHtml(score)}</b>` : ""}</header>
      ${advice.summary ? `<p>${escapeHtml(advice.summary)}</p>` : ""}
      ${advice.strengths?.length ? `<h3>做得较好</h3><ul>${advice.strengths.map((entry) => `<li>${escapeHtml(entry)}</li>`).join("")}</ul>` : ""}
      ${advice.priorities?.length ? `<h3>优先改进</h3><ul>${advice.priorities.map((entry) => `<li>${escapeHtml(entry)}</li>`).join("")}</ul>` : ""}
      ${advice.practiceSteps?.length ? `<h3>练习建议</h3><ol>${advice.practiceSteps.map((entry) => `<li>${escapeHtml(entry)}</li>`).join("")}</ol>` : ""}
    </section>`;
  }

  function renderCharacterWritingDialog() {
    const item = currentCharacter();
    const writing = state.characterWriting;
    elements.writingContent.innerHTML = `<div class="writing-dialog-shell character-writing-shell">
      <header class="writing-dialog-header"><div><span>学写汉字 · Character writing</span><h2 id="wordWritingTitle">${escapeHtml(item.hanzi)} · ${escapeHtml(item.pinyin)}</h2></div><button class="writing-close-button" type="button" data-character-writing="close" aria-label="关闭 / Close">×</button></header>
      <div class="writing-dialog-body">
        <section class="stroke-demo-panel"><div class="writing-panel-heading"><span>第一步 · Step 1</span><h3>观看标准笔顺</h3></div><div class="writing-tian-grid demo-grid"><div id="wordStrokeDemo"></div></div><button class="quiet-button" type="button" data-character-writing="replay">重新演示 / Replay</button></section>
        <section class="stroke-practice-panel"><div class="writing-panel-heading"><span>第二步 · Step 2</span><h3>在田字格中写“${escapeHtml(item.hanzi)}”</h3></div><div class="writing-tian-grid practice-grid"><canvas id="wordWritingCanvas" width="600" height="600"></canvas></div><div class="writing-canvas-actions"><button class="quiet-button" type="button" data-character-writing="clear">清空 / Clear</button><button class="command-button" type="button" data-character-writing="confirm">确认并生成图片 / Confirm</button></div></section>
      </div>
      <div class="writing-dialog-footer"><p id="characterWritingStatus">${writing.artifactUrl ? "书写图片已生成，可保存或提交测评。" : "请先看笔顺，再独立完成书写。"}</p>${writing.artifactUrl ? `<div class="writing-result-actions"><button class="quiet-button" type="button" data-character-writing="download">保存图片 / Save</button></div>` : ""}</div>
      ${writing.artifactUrl ? `<div class="writing-result"><div><span>书写结果</span><strong>${escapeHtml(item.hanzi)}</strong></div><img src="${writing.artifactUrl}" alt="${escapeHtml(item.hanzi)}书写结果"><button class="command-button" type="button" data-character-writing="assess">AI 评估与建议</button></div><label class="character-assessment-consent"><input type="checkbox" data-character-writing-consent> 同意保存到个人 COS 学习记录并用于 AI 测评</label>${renderCharacterAssessment()}` : ""}
    </div>`;
  }

  function initializeCharacterWriting() {
    const item = currentCharacter();
    const target = document.querySelector("#wordStrokeDemo");
    if (target && window.HanziWriter) {
      state.characterWriting.writer?.cancelAnimation?.();
      state.characterWriting.writer = window.HanziWriter.create(target, item.hanzi, {
        width: Math.min(280, target.parentElement.clientWidth - 16), height: Math.min(280, target.parentElement.clientWidth - 16),
        padding: 18, showOutline: true, showCharacter: false, strokeColor: "#16373a", outlineColor: "#c5d3cf",
        highlightColor: "#d45f45", strokeAnimationSpeed: 1, delayBetweenStrokes: 420, charDataLoader: loadCharacterData,
      });
      state.characterWriting.writer.animateCharacter().catch(() => {
        const status = document.querySelector("#characterWritingStatus");
        if (status) status.textContent = "笔顺数据加载失败，请检查网络后重试。";
      });
    }
    const canvas = document.querySelector("#wordWritingCanvas");
    if (!canvas) return;
    const context = canvas.getContext("2d");
    context.lineWidth = 18; context.lineCap = "round"; context.lineJoin = "round"; context.strokeStyle = "#16373a";
    const point = (event) => { const rect = canvas.getBoundingClientRect(); return { x: (event.clientX - rect.left) / rect.width * canvas.width, y: (event.clientY - rect.top) / rect.height * canvas.height }; };
    canvas.addEventListener("pointerdown", (event) => {
      canvas.setPointerCapture(event.pointerId); state.characterWriting.drawing = true; state.characterWriting.strokeCount += 1;
      state.characterWriting.artifactUrl = ""; state.characterWriting.artifactBlob = null; state.characterWriting.assessment = { status: "idle", result: null, message: "" };
      state.characterWriting.lastPoint = point(event);
    });
    canvas.addEventListener("pointermove", (event) => {
      if (!state.characterWriting.drawing) return;
      const next = point(event); context.beginPath(); context.moveTo(state.characterWriting.lastPoint.x, state.characterWriting.lastPoint.y); context.lineTo(next.x, next.y); context.stroke(); state.characterWriting.lastPoint = next;
    });
    const end = () => { state.characterWriting.drawing = false; state.characterWriting.lastPoint = null; };
    canvas.addEventListener("pointerup", end); canvas.addEventListener("pointercancel", end);
  }

  function openCharacterWriting() {
    Object.assign(state.characterWriting, { strokeCount: 0, artifactUrl: "", artifactBlob: null, assessment: { status: "idle", result: null, message: "" } });
    renderCharacterWritingDialog();
    if (!elements.writingDialog.open) elements.writingDialog.showModal();
    initializeCharacterWriting();
  }

  function drawCharacterGrid(context, size) {
    context.fillStyle = "#fff"; context.fillRect(0, 0, size, size); context.strokeStyle = "#9bbab5"; context.lineWidth = 2; context.strokeRect(1, 1, size - 2, size - 2);
    context.save(); context.setLineDash([12, 9]); context.strokeStyle = "#bfd0cd"; context.beginPath();
    [[size / 2, 0, size / 2, size], [0, size / 2, size, size / 2], [0, 0, size, size], [size, 0, 0, size]].forEach(([x1, y1, x2, y2]) => { context.moveTo(x1, y1); context.lineTo(x2, y2); });
    context.stroke(); context.restore();
  }

  async function confirmCharacterWriting() {
    const source = document.querySelector("#wordWritingCanvas");
    if (!source || !state.characterWriting.strokeCount) { const status = document.querySelector("#characterWritingStatus"); if (status) status.textContent = "请先在田字格中书写这个字。"; return; }
    const output = document.createElement("canvas"); output.width = 600; output.height = 600;
    const context = output.getContext("2d"); drawCharacterGrid(context, 600); context.drawImage(source, 0, 0);
    state.characterWriting.artifactUrl = output.toDataURL("image/png");
    state.characterWriting.artifactBlob = await new Promise((resolve) => output.toBlob(resolve, "image/png"));
    renderCharacterWritingDialog(); initializeCharacterWriting();
  }

  async function assessCharacterWriting() {
    const writing = state.characterWriting;
    const consent = elements.writingContent.querySelector("[data-character-writing-consent]")?.checked;
    if (!consent) { writing.assessment = { status: "error", result: null, message: "请先勾选同意保存和测评。" }; renderCharacterWritingDialog(); initializeCharacterWriting(); return; }
    if (!window.LearningApi?.isConfigured() || !window.LearningApi.token()) { writing.assessment = { status: "error", result: null, message: "请先登录，再使用正式书写测评。" }; renderCharacterWritingDialog(); initializeCharacterWriting(); return; }
    const item = currentCharacter();
    try {
      writing.assessment = { status: "working", result: null, message: "" }; renderCharacterWritingDialog(); initializeCharacterWriting(); pinyinWorkIndicator(true, "preparing");
      const data = await new Promise((resolve, reject) => loadCharacterData(item.hanzi, resolve, reject));
      writing.assessment = { status: "ready", message: "", result: await window.LearningApi.assessArtifact(writing.artifactBlob, {
        kind: "handwriting", artifactId: `character-${Date.now()}-${Math.random().toString(16).slice(2)}`, lessonId: state.model.lessonId,
        unitType: "characterWriting", unitId: item.id, referenceText: item.hanzi, locale: state.locale,
        metrics: { characters: [item.hanzi], recordedStrokeCounts: [writing.strokeCount], expectedStrokeCounts: [data.strokes?.length || null] },
      }, { onProgress: (phase) => pinyinWorkIndicator(true, phase) }) };
    } catch (error) {
      writing.assessment = { status: "error", result: null, message: error.message || "书写测评失败" };
    } finally {
      pinyinWorkIndicator(false); renderCharacterWritingDialog(); initializeCharacterWriting();
    }
  }

  function handleCharacterWritingCommand(command) {
    if (command === "close") { state.characterWriting.writer?.cancelAnimation?.(); elements.writingDialog.close(); }
    if (command === "replay") state.characterWriting.writer?.animateCharacter?.();
    if (command === "clear") { const canvas = document.querySelector("#wordWritingCanvas"); canvas?.getContext("2d").clearRect(0, 0, canvas.width, canvas.height); state.characterWriting.strokeCount = 0; }
    if (command === "confirm") void confirmCharacterWriting();
    if (command === "assess") void assessCharacterWriting();
    if (command === "download" && state.characterWriting.artifactUrl) { const link = document.createElement("a"); link.href = state.characterWriting.artifactUrl; link.download = `${currentCharacter().hanzi}-书写练习.png`; link.click(); }
  }

  function openComparison(id) {
    const concept = state.model.comparisonConcepts[id];
    if (!concept) return;
    const content = concept[state.locale] || concept.en;
    const labels = comparisonLabels[state.locale] || comparisonLabels.en;
    state.comparisonId = id;
    elements.assistContext.textContent = `静态语音知识 · ${languageNames[state.locale] || "English"}`;
    elements.assistTitle.textContent = "与我的母语的发音规则对比";
    elements.assistTabs.innerHTML = "";
    elements.assistContent.innerHTML = `<article class="pron-comparison">
      <header class="pron-comparison-intro"><span>语言体系对比 <small>Language system comparison</small></span><h3>${escapeHtml(localize(concept.title, "zh-CN"))}</h3><p>${escapeHtml(localize(concept.title))}</p></header>
      <div class="pron-comparison-grid">
        <section><h3>${escapeHtml(labels.mandarin)}</h3><p>${escapeHtml(content.chineseSystem)}</p></section>
        <section><h3>${escapeHtml(labels.native)}</h3><p>${escapeHtml(content.nativeLanguageSystem)}</p></section>
        <section><h3>${escapeHtml(labels.differences)}</h3><ul>${content.keyDifferences.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul></section>
        <section><h3>${escapeHtml(labels.errors)}</h3><ul>${(content.commonErrors || []).map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul></section>
        <section><h3>${escapeHtml(labels.advice)}</h3><ul>${content.learningAdvice.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul></section>
      </div>
      ${state.locale !== "en" && !concept[state.locale] ? `<p class="pron-comparison-note">当前原型先显示英文标准版；该语种的独立对比内容将在审核后加入。</p>` : ""}
    </article>`;
    elements.assistZone.hidden = false;
  }

  function closeComparison() {
    elements.assistZone.hidden = true;
    state.comparisonId = "";
  }

  function bindEvents() {
    document.querySelectorAll("[data-assist-mode]").forEach((button) => button.addEventListener("click", () => {
      state.assistMode = button.dataset.assistMode;
      localStorage.setItem("digitalBookAssistMode", state.assistMode);
      render();
    }));
    elements.languageSelect.addEventListener("change", () => {
      state.locale = elements.languageSelect.value;
      localStorage.setItem("digitalBookLocale", state.locale);
      render();
    });
    elements.unitSelect.addEventListener("change", () => {
      dismissPinyinAssessment();
      if (state.activePart === "phonetics") state.unitIndex = Number(elements.unitSelect.value);
      else if (state.activePart === "texts") state.textItemIndex = Number(elements.unitSelect.value);
      else if (state.activePart === "practice") state.practiceIndex = Number(elements.unitSelect.value);
      else state.characterIndex = Number(elements.unitSelect.value);
      stopAudio();
      state.audioSegment = null;
      render();
      resetLearningScroll();
    });
    elements.previous.addEventListener("click", () => {
      const key = state.activePart === "phonetics" ? "unitIndex" : state.activePart === "texts" ? "textItemIndex" : state.activePart === "practice" ? "practiceIndex" : "characterIndex";
      if (state[key] > 0) { dismissPinyinAssessment(); state[key] -= 1; stopAudio(); state.audioSegment = null; render(); resetLearningScroll(); }
    });
    elements.next.addEventListener("click", () => {
      const key = state.activePart === "phonetics" ? "unitIndex" : state.activePart === "texts" ? "textItemIndex" : state.activePart === "practice" ? "practiceIndex" : "characterIndex";
      const length = state.activePart === "phonetics" ? state.units.length : state.activePart === "texts" ? textItems().length : state.activePart === "practice" ? practiceItems().length : (characterPart()?.items?.length || 0);
      if (state[key] < length - 1) { dismissPinyinAssessment(); state[key] += 1; stopAudio(); state.audioSegment = null; render(); resetLearningScroll(); }
    });
    elements.unitContent.addEventListener("click", (event) => {
      const practiceItem = event.target.closest("[data-practice-item]")?.dataset.practiceItem;
      if (practiceItem !== undefined) { state.practiceIndex = Number(practiceItem); render(); resetLearningScroll(); return; }
      if (event.target.closest("[data-practice-submit]")) { submitPracticeAnswer(); return; }
      const textGroup = event.target.closest("[data-text-group]")?.dataset.textGroup;
      if (textGroup) {
        const group = textSection()?.groups?.find((entry) => entry.id === textGroup);
        const index = textItems().findIndex((entry) => entry.id === group?.itemIds?.[0]);
        if (index >= 0) { state.textGroupId = textGroup; state.textItemIndex = index; stopAudio(); state.audioSegment = null; render(); resetLearningScroll(); }
        return;
      }
      const textSectionId = event.target.closest("[data-text-section]")?.dataset.textSection;
      if (textSectionId) {
        const section = textSections().find((entry) => entry.id === textSectionId);
        const index = textItems().findIndex((entry) => entry.id === section?.items?.[0]?.id);
        if (index >= 0) { state.textItemIndex = index; stopAudio(); state.audioSegment = null; render(); resetLearningScroll(); }
        return;
      }
      const textItem = event.target.closest("[data-text-item]")?.dataset.textItem;
      if (textItem !== undefined) { state.textItemIndex = Number(textItem); stopAudio(); state.audioSegment = null; render(); resetLearningScroll(); return; }
      if (event.target.closest("[data-oral-answer-prepare]")) { openOralAnswerPreparation(); return; }
      const oralAssessment = event.target.closest("[data-oral-assessment]")?.dataset.oralAssessment;
      if (oralAssessment) { openPinyinAssessment(oralAssessmentTarget(oralAssessment)); return; }
      const characterItem = event.target.closest("[data-character-item]")?.dataset.characterItem;
      if (characterItem !== undefined) { state.characterIndex = Number(characterItem); stopAudio(); state.audioSegment = null; render(); resetLearningScroll(); return; }
      const contentCue = event.target.closest("[data-content-play]")?.dataset.contentPlay;
      if (contentCue) return void playCue(contentCue);
      const noteId = event.target.closest("[data-content-note]")?.dataset.contentNote;
      if (noteId) { openContentNote(noteId); return; }
      if (event.target.closest("[data-text-repeat]")) { openPinyinAssessment(); return; }
      if (event.target.closest("[data-character-write]")) { openCharacterWriting(); return; }
      const chapter = event.target.closest("[data-pron-chapter]")?.dataset.pronChapter;
      if (chapter) return selectChapter(chapter);
      const unit = event.target.closest("[data-pron-unit]")?.dataset.pronUnit;
      if (unit) return selectUnit(unit);
      const group = event.target.closest("[data-pron-group]")?.dataset.pronGroup;
      if (group !== undefined) {
        dismissPinyinAssessment();
        state.groupIndices[currentUnit().id] = Number(group);
        state.challenge = null;
        stopAudio();
        state.audioSegment = null;
        return render();
      }
      const selection = event.target.closest("[data-pron-select]")?.dataset.pronSelect;
      if (selection) {
        const item = findItemByKey(selection);
        if (item) setSelectedItem(item);
        return;
      }
      const cueId = event.target.closest("[data-pron-play]")?.dataset.pronPlay;
      if (cueId) return void playCue(cueId);
      const pairId = event.target.closest("[data-pron-compare]")?.dataset.pronCompare;
      if (pairId) {
        const pair = currentGroup()?.pairs?.find((item) => item.id === pairId);
        if (pair) playQueue([pair.left.cueId, pair.right.cueId]);
        return;
      }
      if (event.target.closest("[data-pron-record]")) return openPinyinAssessment();
      const challenge = event.target.closest("[data-pron-challenge]")?.dataset.pronChallenge;
      if (challenge) return beginChallenge(challenge);
      const challengeAnswer = event.target.closest("[data-pron-challenge-answer]")?.dataset.pronChallengeAnswer;
      if (challengeAnswer) return answerChallenge(challengeAnswer);
      const tone = event.target.closest("[data-pron-tone-answer]")?.dataset.pronToneAnswer;
      if (tone) return answerTone(Number(tone));
      const comparison = event.target.closest("[data-pron-comparison]")?.dataset.pronComparison;
      if (comparison) openComparison(comparison);
    });
    elements.play.addEventListener("click", () => {
      if (!elements.audio.paused) stopAudio();
      else {
        const cue = currentPlayableCue();
        if (cue) void playCue(cue.id);
      }
    });
    elements.continuous.addEventListener("click", () => {
      const ids = state.activePart === "phonetics" ? selectableItems().map((item) => item.cueId).filter(Boolean)
        : state.activePart === "texts" ? (textGroupForItem(currentTextItem())?.itemIds || []).map((id) => textItems().find((item) => item.id === id)?.cueId).filter(Boolean)
          : state.activePart === "practice" ? [] : (characterPart()?.items || []).map((item) => item.cueId).filter(Boolean);
      playQueue(ids);
    });
    elements.loop.addEventListener("click", () => { state.loop = !state.loop; updateAudioLabels(); });
    elements.audio.addEventListener("timeupdate", handleTimeUpdate);
    elements.audio.addEventListener("play", updateAudioLabels);
    elements.audio.addEventListener("pause", updateAudioLabels);
    elements.seek.addEventListener("input", () => {
      if (Number.isFinite(elements.audio.duration)) elements.audio.currentTime = Number(elements.seek.value) / 1000 * elements.audio.duration;
    });
    elements.speed.addEventListener("change", () => { elements.audio.playbackRate = Number(elements.speed.value); });
    elements.assistZone.addEventListener("click", (event) => {
      const command = event.target.closest("[data-assist-window-command]")?.dataset.assistWindowCommand;
      if (command === "close") {
        if (state.pinyinRecording.active) void stopPinyinRecording();
        closeComparison();
      }
      if (command === "fullscreen") elements.assistZone.classList.toggle("is-fullscreen");
      const cueId = event.target.closest("[data-pron-play]")?.dataset.pronPlay;
      if (cueId) return void playCue(cueId);
      if (event.target.closest("[data-oral-answer-start]")) {
        const target = oralAssessmentTarget("answer");
        if (target) openPinyinAssessment(target);
        return;
      }
      if (event.target.closest("[data-pinyin-record]")) {
        if (state.pinyinRecording.active) void stopPinyinRecording();
        else void startPinyinRecording().catch((error) => {
          state.pinyinRecording.status = "error";
          const permissionDenied = error?.name === "NotAllowedError" || /permission denied|not allowed/i.test(error?.message || "");
          state.pinyinRecording.message = permissionDenied
            ? "麦克风权限被当前浏览器或系统拒绝。请使用 Edge 或 Chrome 打开本页，并在地址栏左侧允许麦克风。"
            : error.message || "录音没有开始";
          renderPinyinAssessment();
        });
        return;
      }
      if (event.target.closest("[data-pinyin-preview]") && state.pinyinRecording.previewUrl) {
        const playback = new Audio(state.pinyinRecording.previewUrl);
        void playback.play();
        return;
      }
      if (event.target.closest("[data-pinyin-submit]")) void submitPinyinAssessment();
    });
    elements.assistZone.addEventListener("change", (event) => {
      const countryId = event.target.closest("[data-oral-answer-country]")?.value;
      if (countryId === undefined) return;
      const item = currentTextItem();
      if (!item) return;
      if (countryId) state.oralAnswerChoices[item.id] = countryId;
      else delete state.oralAnswerChoices[item.id];
      renderOralAnswerPreparation();
    });
    document.querySelector(".section-tabs").addEventListener("click", (event) => {
      const part = event.target.closest("[data-pron-part]")?.dataset.pronPart;
      if (!part || part === state.activePart) return;
      dismissPinyinAssessment(); closeComparison(); stopAudio(); state.audioSegment = null; state.activePart = part; render();
    });
    elements.writingDialog.addEventListener("click", (event) => {
      const command = event.target.closest("[data-character-writing]")?.dataset.characterWriting;
      if (command) handleCharacterWritingCommand(command);
    });
    window.addEventListener("keydown", (event) => {
      if (["INPUT", "SELECT", "TEXTAREA"].includes(event.target.tagName)) return;
      const key = state.activePart === "phonetics" ? "unitIndex" : state.activePart === "texts" ? "textItemIndex" : state.activePart === "practice" ? "practiceIndex" : "characterIndex";
      const length = state.activePart === "phonetics" ? state.units.length : state.activePart === "texts" ? textItems().length : state.activePart === "practice" ? practiceItems().length : (characterPart()?.items?.length || 0);
      if (event.key === "ArrowLeft" && state[key] > 0) { state[key] -= 1; stopAudio(); state.audioSegment = null; render(); }
      if (event.key === "ArrowRight" && state[key] < length - 1) { state[key] += 1; stopAudio(); state.audioSegment = null; render(); }
    });
  }

  function initializeToolbar() {
    document.body.classList.add("pronunciation-book");
    document.querySelector(".brand-link small").textContent = `初级综合1 · 第${state.model.lessonNumber}课`;
    const hasTexts = Boolean(textPart());
    const hasCharacters = Boolean(characterPart());
    const hasPractice = Boolean(practiceItems().length);
    const textPartTitle = textPart()?.title || {};
    const textPartLabel = localize(textPartTitle, "zh-CN") || "学习课文";
    const textPartLabelEn = localize(textPartTitle, "en") || "Texts";
    document.querySelector(".section-tabs").innerHTML = `
      <button type="button" class="active" data-pron-part="phonetics">${bilingual("学习语音", "Phonetics")}</button>
      <button type="button" data-pron-part="texts"${hasTexts ? "" : " disabled"}>${bilingual(textPartLabel, hasTexts ? textPartLabelEn : "Coming soon")}</button>
      <button type="button" data-pron-part="characters"${hasCharacters ? "" : " disabled"}>${bilingual("学写汉字", hasCharacters ? "Character writing" : "Coming soon")}</button>
      <button type="button" data-pron-part="practice"${hasPractice ? "" : " disabled"}>${bilingual("课后练习", hasPractice ? "Exercises" : "Coming soon")}</button>`;
    elements.languageSelect.innerHTML = Object.entries(languageNames).map(([code, name]) => `<option value="${code}">${escapeHtml(name)}</option>`).join("");
    if (!languageNames[state.locale]) state.locale = "en";
    elements.languageSelect.value = state.locale;
    elements.continuous.title = "连续播放当前分组 / Play current group";
    elements.continuous.setAttribute("aria-label", "连续播放当前分组 / Play current group");
  }

  async function start({ lessonId, dataRoot }) {
    elements = {
      languageSelect: document.querySelector("#languageSelect"),
      unitTitle: document.querySelector("#unitTitle"), unitKicker: document.querySelector("#unitKicker"),
      unitProgress: document.querySelector("#unitProgress"), unitSelect: document.querySelector("#unitSelect"),
      unitContent: document.querySelector("#unitContent"), previous: document.querySelector("#previousUnitButton"),
      next: document.querySelector("#nextUnitButton"), footerProgress: document.querySelector("#footerProgress"),
      audio: document.querySelector("#lessonAudio"), audioDock: document.querySelector(".audio-dock"),
      play: document.querySelector("#playButton"), continuous: document.querySelector("#continuousButton"),
      loop: document.querySelector("#loopButton"), seek: document.querySelector("#audioSeek"),
      audioTime: document.querySelector("#audioTime"), audioStatus: document.querySelector("#audioStatus"),
      audioLabel: document.querySelector("#audioLabel"), speed: document.querySelector("#speedSelect"),
      assistZone: document.querySelector("#assistWindow"), assistContext: document.querySelector("#assistContext"),
      assistTitle: document.querySelector("#assistTitle"), assistTabs: document.querySelector("#assistTabs"),
      assistContent: document.querySelector("#assistContent"),
      writingDialog: document.querySelector("#wordWritingDialog"), writingContent: document.querySelector("#wordWritingContent"),
    };
    try {
      const runtimeRoot = window.HANZI_COMPANION_CONFIG?.runtimeDataRoot || "../../data";
      const comparisonUrl = `${runtimeRoot}/pronunciation/native-language-comparisons.json`;
      const dataVersion = new URLSearchParams(window.location.search).get("v") || "current";
      const lessonDataUrl = (name) => `${dataRoot}/${name}?v=${encodeURIComponent(dataVersion)}`;
      const [pagesResponse, pronunciationResponse, contentResponse, practiceResponse, comparisonResponse] = await Promise.all([
        fetch(lessonDataUrl("book-pages.json")), fetch(lessonDataUrl("pronunciation.json")),
        fetch(lessonDataUrl("lesson-content.json")).catch(() => null),
        fetch(lessonDataUrl("lesson-practice.json")).catch(() => null),
        fetch(comparisonUrl).catch(() => null),
      ]);
      if (!pagesResponse.ok || !pronunciationResponse.ok) throw new Error("初级语音课程数据不完整");
      const pages = await pagesResponse.json();
      state.model = await pronunciationResponse.json();
      state.contentModel = contentResponse?.ok ? await contentResponse.json() : null;
      state.practiceModel = practiceResponse?.ok ? await practiceResponse.json() : null;
      if (comparisonResponse?.ok) {
        const sharedComparisons = await comparisonResponse.json();
        if (sharedComparisons?.concepts) state.model.comparisonConcepts = sharedComparisons.concepts;
      }
      const audioSource = state.model.audio.cos || state.model.audio.local;
      if (audioSource) {
        elements.audio.preload = "auto";
        elements.audio.src = audioSource;
        elements.audio.load();
      }
      state.cues = new Map(state.model.cues.map((cue) => [cue.id, cue]));
      state.textCues = new Map((state.contentModel?.cues || []).map((cue) => [cue.id, cue]));
      state.units = state.model.chapters.flatMap((chapter) => chapter.units.map((unit) => ({
        ...unit,
        chapterId: chapter.id,
        chapterTitle: chapter.title,
        chapterPart: pages.sections?.[0]?.part || "PART 1",
      })));
      const syncLoadedAudio = () => {
        if (Number.isFinite(elements.audio.duration)) elements.audioTime.textContent = `00:00 / ${formatTime(elements.audio.duration)}`;
      };
      elements.audio.addEventListener("loadedmetadata", syncLoadedAudio);
      if (elements.audio.readyState >= 1) syncLoadedAudio();
      document.title = `第${state.model.lessonNumber}课 · ${localize(state.model.topic, "zh-CN")} | 点点汉语`;
      await loadAssessmentUsage();
      initializeToolbar();
      bindEvents();
      render();
    } catch (error) {
      document.querySelector("#unitContent").innerHTML = `<p class="load-error">语音学习数据加载失败：${escapeHtml(error.message)}</p>`;
    }
  }

  window.PronunciationRenderer = { start };
}());
