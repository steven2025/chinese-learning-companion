"use strict";

const ROUND_SIZE = 5;
const RUNTIME_DATA_ROOT = window.HANZI_COMPANION_CONFIG?.runtimeDataRoot || "../../data";
const CATALOG_URL = `${RUNTIME_DATA_ROOT}/games/word-link/catalog-v2.json`;
const LANGUAGES = [
  ["en", "English"],
  ["th", "ไทย"],
  ["vi", "Tiếng Việt"],
  ["lo", "ພາສາລາວ"],
  ["fr", "Français"],
  ["ja", "日本語"],
  ["ko", "한국어"],
  ["ru", "Русский"],
  ["de", "Deutsch"],
  ["es", "Español"],
  ["id", "Bahasa Indonesia"],
  ["ms", "Bahasa Melayu"],
  ["my", "မြန်မာဘာသာ"]
];

const elements = {
  loading: document.getElementById("loadingLayer"),
  sourceButtons: [...document.querySelectorAll("[data-source]")],
  language: document.getElementById("languageSelect"),
  sourceKicker: document.getElementById("sourceKicker"),
  setTitle: document.getElementById("setTitle"),
  lessonIndex: document.getElementById("lessonIndex"),
  book: document.getElementById("bookSelect"),
  lesson: document.getElementById("lessonSelect"),
  roundLabel: document.getElementById("roundLabel"),
  progressFill: document.getElementById("progressFill"),
  wordProgress: document.getElementById("wordProgress"),
  score: document.getElementById("scoreValue"),
  mistakes: document.getElementById("mistakeValue"),
  feedback: document.getElementById("feedback"),
  columns: {
    hanzi: document.getElementById("hanziColumn"),
    pinyin: document.getElementById("pinyinColumn"),
    meaning: document.getElementById("meaningColumn")
  },
  hint: document.getElementById("hintButton"),
  shuffle: document.getElementById("shuffleButton"),
  sound: document.getElementById("soundButton"),
  dialog: document.getElementById("roundDialog"),
  resultKicker: document.getElementById("resultKicker"),
  resultTitle: document.getElementById("resultTitle"),
  roundScore: document.getElementById("roundScore"),
  resultText: document.getElementById("resultText"),
  nextRound: document.getElementById("nextRoundButton"),
  replay: document.getElementById("replayButton")
};

const state = {
  catalog: null,
  allWords: [],
  lessonCatalog: [],
  source: "developing",
  words: [],
  round: 0,
  roundWords: [],
  matched: new Set(),
  selected: { hanzi: null, pinyin: null, meaning: null },
  score: 0,
  mistakes: 0,
  roundStartScore: 0,
  language: localStorage.getItem("wordLinkLanguage") || "en",
  sound: localStorage.getItem("wordLinkSound") !== "off",
  loadToken: 0
};

function shuffle(items) {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const target = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[target]] = [copy[target], copy[index]];
  }
  return copy;
}

function normalizeWord(word, index) {
  const hanzi = String(word.hanzi || word.cn || "").trim();
  const pinyin = String(word.pinyin || word.py || "").trim();
  const translations = word.translations || word.meanings || {};
  if (!hanzi || !pinyin || !translations.en) return null;
  return {
    id: String(word.id || `word-${index + 1}`),
    hanzi,
    pinyin,
    translations
    , lessonId: word.lessonId || ""
  };
}

