const DATA_ROOT = "../../data/lessons/zjzh-1-1";
const STROKE_DATA_ROOT =
  "https://hsk-1311686407.cos.ap-guangzhou.myqcloud.com/hanzi-companion/stroke-data/v2.0.1/characters";

const languageLabels = {
  en: "English",
  es: "Español",
  fr: "Français",
  id: "Bahasa Indonesia",
  ja: "日本語",
  ko: "한국어",
  lo: "ລາວ",
  ms: "Bahasa Melayu",
  my: "မြန်မာ",
  ru: "Русский",
  th: "ไทย",
};

const partOfSpeechLabels = {
  名: "名词",
  动: "动词",
  形: "形容词",
  副: "副词",
  助: "助词",
  叹: "叹词",
  成: "成语",
};

const sectionLabels = {
  vocabulary: "词语",
  text: "课文",
  practice: "练习",
};

const sectionOrder = ["vocabulary", "text", "practice"];
const textParagraphRanges = [
  [0, 13],
  [14, 23],
  [24, 34],
  [35, 43],
  [44, 56],
  [57, 64],
];

function readStoredJson(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback));
  } catch {
    return fallback;
  }
}

const state = {
  locale: localStorage.getItem("digitalBookLocale") || "en",
  assistMode: localStorage.getItem("digitalBookAssistMode") || "assist",
  section: "vocabulary",
  indices: { vocabulary: 0, text: 0, practice: 0 },
  assistTab: "understand",
  words: [],
  textCues: [],
  textParagraphs: [],
  readingParagraphIndex: 0,
  practiceItems: [],
  units: { vocabulary: [], text: [], practice: [] },
  statuses: readStoredJson("digitalBookWordStatuses", {}),
  answers: readStoredJson("digitalBookPracticeAnswers", {}),
  submitted: readStoredJson("digitalBookPracticeSubmitted", {}),
  answerModes: {},
  keyboardAssessments: {},
  classSettings: { writingInputMode: "both" },
  feedbackPreference: localStorage.getItem("digitalBookFeedbackLanguage") || "native",
  handwriting: {},
  handwritingDrawing: false,
  handwritingStrokeCount: 0,
  practiceWritingItemId: "",
  practiceWritingDrag: null,
  practiceWritingFullscreen: false,
  practiceWritingPreviousStyle: "",
  quizResult: null,
  audioSource: "",
  audioUrls: {},
  audioMessage: "",
  audioMode: "single",
  audioSegment: null,
  loopCurrent: false,
  mediaRecorder: null,
  recordingStream: null,
  recordingChunks: [],
  recordingSamples: [],
  recordingAudioContext: null,
  recordingProcessor: null,
  recordingSourceNode: null,
  recordingMuteNode: null,
  recordingInputSampleRate: 48000,
  recordingWavBlob: null,
  recordingUrl: "",
  recordingStatus: "尚未录音",
  recordingRecord: null,
  recordingStartedAt: 0,
  recordingPlaybackAudio: null,
  discardRecording: false,
  recordingAssessment: { status: "idle", result: null, message: "" },
  assessmentUsage: {},
  aiWork: { active: false, phase: "" },
  lastAssessmentSubmissions: {},
  voiceOrbs: {},
  deepAssist: {},
  wordWriting: {
    wordId: "",
    characters: [],
    characterIndex: 0,
    images: [],
    strokeCounts: [],
    drawing: false,
    strokeCount: 0,
    lastPoint: null,
    writer: null,
    artifactUrl: "",
    artifactBlob: null,
    assessment: { status: "idle", result: null, message: "" },
  },
};

const elements = {
  languageSelect: document.querySelector("#languageSelect"),
  unitTitle: document.querySelector("#unitTitle"),
  unitKicker: document.querySelector("#unitKicker"),
  unitProgress: document.querySelector("#unitProgress"),
  unitSelect: document.querySelector("#unitSelect"),
  unitContent: document.querySelector("#unitContent"),
  workspace: document.querySelector("#learningWorkspace"),
  audio: document.querySelector("#lessonAudio"),
  play: document.querySelector("#playButton"),
  continuous: document.querySelector("#continuousButton"),
  loop: document.querySelector("#loopButton"),
  seek: document.querySelector("#audioSeek"),
  audioTime: document.querySelector("#audioTime"),
  audioStatus: document.querySelector("#audioStatus"),
  audioLabel: document.querySelector("#audioLabel"),
  speed: document.querySelector("#speedSelect"),
  assistTabs: document.querySelector("#assistTabs"),
  assistZone: document.querySelector(".assist-zone"),
  assistContent: document.querySelector("#assistContent"),
  previous: document.querySelector("#previousUnitButton"),
  next: document.querySelector("#nextUnitButton"),
  footerProgress: document.querySelector("#footerProgress"),
  writingDialog: document.querySelector("#wordWritingDialog"),
  writingContent: document.querySelector("#wordWritingContent"),
  practiceWritingPanel: document.querySelector("#practiceWritingPanel"),
  practiceWritingContent: document.querySelector("#practiceWritingContent"),
  aiWorkIndicator: document.querySelector("#aiWorkIndicator"),
};

const assessmentPhaseLabels = {
  preparing: ["正在准备作品", "Preparing work"],
  uploading: ["正在安全上传", "Uploading securely"],
  submitting: ["正在提交任务", "Submitting task"],
  assessing: ["智聆测评中", "Assessing pronunciation"],
  reviewingWriting: ["AI 写作评价中", "Reviewing writing"],
  reviewingHandwriting: ["AI 书写评价中", "Reviewing handwriting"],
  reviewingHandwrittenEssay: ["手写识别与写作评价中", "Recognizing and reviewing handwriting"],
  advising: ["正在生成母语建议", "Preparing feedback"],
  saving: ["正在保存结果", "Saving results"],
};

function assessmentPhaseFor(kind, phase) {
  if (phase !== "assessing") return phase;
  if (kind === "writing") return "reviewingWriting";
  if (kind === "handwriting") return "reviewingHandwriting";
  if (kind === "handwritten-essay") return "reviewingHandwrittenEssay";
  return phase;
}

const buttonTranslations = new Map(Object.entries({
  "词语": "Vocabulary", "课文": "Text", "练习": "Practice",
  "中文沉浸": "Chinese only", "母语辅助": "Native-language aid", "双语对照": "Bilingual",
  "理解": "Meaning", "跟读": "Repeat", "跟写": "Writing", "小练习": "Quiz", "表达": "Express",
  "理解题意": "Understand", "思考方向": "Thinking", "相似实例": "Similar example", "母语解释": "Native-language help",
  "播放": "Play", "播放本句": "Play sentence", "进入跟读": "Start shadowing",
  "已掌握": "Mastered", "待复习": "Review", "收藏": "Save",
  "打开跟写练习": "Open writing", "重新演示": "Replay demo", "清空": "Clear",
  "确认这个字": "Confirm character", "生成整词图片": "Create word image", "下载图片": "Download image",
  "打开手写板": "Open writing pad", "清空本格": "Clear cell", "确认此字": "Confirm character",
  "撤销上一格": "Undo last cell", "保存手写答案": "Save handwriting",
  "键盘输入": "Type answer", "手写作答": "Handwrite", "提交作答": "Submit answer",
  "AI 评估与建议": "AI review", "重新测评": "Assess again", "测评中…": "Assessing…",
  "测评次数已用完": "Assessment limit reached",
  "AI深度解释": "AI deep explanation", "重新尝试": "Try again",
  "暂不跟读，进入练习": "Skip to practice", "第一段": "Paragraph 1", "第二段": "Paragraph 2",
  "第三段": "Paragraph 3", "第四段": "Paragraph 4", "第五段": "Paragraph 5", "第六段": "Paragraph 6",
  "上一个": "Previous", "下一个": "Next", "关闭": "Close", "全屏": "Full screen", "恢复": "Restore",
  "开始跟读": "Start recording", "开始段落跟读": "Record paragraph", "停止录音": "Stop recording",
  "试听录音": "Play recording", "播放课文": "Play model", "连续播放": "Continuous play", "循环当前单元": "Loop unit",
}));

function splitButtonIcon(label) {
  const match = String(label).trim().match(/^([▶✓☆↺‹›×⛶❐⇥↻■●]+)\s*(.*)$/u);
  return match ? { icon: match[1], text: match[2] } : { icon: "", text: String(label).trim() };
}

function bilingualizeButtons(root = document) {
  root.querySelectorAll("button:not([data-bilingualized])").forEach((button) => {
    if (button.matches("[data-quiz-option], [data-writing-character], .voice-orb-button")) return;
    const compact = button.matches(".icon-button, .audio-main-button, .writing-close-button, .practice-writing-window-actions button");
    const original = button.textContent.replace(/\s+/g, " ").trim();
    const { icon, text } = splitButtonIcon(original);
    const english = buttonTranslations.get(text) || buttonTranslations.get(original);
    if (!english) return;
    const chinese = text || original;
    button.dataset.bilingualized = "true";
    button.setAttribute("aria-label", `${chinese} / ${english}`);
    button.title = `${chinese} / ${english}`;
    if (compact) return;
    button.innerHTML = `${icon ? `<span class="button-icon" aria-hidden="true">${escapeHtml(icon)}</span>` : ""}<span class="bilingual-button-label"><strong>${escapeHtml(chinese)}</strong><small>${escapeHtml(english)}</small></span>`;
  });
}

function observeBilingualButtons() {
  const observer = new MutationObserver((mutations) => {
    if (mutations.some((mutation) => mutation.addedNodes.length)) bilingualizeButtons();
  });
  observer.observe(document.body, { childList: true, subtree: true });
}

function mechanicalClock(phase = "assessing", compact = false) {
  const now = new Date();
  const second = now.getSeconds() + now.getMilliseconds() / 1000;
  const minute = now.getMinutes() + second / 60;
  const hour = (now.getHours() % 12) + minute / 60;
  const [zh, en] = assessmentPhaseLabels[phase] || ["AI 正在工作", "AI is working"];
  const marks = Array.from({ length: 12 }, (_, index) => `<i style="--mark:${index}">${[0, 3, 6, 9].includes(index) ? [12, 3, 6, 9][[0, 3, 6, 9].indexOf(index)] : ""}</i>`).join("");
  return `<div class="ai-mechanical-clock${compact ? " is-compact" : ""}" role="status" aria-live="polite">
    <div class="clock-face" style="--second-angle:${second * 6}deg;--minute-angle:${minute * 6}deg;--hour-angle:${hour * 30}deg">
      ${marks}<span class="clock-hand hour-hand"></span><span class="clock-hand minute-hand"></span><span class="clock-hand second-hand"></span><b class="clock-pin"></b>
    </div>
    <div class="clock-status"><strong>${zh}</strong><small>${en}</small></div>
  </div>`;
}

function pauseAllLearningAudio() {
  elements.audio.pause();
  if (state.recordingPlaybackAudio) state.recordingPlaybackAudio.pause();
}

function setAiWork(active, phase = "") {
  state.aiWork = { active, phase };
  document.documentElement.classList.toggle("ai-working", active);
  if (active) pauseAllLearningAudio();
  if (elements.aiWorkIndicator) {
    elements.aiWorkIndicator.hidden = !active;
    elements.aiWorkIndicator.innerHTML = active ? mechanicalClock(phase, true) : "";
  }
}

async function checkResponse(response) {
  if (!response.ok) throw new Error(`数据加载失败：${response.status}`);
  return response.json();
}

async function loadData() {
  let audioData;
  let metadata;
  let textData;
  let pages;
  let practiceData;
  let practiceTranslations;

  if (
    window.DIGITAL_BOOK_DATA?.practiceData &&
    window.DIGITAL_BOOK_DATA?.practiceTranslations
  ) {
    ({
      audioData,
      metadata,
      textData,
      pages,
      practiceData,
      practiceTranslations,
    } =
      window.DIGITAL_BOOK_DATA);
  } else {
    [
      audioData,
      metadata,
      textData,
      pages,
      practiceData,
      practiceTranslations,
    ] = await Promise.all([
      fetch(`${DATA_ROOT}/vocabulary-audio.json`).then(checkResponse),
      fetch(`${DATA_ROOT}/vocabulary-metadata.json`).then(checkResponse),
      fetch(`${DATA_ROOT}/text-audio.json`).then(checkResponse),
      fetch(`${DATA_ROOT}/book-pages.json`).then(checkResponse),
      fetch(`${DATA_ROOT}/lesson-practice.json`).then(checkResponse),
      fetch(`${DATA_ROOT}/practice-intro-translations.json`).then(checkResponse),
    ]);
  }

  const wordCues = audioData.cues.filter((cue) => cue.role === "word");
  if (wordCues.length !== metadata.entries.length) {
    throw new Error("单词表与音频时间线数量不一致");
  }

  state.words = metadata.entries.map((entry, index) => ({
    ...entry,
    cue: wordCues[index],
  }));
  state.textCues = textData.cues.filter((cue) => cue.role === "sentence");
  state.textParagraphs = buildTextParagraphs(state.textCues);
  state.practiceItems = flattenPractice(practiceData);
  state.units = {
    vocabulary: [
      {
        unitType: "partTitle",
        part: "PART 1",
        title: "词汇学习",
        subtitle: "Vocabulary",
      },
      ...state.words.map((word, sourceIndex) => ({
        ...word,
        unitType: "word",
        sourceIndex,
      })),
    ],
    text: [
      {
        unitType: "partTitle",
        part: "PART 2",
        title: "课文学习",
        subtitle: "Text",
      },
      ...state.textCues.map((cue, sourceIndex) => ({
        ...cue,
        unitType: "sentence",
        sourceIndex,
      })),
      {
        unitType: "paragraphReading",
        id: "text-paragraph-reading",
        title: "跟读段落",
        sourceIndex: state.textCues.length,
      },
    ],
    practice: buildPracticeUnits(practiceData, practiceTranslations),
  };

  if (!state.words.length || !state.textCues.length || !state.practiceItems.length) {
    throw new Error("课程学习单元不完整");
  }

  void pages;
}

function buildTextParagraphs(cues) {
  return textParagraphRanges.map(([startIndex, endIndex], index) => {
    const paragraphCues = cues.slice(startIndex, endIndex + 1);
    const text = paragraphCues.map((cue) => cue.texts["zh-CN"]).join("");
    return {
      id: `text-paragraph-${index + 1}`,
      index,
      startIndex,
      endIndex,
      start: paragraphCues[0].start,
      end: paragraphCues[paragraphCues.length - 1].end,
      text,
      charCount: (text.match(/[\u3400-\u9fff]/g) || []).length,
      cues: paragraphCues,
    };
  });
}

function flattenPractice(practiceData) {
  const items = [];
  practiceData.sections.forEach((section) => {
    const groups = Array.isArray(section.groups) ? section.groups : [];
    if (groups.length) {
      groups.forEach((group) => {
        (group.items || []).forEach((item) => {
          items.push({
            ...item,
            sectionId: section.id,
            sectionTitle: section.title,
            groupId: group.id,
            groupTitle: group.title,
            choices: group.choices || section.choices || [],
          });
        });
      });
      return;
    }
    (section.items || []).forEach((item) => {
      items.push({
        ...item,
        sectionId: section.id,
        sectionTitle: section.title,
        groupId: "",
        groupTitle: "",
        choices: section.choices || [],
      });
    });
  });
  return items;
}

function buildPracticeUnits(practiceData, translations) {
  const sectionNumbers = ["一", "二", "三", "四", "五", "六"];
  const units = [
    {
      unitType: "partTitle",
      part: "PART 3",
      title: "练习",
      subtitle: "Practice",
    },
  ];
  let questionNumber = 0;

  practiceData.sections.forEach((section, sectionIndex) => {
    units.push({
      unitType: "sectionTitle",
      sectionId: section.id,
      sectionTitle: section.title,
      title: `${sectionNumbers[sectionIndex]}、${section.title}`,
      instruction: section.instruction || "",
    });

    const groups = Array.isArray(section.groups) ? section.groups : [];
    if (groups.length) {
      groups.forEach((group, groupIndex) => {
        const translatedGroup = translations.groups?.[group.id] || {};
        units.push({
          unitType: "practiceIntro",
          sectionId: section.id,
          sectionTitle: section.title,
          groupId: group.id,
          groupTitle: group.title,
          introNumber: groupIndex + 1,
          textExample: group.textExample || "",
          explanation:
            translatedGroup.explanation?.["zh-CN"] ||
            group.explanation ||
            group.instruction ||
            "",
          explanationTranslations: translatedGroup.explanation || null,
          examples: translatedGroup.examples || [],
          choices: group.choices || [],
          instruction: group.instruction || "",
        });
        (group.items || []).forEach((item) => {
          questionNumber += 1;
          units.push({
            ...item,
            unitType: "practiceItem",
            questionNumber,
            sectionId: section.id,
            sectionTitle: section.title,
            groupId: group.id,
            groupTitle: group.title,
            choices: group.choices || section.choices || [],
          });
        });
      });
      return;
    }

    (section.items || []).forEach((item) => {
      questionNumber += 1;
      units.push({
        ...item,
        unitType: "practiceItem",
        questionNumber,
        sectionId: section.id,
        sectionTitle: section.title,
        groupId: "",
        groupTitle: "",
        choices: section.choices || [],
      });
    });
  });
  return units;
}

function initializeLanguageOptions() {
  elements.languageSelect.innerHTML = Object.entries(languageLabels)
    .map(([code, label]) => `<option value="${code}">${escapeHtml(label)}</option>`)
    .join("");
  if (!languageLabels[state.locale]) state.locale = "en";
  elements.languageSelect.value = state.locale;
}

function currentItems() {
  return state.units[state.section];
}

function currentIndex() {
  return state.indices[state.section];
}

function currentItem() {
  return currentItems()[currentIndex()];
}

function unitLabel(item, index) {
  if (item.unitType === "partTitle") {
    return `${item.part} ${item.title}`;
  }
  if (item.unitType === "sectionTitle") {
    return item.title;
  }
  if (item.unitType === "practiceIntro") {
    return `${item.introNumber}. ${item.groupTitle}`;
  }
  if (item.unitType === "word") {
    return `${String(item.sourceIndex + 1).padStart(2, "0")} ${item.hanzi}`;
  }
  if (item.unitType === "sentence") {
    const text = item.texts["zh-CN"];
    return `${String(item.sourceIndex + 1).padStart(2, "0")} ${truncate(text, 24)}`;
  }
  if (item.unitType === "paragraphReading") {
    return "跟读段落";
  }
  return `第${item.questionNumber}题 ${truncate(item.prompt, 24)}`;
}

function render() {
  const items = currentItems();
  const index = currentIndex();
  const item = currentItem();
  if (!item) return;

  document.querySelectorAll("[data-section]").forEach((button) => {
    button.classList.toggle("active", button.dataset.section === state.section);
  });
  document.querySelectorAll("[data-assist-mode]").forEach((button) => {
    button.classList.toggle(
      "active",
      button.dataset.assistMode === state.assistMode,
    );
  });

  elements.unitTitle.textContent = item.unitType === "partTitle"
    ? item.title
    : item.unitType === "sectionTitle"
      ? item.title
      : item.unitType === "practiceIntro"
        ? item.groupTitle
        : state.section === "vocabulary"
          ? "词语学习"
          : state.section === "text"
            ? "走进课文"
            : item.groupTitle || item.sectionTitle;
  elements.unitKicker.textContent =
    state.section === "practice"
      ? item.sectionTitle
      : "第1课 · 你咋不早说";
  elements.unitProgress.textContent =
    `${sectionLabels[state.section]} · 第 ${index + 1} / ${items.length} 个学习页`;
  elements.footerProgress.textContent = `${index + 1} / ${items.length}`;

  elements.unitSelect.innerHTML = items
    .map(
      (unit, unitIndex) =>
        `<option value="${unitIndex}">${escapeHtml(unitLabel(unit, unitIndex))}</option>`,
    )
    .join("");
  elements.unitSelect.value = String(index);

  elements.previous.disabled = isFirstUnit();
  elements.next.disabled = isLastUnit();
  elements.unitContent.classList.toggle(
    "paragraph-reading-shell",
    item.unitType === "paragraphReading",
  );

  if (item.unitType === "partTitle") renderPartTitle(item);
  else if (item.unitType === "sectionTitle") renderSectionTitle(item);
  else if (item.unitType === "practiceIntro") renderPracticeIntro(item);
  else if (item.unitType === "word") renderWordUnit(item, item.sourceIndex);
  else if (item.unitType === "sentence") {
    renderTextUnit(item, item.sourceIndex);
  } else if (item.unitType === "paragraphReading") {
    renderParagraphReadingUnit();
  } else {
    renderPracticeUnit(item);
  }

  const hideAssist = ["partTitle", "sectionTitle", "paragraphReading"].includes(
    item.unitType,
  );
  elements.assistZone.hidden = hideAssist;
  elements.workspace.classList.toggle("assist-hidden", hideAssist);
  if (!hideAssist) {
    renderAssistTabs();
    renderAssistContent();
  }
  updateAudioLabels();
  initializeVoiceOrbs();
  bilingualizeButtons();
}

function renderPartTitle(item) {
  elements.unitContent.innerHTML = `
    <div class="part-title-unit">
      <span>${escapeHtml(item.part)}</span>
      <h2>${escapeHtml(item.title)}</h2>
      <p>${escapeHtml(item.subtitle)}</p>
    </div>`;
}

function renderSectionTitle(item) {
  elements.unitContent.innerHTML = `
    <div class="section-title-unit">
      <span>课后练习</span>
      <h2>${escapeHtml(item.title)}</h2>
      ${item.instruction ? `<p>${escapeHtml(item.instruction)}</p>` : ""}
    </div>`;
}

function renderPracticeIntro(item) {
  const choices = normalizeChoices(item.choices);
  const showInstruction =
    item.instruction &&
    normalizeComparisonText(item.instruction) !==
      normalizeComparisonText(item.explanation);
  elements.unitContent.innerHTML = `
    <div class="practice-intro-unit">
      <span class="unit-order">${escapeHtml(item.introNumber)} · ${escapeHtml(item.groupTitle)}</span>
      ${item.textExample ? `<div class="textbook-example"><strong>课文例句${item.introNumber}</strong><p>${escapeHtml(item.textExample)}</p></div>` : ""}
      ${item.explanation ? `<div class="grammar-explanation"><strong>解释</strong><p>${escapeHtml(item.explanation)}</p></div>` : ""}
      ${item.examples?.length ? `<div class="intro-examples"><strong>例如</strong><ol>${item.examples.map((example) => `<li>${escapeHtml(example)}</li>`).join("")}</ol></div>` : ""}
      ${showInstruction ? `<p class="intro-instruction">${escapeHtml(item.instruction)}</p>` : ""}
      ${choices.length ? `<div class="word-bank">${choices.map((choice) => `<span>${escapeHtml(choice)}</span>`).join("")}</div>` : ""}
    </div>`;
}

function normalizeComparisonText(value) {
  return String(value || "")
    .replace(/\s+/g, "")
    .replace(/[。！？!?；;，,]/g, "");
}

function renderWordUnit(word, index) {
  const status = state.statuses[word.id] || {};
  const showTranslation = state.assistMode === "bilingual";
  elements.unitContent.innerHTML = `
    <div class="word-unit">
      <span class="unit-order">词语 ${String(index + 1).padStart(2, "0")}</span>
      <h2 class="word-hanzi">${escapeHtml(word.hanzi)}</h2>
      <p class="word-pinyin">${escapeHtml(word.pinyin)}</p>
      <span class="part-of-speech">${escapeHtml(partOfSpeechLabels[word.partOfSpeech] || word.partOfSpeech)}</span>
      ${showTranslation ? `<p class="primary-translation">${escapeHtml(translationFor(word.translations))}</p>` : ""}
      <div class="unit-actions">
        <button class="command-button coral" type="button" data-command="play">▶ 播放</button>
        <button class="quiet-button${status.mastered ? " active" : ""}" type="button" data-command="mastered">✓ 已掌握</button>
        <button class="quiet-button${status.favorite ? " active" : ""}" type="button" data-command="favorite">☆ 收藏</button>
      </div>
    </div>`;
}

function renderTextUnit(cue, index) {
  const showTranslation = state.assistMode === "bilingual";
  const previousText = state.textCues[index - 1]?.texts?.["zh-CN"];
  const nextText = state.textCues[index + 1]?.texts?.["zh-CN"];
  elements.unitContent.innerHTML = `
    <div class="sentence-unit">
      <span class="unit-order">课文第 ${index + 1} 句</span>
      <h2 class="sentence-zh">${escapeHtml(cue.texts["zh-CN"])}</h2>
      ${showTranslation ? `<p class="sentence-translation">${escapeHtml(translationFor(cue.texts))}</p>` : ""}
      <div class="unit-actions">
        <button class="command-button coral" type="button" data-command="play">▶ 播放本句</button>
        <button class="quiet-button" type="button" data-command="open-shadow">进入跟读</button>
      </div>
      <div class="sentence-neighbors">
        ${previousText ? `<span>上句：${escapeHtml(truncate(previousText, 18))}</span>` : ""}
        ${nextText ? `<span>下句：${escapeHtml(truncate(nextText, 18))}</span>` : ""}
      </div>
    </div>`;
}

function currentReadingParagraph() {
  return state.textParagraphs[state.readingParagraphIndex] || state.textParagraphs[0];
}

function paragraphOrdinal(index) {
  return ["第一段", "第二段", "第三段", "第四段", "第五段", "第六段"][index];
}

function renderParagraphReadingUnit() {
  const paragraph = currentReadingParagraph();
  const choice = localStorage.getItem("digitalBookParagraphReadingChoice") || "";
  const recordingComplete = Boolean(state.recordingUrl);
  elements.unitContent.innerHTML = `
    <div class="paragraph-reading-unit">
      <span class="unit-order">课文学习 · 最后一页</span>
      <h2>跟读段落</h2>
      <p class="paragraph-reading-prompt">每段不超过 120 个汉字。AI 会在朗读后给出建议，请按照教材课文朗读。</p>
      <nav class="paragraph-tabs" aria-label="选择跟读段落">
        ${state.textParagraphs.map((item, index) => `<button type="button" data-reading-paragraph="${index}" class="${index === state.readingParagraphIndex ? "active" : ""}" aria-current="${index === state.readingParagraphIndex ? "true" : "false"}">${paragraphOrdinal(index)}</button>`).join("")}
      </nav>
      <div class="paragraph-summary">
        <strong>${paragraphOrdinal(paragraph.index)}</strong>
        <span>课文第 ${paragraph.startIndex + 1}–${paragraph.endIndex + 1} 句 · ${paragraph.charCount} 个汉字</span>
      </div>
      <div class="paragraph-learning-body">
        <div class="paragraph-controls">
          <div class="paragraph-reading-orbs">
            ${voiceOrbButton("paragraph-model", "cyan", "▶", `听${paragraphOrdinal(paragraph.index)}`, "play")}
            ${voiceOrbButton(
              "paragraph-record",
              "violet",
              state.mediaRecorder?.state === "recording" ? "■" : "●",
              state.mediaRecorder?.state === "recording" ? "停止录音" : "开始段落跟读",
              "record",
            )}
            ${recordingComplete ? voiceOrbButton("paragraph-replay", "green", "▶", "试听录音", "play-recording") : ""}
          </div>
          <p class="recording-status paragraph-reading-status">${escapeHtml(state.recordingStatus)}</p>
          ${recordingComplete ? renderAssessmentConsent("recording", state.recordingAssessment) : ""}
          <div class="paragraph-reading-choice">
            <button class="quiet-button${choice === "skipped" ? " active" : ""}" type="button" data-command="skip-paragraph-reading">暂不跟读，进入练习</button>
          </div>
          <p class="privacy-note">录音停止后只保留在当前设备，不会自动上传。</p>
        </div>
        <div class="paragraph-reference" aria-label="本段参考句子">
          <strong>参考句子</strong>
          ${paragraph.cues.map((cue, cueIndex) => `<p><span>${paragraph.startIndex + cueIndex + 1}</span><b>${escapeHtml(cue.texts["zh-CN"])}</b>${state.assistMode === "bilingual" ? `<small>${escapeHtml(translationFor(cue.texts))}</small>` : ""}</p>`).join("")}
        </div>
      </div>
    </div>`;
}

function renderPracticeUnit(item, index) {
  const answer = state.answers[item.id] || "";
  const submitted = state.submitted[item.id];
  const choices = normalizeChoices(item.choices);
  const requiredVocabulary = item.requiredVocabulary || [];
  const supportsHandwriting = item.questionNumber >= 47;
  const allowedModes = writingInputModes();
  const preferredMode = state.answerModes[item.id] || allowedModes[0];
  const answerMode = allowedModes.includes(preferredMode) ? preferredMode : allowedModes[0];
  state.answerModes[item.id] = answerMode;
  elements.unitContent.innerHTML = `
    <div class="practice-unit">
      <span class="practice-target">第 ${item.questionNumber} 题 · ${escapeHtml(item.target || item.groupTitle || item.sectionTitle)}</span>
      <h2 class="practice-prompt">${escapeHtml(item.prompt)}</h2>
      ${choices.length ? `<div class="word-bank">${choices.map((choice) => `<span>${escapeHtml(choice)}</span>`).join("")}</div>` : ""}
      ${requiredVocabulary.length ? `<div class="required-vocabulary"><strong>参考词组</strong><div class="word-bank">${requiredVocabulary.map((word) => `<span>${escapeHtml(word)}</span>`).join("")}</div></div>` : ""}
      ${supportsHandwriting ? `<div class="answer-mode-tabs" role="group" aria-label="作答方式">
        ${allowedModes.includes("keyboard") ? `<button type="button" data-answer-mode="keyboard" class="${answerMode === "keyboard" ? "active" : ""}">键盘输入</button>` : ""}
        ${allowedModes.includes("handwriting") ? `<button type="button" data-answer-mode="handwriting" class="${answerMode === "handwriting" ? "active" : ""}">手写作答</button>` : ""}
      </div>` : ""}
      <div class="answer-box">
        ${answerMode === "handwriting" && supportsHandwriting
          ? renderHandwritingLauncher(item)
          : `<textarea id="practiceAnswer" aria-label="填写答案" placeholder="在这里完成这一小题">${escapeHtml(answer)}</textarea>
            <div class="answer-actions">
              <button class="quiet-button" type="button" data-command="clear-answer">清空</button>
              <button class="command-button" type="button" data-command="submit-answer">提交作答</button>
            </div>
            ${submitted ? renderPracticeFeedback(item, answer) : ""}
            ${submitted && item.type === "guidedProduction" ? renderAssessmentConsent("practice-keyboard", keyboardAssessment(item.id)) : ""}`
        }
      </div>
    </div>`;
}