function applyLessonIndex({ reset = true } = {}) {
  if (state.source !== "developing" || !state.lessonCatalog.length) {
    elements.lessonIndex.hidden = true;
    state.words = state.allWords;
    return;
  }
  elements.lessonIndex.hidden = false;
  const books = [...new Map(state.lessonCatalog.map((item) => [item.bookId, item.bookTitle])).entries()];
  const requestedLesson = new URL(location.href).searchParams.get("lesson");
  const requestedBook = state.lessonCatalog.find((item) => item.lessonId === requestedLesson)?.bookId;
  const bookId = requestedBook || elements.book.value || books[0][0];
  elements.book.innerHTML = books.map(([id, title]) => `<option value="${id}"${id === bookId ? " selected" : ""}>${title}</option>`).join("");
  const lessons = state.lessonCatalog.filter((item) => item.bookId === bookId);
  const lessonId = requestedLesson && lessons.some((item) => item.lessonId === requestedLesson) ? requestedLesson : elements.lesson.value || "all";
  elements.lesson.innerHTML = `<option value="all">本册全部课程</option>${lessons.map((item) => `<option value="${item.lessonId}"${item.lessonId === lessonId ? " selected" : ""}>${item.title}</option>`).join("")}`;
  const selected = elements.lesson.value;
  state.words = state.allWords.filter((word) => selected === "all" ? lessons.some((item) => item.lessonId === word.lessonId) : word.lessonId === selected);
  elements.sourceKicker.textContent = `发展汉语 · ${lessons[0].bookTitle}`;
  elements.setTitle.textContent = selected === "all" ? "本册已收录课程" : lessons.find((item) => item.lessonId === selected)?.title || "教材词汇";
  if (reset) { state.round = 0; state.score = 0; state.mistakes = 0; renderRound(); }
}

function normalizePayload(payload, schema) {
  const rows = schema === "lesson-vocabulary" ? payload.entries : payload.words;
  if (!Array.isArray(rows)) throw new Error("词库中没有可用的 words 或 entries 数组");
  const words = rows.map(normalizeWord).filter(Boolean);
  if (words.length < 3) throw new Error("有效词语不足，至少需要三个词");
  return words;
}

async function fetchJson(url) {
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) throw new Error(`读取失败 (${response.status})`);
  return response.json();
}

function setupLanguages() {
  elements.language.replaceChildren();
  LANGUAGES.forEach(([code, label]) => {
    const option = document.createElement("option");
    option.value = code;
    option.textContent = label;
    elements.language.append(option);
  });
  if (!LANGUAGES.some(([code]) => code === state.language)) state.language = "en";
  elements.language.value = state.language;
}

function meaningFor(word) {
  return word.translations[state.language] || word.translations.en || "";
}

async function loadSource(sourceKey) {
  const token = ++state.loadToken;
  elements.loading.hidden = false;
  elements.dialog.hidden = true;
  try {
    if (!state.catalog) state.catalog = await fetchJson(CATALOG_URL);
    const source = state.catalog.sources[sourceKey] || state.catalog.sources.developing;
    const payload = await fetchJson(new URL(source.dataUrl, new URL(CATALOG_URL, window.location.href)).href);
    if (token !== state.loadToken) return;

    state.source = sourceKey in state.catalog.sources ? sourceKey : "developing";
    state.allWords = normalizePayload(payload, source.schema);
    state.lessonCatalog = payload.lessonCatalog || [];
    state.words = state.allWords;
    state.round = 0;
    state.score = 0;
    state.mistakes = 0;
    state.roundStartScore = 0;
    elements.sourceKicker.textContent = source.kicker;
    elements.setTitle.textContent = source.title;
    elements.sourceButtons.forEach((button) => {
      button.setAttribute("aria-pressed", String(button.dataset.source === state.source));
    });
    const url = new URL(window.location.href);
    url.searchParams.set("source", state.source);
    history.replaceState(null, "", url);
    localStorage.setItem("wordLinkSource", state.source);
    applyLessonIndex({ reset: false });
    renderRound();
  } catch (error) {
    elements.feedback.textContent = `词库读取失败：${error.message}`;
    clearColumns();
  } finally {
    if (token === state.loadToken) elements.loading.hidden = true;
  }
}

elements.book.addEventListener("change", () => { elements.lesson.value = "all"; const url = new URL(location.href); url.searchParams.delete("lesson"); history.replaceState(null, "", url); applyLessonIndex(); });
elements.lesson.addEventListener("change", () => { const url = new URL(location.href); if (elements.lesson.value === "all") url.searchParams.delete("lesson"); else url.searchParams.set("lesson", elements.lesson.value); history.replaceState(null, "", url); applyLessonIndex(); });

function clearColumns() {
  Object.values(elements.columns).forEach((column) => column.replaceChildren());
}