function writingInputModes() {
  const mode = state.classSettings.writingInputMode;
  if (mode === "handwriting-only") return ["handwriting"];
  if (mode === "keyboard-only") return ["keyboard"];
  return ["keyboard", "handwriting"];
}

function keyboardAssessment(itemId) {
  if (!state.keyboardAssessments[itemId]) state.keyboardAssessments[itemId] = { status: "idle", result: null, message: "" };
  return state.keyboardAssessments[itemId];
}

function effectiveFeedbackLocale() {
  if (state.feedbackPreference === "zh-CN") return "zh-CN";
  if (state.feedbackPreference === "bilingual") return `bi-${state.locale}`;
  return state.locale;
}

function feedbackLanguageOptions() {
  const native = languageLabels[state.locale] || "English";
  return [
    ["native", `当前母语 · ${native}`],
    ["zh-CN", "中文"],
    ["bilingual", `中文 + ${native}`],
  ];
}

function normalizeChoices(choices) {
  return (choices || []).map((choice) => {
    if (typeof choice === "string") return choice;
    return choice.text || choice.label || choice.word || "";
  }).filter(Boolean);
}

function handwritingDraft(itemId) {
  if (!state.handwriting[itemId]) {
    state.handwriting[itemId] = { cells: [], strokeCounts: [], saved: false, assessment: { status: "idle", result: null, message: "" } };
  }
  return state.handwriting[itemId];
}

function assessmentUsageKey(record) {
  if (!record) return "";
  return [record.lessonId, record.unitType, record.unitId].join(":");
}

function recordingQuota() {
  const key = assessmentUsageKey(state.recordingRecord);
  const used = Math.min(2, Number(state.assessmentUsage[key] || 0));
  return { key, used, limit: 2, remaining: Math.max(0, 2 - used) };
}

async function loadAssessmentUsage() {
  if (!window.LearningApi?.isConfigured() || !window.LearningApi.token()) return;
  try {
    const history = await window.LearningApi.assessmentHistory();
    const usage = {};
    (history.records || []).filter((record) => record.type === "pronunciation-assess" && record.status === "completed").forEach((record) => {
      const key = assessmentUsageKey(record);
      usage[key] = Math.min(2, Number(usage[key] || 0) + 1);
    });
    state.assessmentUsage = usage;
  } catch {
    state.assessmentUsage = {};
  }
}

function renderAssessmentResult(assessment) {
  if (!assessment || assessment.status === "idle") return "";
  if (assessment.status === "working") return `<div class="assessment-panel is-working">${mechanicalClock(assessment.phase || "assessing")}<p>程序已进入静默状态，云端正在完成测评和母语建议。</p><small>The app is silent while the cloud assessment is running.</small></div>`;
  if (assessment.status === "error") return `<div class="assessment-panel is-error"><strong>本次测评未完成 <small>Assessment incomplete</small></strong><p>${escapeHtml(assessment.message || "请稍后重试")}</p></div>`;
  const result = assessment.result || {};
  const scores = result.scores || {};
  const advice = result.advice || {};
  const scoreEntries = [
    ["建议分", "Score", scores.suggestedScore],
    ["准确度", "Accuracy", scores.accuracy],
    ["流利度", "Fluency", scores.fluency],
    ["完整度", "Completion", scores.completion],
    ["任务完成", "Task", scores.taskCompletion],
    ["目标词语", "Vocabulary", scores.targetVocabulary],
    ["内容结构", "Content", scores.contentStructure],
    ["中文表达", "Chinese", scores.chineseExpression],
    ["综合", "Overall", scores.total],
  ].filter(([, , value]) => value !== null && value !== undefined);
  const adviceList = (key) => Array.isArray(advice[key]) && advice[key].length
    ? `<ul>${advice[key].map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>`
    : "";
  return `<div class="assessment-panel is-ready">
    <div class="assessment-title"><span>AI 测评完成 / Assessment complete</span><strong>${escapeHtml(advice.summary || "本次学习作品已完成评估。")}</strong></div>
    ${scoreEntries.length ? `<div class="assessment-scores">${scoreEntries.map(([label, english, value]) => `<div><strong>${escapeHtml(value)}</strong><span>${label}<small>${english}</small></span></div>`).join("")}</div>` : ""}
    ${adviceList("strengths") ? `<section><strong>做得较好 <small>Strengths</small></strong>${adviceList("strengths")}</section>` : ""}
    ${adviceList("priorities") ? `<section><strong>优先改进 <small>Priorities</small></strong>${adviceList("priorities")}</section>` : ""}
    ${adviceList("practiceSteps") ? `<section><strong>练习建议 <small>Practice steps</small></strong>${adviceList("practiceSteps")}</section>` : ""}
    ${Array.isArray(advice.revisionExamples) && advice.revisionExamples.length ? `<section><strong>局部修改示范 <small>Revision examples</small></strong><ul>${advice.revisionExamples.map((example) => `<li><b>${escapeHtml(example.original || "")}</b> → ${escapeHtml(example.revised || "")}<small>${escapeHtml(example.reason || "")}</small></li>`).join("")}</ul></section>` : ""}
    ${adviceList("checklist") ? `<section><strong>再次检查 <small>Checklist</small></strong>${adviceList("checklist")}</section>` : ""}
    ${result.recognizedText ? `<section><strong>手写识别文本 <small>Recognized text</small></strong><p>${escapeHtml(result.recognizedText)}</p></section>` : ""}
    ${result.contentAssessmentAvailable === false ? `<p class="assessment-basis">手写文字未能可靠识别，本次只提供书写指标建议，不评价作文内容。</p>` : ""}
    ${result.handwritingAdvice ? `<section><strong>汉字书写建议 <small>Handwriting</small></strong><p>${escapeHtml(result.handwritingAdvice.summary || "")}</p>${Array.isArray(result.handwritingAdvice.priorities) ? `<ul>${result.handwritingAdvice.priorities.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>` : ""}</section>` : ""}
    ${advice.reviewBasis ? `<p class="assessment-basis">${escapeHtml(advice.reviewBasis)}</p>` : ""}
  </div>`;
}

function renderAssessmentConsent(kind, assessment) {
  const working = assessment?.status === "working";
  const quota = kind === "recording" ? recordingQuota() : null;
  const exhausted = Boolean(quota && quota.remaining <= 0);
  const unlimitedLabel = kind === "practice-keyboard"
    ? "<strong>写作测评次数不限</strong><small>Unlimited writing reviews</small>"
    : kind === "practice-writing"
      ? "<strong>内容与书写测评次数不限</strong><small>Unlimited content and handwriting reviews</small>"
      : "<strong>书写测评次数不限</strong><small>Unlimited handwriting reviews</small>";
  const command = kind === "recording"
    ? "assess-recording"
    : kind === "word-writing"
      ? "assess-word-writing"
      : kind === "practice-keyboard"
        ? "assess-practice-keyboard"
        : "assess-practice-handwriting";
  const commandAttribute = kind === "word-writing" ? `data-writing-command="${command}"` : `data-command="${command}"`;
  return `<div class="assessment-consent">
    <div class="assessment-quota ${quota ? "is-limited" : "is-unlimited"}">${quota ? `<strong>本学习点剩余 ${quota.remaining} / 2 次</strong><small>${quota.remaining} of 2 assessments remaining</small>` : unlimitedLabel}</div>
    <label class="assessment-language-select"><span>评价语言 <small>Feedback language</small></span><select data-feedback-language>${feedbackLanguageOptions().map(([value, label]) => `<option value="${value}"${state.feedbackPreference === value ? " selected" : ""}>${escapeHtml(label)}</option>`).join("")}</select></label>
    <label><input type="checkbox" data-assessment-consent="${kind}" ${exhausted ? "disabled" : ""}> <span>同意将本次作品保存到我的 COS 学习记录，并用于 AI 测评<br><small>I agree to save this work to my private COS learning record for AI assessment.</small></span></label>
    <button class="command-button" type="button" ${commandAttribute} ${working || exhausted ? "disabled" : ""}>${exhausted ? "测评次数已用完" : working ? "测评中…" : assessment?.status === "ready" ? "重新测评" : "AI 评估与建议"}</button>
  </div>${renderAssessmentResult(assessment)}`;
}

function renderHandwritingLauncher(item) {
  const draft = handwritingDraft(item.id);
  return `
    <div class="handwriting-launcher">
      <div>
        <strong>${draft.cells.length ? `已完成 ${draft.cells.length} 个字` : "尚未开始手写"}</strong>
        <span>${draft.saved ? "手写答案已保留" : "可继续打开手写板作答"}</span>
      </div>
      <button class="command-button" type="button" data-command="open-practice-writing">打开手写板</button>
    </div>
    ${draft.saved ? `<div class="answer-feedback"><strong>手写答案已保留</strong><br>确认后可上传到个人学习记录并获得书写建议。</div>${renderAssessmentConsent("practice-writing", draft.assessment)}` : ""}`;
}

function renderHandwritingWorkspace(item) {
  const draft = handwritingDraft(item.id);
  return `
    <header class="practice-writing-panel-header" data-writing-drag-handle>
      <div>
        <span>第${item.questionNumber}题</span>
        <h2 id="practiceWritingTitle">手写作答</h2>
      </div>
      <div class="practice-writing-window-actions">
        <button type="button" data-command="toggle-practice-writing-fullscreen" aria-label="${state.practiceWritingFullscreen ? "恢复手写板大小 / Restore writing pad" : "全屏显示手写板 / Full-screen writing pad"}" title="${state.practiceWritingFullscreen ? "恢复 / Restore" : "全屏 / Full screen"}">${state.practiceWritingFullscreen ? "❐" : "⛶"}</button>
        <button type="button" data-command="close-practice-writing" aria-label="关闭手写板 / Close writing pad" title="关闭 / Close">×</button>
      </div>
    </header>
    <div class="handwriting-workspace practice-writing-panel-body">
      <div class="handwriting-active-grid">
        <div class="handwriting-grid-lines" aria-hidden="true"></div>
        <canvas id="practiceHandwritingCanvas" width="600" height="600" aria-label="手写田字格"></canvas>
      </div>
      <p class="handwriting-count">已完成 ${draft.cells.length} 格</p>
      <div class="handwriting-actions">
        <button class="quiet-button" type="button" data-command="clear-handwriting">清空本格</button>
        <button class="command-button" type="button" data-command="confirm-handwriting">确认此字</button>
        <button class="quiet-button" type="button" data-command="remove-handwriting" ${draft.cells.length ? "" : "disabled"}>撤销上一格</button>
      </div>
      <div class="handwriting-cells">
        ${draft.cells.length
          ? draft.cells.map((image, index) => `<span><img src="${escapeAttribute(image)}" alt="第${index + 1}格手写笔迹"></span>`).join("")
          : "<p>确认每个字后，笔迹会按顺序排列在这里。</p>"}
      </div>
      <div class="answer-actions">
        <button class="command-button" type="button" data-command="save-handwriting">保存手写答案</button>
      </div>
      ${draft.saved ? `<div class="answer-feedback"><strong>手写答案已保留</strong><br>确认后可上传到个人学习记录并获得书写建议。</div>${renderAssessmentConsent("practice-writing", draft.assessment)}` : ""}
    </div>`;
}

function openPracticeWritingPanel() {
  const item = currentItem();
  if (item.questionNumber < 47) return;
  state.practiceWritingItemId = item.id;
  elements.practiceWritingContent.innerHTML = renderHandwritingWorkspace(item);
  bilingualizeButtons(elements.practiceWritingContent);
  elements.practiceWritingPanel.hidden = false;
  setupHandwritingCanvas(item.id);
}

function closePracticeWritingPanel() {
  if (state.practiceWritingFullscreen) setPracticeWritingFullscreen(false);
  elements.practiceWritingPanel.hidden = true;
  state.practiceWritingItemId = "";
  state.practiceWritingDrag = null;
}

function setPracticeWritingFullscreen(fullscreen) {
  const panel = elements.practiceWritingPanel;
  if (fullscreen === state.practiceWritingFullscreen) return;
  if (fullscreen) {
    state.practiceWritingPreviousStyle = panel.getAttribute("style") || "";
    panel.removeAttribute("style");
    panel.classList.add("is-fullscreen");
  } else {
    panel.classList.remove("is-fullscreen");
    if (state.practiceWritingPreviousStyle) {
      panel.setAttribute("style", state.practiceWritingPreviousStyle);
    } else {
      panel.removeAttribute("style");
    }
    state.practiceWritingPreviousStyle = "";
  }
  state.practiceWritingFullscreen = fullscreen;
  const button = panel.querySelector('[data-command="toggle-practice-writing-fullscreen"]');
  if (!button) return;
  button.textContent = fullscreen ? "❐" : "⛶";
  button.setAttribute("aria-label", fullscreen ? "恢复手写板大小 / Restore writing pad" : "全屏显示手写板 / Full-screen writing pad");
  button.title = fullscreen ? "恢复 / Restore" : "全屏 / Full screen";
}

function togglePracticeWritingFullscreen() {
  setPracticeWritingFullscreen(!state.practiceWritingFullscreen);
}

function refreshPracticeWritingPanel() {
  const item = currentItem();
  renderPracticeUnit(item);
  if (state.practiceWritingItemId !== item.id || elements.practiceWritingPanel.hidden) return;
  elements.practiceWritingContent.innerHTML = renderHandwritingWorkspace(item);
  bilingualizeButtons(elements.practiceWritingContent);
  setupHandwritingCanvas(item.id);
}

function setupHandwritingCanvas(itemId) {
  const canvas = document.querySelector("#practiceHandwritingCanvas");
  if (!canvas) return;
  const context = canvas.getContext("2d");
  state.handwritingStrokeCount = 0;
  let drawing = false;

  const pointFromEvent = (event) => {
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((event.clientX - rect.left) * canvas.width) / rect.width,
      y: ((event.clientY - rect.top) * canvas.height) / rect.height,
    };
  };

  canvas.addEventListener("pointerdown", (event) => {
    drawing = true;
    state.handwritingDrawing = true;
    state.handwritingStrokeCount += 1;
    const point = pointFromEvent(event);
    context.beginPath();
    context.moveTo(point.x, point.y);
    canvas.setPointerCapture(event.pointerId);
  });
  canvas.addEventListener("pointermove", (event) => {
    if (!drawing) return;
    const point = pointFromEvent(event);
    context.strokeStyle = "#173b4c";
    context.lineWidth = 18;
    context.lineCap = "round";
    context.lineJoin = "round";
    context.lineTo(point.x, point.y);
    context.stroke();
  });
  ["pointerup", "pointercancel"].forEach((eventName) => {
    canvas.addEventListener(eventName, () => {
      drawing = false;
      state.handwritingDrawing = false;
    });
  });
  canvas.dataset.itemId = itemId;
}

function clearHandwritingCanvas() {
  const canvas = document.querySelector("#practiceHandwritingCanvas");
  if (!canvas) return;
  canvas.getContext("2d").clearRect(0, 0, canvas.width, canvas.height);
  state.handwritingStrokeCount = 0;
}

function confirmHandwritingCell() {
  const item = currentItem();
  const canvas = document.querySelector("#practiceHandwritingCanvas");
  if (!canvas || !state.handwritingStrokeCount) return;
  const draft = handwritingDraft(item.id);
  draft.cells.push(canvas.toDataURL("image/png"));
  draft.strokeCounts.push(state.handwritingStrokeCount);
  draft.saved = false;
  draft.assessment = { status: "idle", result: null, message: "" };
  refreshPracticeWritingPanel();
}

function removeHandwritingCell() {
  const item = currentItem();
  const draft = handwritingDraft(item.id);
  draft.cells.pop();
  draft.strokeCounts.pop();
  draft.saved = false;
  draft.assessment = { status: "idle", result: null, message: "" };
  refreshPracticeWritingPanel();
}

function saveHandwritingAnswer() {
  const item = currentItem();
  const draft = handwritingDraft(item.id);
  if (!draft.cells.length) return;
  draft.saved = true;
  refreshPracticeWritingPanel();
}

function setAnswerMode(mode) {
  const item = currentItem();
  if (item.questionNumber < 47) return;
  if (!writingInputModes().includes(mode)) return;
  state.answerModes[item.id] = mode;
  if (mode === "keyboard") closePracticeWritingPanel();
  renderPracticeUnit(item);
}

function getAssistTabs() {
  if (currentItem().unitType === "practiceIntro") {
    return [{ key: "understand", label: "母语解释" }];
  }
  if (state.section === "practice") {
    return [
      { key: "understand", label: "理解题意" },
      { key: "hint", label: "思考方向" },
      { key: "example", label: "相似实例" },
    ];
  }
  if (state.section === "vocabulary") {
    return [
      { key: "understand", label: "理解" },
      { key: "shadow", label: "跟读" },
      { key: "write", label: "跟写" },
      { key: "practice", label: "小练习" },
    ];
  }
  return [
    { key: "understand", label: "理解" },
    { key: "shadow", label: "跟读" },
    { key: "practice", label: state.section === "text" ? "表达" : "小练习" },
  ];
}

function renderAssistTabs() {
  const tabs = getAssistTabs();
  if (!tabs.some((tab) => tab.key === state.assistTab)) {
    state.assistTab = tabs[0].key;
  }
  elements.assistTabs.style.setProperty("--assist-tab-count", tabs.length);
  elements.assistTabs.innerHTML = tabs
    .map(
      (tab) =>
        `<button type="button" role="tab" data-assist-tab="${tab.key}" class="${tab.key === state.assistTab ? "active" : ""}" aria-selected="${tab.key === state.assistTab}">${tab.label}</button>`,
    )
    .join("");
}

function renderAssistContent() {
  if (state.section === "vocabulary") renderWordAssist();
  else if (state.section === "text") renderTextAssist();
  else renderPracticeAssist();
  bilingualizeButtons(elements.assistContent);
}

function renderWordAssist() {
  const word = currentItem();
  const context = findLessonContext(word.hanzi);
  if (state.assistTab === "understand") {
    elements.assistContent.innerHTML = `
      <div class="assist-grid">
        <div class="assist-block">
          <span class="assist-label">母语词义</span>
          <p class="translation-large">${state.assistMode === "immersion" ? "中文沉浸模式已开启" : escapeHtml(translationFor(word.translations))}</p>
        </div>
        <div class="assist-block">
          <span class="assist-label">本课语境</span>
          <p>${escapeHtml(context?.texts?.["zh-CN"] || `在课文中寻找“${word.hanzi}”的使用位置。`)}</p>
        </div>
        <div class="assist-block">
          <span class="assist-label">思考方向</span>
          <p>${escapeHtml(buildThinkingHint(word))}</p>
        </div>
        <div class="assist-block">
          <span class="assist-label">学习状态</span>
          <div class="shadow-tools">
            <button class="quiet-button" type="button" data-command="mastered">✓ 已掌握</button>
            <button class="quiet-button" type="button" data-command="review">↺ 待复习</button>
            <button class="quiet-button" type="button" data-command="favorite">☆ 收藏</button>
          </div>
        </div>
        ${renderDeepAssistPanel({ unitType: "vocabulary", unitId: word.id, assistType: "deep-explain" })}
      </div>`;
    return;
  }
  if (state.assistTab === "shadow") {
    renderShadowAssist(`“${word.hanzi}”`);
    return;
  }
  if (state.assistTab === "write") {
    elements.assistContent.innerHTML = `
      <div class="assist-block writing-launch">
        <span class="assist-label">汉字跟写</span>
        <p>先观看“${escapeHtml(word.hanzi)}”每个字的笔顺，再在田字格中逐字书写。</p>
        <button class="command-button" type="button" data-command="open-word-writing">打开跟写练习</button>
        <p class="privacy-note">书写图片不会自动上传，确认后再保存。</p>
      </div>`;
    return;
  }
  renderWordQuiz(word);
}

function openWordWritingDialog() {
  const word = currentItem();
  if (word?.unitType !== "word") return;
  const writing = state.wordWriting;
  if (writing.wordId !== word.id) {
    writing.wordId = word.id;
    writing.characters = Array.from(word.hanzi);
    writing.characterIndex = 0;
    writing.images = Array(writing.characters.length).fill("");
    writing.strokeCounts = Array(writing.characters.length).fill(0);
    writing.artifactUrl = "";
    writing.artifactBlob = null;
    writing.assessment = { status: "idle", result: null, message: "" };
  }
  renderWordWritingDialog(word);
  if (typeof elements.writingDialog.showModal === "function") {
    if (!elements.writingDialog.open) elements.writingDialog.showModal();
  } else {
    elements.writingDialog.setAttribute("open", "");
  }
  initializeWordWritingCharacter();
}

function renderWordWritingDialog(word = currentItem()) {
  const writing = state.wordWriting;
  const character = writing.characters[writing.characterIndex] || "";
  const allComplete =
    writing.images.length > 0 && writing.images.every(Boolean);
  elements.writingContent.innerHTML = `
    <div class="writing-dialog-shell">
      <header class="writing-dialog-header">
        <div>
          <span>词语跟写</span>
          <h2 id="wordWritingTitle">${escapeHtml(word.hanzi)} · 第 ${writing.characterIndex + 1} / ${writing.characters.length} 个字</h2>
        </div>
        <button class="writing-close-button" type="button" data-writing-command="close" aria-label="关闭跟写弹窗 / Close writing dialog" title="关闭 / Close">×</button>
      </header>
      <nav class="writing-character-tabs" aria-label="选择要练习的汉字">
        ${writing.characters.map((item, index) => `<button type="button" data-writing-character="${index}" class="${index === writing.characterIndex ? "active" : ""}"><strong>${escapeHtml(item)}</strong><span>${writing.images[index] ? "已完成" : `第${index + 1}字`}</span></button>`).join("")}
      </nav>
      <div class="writing-dialog-body">
        <section class="stroke-demo-panel">
          <div class="writing-panel-heading"><span>第一步</span><h3>观看“${escapeHtml(character)}”的笔顺</h3></div>
          <div class="writing-tian-grid demo-grid"><div id="wordStrokeDemo" aria-label="${escapeAttribute(character)}的笔顺演示"></div></div>
          <button class="quiet-button" type="button" data-writing-command="replay">重新演示</button>
        </section>
        <section class="stroke-practice-panel">
          <div class="writing-panel-heading"><span>第二步</span><h3>在田字格中书写“${escapeHtml(character)}”</h3></div>
          <div class="writing-tian-grid practice-grid"><canvas id="wordWritingCanvas" width="600" height="600" aria-label="书写${escapeAttribute(character)}"></canvas></div>
          <div class="writing-canvas-actions">
            <button class="quiet-button" type="button" data-writing-command="clear">清空</button>
            <button class="command-button" type="button" data-writing-command="confirm">确认这个字</button>
          </div>
        </section>
      </div>
      <div class="writing-dialog-footer">
        <p id="wordWritingStatus">${allComplete ? "所有汉字已经完成，可以生成整词书写图片。" : "请按笔顺练习，确认后再进入下一个字。"}</p>
        <div class="writing-result-actions">
          <button class="command-button" type="button" data-writing-command="generate" ${allComplete ? "" : "disabled"}>生成整词图片</button>
        </div>
      </div>
      ${writing.artifactUrl ? `<div class="writing-result"><div><span>已生成</span><strong>${escapeHtml(word.hanzi)}书写图片</strong></div><img src="${writing.artifactUrl}" alt="${escapeAttribute(word.hanzi)}书写结果"><button class="quiet-button" type="button" data-writing-command="download">下载图片</button></div>${renderAssessmentConsent("word-writing", writing.assessment)}` : ""}
    </div>`;
  bilingualizeButtons(elements.writingContent);
}

function initializeWordWritingCharacter() {
  setupWordWritingCanvas();
  const writing = state.wordWriting;
  const character = writing.characters[writing.characterIndex];
  const target = document.querySelector("#wordStrokeDemo");
  if (!target || !character) return;
  target.innerHTML = "";
  if (!window.HanziWriter) {
    target.textContent = "笔顺组件未加载";
    return;
  }
  writing.writer = HanziWriter.create(target, character, {
    width: Math.min(280, target.parentElement.clientWidth - 16),
    height: Math.min(280, target.parentElement.clientWidth - 16),
    padding: 18,
    showOutline: true,
    showCharacter: false,
    strokeColor: "#16373a",
    outlineColor: "#c5d3cf",
    highlightColor: "#d45f45",
    strokeAnimationSpeed: 1,
    delayBetweenStrokes: 420,
    charDataLoader: loadLocalStrokeData,
  });
  animateCurrentWritingCharacter();
}

function loadLocalStrokeData(character, onComplete, onError) {
  const bundledData = window.DIGITAL_BOOK_STROKE_DATA?.[character];
  if (bundledData) {
    Promise.resolve().then(() => onComplete(bundledData));
    return;
  }
  if (window.location.protocol === "file:") {
    onError?.(new Error(`离线笔顺数据中缺少“${character}”`));
    return;
  }
  fetch(`${STROKE_DATA_ROOT}/${encodeURIComponent(character)}.json`)
    .then((response) => {
      if (!response.ok) throw new Error(`笔顺数据加载失败：${response.status}`);
      return response.json();
    })
    .then(onComplete)
    .catch((error) => onError?.(error));
}

function animateCurrentWritingCharacter() {
  const animation = state.wordWriting.writer?.animateCharacter?.();
  animation?.catch?.(() => {
    setWordWritingStatus("笔顺数据加载失败，请刷新页面后重试。 ");
  });
}

function setupWordWritingCanvas() {
  const canvas = document.querySelector("#wordWritingCanvas");
  if (!canvas) return;
  const context = canvas.getContext("2d");
  context.lineWidth = 18;
  context.lineCap = "round";
  context.lineJoin = "round";
  context.strokeStyle = "#16373a";
  state.wordWriting.drawing = false;
  state.wordWriting.lastPoint = null;
  state.wordWriting.strokeCount = 0;
  const saved = state.wordWriting.images[state.wordWriting.characterIndex];
  if (saved) {
    const image = new Image();
    image.addEventListener("load", () => {
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      state.wordWriting.strokeCount = 1;
    });
    image.src = saved;
  }
  const pointFromEvent = (event) => {
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((event.clientX - rect.left) / rect.width) * canvas.width,
      y: ((event.clientY - rect.top) / rect.height) * canvas.height,
    };
  };
  canvas.addEventListener("pointerdown", (event) => {
    canvas.setPointerCapture(event.pointerId);
    if (state.wordWriting.images[state.wordWriting.characterIndex]) {
      context.clearRect(0, 0, canvas.width, canvas.height);
    }
    state.wordWriting.drawing = true;
    state.wordWriting.strokeCount += 1;
    state.wordWriting.images[state.wordWriting.characterIndex] = "";
    state.wordWriting.artifactUrl = "";
    state.wordWriting.artifactBlob = null;
    state.wordWriting.assessment = { status: "idle", result: null, message: "" };
    state.wordWriting.lastPoint = pointFromEvent(event);
  });
  canvas.addEventListener("pointermove", (event) => {
    if (!state.wordWriting.drawing) return;
    const point = pointFromEvent(event);
    context.beginPath();
    context.moveTo(state.wordWriting.lastPoint.x, state.wordWriting.lastPoint.y);
    context.lineTo(point.x, point.y);
    context.stroke();
    state.wordWriting.lastPoint = point;
  });
  const endDrawing = () => {
    state.wordWriting.drawing = false;
    state.wordWriting.lastPoint = null;
  };
  canvas.addEventListener("pointerup", endDrawing);
  canvas.addEventListener("pointercancel", endDrawing);
}

function setWordWritingStatus(message) {
  const status = document.querySelector("#wordWritingStatus");
  if (status) status.textContent = message;
}

function clearWordWritingCanvas() {
  const canvas = document.querySelector("#wordWritingCanvas");
  canvas?.getContext("2d").clearRect(0, 0, canvas.width, canvas.height);
  state.wordWriting.images[state.wordWriting.characterIndex] = "";
  state.wordWriting.artifactUrl = "";
  state.wordWriting.artifactBlob = null;
  state.wordWriting.assessment = { status: "idle", result: null, message: "" };
  state.wordWriting.strokeCount = 0;
  setWordWritingStatus("田字格已清空，请重新书写。 ");
}

async function confirmWordWritingCharacter() {
  const canvas = document.querySelector("#wordWritingCanvas");
  if (!canvas || !state.wordWriting.strokeCount) {
    setWordWritingStatus("请先在田字格中书写这个字。 ");
    return;
  }
  const writing = state.wordWriting;
  writing.images[writing.characterIndex] = canvas.toDataURL("image/png");
  writing.strokeCounts[writing.characterIndex] = writing.strokeCount;
  if (writing.characterIndex < writing.characters.length - 1) {
    writing.characterIndex += 1;
    renderWordWritingDialog();
    initializeWordWritingCharacter();
    return;
  }
  await generateWordWritingImage();
}