function createTile(kind, word) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "word-tile";
  button.dataset.kind = kind;
  button.dataset.wordId = word.id;
  button.textContent = kind === "hanzi" ? word.hanzi : kind === "pinyin" ? word.pinyin : meaningFor(word);
  button.addEventListener("click", () => selectTile(button));
  return button;
}

function renderRound() {
  clearColumns();
  state.matched.clear();
  state.selected = { hanzi: null, pinyin: null, meaning: null };
  state.roundStartScore = state.score;
  const start = state.round * ROUND_SIZE;
  state.roundWords = state.words.slice(start, start + ROUND_SIZE);
  if (!state.roundWords.length) {
    state.round = 0;
    state.roundWords = state.words.slice(0, ROUND_SIZE);
  }

  ["hanzi", "pinyin", "meaning"].forEach((kind) => {
    shuffle(state.roundWords).forEach((word) => elements.columns[kind].append(createTile(kind, word)));
  });
  updateHud();
  elements.feedback.textContent = "每列选择一项，组成同一个词。";
}

function updateHud() {
  const totalRounds = Math.ceil(state.words.length / ROUND_SIZE);
  const completedBeforeRound = state.round * ROUND_SIZE;
  const completed = Math.min(state.words.length, completedBeforeRound + state.matched.size);
  elements.roundLabel.textContent = `第 ${state.round + 1} / ${totalRounds} 轮`;
  elements.wordProgress.textContent = `${completed} / ${state.words.length}`;
  elements.progressFill.style.width = `${state.words.length ? (completed / state.words.length) * 100 : 0}%`;
  elements.score.textContent = state.score;
  elements.mistakes.textContent = state.mistakes;
}

function selectedButton(kind) {
  const id = state.selected[kind];
  return id ? elements.columns[kind].querySelector(`[data-word-id="${CSS.escape(id)}"]`) : null;
}

function selectTile(button) {
  sound.play("tap");
  const kind = button.dataset.kind;
  const previous = selectedButton(kind);
  if (previous === button) {
    previous.classList.remove("selected");
    state.selected[kind] = null;
    return;
  }
  previous?.classList.remove("selected");
  button.classList.add("selected");
  state.selected[kind] = button.dataset.wordId;
  if (Object.values(state.selected).every(Boolean)) checkSelection();
}

function checkSelection() {
  const ids = Object.values(state.selected);
  const buttons = Object.keys(state.selected).map(selectedButton).filter(Boolean);
  if (new Set(ids).size === 1) {
    state.score += 100;
    state.matched.add(ids[0]);
    sound.play("correct");
    elements.feedback.textContent = "连接正确！继续找下一组。";
    buttons.forEach((button) => {
      button.classList.remove("selected");
      button.classList.add("matched");
      window.setTimeout(() => button.remove(), 250);
    });
    resetSelection();
    updateHud();
    if (state.matched.size === state.roundWords.length) window.setTimeout(showRoundResult, 360);
    return;
  }

  state.mistakes += 1;
  state.score = Math.max(0, state.score - 20);
  sound.play("wrong");
  elements.feedback.textContent = "这三项不是同一个词，再比较一下。";
  buttons.forEach((button) => button.classList.add("wrong"));
  window.setTimeout(() => {
    buttons.forEach((button) => button.classList.remove("wrong", "selected"));
    resetSelection();
  }, 420);
  updateHud();
}

function resetSelection() {
  state.selected = { hanzi: null, pinyin: null, meaning: null };
}

function showRoundResult() {
  const finalRound = (state.round + 1) * ROUND_SIZE >= state.words.length;
  const earned = state.score - state.roundStartScore;
  elements.resultKicker.textContent = finalRound ? "词库完成" : "本轮完成";
  elements.resultTitle.textContent = finalRound ? "本词库已经全部连对" : `${state.roundWords.length}组词语全部连对了`;
  elements.roundScore.textContent = `${earned >= 0 ? "+" : ""}${earned}`;
  elements.resultText.textContent = `当前总分 ${state.score}，累计失误 ${state.mistakes} 次。`;
  elements.nextRound.querySelector("b").textContent = finalRound ? "再练一次" : "下一轮";
  elements.nextRound.querySelector("small").textContent = finalRound ? "Play again" : "Next round";
  elements.nextRound.dataset.final = String(finalRound);
  elements.dialog.hidden = false;
  sound.play(finalRound ? "finish" : "round");
}