function drawTianGrid(context, x, y, size) {
  context.save();
  context.strokeStyle = "#b9cbc6";
  context.lineWidth = 2;
  context.strokeRect(x + 1, y + 1, size - 2, size - 2);
  context.setLineDash([10, 8]);
  context.beginPath();
  context.moveTo(x + size / 2, y);
  context.lineTo(x + size / 2, y + size);
  context.moveTo(x, y + size / 2);
  context.lineTo(x + size, y + size / 2);
  context.moveTo(x, y);
  context.lineTo(x + size, y + size);
  context.moveTo(x + size, y);
  context.lineTo(x, y + size);
  context.stroke();
  context.restore();
}

function loadWritingImage(source) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.addEventListener("load", () => resolve(image), { once: true });
    image.addEventListener("error", reject, { once: true });
    image.src = source;
  });
}

async function generateWordWritingImage() {
  const writing = state.wordWriting;
  if (!writing.images.length || writing.images.some((image) => !image)) {
    setWordWritingStatus("请先完成词语中的每一个汉字。 ");
    return;
  }
  const cellSize = 320;
  const canvas = document.createElement("canvas");
  canvas.width = cellSize * writing.images.length;
  canvas.height = cellSize;
  const context = canvas.getContext("2d");
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, canvas.width, canvas.height);
  const images = await Promise.all(writing.images.map(loadWritingImage));
  images.forEach((image, index) => {
    const x = index * cellSize;
    drawTianGrid(context, x, 0, cellSize);
    context.drawImage(image, x, 0, cellSize, cellSize);
  });
  writing.artifactUrl = canvas.toDataURL("image/png");
  writing.artifactBlob = await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
  persistWordWritingRecord(canvas);
  renderWordWritingDialog();
  initializeWordWritingCharacter();
  setWordWritingStatus("整词书写图片已生成，当前只保存在本地预览中。 ");
}

function persistWordWritingRecord(canvas) {
  const word = currentItem();
  const writing = state.wordWriting;
  const record = {
    schemaVersion: "1.0",
    artifactId: window.crypto?.randomUUID?.() || `writing-${Date.now()}`,
    userId: "local-user",
    lessonId: "zjzh-1-1",
    unitType: "vocabularyWriting",
    unitId: `${word.id}-writing`,
    referenceText: word.hanzi,
    createdAt: new Date().toISOString(),
    media: {
      mimeType: "image/png",
      sizeBytes: Math.round((writing.artifactUrl.length * 3) / 4),
      width: canvas.width,
      height: canvas.height,
    },
    storage: {
      provider: "tencent-cos",
      status: "local",
      objectKey: null,
      url: null,
    },
    assessments: [
      {
        provider: "deepseek",
        status: "pending",
        mode: "handwriting-advice",
        result: null,
      },
    ],
    consent: { uploadAllowed: false, consentedAt: null },
  };
  const records = readStoredJson("digitalBookWritingRecords", []);
  records.push(record);
  localStorage.setItem(
    "digitalBookWritingRecords",
    JSON.stringify(records.slice(-100)),
  );
}

function closeWordWritingDialog() {
  state.wordWriting.writer?.cancelAnimation?.();
  if (elements.writingDialog.open && elements.writingDialog.close) {
    elements.writingDialog.close();
  } else {
    elements.writingDialog.removeAttribute("open");
  }
}

function handleWordWritingCommand(command) {
  if (command === "close") closeWordWritingDialog();
  else if (command === "replay") animateCurrentWritingCharacter();
  else if (command === "clear") clearWordWritingCanvas();
  else if (command === "confirm") void confirmWordWritingCharacter();
  else if (command === "generate") void generateWordWritingImage();
  else if (command === "assess-word-writing") void assessWordWriting();
  else if (command === "download" && state.wordWriting.artifactUrl) {
    const link = document.createElement("a");
    link.href = state.wordWriting.artifactUrl;
    link.download = `${currentItem().hanzi}-书写练习.png`;
    link.click();
  }
}

function renderTextAssist() {
  const cue = currentItem();
  if (state.assistTab === "understand") {
    const keywords = state.words.filter((word) =>
      cue.texts["zh-CN"].includes(word.hanzi),
    );
    elements.assistContent.innerHTML = `
      <div class="assist-grid">
        <div class="assist-block">
          <span class="assist-label">母语理解</span>
          <p class="translation-large">${state.assistMode === "immersion" ? "先根据中文语境理解本句。" : escapeHtml(translationFor(cue.texts))}</p>
        </div>
        <div class="assist-block">
          <span class="assist-label">本句词语</span>
          <div class="keyword-list">${keywords.length ? keywords.map((word) => `<span>${escapeHtml(word.hanzi)} · ${escapeHtml(word.pinyin)}</span>`).join("") : "<span>结合上下句理解</span>"}</div>
        </div>
        <div class="assist-block">
          <span class="assist-label">思考方向</span>
          <p>先找出本句中的人物、动作和结果，再判断它与上一句之间的关系。</p>
        </div>
        <div class="assist-block">
          <span class="assist-label">语境位置</span>
          <p>这是课文第 ${cue.sourceIndex + 1} 句。需要时可用下方按钮连续听前后句。</p>
        </div>
        ${renderDeepAssistPanel({ unitType: "text", unitId: cue.id, assistType: "deep-explain" })}
      </div>`;
    return;
  }
  if (state.assistTab === "shadow") {
    renderShadowAssist(`课文第 ${cue.sourceIndex + 1} 句`);
    return;
  }
  elements.assistContent.innerHTML = `
    <div class="assist-block">
      <span class="assist-label">用自己的话表达</span>
      <p>保持原意，换一种更简单的说法复述本句。先说清楚“谁、做了什么、结果怎样”。</p>
      <div class="answer-box">
        <textarea data-text-response aria-label="复述当前句" placeholder="用自己的话复述这句话"></textarea>
      </div>
    </div>`;
}

function renderShadowAssist(label) {
  elements.assistContent.innerHTML = `
    <div class="assist-block">
      <span class="assist-label">听辨与跟读</span>
      <p>先完整听一遍，再录下自己的跟读，与标准音逐段比较。</p>
      <div class="shadow-orbs">
        ${voiceOrbButton("shadow-model", "cyan", "▶", `播放${label}`, "play")}
        ${voiceOrbButton(
          "shadow-record",
          "violet",
          state.mediaRecorder?.state === "recording" ? "■" : "●",
          state.mediaRecorder?.state === "recording" ? "停止录音" : "开始跟读",
          "record",
        )}
        ${state.recordingUrl ? voiceOrbButton("shadow-replay", "green", "▶", "试听录音", "play-recording") : ""}
      </div>
      <div class="recording-status">${escapeHtml(state.recordingStatus)}</div>
      ${state.recordingUrl ? renderAssessmentConsent("recording", state.recordingAssessment) : ""}
      <p class="privacy-note">录音停止后不会自动上传；只有勾选同意并开始测评时才会保存到个人 COS 记录。</p>
    </div>`;
}

function voiceOrbButton(id, theme, glyph, label, command) {
  const englishLabel = buttonTranslations.get(label)
    || (label.startsWith("播放课文第") ? "Play sentence" : label.startsWith("播放“") ? "Play model" : label.startsWith("听第") ? "Play paragraph" : "Voice action");
  return `
    <div class="voice-orb-unit">
      <button class="voice-orb-button voice-orb-medium" type="button" data-command="${command}" aria-label="${escapeAttribute(`${label} / ${englishLabel}`)}" title="${escapeAttribute(`${label} / ${englishLabel}`)}">
        <span class="voice-orb" data-orb-id="${id}" data-orb-theme="${theme}">
          <canvas></canvas>
          <span class="orb-glyph">${glyph}</span>
        </span>
      </button>
      <strong>${escapeHtml(label)}<small>${escapeHtml(englishLabel)}</small></strong>
    </div>`;
}

function destroyVoiceOrbs() {
  Object.values(state.voiceOrbs).forEach((orb) => orb?.destroy?.());
  state.voiceOrbs = {};
}

function initializeVoiceOrbs() {
  destroyVoiceOrbs();
  if (!window.VoiceOrb) return;
  document.querySelectorAll("[data-orb-id]").forEach((root) => {
    const id = root.dataset.orbId;
    const orb = new VoiceOrb(root, { theme: root.dataset.orbTheme });
    state.voiceOrbs[id] = orb;
  });
  syncVoiceOrbStates();
  if (state.mediaRecorder?.state === "recording" && state.recordingStream) {
    const recordOrb = findVoiceOrb("record");
    recordOrb?.attachStream(state.recordingStream).then(() => {
      recordOrb.setTheme("violet");
      recordOrb.setState("recording");
    });
  }
}

function findVoiceOrb(role) {
  const entry = Object.entries(state.voiceOrbs).find(([id]) =>
    id.endsWith(`-${role}`),
  );
  return entry?.[1] || null;
}

function setVoiceOrbGlyph(orb, glyph) {
  const element = orb?.root?.querySelector(".orb-glyph");
  if (element) element.textContent = glyph;
}

function syncVoiceOrbStates() {
  const modelOrb = findVoiceOrb("model");
  if (modelOrb) {
    const playing = !elements.audio.paused;
    modelOrb.setTheme("cyan");
    modelOrb.setState(playing ? "playing" : "idle", { synthetic: playing });
    setVoiceOrbGlyph(modelOrb, playing ? "Ⅱ" : "▶");
  }
  const recordOrb = findVoiceOrb("record");
  if (recordOrb && state.mediaRecorder?.state !== "recording") {
    recordOrb.setTheme(state.recordingUrl ? "green" : "violet");
    recordOrb.setState(state.recordingUrl ? "complete" : "idle");
    setVoiceOrbGlyph(recordOrb, state.recordingUrl ? "✓" : "●");
  }
  const replayOrb = findVoiceOrb("replay");
  if (replayOrb) {
    const playing = state.recordingPlaybackAudio?.paused === false;
    replayOrb.setTheme("green");
    replayOrb.setState(playing ? "playing" : "complete");
    setVoiceOrbGlyph(replayOrb, playing ? "Ⅱ" : "▶");
  }
}

function renderWordQuiz(word) {
  const correct = translationFor(word.translations);
  const distractors = state.words
    .filter((candidate) => candidate.id !== word.id)
    .map((candidate) => translationFor(candidate.translations))
    .filter((value, index, values) => value && values.indexOf(value) === index)
    .slice(currentIndex() % 8, currentIndex() % 8 + 2);
  const options = deterministicShuffle([correct, ...distractors], currentIndex());
  elements.assistContent.innerHTML = `
    <div class="assist-block">
      <span class="assist-label">即时理解检查</span>
      <p>请选择“${escapeHtml(word.hanzi)}”在本课中的意思。</p>
      <div class="quiz-options">
        ${options.map((option, optionIndex) => {
          const resultClass =
            state.quizResult && option === correct
              ? "correct"
              : state.quizResult === option
                ? "incorrect"
                : "";
          return `<button type="button" class="${resultClass}" data-quiz-option="${escapeAttribute(option)}"><strong class="quiz-option-key">${String.fromCharCode(65 + optionIndex)}</strong><span class="quiz-option-text">${escapeHtml(option)}</span></button>`;
        }).join("")}
      </div>
      <div class="quiz-feedback">${state.quizResult ? (state.quizResult === correct ? "回答正确。再听一遍并跟读这个词。" : "再结合词性和课文语境比较，正确选项已经标出。") : "选择后显示简短反馈。"}</div>
    </div>`;
}

function renderPracticeAssist() {
  const item = currentItem();
  if (item.unitType === "practiceIntro") {
    const translated = item.explanationTranslations
      ? translationFor(item.explanationTranslations)
      : "";
    elements.assistContent.innerHTML = `
      <div class="assist-block">
        <span class="assist-label">${escapeHtml(languageLabels[state.locale] || state.locale)} · 语法解释</span>
        <p class="translation-large">${state.assistMode === "immersion" ? "中文沉浸模式已开启" : escapeHtml(translated || item.explanation)}</p>
      </div>
      ${renderDeepAssistPanel({ unitType: "practice-intro", unitId: item.groupId, assistType: "deep-explain" })}`;
    return;
  }
  const support = item.support || {};
  if (state.assistTab === "understand") {
    elements.assistContent.innerHTML = `
      <div class="assist-block">
        <span class="assist-label">题目要求</span>
        <p class="translation-large">${escapeHtml(support.promptMeaning || "先确认题目要求你补充、改写还是解释什么内容。")}</p>
      </div>
      ${renderDeepAssistPanel({ unitType: "practice", unitId: item.id, assistType: "prompt-meaning" })}`;
    return;
  }
  if (state.assistTab === "hint") {
    elements.assistContent.innerHTML = `
      <div class="assist-block">
        <span class="assist-label">思考方向</span>
        <p>${escapeHtml(support.thinkingHint || "先从题干中的人物、时间、动作和结果寻找线索。")}</p>
      </div>
      ${renderDeepAssistPanel({ unitType: "practice", unitId: item.id, assistType: "thinking-hint" })}`;
    return;
  }
  const example = support.similarExample;
  elements.assistContent.innerHTML = `
    <div class="assist-grid">
      <div class="assist-block">
        <span class="assist-label">相似题目</span>
        <p>${escapeHtml(example?.prompt || "这一题暂无相似实例。")}</p>
      </div>
      ${example ? `<div class="assist-block"><span class="assist-label">实例解析</span><p>${escapeHtml(example.answer)}\n${escapeHtml(example.explanation)}</p></div>` : ""}
    </div>
    ${renderDeepAssistPanel({ unitType: "practice", unitId: item.id, assistType: "similar-example" })}`;
}

function deepAssistKey(request) {
  return `${request.unitType}:${request.unitId}:${request.assistType}:${state.locale}`;
}

function renderDeepAssistPanel(request) {
  if (!window.LearningApi?.isConfigured()) return "";
  const record = state.deepAssist[deepAssistKey(request)] || {};
  if (record.status === "loading") return '<div class="assist-block deep-assist-block"><span class="assist-label">AI深度解释</span><p>正在生成并检查解释…</p></div>';
  if (record.status === "error") return `<div class="assist-block deep-assist-block"><span class="assist-label">AI深度解释</span><p>${escapeHtml(record.message)}</p><button class="quiet-button" type="button" data-command="deep-assist" data-deep-request="${escapeAttribute(JSON.stringify(request))}">重新尝试</button></div>`;
  if (record.status === "ready") return `<div class="assist-block deep-assist-block"><span class="assist-label">AI深度解释 · ${escapeHtml(languageLabels[state.locale] || state.locale)}</span>${renderDeepAssistValue(record.result)}</div>`;
  return `<div class="assist-block deep-assist-block"><span class="assist-label">需要更深入时</span><p>查看本学习点的语境、结构、易错点或分步提示。首次生成后将保存并供后续学习者复用。</p><button class="command-button" type="button" data-command="deep-assist" data-deep-request="${escapeAttribute(JSON.stringify(request))}">AI深度解释</button></div>`;
}