function showHint() {
  const remaining = state.roundWords.filter((word) => !state.matched.has(word.id));
  if (!remaining.length) return;
  const word = remaining[Math.floor(Math.random() * remaining.length)];
  ["hanzi", "pinyin", "meaning"].forEach((kind) => {
    const tile = elements.columns[kind].querySelector(`[data-word-id="${CSS.escape(word.id)}"]`);
    tile?.classList.add("hint");
    window.setTimeout(() => tile?.classList.remove("hint"), 1600);
  });
  state.score = Math.max(0, state.score - 10);
  elements.feedback.textContent = "已短暂标出一组正确连接。";
  updateHud();
  sound.play("hint");
}

function reshuffle() {
  ["hanzi", "pinyin", "meaning"].forEach((kind) => {
    const column = elements.columns[kind];
    shuffle([...column.children]).forEach((tile) => column.append(tile));
    [...column.children].forEach((tile) => tile.classList.remove("selected"));
  });
  resetSelection();
  elements.feedback.textContent = "三列顺序已经重新排列。";
  sound.play("shuffle");
}

const sound = {
  context: null,
  play(type) {
    if (!state.sound) return;
    try {
      this.context ||= new (window.AudioContext || window.webkitAudioContext)();
      const now = this.context.currentTime;
      const notes = {
        tap: [[330, .035]],
        correct: [[523, .08], [659, .1]],
        wrong: [[180, .09], [125, .13]],
        hint: [[440, .06], [554, .06]],
        shuffle: [[280, .04], [360, .04], [440, .05]],
        round: [[523, .07], [659, .07], [784, .12]],
        finish: [[523, .08], [659, .08], [784, .08], [1047, .18]]
      }[type] || [[330, .04]];
      let offset = 0;
      notes.forEach(([frequency, duration]) => {
        const oscillator = this.context.createOscillator();
        const gain = this.context.createGain();
        oscillator.type = type === "wrong" ? "triangle" : "sine";
        oscillator.frequency.value = frequency;
        gain.gain.setValueAtTime(.0001, now + offset);
        gain.gain.exponentialRampToValueAtTime(.12, now + offset + .008);
        gain.gain.exponentialRampToValueAtTime(.0001, now + offset + duration);
        oscillator.connect(gain).connect(this.context.destination);
        oscillator.start(now + offset);
        oscillator.stop(now + offset + duration + .01);
        offset += duration * .82;
      });
    } catch (_) {
      // Audio feedback is optional; the visual state remains authoritative.
    }
  }
};

elements.sourceButtons.forEach((button) => button.addEventListener("click", () => loadSource(button.dataset.source)));
elements.language.addEventListener("change", () => {
  state.language = elements.language.value;
  localStorage.setItem("wordLinkLanguage", state.language);
  renderRound();
});
elements.hint.addEventListener("click", showHint);
elements.shuffle.addEventListener("click", reshuffle);
elements.sound.addEventListener("click", () => {
  state.sound = !state.sound;
  localStorage.setItem("wordLinkSound", state.sound ? "on" : "off");
  elements.sound.setAttribute("aria-pressed", String(state.sound));
  if (state.sound) sound.play("tap");
});
elements.nextRound.addEventListener("click", () => {
  const finalRound = elements.nextRound.dataset.final === "true";
  if (finalRound) {
    state.round = 0;
    state.score = 0;
    state.mistakes = 0;
  } else {
    state.round += 1;
  }
  elements.dialog.hidden = true;
  renderRound();
});
elements.replay.addEventListener("click", () => {
  state.round = 0;
  state.score = 0;
  state.mistakes = 0;
  elements.dialog.hidden = true;
  renderRound();
});

setupLanguages();
elements.sound.setAttribute("aria-pressed", String(state.sound));
const requestedSource = new URLSearchParams(location.search).get("source");
loadSource(requestedSource || localStorage.getItem("wordLinkSource") || "developing");