function renderDeepAssistValue(value) {
  if (Array.isArray(value)) return `<ul>${value.map((item) => `<li>${typeof item === "object" ? renderDeepAssistValue(item) : escapeHtml(item)}</li>`).join("")}</ul>`;
  if (value && typeof value === "object") return Object.entries(value).map(([key, item]) => `<div class="deep-assist-row"><strong>${escapeHtml(deepAssistLabel(key))}</strong>${renderDeepAssistValue(item)}</div>`).join("");
  return `<p>${escapeHtml(value || "")}</p>`;
}

function deepAssistLabel(key) {
  return ({ summary: "简明说明", contextMeaning: "本课语境", collocations: "常用搭配", contrast: "辨析", errorWarning: "易错提醒", examples: "相似例句", translation: "母语解释", segments: "句子分块", grammarPoints: "语法要点", contextRole: "上下文作用", expressionTip: "表达建议", taskMeaning: "题目要求", vocabularyReminder: "参考词汇提醒", suggestedStructure: "参考结构", keyRequirements: "关键要求", protectedTerms: "目标词语", steps: "思考步骤", checklist: "检查清单", prompt: "相似题目", answer: "实例答案", explanation: "实例解析", differenceFromOriginal: "与原题区别", zh: "中文", meaning: "含义", structure: "结构", usageNotes: "使用提示" })[key] || key;
}

async function requestDeepAssist(request) {
  const key = deepAssistKey(request);
  state.deepAssist[key] = { status: "loading" };
  renderAssistContent();
  try {
    const response = await window.LearningApi.resolveAssist({ lessonId: "zjzh-1-1", locale: state.locale, ...request });
    state.deepAssist[key] = { status: "ready", result: response.content?.content || response.content };
  } catch (error) {
    state.deepAssist[key] = { status: "error", message: error.message || "深度解释暂时不可用" };
  }
  renderAssistContent();
}

function renderPracticeFeedback(item, response) {
  if (item.type === "guidedProduction") {
    return `
      <div class="answer-feedback">
        <strong>键盘答案已保存</strong><br>
        可在下方选择评价语言，再获得四项内容评价和完善建议。
      </div>`;
  }
  const result = evaluatePractice(item, response);
  const answer = item.answer || {};
  const reference = answer.reference ||
    answer.accepted?.join(" / ") ||
    answer.referencePoints?.join("；") ||
    "";
  return `
    <div class="answer-feedback${result.correct ? "" : " needs-work"}">
      <strong>${result.correct ? "作答符合要求" : "请根据提示再检查"}</strong><br>
      ${escapeHtml(result.message)}
      ${reference ? `<div class="example-answer"><strong>提交后参考：</strong><br>${escapeHtml(reference)}</div>` : ""}
    </div>`;
}

function evaluatePractice(item, response) {
  const value = response.trim();
  const answer = item.answer || {};
  if (!value) return { correct: false, message: "还没有填写答案。先根据思考方向完成一次尝试。" };

  if (answer.accepted?.length) {
    const normalized = normalizeAnswer(value);
    const correct = answer.accepted.some((accepted) =>
      normalized.includes(normalizeAnswer(accepted)),
    );
    return {
      correct,
      message: correct
        ? answer.explanation || "答案与题目语境相符。"
        : "检查所填内容是否符合句意和指定词语。",
    };
  }

  if (answer.required?.length) {
    const missing = answer.required.filter((part) => !value.includes(part));
    return {
      correct: missing.length === 0,
      message: missing.length
        ? `还需要检查这些要点：${missing.join("、")}。`
        : answer.explanation || "已使用要求的结构，请再朗读检查表达是否自然。",
    };
  }

  const longEnough = value.replace(/\s/g, "").length >= 8;
  return {
    correct: longEnough,
    message: longEnough
      ? "答案已记录。请根据参考要点检查依据是否完整、表达是否清楚。"
      : "答案还比较简短，可以补充课文依据或说明原因。",
  };
}

function normalizeAnswer(value) {
  return value.replace(/[\s，。！？、；：,.!?;:（）()]/g, "").toLowerCase();
}

function translationFor(translations) {
  return translations?.[state.locale] || translations?.en || "";
}

function findLessonContext(hanzi) {
  return state.textCues.find((cue) => cue.texts["zh-CN"].includes(hanzi));
}

function buildThinkingHint(word) {
  const pos = partOfSpeechLabels[word.partOfSpeech] || word.partOfSpeech;
  const templates = {
    名词: `“${word.hanzi}”是名词。观察它通常指什么人、事物或概念，以及课文中与它搭配的动词。`,
    动词: `“${word.hanzi}”是动词。注意动作的对象，以及它在句中的前后搭配。`,
    形容词: `“${word.hanzi}”是形容词。注意它描述的对象，以及能否用“很”或“不太”修饰。`,
    副词: `“${word.hanzi}”是副词。重点观察它在句中的位置和所修饰的动作或状态。`,
    助词: `“${word.hanzi}”是助词。把它放回完整格式中理解，不单独记忆词义。`,
    叹词: `“${word.hanzi}”是叹词。注意说话人的语气和使用场景。`,
    成语: `“${word.hanzi}”是固定表达。结合完整语境理解，不逐字翻译。`,
  };
  return templates[pos] || `结合本课句子观察“${word.hanzi}”的含义和搭配。`;
}

function deterministicShuffle(values, seed) {
  return values
    .map((value, index) => ({ value, sort: (index * 7 + seed * 3) % 11 }))
    .sort((a, b) => a.sort - b.sort)
    .map((item) => item.value);
}

function setSection(section, index = state.indices[section] || 0) {
  if (!sectionOrder.includes(section)) return;
  closePracticeWritingPanel();
  resetAudioSource();
  state.section = section;
  state.indices[section] = Math.max(
    0,
    Math.min(index, sectionItems(section).length - 1),
  );
  state.assistTab = "understand";
  state.quizResult = null;
  resetRecordingForUnit();
  render();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function sectionItems(section) {
  return state.units[section];
}

function moveUnit(direction) {
  const items = currentItems();
  const index = currentIndex();
  if (index + direction >= 0 && index + direction < items.length) {
    state.indices[state.section] = index + direction;
    closePracticeWritingPanel();
    stopAudio();
    state.assistTab = "understand";
    state.quizResult = null;
    resetRecordingForUnit();
    render();
    window.scrollTo({ top: 0, behavior: "smooth" });
    return;
  }
  const sectionIndex = sectionOrder.indexOf(state.section);
  const nextSection = sectionOrder[sectionIndex + direction];
  if (!nextSection) return;
  setSection(
    nextSection,
    direction > 0 ? 0 : sectionItems(nextSection).length - 1,
  );
}

function isFirstUnit() {
  return state.section === sectionOrder[0] && currentIndex() === 0;
}

function isLastUnit() {
  const lastSection = sectionOrder[sectionOrder.length - 1];
  return (
    state.section === lastSection &&
    currentIndex() === currentItems().length - 1
  );
}

function audioSourceForSection() {
  const item = currentItem();
  if (item?.unitType === "word") return "vocabulary";
  if (item?.unitType === "sentence") return "text";
  if (item?.unitType === "paragraphReading") return "text";
  return "";
}

async function ensureAudioSource(source) {
  if (!source) return false;
  if (
    state.audioSource === source
    && state.audioUrls[source]
    && elements.audio.getAttribute("src")
  ) return true;

  elements.audio.pause();
  state.audioSource = "";
  state.audioMessage = "正在连接教材音频 / Loading audio";
  updateAudioLabels();

  if (!window.LearningApi?.isConfigured()) {
    state.audioMessage = "教材音频服务尚未配置 / Audio service unavailable";
    updateAudioLabels();
    return false;
  }

  if (!window.LearningApi.token()) {
    state.audioMessage = "请从学习中心登录后播放 / Sign in from Learning Center";
    updateAudioLabels();
    return false;
  }

  let audioUrl = state.audioUrls[source] || "";
  try {
    if (!audioUrl) {
      const result = await window.LearningApi.mediaUrl({
        lessonId: "zjzh-1-1",
        mediaType: source,
      });
      audioUrl = String(result?.url || "");
      if (!audioUrl) throw new Error("云端未返回音频地址");
      state.audioUrls[source] = audioUrl;
    }
  } catch (error) {
    const message = String(error?.message || "");
    state.audioMessage = /登录|邀请码|会话|401|token/i.test(message)
      ? "登录已失效，请返回学习中心重新登录 / Session expired"
      : "教材音频暂时无法加载，请稍后重试 / Audio temporarily unavailable";
    updateAudioLabels();
    return false;
  }

  state.audioSource = source;
  elements.audio.src = audioUrl;
  elements.audio.load();
  if (elements.audio.readyState >= HTMLMediaElement.HAVE_METADATA) {
    state.audioMessage = "";
    return true;
  }

  const ready = await new Promise((resolve) => {
    let timeoutId;
    const cleanup = () => {
      clearTimeout(timeoutId);
      elements.audio.removeEventListener("loadedmetadata", finish);
      elements.audio.removeEventListener("error", fail);
    };
    const finish = () => { cleanup(); resolve(true); };
    const fail = () => { cleanup(); resolve(false); };
    timeoutId = setTimeout(fail, 12000);
    elements.audio.addEventListener("loadedmetadata", finish);
    elements.audio.addEventListener("error", fail);
  });

  if (!ready) {
    delete state.audioUrls[source];
    state.audioSource = "";
    elements.audio.removeAttribute("src");
    elements.audio.load();
    state.audioMessage = "教材音频暂时无法加载，请稍后重试 / Audio temporarily unavailable";
    updateAudioLabels();
    return false;
  }

  state.audioMessage = "";
  updateAudioLabels();
  return true;
}

async function playCurrent(mode = "single") {
  if (state.aiWork.active) return;
  const source = audioSourceForSection();
  if (!source) return;
  const item = currentItem();
  const cue = item.unitType === "word"
    ? item.cue
    : item.unitType === "paragraphReading"
      ? currentReadingParagraph()
      : item;
  const ready = await ensureAudioSource(source);
  if (!ready) return;

  state.audioMode = mode;
  state.audioSegment = {
    section: state.section,
    index: currentIndex(),
    start: cue.start,
    end: cue.end,
  };
  elements.audio.currentTime = cue.start;
  elements.audio.playbackRate = Number(elements.speed.value);
  try {
    await elements.audio.play();
  } catch {
    return;
  }
  updateAudioLabels();
}

function stopAudio() {
  elements.audio.pause();
  state.audioMode = "single";
  state.audioSegment = null;
  updateAudioLabels();
}

function resetAudioSource() {
  elements.audio.pause();
  elements.audio.removeAttribute("src");
  elements.audio.load();
  elements.seek.value = "0";
  elements.audioTime.textContent = "00:00 / 00:00";
  state.audioSource = "";
  state.audioMessage = "";
  state.audioMode = "single";
  state.audioSegment = null;
}

function handleTimeUpdate() {
  const time = elements.audio.currentTime;
  if (state.audioMode === "continuous") {
    const items = state.section === "vocabulary" ? state.words : state.textCues;
    const index = items.findIndex((item) => {
      const cue = state.section === "vocabulary" ? item.cue : item;
      return time >= cue.start && time <= cue.end;
    });
    if (index >= 0 && index + 1 !== currentIndex()) {
      state.indices[state.section] = index + 1;
      state.audioSegment = {
        section: state.section,
        index: index + 1,
        start: state.section === "vocabulary" ? items[index].cue.start : items[index].start,
        end: state.section === "vocabulary" ? items[index].cue.end : items[index].end,
      };
      render();
    }
  } else if (state.audioSegment && time >= state.audioSegment.end) {
    if (state.loopCurrent) {
      elements.audio.currentTime = state.audioSegment.start;
    } else {
      elements.audio.pause();
      elements.audio.currentTime = state.audioSegment.end;
    }
  }

  if (Number.isFinite(elements.audio.duration)) {
    elements.seek.value = String(
      Math.round((elements.audio.currentTime / elements.audio.duration) * 1000),
    );
    elements.audioTime.textContent =
      `${formatTime(elements.audio.currentTime)} / ${formatTime(elements.audio.duration)}`;
  }
  updateAudioLabels();
}

function updateAudioLabels() {
  const playable = Boolean(audioSourceForSection());
  document.querySelector(".audio-dock").hidden = !playable;
  if (!playable) return;
  const item = currentItem();
  const label =
    item.unitType === "word"
      ? `${item.hanzi} · ${item.pinyin}`
      : item.unitType === "paragraphReading"
        ? `课文${paragraphOrdinal(state.readingParagraphIndex)}`
      : `课文第 ${item.sourceIndex + 1} 句`;
  elements.audioLabel.textContent = label;
  elements.audioStatus.textContent = state.audioMessage || (
    elements.audio.paused
      ? "准备播放 / Ready"
      : state.audioMode === "continuous"
        ? "连续播放 / Playing all"
        : "播放当前单元 / Playing"
  );
  elements.play.textContent = elements.audio.paused ? "▶" : "Ⅱ";
  elements.continuous.classList.toggle(
    "active",
    state.audioMode === "continuous" && !elements.audio.paused,
  );
  elements.continuous.setAttribute(
    "aria-pressed",
    String(state.audioMode === "continuous" && !elements.audio.paused),
  );
  elements.continuous.hidden = item.unitType === "paragraphReading";
  syncVoiceOrbStates();
}

function formatTime(seconds) {
  if (!Number.isFinite(seconds)) return "00:00";
  const minutes = Math.floor(seconds / 60);
  const rest = Math.floor(seconds % 60);
  return `${String(minutes).padStart(2, "0")}:${String(rest).padStart(2, "0")}`;
}

function toggleWordStatus(action) {
  if (currentItem()?.unitType !== "word") return;
  const word = currentItem();
  const status = state.statuses[word.id] || {};
  status[action] = !status[action];
  if (action === "mastered" && status[action]) status.review = false;
  if (action === "review" && status[action]) status.mastered = false;
  state.statuses[word.id] = status;
  localStorage.setItem("digitalBookWordStatuses", JSON.stringify(state.statuses));
  render();
}

function submitPractice() {
  const item = currentItem();
  const textarea = document.querySelector("#practiceAnswer");
  state.answers[item.id] = textarea?.value || "";
  state.submitted[item.id] = true;
  localStorage.setItem("digitalBookPracticeAnswers", JSON.stringify(state.answers));
  localStorage.setItem(
    "digitalBookPracticeSubmitted",
    JSON.stringify(state.submitted),
  );
  renderPracticeUnit(item, currentIndex());
}

async function toggleRecording() {
  if (state.aiWork.active) return;
  if (state.mediaRecorder?.state === "recording") {
    state.recordingWavBlob = await stopPcmCapture();
    state.mediaRecorder.stop();
    return;
  }
  if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
    state.recordingStatus = "当前浏览器不支持录音。";
    refreshRecordingView();
    return;
  }
  try {
    state.recordingStream = await navigator.mediaDevices.getUserMedia({
      audio: true,
    });
    state.recordingChunks = [];
    state.recordingSamples = [];
    state.recordingWavBlob = null;
    state.discardRecording = false;
    await startPcmCapture(state.recordingStream);
    state.mediaRecorder = new MediaRecorder(state.recordingStream);
    state.mediaRecorder.addEventListener("dataavailable", (event) => {
      if (event.data.size) state.recordingChunks.push(event.data);
    });
    state.mediaRecorder.addEventListener("stop", finishRecording);
    state.recordingStartedAt = Date.now();
    state.mediaRecorder.start();
    state.recordingStatus = "正在录音…";
    if (currentItem()?.unitType === "paragraphReading") {
      localStorage.setItem("digitalBookParagraphReadingChoice", "started");
    }
    refreshRecordingView();
  } catch {
    await stopPcmCapture().catch(() => null);
    state.recordingStatus = "未获得麦克风权限，录音没有开始。";
    refreshRecordingView();
  }
}

async function startPcmCapture(stream) {
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) throw new Error("当前浏览器不支持标准录音格式");
  const context = new AudioContextClass();
  await context.resume();
  const source = context.createMediaStreamSource(stream);
  const processor = context.createScriptProcessor(4096, 1, 1);
  const mute = context.createGain();
  mute.gain.value = 0;
  state.recordingSamples = [];
  state.recordingInputSampleRate = context.sampleRate;
  processor.onaudioprocess = (event) => {
    if (state.mediaRecorder?.state !== "recording") return;
    state.recordingSamples.push(new Float32Array(event.inputBuffer.getChannelData(0)));
  };
  source.connect(processor);
  processor.connect(mute);
  mute.connect(context.destination);
  state.recordingAudioContext = context;
  state.recordingSourceNode = source;
  state.recordingProcessor = processor;
  state.recordingMuteNode = mute;
}

async function stopPcmCapture() {
  const samples = state.recordingSamples;
  const inputRate = state.recordingInputSampleRate || 48000;
  state.recordingProcessor?.disconnect();
  state.recordingSourceNode?.disconnect();
  state.recordingMuteNode?.disconnect();
  state.recordingProcessor = null;
  state.recordingSourceNode = null;
  state.recordingMuteNode = null;
  if (state.recordingAudioContext) await state.recordingAudioContext.close().catch(() => {});
  state.recordingAudioContext = null;
  if (!samples.length) return null;
  const total = samples.reduce((sum, item) => sum + item.length, 0);
  const merged = new Float32Array(total);
  let offset = 0;
  samples.forEach((item) => { merged.set(item, offset); offset += item.length; });
  state.recordingSamples = [];
  return encodeWav(downsampleAudio(merged, inputRate, 16000), 16000);
}

function downsampleAudio(input, inputRate, outputRate) {
  if (inputRate === outputRate) return input;
  const ratio = inputRate / outputRate;
  const length = Math.max(1, Math.floor(input.length / ratio));
  const output = new Float32Array(length);
  for (let index = 0; index < length; index += 1) {
    const start = Math.floor(index * ratio);
    const end = Math.min(input.length, Math.floor((index + 1) * ratio));
    let sum = 0;
    for (let cursor = start; cursor < end; cursor += 1) sum += input[cursor];
    output[index] = sum / Math.max(1, end - start);
  }
  return output;
}

function encodeWav(samples, sampleRate) {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);
  const writeText = (offset, value) => Array.from(value).forEach((character, index) => view.setUint8(offset + index, character.charCodeAt(0)));
  writeText(0, "RIFF");
  view.setUint32(4, 36 + samples.length * 2, true);
  writeText(8, "WAVE");
  writeText(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeText(36, "data");
  view.setUint32(40, samples.length * 2, true);
  samples.forEach((sample, index) => {
    const value = Math.max(-1, Math.min(1, sample));
    view.setInt16(44 + index * 2, value < 0 ? value * 0x8000 : value * 0x7fff, true);
  });
  return new Blob([buffer], { type: "audio/wav" });
}

function finishRecording() {
  if (state.discardRecording) {
    state.recordingStream?.getTracks().forEach((track) => track.stop());
    state.recordingStream = null;
    state.discardRecording = false;
    return;
  }
  const blob = new Blob(state.recordingChunks, {
    type: state.mediaRecorder.mimeType || "audio/webm",
  });
  if (state.recordingUrl) URL.revokeObjectURL(state.recordingUrl);
  state.recordingUrl = URL.createObjectURL(blob);
  state.recordingRecord = createRecordingRecord(blob);
  state.recordingAssessment = { status: "idle", result: null, message: "" };
  state.recordingStatus = state.recordingWavBlob ? "录音完成，可以试听；确认后可进行真实口语测评。" : "录音完成，但标准测评音频生成失败，请重新录制。";
  state.recordingStream?.getTracks().forEach((track) => track.stop());
  state.recordingStream = null;
  persistRecordingRecord(state.recordingRecord);
  if (currentItem()?.unitType === "paragraphReading") {
    localStorage.setItem("digitalBookParagraphReadingChoice", "completed");
  }
  refreshRecordingView();
}

function resetRecordingForUnit() {
  stopRecordedAudio();
  if (state.recordingUrl) URL.revokeObjectURL(state.recordingUrl);
  state.recordingUrl = "";
  state.recordingRecord = null;
  state.recordingWavBlob = null;
  state.recordingAssessment = { status: "idle", result: null, message: "" };
  state.recordingStartedAt = 0;
  state.recordingStatus = "尚未录音";
  if (state.mediaRecorder?.state === "recording") {
    state.discardRecording = true;
    state.mediaRecorder.stop();
  }
  state.recordingStream?.getTracks().forEach((track) => track.stop());
  state.recordingStream = null;
  void stopPcmCapture();
}

function refreshRecordingView() {
  if (currentItem()?.unitType === "paragraphReading") {
    renderParagraphReadingUnit();
  } else {
    renderAssistContent();
  }
  initializeVoiceOrbs();
}

function createRecordingRecord(blob) {
  const item = currentItem();
  const unitType = item.unitType === "paragraphReading" ? "paragraphReading" : item.unitType === "word" ? "vocabulary" : "sentence";
  const paragraph = unitType === "paragraphReading" ? currentReadingParagraph() : null;
  const referenceText =
    unitType === "paragraphReading"
      ? paragraph.text
      : unitType === "vocabulary"
        ? item.hanzi
        : item.texts?.["zh-CN"] || "";
  const id =
    window.crypto?.randomUUID?.() ||
    `recording-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return {
    schemaVersion: "1.0",
    artifactId: id,
    userId: "local-user",
    lessonId: "zjzh-1-1",
    unitType,
    unitId: paragraph?.id || item.id || id,
    referenceText,
    createdAt: new Date().toISOString(),
    media: {
      mimeType: state.recordingWavBlob?.type || blob.type || "audio/webm",
      sizeBytes: state.recordingWavBlob?.size || blob.size,
      durationMs: Math.max(0, Date.now() - state.recordingStartedAt),
    },
    storage: {
      provider: "tencent-cos",
      status: "local",
      objectKey: null,
      url: null,
    },
    assessments: [
      {
        provider: "tencent-soe",
        status: "pending",
        mode: unitType === "paragraphReading" ? "paragraph" : "sentence",
        result: null,
      },
      {
        provider: "deepseek",
        status: "pending",
        mode: "learning-advice",
        result: null,
      },
    ],
    consent: {
      uploadAllowed: false,
      consentedAt: null,
    },
  };
}

function persistRecordingRecord(record) {
  const records = readStoredJson("digitalBookRecordingRecords", []);
  records.push(record);
  localStorage.setItem(
    "digitalBookRecordingRecords",
    JSON.stringify(records.slice(-100)),
  );
}

function stopRecordedAudio() {
  if (!state.recordingPlaybackAudio) return;
  state.recordingPlaybackAudio.pause();
  state.recordingPlaybackAudio.currentTime = 0;
  state.recordingPlaybackAudio = null;
  syncVoiceOrbStates();
}

function playRecordedAudio() {
  if (state.aiWork.active) return;
  if (!state.recordingUrl) return;
  if (state.recordingPlaybackAudio?.paused === false) {
    stopRecordedAudio();
    return;
  }
  stopAudio();
  const playback = new Audio(state.recordingUrl);
  state.recordingPlaybackAudio = playback;
  const replayOrb = findVoiceOrb("replay");
  replayOrb?.attachMediaElement(playback);
  playback.addEventListener("play", syncVoiceOrbStates);
  playback.addEventListener("pause", syncVoiceOrbStates);
  playback.addEventListener("ended", () => {
    state.recordingPlaybackAudio = null;
    syncVoiceOrbStates();
  });
  playback.addEventListener("error", () => {
    state.recordingStatus = "录音暂时无法播放，请重新录制。";
    state.recordingPlaybackAudio = null;
    refreshRecordingView();
  });
  void playback.play();
}

function assessmentConsentGranted(kind) {
  return Array.from(document.querySelectorAll(`[data-assessment-consent="${kind}"]`)).some((input) => input.checked);
}

function requireAssessmentReady(kind) {
  if (!window.LearningApi?.isConfigured() || !window.LearningApi.token()) throw new Error("请先登录，再使用 AI 测评");
  if (state.aiWork.active) throw new Error("已有一个 AI 任务正在进行，请等待完成");
  if (!assessmentConsentGranted(kind)) throw new Error("请先勾选同意上传和测评");
}

function enforceWritingCooldown(key) {
  const now = Date.now();
  const elapsed = now - Number(state.lastAssessmentSubmissions[key] || 0);
  if (elapsed < 10000) throw new Error(`请等待 ${Math.ceil((10000 - elapsed) / 1000)} 秒后再提交书写测评`);
  state.lastAssessmentSubmissions[key] = now;
}

async function assessRecording() {
  let ownsAiWork = false;
  try {
    requireAssessmentReady("recording");
    if (recordingQuota().remaining <= 0) throw new Error("本学习点的两次正式口语测评已经用完");
    if (!state.recordingWavBlob || !state.recordingRecord) throw new Error("请先完成一次跟读录音");
    state.recordingAssessment = { status: "working", phase: "preparing", result: null, message: "" };
    setAiWork(true, "preparing");
    ownsAiWork = true;
    state.recordingStatus = "录音正在上传并交给 SOE-N 测评…";
    refreshRecordingView();
    const record = state.recordingRecord;
    const result = await window.LearningApi.assessArtifact(state.recordingWavBlob, {
      kind: "recording",
      artifactId: record.artifactId,
      lessonId: record.lessonId,
      unitType: record.unitType,
      unitId: record.unitId,
      referenceText: record.referenceText,
      locale: effectiveFeedbackLocale(),
      mode: record.assessments[0].mode,
    }, { onProgress: (phase) => {
      state.recordingAssessment.phase = phase;
      setAiWork(true, phase);
      refreshRecordingView();
    } });
    state.recordingAssessment = { status: "ready", result, message: "" };
    if (result.quota) state.assessmentUsage[recordingQuota().key] = result.quota.limit - result.quota.remaining;
    state.recordingStatus = "测评完成，录音已保存到个人 COS 学习记录。";
  } catch (error) {
    state.recordingAssessment = { status: "error", result: null, message: error.message || "口语测评失败" };
    state.recordingStatus = "本地录音仍然保留，可以重试测评。";
  }
  if (ownsAiWork) setAiWork(false);
  refreshRecordingView();
}

function dataUrlToBlob(dataUrl) {
  const [header, encoded] = String(dataUrl).split(",");
  const mimeType = header.match(/data:([^;]+)/)?.[1] || "image/png";
  const bytes = Uint8Array.from(atob(encoded || ""), (character) => character.charCodeAt(0));
  return new Blob([bytes], { type: mimeType });
}

async function analyzeWritingImage(dataUrl) {
  const image = await loadWritingImage(dataUrl);
  const canvas = document.createElement("canvas");
  canvas.width = 160;
  canvas.height = 160;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  context.fillStyle = "#fff";
  context.fillRect(0, 0, 160, 160);
  context.drawImage(image, 0, 0, 160, 160);
  const pixels = context.getImageData(0, 0, 160, 160).data;
  let count = 0;
  let sumX = 0;
  let sumY = 0;
  let minX = 160;
  let minY = 160;
  let maxX = 0;
  let maxY = 0;
  for (let index = 0; index < pixels.length; index += 4) {
    const darkness = 255 - (pixels[index] + pixels[index + 1] + pixels[index + 2]) / 3;
    if (pixels[index + 3] < 40 || darkness < 45) continue;
    const pixel = index / 4;
    const x = pixel % 160;
    const y = Math.floor(pixel / 160);
    count += 1;
    sumX += x;
    sumY += y;
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
  }
  return {
    inkRatio: Math.round((count / 25600) * 1000) / 10,
    centerOffsetX: count ? Math.round(((sumX / count - 79.5) / 80) * 100) / 100 : 0,
    centerOffsetY: count ? Math.round(((sumY / count - 79.5) / 80) * 100) / 100 : 0,
    widthRatio: count ? Math.round(((maxX - minX + 1) / 160) * 100) / 100 : 0,
    heightRatio: count ? Math.round(((maxY - minY + 1) / 160) * 100) / 100 : 0,
  };
}

async function expectedStrokeCounts(characters) {
  return Promise.all(characters.map(async (character) => {
    try {
      const bundled = window.DIGITAL_BOOK_STROKE_DATA?.[character];
      if (bundled) return bundled.strokes?.length || null;
      const response = await fetch(`${STROKE_DATA_ROOT}/${encodeURIComponent(character)}.json`);
      if (!response.ok) return null;
      return (await response.json()).strokes?.length || null;
    } catch { return null; }
  }));
}

async function assessWordWriting() {
  const writing = state.wordWriting;
  let ownsAiWork = false;
  try {
    requireAssessmentReady("word-writing");
    if (!writing.artifactBlob || !writing.artifactUrl) throw new Error("请先生成整词书写图片");
    enforceWritingCooldown(`word:${writing.wordId}`);
    writing.assessment = { status: "working", phase: "preparing", result: null, message: "" };
    setAiWork(true, "preparing");
    ownsAiWork = true;
    renderWordWritingDialog();
    const word = currentItem();
    const [layout, expected] = await Promise.all([
      Promise.all(writing.images.map(analyzeWritingImage)),
      expectedStrokeCounts(writing.characters),
    ]);
    const result = await window.LearningApi.assessArtifact(writing.artifactBlob, {
      kind: "handwriting",
      artifactId: window.crypto?.randomUUID?.() || `writing-${Date.now()}`,
      lessonId: "zjzh-1-1",
      unitType: "vocabularyWriting",
      unitId: `${word.id}-writing`,
      referenceText: word.hanzi,
      locale: effectiveFeedbackLocale(),
      metrics: { characters: writing.characters, recordedStrokeCounts: writing.strokeCounts, expectedStrokeCounts: expected, layout },
    }, { onProgress: (phase) => {
      const displayPhase = assessmentPhaseFor("handwriting", phase);
      writing.assessment.phase = displayPhase;
      setAiWork(true, displayPhase);
      renderWordWritingDialog();
    } });
    writing.assessment = { status: "ready", result, message: "" };
  } catch (error) {
    writing.assessment = { status: "error", result: null, message: error.message || "书写测评失败" };
  }
  if (ownsAiWork) setAiWork(false);
  renderWordWritingDialog();
  initializeWordWritingCharacter();
}

async function combineHandwritingCells(cells) {
  const columns = Math.min(8, Math.max(1, cells.length));
  const rows = Math.ceil(cells.length / columns);
  const cellSize = 180;
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(600, columns * cellSize);
  canvas.height = Math.max(800, rows * cellSize);
  const context = canvas.getContext("2d");
  context.fillStyle = "#fff";
  context.fillRect(0, 0, canvas.width, canvas.height);
  const images = await Promise.all(cells.map(loadWritingImage));
  const left = Math.floor((canvas.width - columns * cellSize) / 2);
  images.forEach((image, index) => {
    const x = left + (index % columns) * cellSize;
    const y = Math.floor(index / columns) * cellSize;
    drawTianGrid(context, x, y, cellSize);
    context.drawImage(image, x, y, cellSize, cellSize);
  });
  return new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
}

async function assessPracticeHandwriting() {
  const item = currentItem();
  const draft = handwritingDraft(item.id);
  let ownsAiWork = false;
  try {
    requireAssessmentReady("practice-writing");
    if (!draft.saved || !draft.cells.length) throw new Error("请先保存手写答案");
    enforceWritingCooldown(`practice:${item.id}`);
    draft.assessment = { status: "working", phase: "preparing", result: null, message: "" };
    setAiWork(true, "preparing");
    ownsAiWork = true;
    refreshPracticeWritingPanel();
    const [blob, layout] = await Promise.all([combineHandwritingCells(draft.cells), Promise.all(draft.cells.map(analyzeWritingImage))]);
    const result = await window.LearningApi.assessArtifact(blob, {
      kind: "handwriting",
      artifactId: window.crypto?.randomUUID?.() || `practice-writing-${Date.now()}`,
      lessonId: "zjzh-1-1",
      unitType: "practiceHandwriting",
      unitId: item.id,
      referenceText: `第${item.questionNumber}题手写作文`,
      locale: effectiveFeedbackLocale(),
      metrics: {
        questionNumber: item.questionNumber,
        prompt: item.prompt,
        requiredVocabulary: item.requiredVocabulary || [],
        referencePoints: item.answer?.referencePoints || [],
        rubric: item.answer?.rubric || [],
        characterCount: draft.cells.length,
        recordedStrokeCounts: draft.strokeCounts,
        layout,
      },
    }, { onProgress: (phase) => {
      const displayPhase = assessmentPhaseFor("handwritten-essay", phase);
      draft.assessment.phase = displayPhase;
      setAiWork(true, displayPhase);
      refreshPracticeWritingPanel();
    } });
    draft.assessment = { status: "ready", result, message: "" };
  } catch (error) {
    draft.assessment = { status: "error", result: null, message: error.message || "书写测评失败" };
  }
  if (ownsAiWork) setAiWork(false);
  refreshPracticeWritingPanel();
}

async function assessPracticeKeyboard() {
  const item = currentItem();
  const assessment = keyboardAssessment(item.id);
  let ownsAiWork = false;
  try {
    requireAssessmentReady("practice-keyboard");
    const answer = String(state.answers[item.id] || "").trim();
    if (!answer) throw new Error("请先完成键盘作答并提交");
    enforceWritingCooldown(`practice-keyboard:${item.id}`);
    state.keyboardAssessments[item.id] = { status: "working", phase: "preparing", result: null, message: "" };
    setAiWork(true, "preparing");
    ownsAiWork = true;
    renderPracticeUnit(item, currentIndex());
    const blob = new Blob([JSON.stringify({ text: answer })], { type: "application/json" });
    const result = await window.LearningApi.assessArtifact(blob, {
      kind: "essay",
      artifactId: window.crypto?.randomUUID?.() || `practice-keyboard-${Date.now()}`,
      lessonId: "zjzh-1-1",
      unitType: "practiceWriting",
      unitId: item.id,
      referenceText: answer,
      locale: effectiveFeedbackLocale(),
      metrics: {
        questionNumber: item.questionNumber,
        prompt: item.prompt,
        requiredVocabulary: item.requiredVocabulary || [],
        referencePoints: item.answer?.referencePoints || [],
        rubric: item.answer?.rubric || [],
      },
    }, { onProgress: (phase) => {
      const displayPhase = assessmentPhaseFor("writing", phase);
      state.keyboardAssessments[item.id].phase = displayPhase;
      setAiWork(true, displayPhase);
      renderPracticeUnit(item, currentIndex());
    } });
    state.keyboardAssessments[item.id] = { status: "ready", result, message: "" };
  } catch (error) {
    state.keyboardAssessments[item.id] = { status: "error", result: null, message: error.message || "写作测评失败" };
  }
  if (ownsAiWork) setAiWork(false);
  renderPracticeUnit(item, currentIndex());
}

function handleCommand(command) {
  if (command === "play") {
    if (!elements.audio.paused && state.audioMode === "single") stopAudio();
    else void playCurrent("single");
  } else if (command === "record") {
    void toggleRecording();
  } else if (command === "open-shadow") {
    state.assistTab = "shadow";
    renderAssistTabs();
    renderAssistContent();
    initializeVoiceOrbs();
    if (window.matchMedia("(max-width: 900px)").matches) {
      elements.assistZone.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  } else if (command === "open-word-writing") {
    openWordWritingDialog();
  } else if (command === "play-recording") {
    playRecordedAudio();
  } else if (command === "assess-recording") {
    void assessRecording();
  } else if (command === "skip-paragraph-reading") {
    localStorage.setItem("digitalBookParagraphReadingChoice", "skipped");
    moveUnit(1);
  } else if (["mastered", "review", "favorite"].includes(command)) {
    toggleWordStatus(command);
  } else if (command === "submit-answer") {
    submitPractice();
  } else if (command === "clear-answer") {
    const item = currentItem();
    state.answers[item.id] = "";
    delete state.submitted[item.id];
    localStorage.setItem("digitalBookPracticeAnswers", JSON.stringify(state.answers));
    localStorage.setItem(
      "digitalBookPracticeSubmitted",
      JSON.stringify(state.submitted),
    );
    renderPracticeUnit(item, currentIndex());
  } else if (command === "clear-handwriting") {
    clearHandwritingCanvas();
  } else if (command === "open-practice-writing") {
    openPracticeWritingPanel();
  } else if (command === "close-practice-writing") {
    closePracticeWritingPanel();
  } else if (command === "toggle-practice-writing-fullscreen") {
    togglePracticeWritingFullscreen();
  } else if (command === "confirm-handwriting") {
    confirmHandwritingCell();
  } else if (command === "remove-handwriting") {
    removeHandwritingCell();
  } else if (command === "save-handwriting") {
    saveHandwritingAnswer();
  } else if (command === "assess-practice-handwriting") {
    void assessPracticeHandwriting();
  } else if (command === "assess-practice-keyboard") {
    void assessPracticeKeyboard();
  }
}

function bindEvents() {
  document.addEventListener("change", (event) => {
    if (!event.target.matches("[data-feedback-language]")) return;
    state.feedbackPreference = event.target.value;
    localStorage.setItem("digitalBookFeedbackLanguage", state.feedbackPreference);
    document.querySelectorAll("[data-feedback-language]").forEach((select) => { select.value = state.feedbackPreference; });
  });
  document.querySelectorAll("[data-section]").forEach((button) => {
    button.addEventListener("click", () => setSection(button.dataset.section));
  });
  document.querySelectorAll("[data-assist-mode]").forEach((button) => {
    button.addEventListener("click", () => {
      state.assistMode = button.dataset.assistMode;
      localStorage.setItem("digitalBookAssistMode", state.assistMode);
      render();
    });
  });
  elements.languageSelect.addEventListener("change", () => {
    state.locale = elements.languageSelect.value;
    localStorage.setItem("digitalBookLocale", state.locale);
    render();
  });
  elements.unitSelect.addEventListener("change", () => {
    stopAudio();
    closePracticeWritingPanel();
    state.indices[state.section] = Number(elements.unitSelect.value);
    state.assistTab = "understand";
    state.quizResult = null;
    resetRecordingForUnit();
    render();
    window.scrollTo({ top: 0, behavior: "smooth" });
  });
  elements.previous.addEventListener("click", () => moveUnit(-1));
  elements.next.addEventListener("click", () => moveUnit(1));
  elements.unitContent.addEventListener("click", (event) => {
    const paragraphIndex = event.target.closest("[data-reading-paragraph]")?.dataset.readingParagraph;
    if (paragraphIndex !== undefined) {
      stopAudio();
      resetRecordingForUnit();
      state.readingParagraphIndex = Number(paragraphIndex);
      render();
      return;
    }
    const answerMode = event.target.closest("[data-answer-mode]")?.dataset.answerMode;
    if (answerMode) {
      setAnswerMode(answerMode);
      return;
    }
    const command = event.target.closest("[data-command]")?.dataset.command;
    if (command) handleCommand(command);
  });
  elements.unitContent.addEventListener("input", (event) => {
    if (event.target.id !== "practiceAnswer") return;
    state.answers[currentItem().id] = event.target.value;
    localStorage.setItem("digitalBookPracticeAnswers", JSON.stringify(state.answers));
  });
  elements.assistTabs.addEventListener("click", (event) => {
    const tab = event.target.closest("[data-assist-tab]")?.dataset.assistTab;
    if (!tab) return;
    state.assistTab = tab;
    renderAssistTabs();
    renderAssistContent();
    initializeVoiceOrbs();
    if (tab === "write" && state.section === "vocabulary") {
      openWordWritingDialog();
    }
  });
  elements.assistContent.addEventListener("click", (event) => {
    const commandElement = event.target.closest("[data-command]");
    const command = commandElement?.dataset.command;
    if (command) {
      if (command === "deep-assist") {
        try { void requestDeepAssist(JSON.parse(commandElement.dataset.deepRequest)); }
        catch { /* Ignore malformed DOM data. */ }
        return;
      }
      handleCommand(command);
      return;
    }
    const option = event.target.closest("[data-quiz-option]")?.dataset.quizOption;
    if (option) {
      state.quizResult = option;
      renderAssistContent();
    }
  });
  elements.writingContent.addEventListener("click", (event) => {
    const characterIndex = event.target.closest("[data-writing-character]")?.dataset.writingCharacter;
    if (characterIndex !== undefined) {
      state.wordWriting.characterIndex = Number(characterIndex);
      renderWordWritingDialog();
      initializeWordWritingCharacter();
      return;
    }
    const command = event.target.closest("[data-writing-command]")?.dataset.writingCommand;
    if (command) handleWordWritingCommand(command);
  });
  elements.writingDialog.addEventListener("click", (event) => {
    if (event.target === elements.writingDialog) closeWordWritingDialog();
  });
  elements.writingDialog.addEventListener("close", () => {
    state.wordWriting.writer?.cancelAnimation?.();
  });
  elements.practiceWritingContent.addEventListener("click", (event) => {
    const command = event.target.closest("[data-command]")?.dataset.command;
    if (command) handleCommand(command);
  });
  elements.practiceWritingContent.addEventListener("pointerdown", (event) => {
    const handle = event.target.closest("[data-writing-drag-handle]");
    if (!handle || event.target.closest("button") || state.practiceWritingFullscreen) return;
    const rect = elements.practiceWritingPanel.getBoundingClientRect();
    state.practiceWritingDrag = {
      pointerId: event.pointerId,
      offsetX: event.clientX - rect.left,
      offsetY: event.clientY - rect.top,
    };
    elements.practiceWritingPanel.style.left = `${rect.left}px`;
    elements.practiceWritingPanel.style.top = `${rect.top}px`;
    elements.practiceWritingPanel.style.right = "auto";
    handle.setPointerCapture(event.pointerId);
  });
  window.addEventListener("pointermove", (event) => {
    const drag = state.practiceWritingDrag;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const panel = elements.practiceWritingPanel;
    const maxLeft = Math.max(8, window.innerWidth - panel.offsetWidth - 8);
    const maxTop = Math.max(8, window.innerHeight - panel.offsetHeight - 8);
    panel.style.left = `${Math.min(maxLeft, Math.max(8, event.clientX - drag.offsetX))}px`;
    panel.style.top = `${Math.min(maxTop, Math.max(8, event.clientY - drag.offsetY))}px`;
  });
  window.addEventListener("pointerup", (event) => {
    if (state.practiceWritingDrag?.pointerId === event.pointerId) {
      state.practiceWritingDrag = null;
    }
  });
  elements.play.addEventListener("click", () => {
    if (state.aiWork.active) return;
    if (!elements.audio.paused) stopAudio();
    else void playCurrent("single");
  });
  elements.continuous.addEventListener("click", () => {
    if (state.aiWork.active) return;
    if (!elements.audio.paused && state.audioMode === "continuous") stopAudio();
    else void playCurrent("continuous");
  });
  elements.loop.addEventListener("click", () => {
    state.loopCurrent = !state.loopCurrent;
    elements.loop.classList.toggle("active", state.loopCurrent);
    elements.loop.setAttribute("aria-pressed", String(state.loopCurrent));
  });
  elements.audio.addEventListener("timeupdate", handleTimeUpdate);
  elements.audio.addEventListener("play", updateAudioLabels);
  elements.audio.addEventListener("pause", updateAudioLabels);
  elements.audio.addEventListener("ended", stopAudio);
  elements.seek.addEventListener("input", () => {
    if (!Number.isFinite(elements.audio.duration)) return;
    elements.audio.currentTime =
      (Number(elements.seek.value) / 1000) * elements.audio.duration;
  });
  elements.speed.addEventListener("change", () => {
    elements.audio.playbackRate = Number(elements.speed.value);
  });
  window.addEventListener("keydown", (event) => {
    const tag = event.target.tagName;
    if (["INPUT", "TEXTAREA", "SELECT"].includes(tag)) return;
    if (event.key === "ArrowLeft") moveUnit(-1);
    if (event.key === "ArrowRight") moveUnit(1);
  });
  window.addEventListener("beforeunload", () => {
    stopRecordedAudio();
    destroyVoiceOrbs();
    if (state.recordingUrl) URL.revokeObjectURL(state.recordingUrl);
    state.recordingStream?.getTracks().forEach((track) => track.stop());
  });
}

function truncate(value, length) {
  const text = String(value).replace(/\s+/g, " ");
  return text.length > length ? `${text.slice(0, length)}…` : text;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function escapeAttribute(value) {
  return escapeHtml(value);
}

async function start() {
  initializeLanguageOptions();
  bindEvents();
  observeBilingualButtons();
  try {
    await loadData();
    await loadClassSettings();
    await loadAssessmentUsage();
    render();
  } catch (error) {
    elements.unitContent.innerHTML =
      `<p class="load-error">数字书数据加载失败：${escapeHtml(error.message)}</p>`;
  }
}

async function loadClassSettings() {
  if (!window.LearningApi?.isConfigured() || !window.LearningApi.token()) return;
  try {
    const response = await window.LearningApi.classSettings();
    state.classSettings = { ...state.classSettings, ...(response.settings || {}) };
  } catch {
    state.classSettings = { writingInputMode: "both" };
  }
}

start();
