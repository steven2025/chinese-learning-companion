(function () {
  "use strict";

  const lessons = window.CHARACTER_LESSONS;
  const reviewedCultures = window.CHARACTER_CULTURES || {};
  const strokeData = window.HANZI_STROKE_DATA;
  const library = window.TEXTBOOK_LIBRARY;
  let currentSeries = library.series[0];
  let currentBook = currentSeries.books.find(book => book.available);
  let currentChapter = currentBook.chapters[0];
  let characters = [...currentChapter.characters];
  const ttsFunctionUrl = String(window.HANZI_COMPANION_CONFIG?.ttsFunctionUrl || "").replace(/\/$/, "");
  const essayFunctionUrl = String(window.HANZI_COMPANION_CONFIG?.essayFunctionUrl || "").replace(/\/$/, "");
  const strokeCosBaseUrl = "https://hsk-1311686407.cos.ap-guangzhou.myqcloud.com/hanzi-companion/stroke-data/v2.0.1/characters";
  const phraseCultures = {
    "十八": {
      pinyin: "shí bā", component: "词组：十八", examples: ["十八个人", "十八本书", "十八岁"],
      sections: {
        formation: { title: "“十”和“八”组合成“十八”", text: "“十八”由“十”和“八”组成。“十”在前，“八”在后，表示一个十再加八，也就是“十八”。两个字的顺序不能换。" },
        culture: { title: "数量和年龄中的“十八”", text: "“十八”可以表示数量，也可以表示年龄。例如：“十八个人”、“十八本书”、“十八岁”。说年龄时，“岁”放在数字后面。" },
        memory: { title: "先看“十”，再看“八”", text: "一个“十”加“八”就是“十八”。写这两个字时，大小要接近，中间留一点距离，不要挤在一起。" }
      }
    },
    "八十": {
      pinyin: "bā shí", component: "词组：八十", examples: ["八十个人", "八十岁", "八十分"],
      sections: {
        formation: { title: "“八”和“十”组合成“八十”", text: "“八十”由“八”和“十”组成。“八”在前，“十”在后，表示八个十，也就是“八十”。“八十”和“十八”的顺序不同，数字也不同。" },
        culture: { title: "“八十”的常见用法", text: "“八十”可以表示数量、年龄、分数或号码。例如：“八十个人”、“八十岁”、“八十分”、“八十号”。看后面的词，就能知道它表示什么。" },
        memory: { title: "看清“八十”和“十八”", text: "“八十”是八个“十”，“十八”是一个“十”加“八”。读和写的时候都要看清两个字的顺序。" }
      }
    }
  };
  const cultureAudioCache = new Map();
  const remoteContentCache = new Map();
  const remoteContentMisses = new Set();
  const localStrokePromises = new Map();
  const culturePlayer = new Audio();
  culturePlayer.preload = "none";
  const savedCultureRate = Number(localStorage.getItem("hanzi-culture-audio-rate"));
  culturePlayer.playbackRate = savedCultureRate >= 0.65 && savedCultureRate <= 1.25 ? savedCultureRate : 0.9;
  let deferredInstallPrompt = null;
  const annotationTargets = {
    "十": [{ x: .36, y: .50 }, { x: .50, y: .34 }],
    "八": [{ x: .36, y: .55 }, { x: .64, y: .55 }],
    "土": [{ x: .50, y: .40 }, { x: .50, y: .51 }, { x: .50, y: .70 }]
  };

  const uiText = {
    zh: {
      sequence: "逐笔讲解", full: "完整演示", radical: "高亮部首", focus: "书写重点",
      cultureButton: "看看这个字的文化含义", cultureHint: "构形知识与文化联想已分开标注",
      practiceNext: "动画看懂了，开始跟写", waiting: "等待落笔", writing: "正在书写", completed: "书写完成",
      clear: "清空重写", hint: "播放提示", compare: "叠加标准字", userOnly: "只看本次书写"
    },
    en: {
      sequence: "Stroke guide", full: "Full demo", radical: "Highlight radical", focus: "Writing focus",
      cultureButton: "Explore the character in culture", cultureHint: "Verified formation and memory aids are clearly separated",
      practiceNext: "Ready — start writing", waiting: "Ready", writing: "Writing", completed: "Completed",
      clear: "Rewrite", hint: "Show hint", compare: "Overlay standard", userOnly: "Show my writing"
    }
  };

  const state = {
    character: "十",
    locale: "zh",
    view: "learn",
    practiceMode: "trace",
    demoWriter: null,
    modelWriter: null,
    quizWriter: null,
    activeStroke: -1,
    mistakes: 0,
    mistakesByStroke: [],
    attempts: 0,
    capturedStrokes: [],
    currentStroke: null,
    pendingStroke: null,
    comparing: false,
    multiSelecting: false,
    selectedCharacters: [],
    phraseMode: false,
    phraseCharacters: [],
    phraseWriters: [],
    phraseEntries: [],
    phraseIndex: 0,
    cultureEntityKey: "",
    cultureAudioKey: "",
    cultureAudioLoading: false,
    cultureQueue: [],
    culturePlayAllActive: false,
    essayMode: "direct",
    essayId: "",
    essayTitle: "",
    essayText: "",
    essayCells: [],
    essaySelectedIndex: 0,
    essayPage: 0,
    essayHistory: [],
    essayVersions: [],
    essayFeedbackStale: false,
    essayDrawing: false,
    essayStroke: [],
    completed: new Set(loadProgress())
  };

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));
  function fallbackLesson(character) {
    const count = Math.max(1, strokeData[character]?.strokes?.length || 1);
    const strokes = Array.from({ length: count }, (_, index) => ({
      name: { zh: `第${index + 1}笔`, en: `Stroke ${index + 1}` }, pinyin: "", direction: "→",
      instruction: { zh: "观察动画中的起笔位置和行笔方向，再跟着书写。", en: "Watch the starting point and direction, then trace the stroke." }
    }));
    return {
      generatedFallback: true,
      pinyin: "—",
      meaning: { zh: "教材“写汉字”栏目收录", en: "Included in the textbook writing section" },
      structure: { zh: "基础书写模式 · 讲解待审核", en: "Basic writing mode · review pending" },
      strokeCount: count,
      overview: { title: { zh: "先看完整笔顺", en: "Watch the full stroke order" }, text: { zh: "本字已进入教材书写库。标准动画和跟写可以使用，详细笔画名称与文化内容将在教师审核后补充。", en: "This textbook character supports animation and tracing. Detailed teaching notes will be added after review." } },
      strokes,
      focus: { zh: "先确认笔顺，再注意字在田字格中的大小、方向和重心。", en: "Check stroke order, then focus on size, direction, and balance in the grid." },
      rules: { zh: ["按动画顺序书写", "注意起笔和收笔位置", "保持字形居中"], en: ["Follow the animation order", "Watch stroke starts and ends", "Keep the character centered"] },
      feedback: { perfect: { zh: "已完成书写。可以对照标准字继续调整结构。", en: "Completed. Compare with the model to refine the structure." }, retry: Array.from({ length: count }, () => ({ zh: "请观察这一笔的起点和方向，再试一次。", en: "Watch this stroke's starting point and direction, then try again." })) },
      culture: {
        component: { zh: "教材汉字", en: "Textbook character" }, title: { zh: "详细构形内容待审核", en: "Formation review pending" },
        verified: { zh: "本字已按教材“写汉字”栏目收录。可靠的部首、构形和文化说明将在教师审核后开放。", en: "This character comes from the textbook writing section. Reviewed formation and culture notes will be added later." },
        associationTitle: { zh: "暂不自动生成文化解释", en: "No unreviewed culture claims" }, association: { zh: "为避免错误解释，当前只提供标准笔顺、动画和跟写。", en: "To avoid unreliable claims, only stroke order, animation, and practice are available now." },
        examples: [], mnemonic: { zh: "先通过动画和田字格记住字形。", en: "Use the animation and grid to remember the form." }
      }
    };
  }
  function cultureFromRecord(record) {
    const sections = Object.fromEntries(record.sections.map(section => [section.key, {
      title: localized(section.title),
      text: localized(section.text)
    }]));
    return {
      pinyin: record.pinyin,
      component: localized(record.component),
      examples: (record.examples || []).map(example => state.locale === "zh"
        ? example.zh
        : `${example.zh} · ${example.pinyin} · ${example.en}`),
      sections
    };
  }

  function lessonFor(character) {
    const base = lessons[character] || fallbackLesson(character);
    const remoteRecord = remoteContentCache.get(`character:${character}`);
    if (remoteRecord) {
      return {
        ...base,
        pinyin: remoteRecord.pinyin,
        meaning: remoteRecord.meaning,
        structure: remoteRecord.component,
        culture: cultureFromRecord(remoteRecord)
      };
    }
    const reviewedCulture = reviewedCultures[character];
    if (!reviewedCulture || !base.generatedFallback) return base;
    return {
      ...base,
      pinyin: reviewedCulture.pinyin || base.pinyin,
      meaning: reviewedCulture.meaning || base.meaning,
      structure: { zh: reviewedCulture.component, en: reviewedCulture.component },
      culture: reviewedCulture
    };
  }
  const lesson = () => lessonFor(state.character);
  const localized = value => value?.[state.locale] ?? value?.zh ?? value ?? "";

  async function ensureRemoteContent(type, id) {
    const key = `${type}:${id}`;
    if (remoteContentCache.has(key)) return remoteContentCache.get(key);
    if (remoteContentMisses.has(key) || !ttsFunctionUrl) return null;
    try {
      const response = await fetch(`${ttsFunctionUrl}/content/resolve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, id })
      });
      const payload = await response.json().catch(() => ({}));
      if (response.status === 404) {
        remoteContentMisses.add(key);
        return null;
      }
      if (!response.ok || !payload.ok || !payload.content) throw new Error(payload.message || `内容服务返回${response.status}`);
      remoteContentCache.set(key, payload.content);
      return payload.content;
    } catch (error) {
      console.warn(`未能读取${key}的COS内容：`, error.message);
      return null;
    }
  }

  function loadProgress() {
    try { return JSON.parse(localStorage.getItem("hanzi-companion-progress-v1") || "[]"); }
    catch (_) { return []; }
  }

  function saveProgress() {
    try { localStorage.setItem("hanzi-companion-progress-v1", JSON.stringify([...state.completed])); }
    catch (_) {}
  }

  function showToast(message) {
    const toast = $("#toast");
    toast.textContent = message;
    toast.classList.add("show");
    clearTimeout(showToast.timer);
    showToast.timer = setTimeout(() => toast.classList.remove("show"), 2200);
  }

  function setupPwaInstall() {
    const installButton = $("#installAppButton");
    if (!installButton) return;
    const isStandalone = window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;
    const isIos = /iphone|ipad|ipod/i.test(window.navigator.userAgent);

    if (isIos && !isStandalone) installButton.hidden = false;
    installButton.addEventListener("click", async () => {
      if (deferredInstallPrompt) {
        deferredInstallPrompt.prompt();
        const choice = await deferredInstallPrompt.userChoice;
        deferredInstallPrompt = null;
        if (choice.outcome === "accepted") installButton.hidden = true;
        return;
      }
      if (isIos) {
        showToast("请点击 Safari 的分享按钮，再选择“添加到主屏幕” · Share → Add to Home Screen");
        return;
      }
      showToast("浏览器尚未开放安装入口，可从浏览器菜单选择“安装应用” · Install from the browser menu");
    });

    window.addEventListener("beforeinstallprompt", event => {
      event.preventDefault();
      deferredInstallPrompt = event;
      installButton.hidden = false;
    });
    window.addEventListener("appinstalled", () => {
      deferredInstallPrompt = null;
      installButton.hidden = true;
      showToast("安装完成 · App installed");
    });
  }

  async function loadLocalStrokeData(character) {
    if (strokeData[character]) return strokeData[character];
    if (!localStrokePromises.has(character)) {
      const request = fetch(`data/strokes/${encodeURIComponent(character)}.json`, { cache: "force-cache" })
        .then(async response => {
          if (response.ok) return response;
          return fetch(`${strokeCosBaseUrl}/${encodeURIComponent(character)}.json`, {
            cache: "force-cache",
            mode: "cors"
          });
        })
        .then(response => {
          if (!response.ok) throw new Error(`本地笔画数据不存在：${character}`);
          return response.json();
        })
        .then(data => { strokeData[character] = data; return data; })
        .catch(error => { localStrokePromises.delete(character); throw error; });
      localStrokePromises.set(character, request);
    }
    return localStrokePromises.get(character);
  }

  function writerOptions(size, extra = {}, character = state.character) {
    const options = {
      width: size,
      height: size,
      padding: 18,
      showOutline: true,
      showCharacter: false,
      strokeColor: "#173654",
      outlineColor: "#bfd0df",
      highlightColor: "#18bfc6",
      drawingColor: "#0aa5ae",
      drawingWidth: 9,
      strokeAnimationSpeed: 1.05,
      strokeHighlightSpeed: 1.45,
      delayBetweenStrokes: 320,
      ...extra
    };
    options.charDataLoader = char => loadLocalStrokeData(char);
    return options;
  }

  async function ensureCharacterData(character) {
    return loadLocalStrokeData(character);
  }

  function fitSize(element, cap) {
    const width = element?.getBoundingClientRect().width || cap;
    return Math.max(80, Math.min(cap, Math.floor(width)));
  }

  function destroyWriter(writer) {
    try { writer?.cancelQuiz?.(); } catch (_) {}
  }

  function clearWriterTargets() {
    destroyWriter(state.demoWriter);
    destroyWriter(state.modelWriter);
    destroyWriter(state.quizWriter);
    ["demoWriter", "modelWriter", "quizWriter"].forEach(id => { const el = document.getElementById(id); if (el) el.innerHTML = ""; });
  }

  function buildWriters() {
    clearWriterTargets();
    if (!window.HanziWriter) {
      showToast("Hanzi Writer 加载失败，请检查 vendor 文件。 ");
      return;
    }
    const demoSize = fitSize($("#demoGrid"), 550);
    state.demoWriter = HanziWriter.create("demoWriter", state.character, writerOptions(demoSize));

    const modelGrid = $("#modelWriter")?.parentElement;
    const modelSize = fitSize(modelGrid, 260);
    state.modelWriter = HanziWriter.create("modelWriter", state.character, writerOptions(modelSize));

    buildQuizWriter();
    requestAnimationFrame(syncAnnotationLines);
  }

  function normalizedPoint(event) {
    const grid = $(".tianzige.practice");
    const rect = grid?.getBoundingClientRect();
    if (!rect?.width) return null;
    return {
      x: Math.max(0, Math.min(1000, (event.clientX - rect.left) / rect.width * 1000)),
      y: Math.max(0, Math.min(1000, (event.clientY - rect.top) / rect.height * 1000))
    };
  }

  function startStrokeCapture(event) {
    if (event.button != null && event.button !== 0) return;
    const point = normalizedPoint(event);
    if (!point) return;
    state.currentStroke = [point];
    updateLiveStatus("writing");
  }

  function continueStrokeCapture(event) {
    if (!state.currentStroke) return;
    const point = normalizedPoint(event);
    if (!point) return;
    const previous = state.currentStroke[state.currentStroke.length - 1];
    if (Math.hypot(point.x - previous.x, point.y - previous.y) >= 4) state.currentStroke.push(point);
  }

  function finishStrokeCapture(event) {
    if (!state.currentStroke) return;
    const point = normalizedPoint(event);
    if (point) state.currentStroke.push(point);
    if (state.currentStroke.length > 1) state.pendingStroke = state.currentStroke;
    state.currentStroke = null;
  }

  function removeRejectedCapture() {
    state.pendingStroke = null;
  }

  function acceptCapturedStroke() {
    if (state.pendingStroke?.length > 1) state.capturedStrokes.push(state.pendingStroke);
    state.pendingStroke = null;
  }

  function smoothPath(points) {
    if (!points?.length) return "";
    if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;
    let path = `M ${points[0].x.toFixed(1)} ${points[0].y.toFixed(1)}`;
    for (let i = 1; i < points.length - 1; i += 1) {
      const midpointX = (points[i].x + points[i + 1].x) / 2;
      const midpointY = (points[i].y + points[i + 1].y) / 2;
      path += ` Q ${points[i].x.toFixed(1)} ${points[i].y.toFixed(1)} ${midpointX.toFixed(1)} ${midpointY.toFixed(1)}`;
    }
    const last = points[points.length - 1];
    return `${path} L ${last.x.toFixed(1)} ${last.y.toFixed(1)}`;
  }

  function writingStats(strokes) {
    const points = strokes.flat();
    if (!points.length) return null;
    const xs = points.map(point => point.x);
    const ys = points.map(point => point.y);
    const minX = Math.min(...xs), maxX = Math.max(...xs);
    const minY = Math.min(...ys), maxY = Math.max(...ys);
    return { minX, maxX, minY, maxY, width: maxX - minX, height: maxY - minY, centerX: (minX + maxX) / 2, centerY: (minY + maxY) / 2 };
  }

  function standardStats() {
    const medians = strokeData[state.character]?.medians || [];
    const normalized = medians.map(stroke => stroke.map(([x, y]) => ({ x: x * .9765625, y: (900 - y) * .9765625 })));
    return writingStats(normalized);
  }

  function analyzeWriting() {
    const actual = writingStats(state.capturedStrokes);
    const standard = standardStats();
    if (!actual || !standard) return { penalty: 0, label: state.locale === "zh" ? "已记录" : "Recorded", suggestion: "" };

    const dx = (actual.centerX - standard.centerX) / 1000;
    const dy = (actual.centerY - standard.centerY) / 1000;
    const widthRatio = actual.width / Math.max(standard.width, 1);
    const heightRatio = actual.height / Math.max(standard.height, 1);
    const issues = [
      { value: Math.abs(dx) / .08, zh: dx < 0 ? "整体位置略偏左，可以向田字格中心移动。" : "整体位置略偏右，可以向田字格中心移动。", en: dx < 0 ? "The character sits slightly left; move it toward the center." : "The character sits slightly right; move it toward the center." },
      { value: Math.abs(dy) / .08, zh: dy < 0 ? "整体位置略偏上，注意上下留白。" : "整体位置略偏下，注意上下留白。", en: dy < 0 ? "The character sits slightly high; balance the vertical spacing." : "The character sits slightly low; balance the vertical spacing." },
      { value: Math.abs(Math.log(Math.max(widthRatio, .1))) / .23, zh: widthRatio < 1 ? "字形略窄，可以把左右笔画写得更舒展。" : "字形略宽，可以适当收紧左右结构。", en: widthRatio < 1 ? "The form is slightly narrow; open the side strokes more." : "The form is slightly wide; tighten the side spacing." },
      { value: Math.abs(Math.log(Math.max(heightRatio, .1))) / .23, zh: heightRatio < 1 ? "字形略矮，纵向笔画可以更舒展。" : "字形略高，注意控制上下比例。", en: heightRatio < 1 ? "The form is slightly short; extend the vertical movement." : "The form is slightly tall; control the vertical proportion." }
    ];
    issues.sort((a, b) => b.value - a.value);
    const strongest = issues[0];
    const stable = strongest.value < 1;
    const penalty = Math.min(18, Math.round(issues.reduce((sum, issue) => sum + Math.max(0, issue.value - .55) * 2.4, 0)));
    return {
      penalty,
      label: stable ? (state.locale === "zh" ? "居中协调" : "Balanced") : (state.locale === "zh" ? "可调结构" : "Refine form"),
      suggestion: stable ? "" : strongest[state.locale]
    };
  }

  function renderUserWriting() {
    const preview = $("#userWritingPreview");
    const standardPaths = (strokeData[state.character]?.strokes || []).map(path => `<path class="standard-stroke" d="${path}"></path>`).join("");
    const userPaths = state.capturedStrokes.map(points => `<path class="user-stroke" d="${smoothPath(points)}"></path>`).join("");
    preview.innerHTML = `<g transform="scale(.9765625) translate(0 900) scale(1 -1)">${standardPaths}</g><g>${userPaths}</g>`;
    $("#samplePlaceholder").hidden = state.capturedStrokes.length > 0;
    $("#sampleStatus").textContent = state.locale === "zh" ? "真实轨迹" : "Captured path";
  }

  function setComparison(enabled) {
    state.comparing = enabled;
    $("#userSampleCard").classList.toggle("comparing", enabled);
    $("#compareButton").textContent = enabled ? uiText[state.locale].userOnly : uiText[state.locale].compare;
  }

  function standardPathMarkup(character, className = "", color = "#173654") {
    return (strokeData[character]?.strokes || []).map(path => `<path${className ? ` class="${className}"` : ""} d="${path}" fill="${color}"></path>`).join("");
  }

  function standardCharacterSvg(character) {
    return `<svg class="phrase-standard-svg" viewBox="0 0 1000 1000" aria-label="${character}标准字"><g transform="scale(.9765625) translate(0 900) scale(1 -1)">${standardPathMarkup(character)}</g></svg>`;
  }

  function userCharacterSvg(entry, includeStandard = true) {
    const standard = includeStandard ? `<g transform="scale(.9765625) translate(0 900) scale(1 -1)">${standardPathMarkup(entry.character, "standard-stroke", "#e7a83f")}</g>` : "";
    const user = entry.captured.map(points => `<path class="user-stroke" d="${smoothPath(points)}"></path>`).join("");
    return `<svg viewBox="0 0 1000 1000" aria-label="用户书写的${entry.character}">${standard}<g>${user}</g></svg>`;
  }

  function destroyPhraseWriters() {
    state.phraseWriters.forEach(destroyWriter);
    state.phraseWriters = [];
  }

  function renderPhrasePractice() {
    destroyPhraseWriters();
    const phrase = state.phraseCharacters;
    if (phrase.length < 2) return;
    $("#singlePracticeGrid").hidden = true;
    $("#phrasePracticePanel").hidden = false;
    $("#heroCharacter").textContent = phrase.join("");
    $("#heroCharacter").classList.add("phrase-hero");
    $("#pinyinLabel").textContent = phrase.map(char => lessonFor(char).pinyin).join("  ");
    $("#meaningLabel").textContent = state.locale === "zh" ? "多字并排书写练习" : "Multi-character writing practice";
    $("#structureLabel").textContent = state.locale === "zh" ? `${phrase.length}字组合` : `${phrase.length}-character group`;
    $("#phraseTitle").textContent = `${phrase.join("")} · ${phrase.map(char => lessonFor(char).pinyin).join(" ")}`;
    $("#phraseProgress").textContent = state.locale === "zh" ? `共${phrase.length}个字；依次完成后生成并排真实笔迹。` : `${phrase.length} characters; complete each grid to create a combined writing image.`;
    $("#phraseActiveHint").textContent = state.locale === "zh" ? `请先写“${phrase[0]}”` : `Write ${phrase[0]} first`;
    $("#phraseComparison").hidden = true;
    $("#phraseComparison").classList.remove("comparing");
    $("#phraseOverlayButton").textContent = state.locale === "zh" ? "叠加标准字" : "Overlay standard";

    const countStyle = `--phrase-count:${phrase.length}`;
    $("#phraseStandardRow").style.cssText = countStyle;
    $("#phraseWritingRow").style.cssText = countStyle;
    $("#phraseStandardRow").innerHTML = phrase.map(char => `
      <div class="phrase-standard-cell">
        <div class="tianzige phrase-standard"><div class="grid-lines" aria-hidden="true"></div>${standardCharacterSvg(char)}</div>
        <div class="phrase-cell-label"><strong>${char}</strong><small>${lessonFor(char).pinyin}</small></div>
      </div>`).join("");
    $("#phraseWritingRow").innerHTML = phrase.map((char, index) => `
      <div class="phrase-write-cell${index === 0 ? " active" : ""}" data-phrase-index="${index}">
        <div class="tianzige phrase-write"><div class="grid-lines" aria-hidden="true"></div><div class="writer-target" id="phraseWriter${index}"></div></div>
        <div class="phrase-cell-label"><strong>${char}</strong><small>${lessonFor(char).pinyin}</small></div>
        <span class="phrase-cell-status" id="phraseStatus${index}">${index === 0 ? "等待落笔" : "等待前一字"}</span>
      </div>`).join("");

    state.phraseIndex = 0;
    state.phraseEntries = phrase.map(character => ({ character, captured: [], current: null, pending: null, mistakes: 0, score: null }));
    requestAnimationFrame(buildPhraseWriters);
  }

  function phrasePoint(event, grid) {
    const rect = grid.getBoundingClientRect();
    return { x: Math.max(0, Math.min(1000, (event.clientX - rect.left) / rect.width * 1000)), y: Math.max(0, Math.min(1000, (event.clientY - rect.top) / rect.height * 1000)) };
  }

  function bindPhraseCapture(index, grid) {
    const entry = state.phraseEntries[index];
    grid.addEventListener("pointerdown", event => {
      if (index !== state.phraseIndex || (event.button != null && event.button !== 0)) return;
      entry.current = [phrasePoint(event, grid)];
      $("#phraseStatus" + index).textContent = state.locale === "zh" ? "正在书写" : "Writing";
    }, true);
    grid.addEventListener("pointermove", event => {
      if (!entry.current) return;
      const point = phrasePoint(event, grid);
      const previous = entry.current[entry.current.length - 1];
      if (Math.hypot(point.x - previous.x, point.y - previous.y) >= 4) entry.current.push(point);
    }, true);
    const finish = event => {
      if (!entry.current) return;
      entry.current.push(phrasePoint(event, grid));
      if (entry.current.length > 1) entry.pending = entry.current;
      entry.current = null;
    };
    grid.addEventListener("pointerup", finish, true);
    grid.addEventListener("pointercancel", finish, true);
  }

  function buildPhraseWriters() {
    destroyPhraseWriters();
    state.phraseEntries.forEach((entry, index) => {
      const grid = $("#phraseWriter" + index).parentElement;
      const size = fitSize(grid, 300);
      bindPhraseCapture(index, grid);
      const writer = HanziWriter.create("phraseWriter" + index, entry.character, writerOptions(size, { showCharacter: state.practiceMode === "trace", showOutline: true, drawingWidth: 10 }, entry.character));
      writer.quiz({
        showHintAfterMisses: 3,
        highlightOnComplete: true,
        leniency: state.practiceMode === "trace" ? 1.15 : 1.3,
        onMistake: data => {
          entry.mistakes += 1;
          entry.pending = null;
          const phraseLesson = lessonFor(entry.character);
          $("#phraseStatus" + index).textContent = localized(phraseLesson.feedback.retry[data.strokeNum] || phraseLesson.feedback.retry[0]);
        },
        onCorrectStroke: data => {
          if (entry.pending?.length > 1) entry.captured.push(entry.pending);
          entry.pending = null;
          $("#phraseStatus" + index).textContent = state.locale === "zh" ? `第${data.strokeNum + 1}笔完成` : `Stroke ${data.strokeNum + 1} complete`;
        },
        onComplete: () => completePhraseCharacter(index)
      });
      state.phraseWriters.push(writer);
    });
  }

  function completePhraseCharacter(index) {
    const entry = state.phraseEntries[index];
    entry.score = Math.max(60, 100 - entry.mistakes * 7);
    const cell = $(`[data-phrase-index="${index}"]`);
    cell.classList.remove("active");
    cell.classList.add("done");
    $("#phraseStatus" + index).textContent = state.locale === "zh" ? `完成 · ${entry.score}分` : `Done · ${entry.score}`;
    if (index < state.phraseEntries.length - 1) {
      state.phraseIndex = index + 1;
      const next = $(`[data-phrase-index="${state.phraseIndex}"]`);
      next.classList.add("active");
      $("#phraseStatus" + state.phraseIndex).textContent = state.locale === "zh" ? "等待落笔" : "Ready";
      $("#phraseActiveHint").textContent = state.locale === "zh" ? `接着写“${state.phraseEntries[state.phraseIndex].character}”` : `Next: ${state.phraseEntries[state.phraseIndex].character}`;
    } else {
      finishPhrasePractice();
    }
  }

  function finishPhrasePractice() {
    const entries = state.phraseEntries;
    const total = Math.round(entries.reduce((sum, entry) => sum + entry.score, 0) / entries.length);
    const countStyle = `--phrase-count:${entries.length}`;
    $("#phraseStandardResult").style.cssText = countStyle;
    $("#phraseUserResult").style.cssText = countStyle;
    $("#phraseStandardResult").innerHTML = entries.map(entry => `<div class="comparison-cell standard">${standardCharacterSvg(entry.character)}</div>`).join("");
    $("#phraseUserResult").innerHTML = entries.map(entry => `<div class="comparison-cell user">${userCharacterSvg(entry)}<span class="comparison-score">${entry.score}</span></div>`).join("");
    const stats = entries.map(entry => writingStats(entry.captured)).filter(Boolean);
    const widths = stats.map(item => item.width);
    const centers = stats.map(item => item.centerY);
    const widthSpread = widths.length ? Math.max(...widths) - Math.min(...widths) : 0;
    const centerSpread = centers.length ? Math.max(...centers) - Math.min(...centers) : 0;
    const feedback = widthSpread > 150
      ? (state.locale === "zh" ? "各字大小略有差异，下一次注意保持占格比例一致。" : "Character sizes vary; keep their proportions more consistent.")
      : centerSpread > 100
        ? (state.locale === "zh" ? "各字重心高低略有差异，注意保持在同一水平线上。" : "The vertical centers vary; align the characters on one baseline.")
        : (state.locale === "zh" ? "各字大小和重心较协调，可以继续注意字间距离。" : "Size and alignment are balanced; continue to watch spacing.");
    $("#phraseTotalScore").textContent = total;
    $("#phraseScoreTitle").textContent = `${state.phraseCharacters.join("")} · ${state.locale === "zh" ? "整体评价" : "Overall"}`;
    $("#phraseFeedback").textContent = feedback;
    $("#phraseComparison").hidden = false;
    $("#phraseActiveHint").textContent = state.locale === "zh" ? "全部完成" : "Completed";
    state.phraseCharacters.forEach(char => state.completed.add(char));
    saveProgress();
    renderRailState();
    $("#phraseComparison").scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  async function startPhrasePractice(charactersToWrite) {
    const valid = charactersToWrite.filter(char => /[\u3400-\u9fff]/.test(char)).slice(0, 4);
    if (valid.length < 2) {
      showToast(state.locale === "zh" ? "请至少选择两个汉字。" : "Select at least two characters.");
      return;
    }
    showToast(state.locale === "zh" ? "正在准备词组笔顺数据…" : "Preparing stroke data…");
    try { await Promise.all(valid.map(ensureCharacterData)); }
    catch (error) { showToast(`部分笔顺数据加载失败：${error.message}`); }
    state.phraseMode = true;
    state.phraseCharacters = valid.slice(0, 4);
    await ensureRemoteContent("word", state.phraseCharacters.join(""));
    state.multiSelecting = false;
    renderMultiSelection();
    switchView("practice");
  }

  function exitPhrasePractice() {
    destroyPhraseWriters();
    state.phraseMode = false;
    state.phraseCharacters = [];
    $("#phrasePracticePanel").hidden = true;
    $("#singlePracticeGrid").hidden = false;
    if (state.phraseMode) renderPhrasePractice();
    else renderCharacter();
    switchView("practice");
  }

  function renderMultiSelection() {
    $("#multiSelectToggle").classList.toggle("active", state.multiSelecting);
    $("#multiSelectToggle").textContent = state.multiSelecting ? "✓ 正在勾选" : "□ 勾选多字";
    $("#selectionTray").hidden = !state.multiSelecting;
    $("#selectedCharacters").textContent = state.selectedCharacters.length ? state.selectedCharacters.join(" ") : "—";
    $("#startMultiPractice").disabled = state.selectedCharacters.length < 2;
    $$(".character-item").forEach(item => item.classList.toggle("multi-selected", state.selectedCharacters.includes(item.dataset.character)));
  }

  function buildQuizWriter(preserveSample = false) {
    destroyWriter(state.quizWriter);
    const target = $("#quizWriter");
    if (!target || !window.HanziWriter) return;
    target.innerHTML = "";
    const grid = target.parentElement;
    const size = fitSize(grid, 480);
    state.mistakes = 0;
    state.mistakesByStroke = new Array(lesson().strokeCount).fill(0);
    resetFeedback(false, preserveSample);
    state.quizWriter = HanziWriter.create("quizWriter", state.character, writerOptions(size, {
      showCharacter: state.practiceMode === "trace",
      showOutline: true,
      drawingWidth: 10
    }));
    state.quizWriter.quiz({
      showHintAfterMisses: 3,
      highlightOnComplete: true,
      leniency: state.practiceMode === "trace" ? 1.15 : 1.3,
      onMistake: data => {
        removeRejectedCapture();
        state.mistakes += 1;
        state.mistakesByStroke[data.strokeNum] = data.mistakesOnStroke;
        updateLiveStatus("writing");
        $("#practiceHelp").textContent = localized(lesson().feedback.retry[data.strokeNum] || lesson().feedback.retry[0]);
      },
      onCorrectStroke: data => {
        acceptCapturedStroke();
        updateLiveStatus("writing");
        const stroke = lesson().strokes[data.strokeNum];
        $("#practiceHelp").textContent = state.locale === "zh"
          ? `第${data.strokeNum + 1}笔“${localized(stroke.name)}”完成，继续下一笔。`
          : `Stroke ${data.strokeNum + 1} (${localized(stroke.name)}) complete. Continue.`;
      },
      onComplete: data => completePractice(data)
    });
  }

  function renderCharacter() {
    const data = lesson();
    $("#heroCharacter").classList.remove("phrase-hero");
    $("#heroCharacter").textContent = state.character;
    $("#pinyinLabel").textContent = data.pinyin;
    $("#meaningLabel").textContent = localized(data.meaning);
    $("#structureLabel").textContent = localized(data.structure);
    $("#strokeCounter").textContent = state.locale === "zh" ? `${data.strokeCount}画` : `${data.strokeCount} strokes`;
    $("#coachTitle").textContent = localized(data.overview.title);
    $("#coachText").textContent = localized(data.overview.text);
    $("#focusText").textContent = localized(data.focus);
    $("#practicePrompt").textContent = state.locale === "zh" ? `请写“${state.character}”` : `Write “${state.character}”`;

    renderStrokeSteps();
    renderPracticeRules();
    renderCulture();
    renderRailState();
    buildWriters();
  }

  function renderStrokeSteps() {
    const container = $("#strokeSteps");
    const count = lesson().strokeCount;
    container.classList.toggle("is-idle", state.activeStroke < 0);
    if (lesson().generatedFallback) {
      container.innerHTML = `<div class="stroke-step side-left generic-stroke-guide" style="--slot-top:42%">
        <span class="number">${count}</span>
        <span><strong>${count}画 · 完整笔顺</strong><small>播放动画，观察每一笔的起点、方向和先后顺序。</small></span>
        <span class="direction" aria-hidden="true">▶</span>
      </div>`;
      requestAnimationFrame(syncAnnotationLines);
      return;
    }
    container.innerHTML = lesson().strokes.map((stroke, index) => `
      <button type="button" class="stroke-step side-${index % 2 === 0 ? "left" : "right"}${index === state.activeStroke ? " active" : ""}" data-stroke-index="${index}" style="--slot-top:${count === 2 ? (index === 0 ? 22 : 62) : (14 + index * 29)}%">
        <span class="number">${index + 1}</span>
        <span><strong>${localized(stroke.name)} <small>${stroke.pinyin}</small></strong><small>${localized(stroke.instruction)}</small></span>
        <span class="direction" aria-hidden="true">${stroke.direction}</span>
      </button>`).join("");
    requestAnimationFrame(syncAnnotationLines);
  }

  function syncAnnotationLines() {
    const stage = $("#guidedStage");
    const grid = $("#demoGrid");
    const svg = $("#annotationLines");
    if (!stage || !grid || !svg || window.innerWidth <= 820) {
      if (svg) svg.innerHTML = "";
      return;
    }

    const stageRect = stage.getBoundingClientRect();
    const gridRect = grid.getBoundingClientRect();
    const targets = annotationTargets[state.character] || [];
    svg.setAttribute("viewBox", `0 0 ${stageRect.width} ${stageRect.height}`);
    svg.innerHTML = $$(".stroke-step", $("#strokeSteps")).map((step, index) => {
      const stepRect = step.getBoundingClientRect();
      const leftSide = step.classList.contains("side-left");
      const startX = (leftSide ? stepRect.right : stepRect.left) - stageRect.left;
      const startY = stepRect.top - stageRect.top + stepRect.height / 2;
      const target = targets[index] || { x: .5, y: .5 };
      const endX = gridRect.left - stageRect.left + gridRect.width * target.x;
      const endY = gridRect.top - stageRect.top + gridRect.height * target.y;
      const bend = Math.max(36, Math.abs(endX - startX) * .44);
      const controlX = leftSide ? startX + bend : startX - bend;
      const active = index === state.activeStroke ? " active" : "";
      return `<path class="${active.trim()}" d="M ${startX.toFixed(1)} ${startY.toFixed(1)} C ${controlX.toFixed(1)} ${startY.toFixed(1)}, ${controlX.toFixed(1)} ${endY.toFixed(1)}, ${endX.toFixed(1)} ${endY.toFixed(1)}"></path><circle class="${active.trim()}" cx="${endX.toFixed(1)}" cy="${endY.toFixed(1)}" r="${index === state.activeStroke ? 5 : 3.5}"></circle>`;
    }).join("");
  }

  function renderPracticeRules() {
    $("#modelRules").innerHTML = lesson().rules[state.locale].map(rule => `<li>${rule}</li>`).join("");
  }

  function cultureEntity() {
    if (state.phraseMode && state.phraseCharacters.length > 1) {
      const id = state.phraseCharacters.join("");
      const remoteRecord = remoteContentCache.get(`word:${id}`);
      if (remoteRecord) return { key: `word:${id}`, type: "word", id, data: cultureFromRecord(remoteRecord), available: true };
      return { key: `word:${id}`, type: "word", id, data: phraseCultures[id] || null, available: Boolean(phraseCultures[id]) };
    }
    const remoteRecord = remoteContentCache.get(`character:${state.character}`);
    if (remoteRecord) return { key: `character:${state.character}`, type: "character", id: state.character, data: cultureFromRecord(remoteRecord), available: true };
    const reviewed = reviewedCultures[state.character];
    return {
      key: `character:${state.character}`,
      type: "character",
      id: state.character,
      data: reviewed || lesson().culture,
      available: Boolean(reviewed) || !lesson().generatedFallback
    };
  }

  function stopCultureAudio(clearSource = true) {
    culturePlayer.pause();
    if (clearSource) {
      culturePlayer.removeAttribute("src");
      culturePlayer.load();
    }
    state.cultureAudioKey = "";
    state.cultureQueue = [];
    state.culturePlayAllActive = false;
    updateCultureAudioButtons();
  }

  function setCultureAudioStatus(message) {
    const status = $("#cultureAudioStatus");
    if (status) status.textContent = message;
  }

  function updateCultureAudioButtons() {
    const entity = cultureEntity();
    const enabled = entity.available && Boolean(ttsFunctionUrl);
    $$('[data-culture-audio]').forEach(button => {
      const active = button.dataset.cultureAudio === state.cultureAudioKey;
      const playing = active && !culturePlayer.paused;
      button.disabled = !enabled || state.cultureAudioLoading;
      button.classList.toggle("is-playing", playing);
      const icon = state.cultureAudioLoading ? "…" : playing ? "❚❚" : active ? "▶" : "▶";
      const label = state.cultureAudioLoading
        ? (state.locale === "zh" ? "准备中" : "Loading")
        : playing
          ? (state.locale === "zh" ? "暂停" : "Pause")
          : active
            ? (state.locale === "zh" ? "继续" : "Resume")
            : (state.locale === "zh" ? "中文原声" : "Chinese audio");
      button.innerHTML = `<span aria-hidden="true">${icon}</span><span>${label}</span>`;
      button.closest(".culture-section")?.classList.toggle("is-speaking", playing);
    });
    const allButton = $("#playAllCultureButton");
    if (allButton) {
      allButton.disabled = !enabled || state.cultureAudioLoading;
      allButton.classList.toggle("is-playing", state.culturePlayAllActive && !culturePlayer.paused);
      allButton.innerHTML = state.culturePlayAllActive
        ? `<span aria-hidden="true">■</span><span>${state.locale === "zh" ? "停止朗读" : "Stop"}</span>`
        : `<span aria-hidden="true">▶</span><span>${state.locale === "zh" ? "连续朗读三段" : "Play all three"}</span>`;
    }
  }

  function applyCultureManifest(manifest) {
    const entity = cultureEntity();
    if (`${manifest.type}:${manifest.id}` !== entity.key || state.locale !== "zh") return;
    const byKey = Object.fromEntries(manifest.sections.map(section => [section.key, section]));
    if (byKey.formation) {
      $("#cultureTitle").textContent = byKey.formation.title;
      $("#cultureVerified").textContent = byKey.formation.text;
    }
    if (byKey.culture) {
      $("#associationTitle").textContent = byKey.culture.title;
      $("#associationText").textContent = byKey.culture.text;
    }
    if (byKey.memory) {
      $("#mnemonicTitle").textContent = byKey.memory.title;
      $("#mnemonicText").textContent = byKey.memory.text;
    }
  }

  async function ensureCultureAudio() {
    const entity = cultureEntity();
    if (!entity.available) throw new Error("该组合暂无词组文化语音");
    if (!ttsFunctionUrl) throw new Error("语音服务尚未配置");
    const cached = cultureAudioCache.get(entity.key);
    if (cached && cached.expiresAt > Date.now()) {
      applyCultureManifest(cached.manifest);
      return cached.manifest;
    }

    state.cultureAudioLoading = true;
    updateCultureAudioButtons();
    setCultureAudioStatus(state.locale === "zh" ? "正在准备中文原声…" : "Preparing Chinese audio…");
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 55000);
    try {
      const result = await fetch(`${ttsFunctionUrl}/audio/resolve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: entity.type, id: entity.id }),
        signal: controller.signal
      });
      const payload = await result.json().catch(() => ({}));
      if (!result.ok || !payload.ok || !payload.manifest) throw new Error(payload.message || `语音服务返回${result.status}`);
      const expectedPinyin = String(entity.data?.pinyin || lesson().pinyin || "").trim();
      const audioPinyin = String(payload.manifest.pinyin || "").trim();
      if (expectedPinyin && audioPinyin !== expectedPinyin) {
        throw new Error(`语音拼音与页面注音不一致：${audioPinyin || "未提供"} / ${expectedPinyin}`);
      }
      cultureAudioCache.set(entity.key, { manifest: payload.manifest, expiresAt: Date.now() + 45 * 60 * 1000 });
      if (cultureEntity().key === entity.key) {
        applyCultureManifest(payload.manifest);
        setCultureAudioStatus(state.locale === "zh" ? "中文原声已准备，可分别播放" : "Chinese audio is ready");
      }
      return payload.manifest;
    } catch (error) {
      const message = error.name === "AbortError" ? "语音准备超时，请重试" : error.message;
      setCultureAudioStatus(message);
      throw error;
    } finally {
      clearTimeout(timeout);
      state.cultureAudioLoading = false;
      updateCultureAudioButtons();
    }
  }

  function formatAudioTime(seconds) {
    if (!Number.isFinite(seconds)) return "0:00";
    return `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, "0")}`;
  }

  async function playCultureSection(key, fromQueue = false) {
    if (!fromQueue) {
      state.cultureQueue = [];
      state.culturePlayAllActive = false;
    }
    if (state.cultureAudioKey === key && culturePlayer.src) {
      if (!culturePlayer.paused) culturePlayer.pause();
      else await culturePlayer.play();
      updateCultureAudioButtons();
      return;
    }

    try {
      const manifest = await ensureCultureAudio();
      const section = manifest.sections.find(item => item.key === key);
      if (!section?.url) throw new Error("未找到对应语音文件");
      state.cultureAudioKey = key;
      culturePlayer.src = section.url;
      culturePlayer.currentTime = 0;
      await culturePlayer.play();
      setCultureAudioStatus(`${state.locale === "zh" ? "正在朗读" : "Playing"}：${section.title}`);
      updateCultureAudioButtons();
    } catch (error) {
      if (error.name === "NotAllowedError") {
        setCultureAudioStatus(state.locale === "zh" ? "语音已准备好，请再次点击播放" : "Audio ready; click play again");
      } else {
        showToast(state.locale === "zh" ? `语音播放失败：${error.message}` : `Audio failed: ${error.message}`);
      }
      state.culturePlayAllActive = false;
      state.cultureQueue = [];
      updateCultureAudioButtons();
    }
  }

  async function playAllCultureAudio() {
    if (state.culturePlayAllActive) {
      stopCultureAudio();
      setCultureAudioStatus(state.locale === "zh" ? "已停止连续朗读" : "Playback stopped");
      return;
    }
    try {
      const manifest = await ensureCultureAudio();
      const keys = manifest.sections.map(section => section.key);
      state.culturePlayAllActive = true;
      state.cultureQueue = keys.slice(1);
      await playCultureSection(keys[0], true);
    } catch (error) {
      showToast(state.locale === "zh" ? `语音准备失败：${error.message}` : `Audio failed: ${error.message}`);
    }
  }

  function renderCulture() {
    const entity = cultureEntity();
    if (state.cultureEntityKey && state.cultureEntityKey !== entity.key) stopCultureAudio();
    state.cultureEntityKey = entity.key;
    const glyph = $("#cultureGlyph");
    glyph.textContent = entity.id;
    glyph.classList.toggle("phrase", entity.type === "word");
    $("#cultureAnimateButton").hidden = entity.type === "word";

    if (entity.data?.sections) {
      $("#componentBadge").textContent = entity.data.component;
      $("#cultureTitle").textContent = entity.data.sections.formation.title;
      $("#cultureVerified").textContent = entity.data.sections.formation.text;
      $("#associationTitle").textContent = entity.data.sections.culture.title;
      $("#associationText").textContent = entity.data.sections.culture.text;
      $("#cultureExamples").innerHTML = entity.data.examples.map(example => `<span>${example}</span>`).join("");
      $("#mnemonicTitle").textContent = entity.data.sections.memory.title;
      $("#mnemonicText").textContent = entity.data.sections.memory.text;
    } else if (entity.type === "word") {
      $("#componentBadge").textContent = "多字组合";
      $("#cultureTitle").textContent = "该组合暂无词组文化内容";
      $("#cultureVerified").textContent = "只有教材中确认的词语或固定表达才生成整体解释，避免把随意勾选的汉字组合误当作词语。";
      $("#associationTitle").textContent = "可以继续完成并排书写";
      $("#associationText").textContent = "当前组合仍可用于观察字距、大小和重心，但不会自动生成未经审核的文化解释。";
      $("#cultureExamples").innerHTML = "";
      $("#mnemonicTitle").textContent = "内容等待配置";
      $("#mnemonicText").textContent = "如该组合属于教材词语，可在审核后加入词组文化和中文语音。";
    } else {
      const culture = entity.data;
      $("#componentBadge").textContent = localized(culture.component);
      $("#cultureTitle").textContent = localized(culture.title);
      $("#cultureVerified").textContent = localized(culture.verified);
      $("#associationTitle").textContent = localized(culture.associationTitle);
      $("#associationText").textContent = localized(culture.association);
      $("#cultureExamples").innerHTML = culture.examples.map(example => `<span>${example}</span>`).join("");
      $("#mnemonicTitle").textContent = state.locale === "zh" ? "结构记忆" : "Memory aid";
      $("#mnemonicText").textContent = localized(culture.mnemonic);
    }

    const cached = cultureAudioCache.get(entity.key);
    if (cached?.expiresAt > Date.now()) applyCultureManifest(cached.manifest);
    setCultureAudioStatus(!entity.available
      ? (state.locale === "zh" ? "该组合暂无语音" : "No audio for this group")
      : !ttsFunctionUrl
        ? (state.locale === "zh" ? "语音服务尚未配置" : "Audio service not configured")
        : (state.locale === "zh" ? "三段讲解可分别播放" : "Three Chinese audio sections"));
    updateCultureAudioButtons();
  }

  function chapterLabel(chapter) {
    return `第${chapter.id}课 · ${chapter.title}`;
  }

  function bookOccurrences(character) {
    return currentBook.chapters.filter(chapter => chapter.characters.includes(character));
  }

  function renderCharacterRail() {
    const query = $("#characterSearch")?.value.trim() || "";
    const scope = $("#searchScope")?.value || "lesson";
    let entries = [];
    if (scope === "lesson") {
      entries = currentChapter.characters.map(character => ({ character, chapter: currentChapter }));
    } else {
      const seen = new Set();
      currentBook.chapters.forEach(chapter => chapter.characters.forEach(character => {
        if (!seen.has(character)) {
          seen.add(character);
          entries.push({ character, chapter });
        }
      }));
    }
    if (query) {
      const normalized = query.toLowerCase().replace(/\s+/g, "");
      entries = entries.filter(({ character }) => {
        const data = lessonFor(character);
        return character.includes(query) || String(data.pinyin || "").toLowerCase().replace(/\s+/g, "").includes(normalized);
      });
    }

    $("#characterList").innerHTML = entries.map(({ character, chapter }) => {
      const data = lessonFor(character);
      const known = !data.generatedFallback || Boolean(reviewedCultures[character]) || remoteContentCache.has(`character:${character}`);
      const locations = bookOccurrences(character);
      const location = scope === "book" ? `${chapterLabel(chapter)}${locations.length > 1 ? ` · 共${locations.length}课` : ""}` : "教材写字";
      return `<button class="character-item${character === state.character ? " active" : ""}${state.completed.has(character) ? " completed" : ""}" type="button" data-character="${character}" data-chapter="${chapter.id}">
        <span class="character-glyph">${character}</span>
        <span class="character-meta"><strong>${known ? data.pinyin : "教材汉字"}</strong><small>${known ? localized(data.meaning) : "写汉字栏目"}</small><span class="search-location">${location}</span></span>
        <span class="status-dot" aria-label="${state.completed.has(character) ? "已完成" : "未完成"}"></span>
      </button>`;
    }).join("");

    const direct = $("#directStudy");
    const chineseQuery = query.replace(/\s+/g, "");
    const canDirect = /^[\u3400-\u9fff]{1,4}$/.test(chineseQuery) && (chineseQuery.length > 1 || entries.length === 0);
    direct.hidden = !canDirect;
    if (canDirect) {
      direct.innerHTML = `<strong>教材${chineseQuery.length > 1 ? "词组" : "外查询"}：${chineseQuery}</strong>
        ${chineseQuery.length > 1 ? "可按词组并排书写；字里文化仅在审核后开放。" : "未在当前搜索范围找到，仍可打开标准动画和跟写。"}
        <button type="button" data-direct-study="${chineseQuery}">${chineseQuery.length > 1 ? "并排学习这个词组" : "直接学习这个字"}</button>`;
    }
    $("#librarySummary").textContent = query
      ? `找到 ${entries.length} 个教材汉字${scope === "book" ? " · 本册30课" : " · 本课"}`
      : `本课“写汉字”栏目 · ${currentChapter.characters.length}字 · PDF第${currentChapter.pdfPage}页`;
    $("#clearSearchButton").hidden = !query;
    renderRailState();
  }

  async function activateCharacter(character) {
    if (!character) return;
    if (!strokeData[character]) showToast(`正在加载“${character}”的标准笔顺…`);
    try { await ensureCharacterData(character); }
    catch (error) {
      showToast(`“${character}”笔顺数据加载失败，请检查网络后重试。`);
      return;
    }
    await ensureRemoteContent("character", character);
    state.phraseMode = false;
    state.character = character;
    state.activeStroke = -1;
    state.attempts = 0;
    state.selectedCharacters = [];
    renderMultiSelection();
    renderCharacter();
  }

  function selectChapter(chapterId, preferredCharacter = "") {
    const next = currentBook.chapters.find(chapter => chapter.id === String(chapterId));
    if (!next) return;
    currentChapter = next;
    characters = [...currentChapter.characters];
    $("#chapterSelect").value = currentChapter.id;
    $("#railLessonTitle").textContent = chapterLabel(currentChapter);
    $("#characterSearch").value = "";
    $("#searchScope").value = "lesson";
    renderCharacterRail();
    const nextCharacter = currentChapter.characters.includes(preferredCharacter) ? preferredCharacter : currentChapter.characters[0];
    activateCharacter(nextCharacter);
  }

  function initCurriculumNavigation() {
    $("#seriesSelect").innerHTML = library.series.map(series => `<option value="${series.id}">${series.title}</option>`).join("");
    $("#seriesSelect").value = currentSeries.id;
    $("#bookSelect").innerHTML = currentSeries.books.map(book => `<option value="${book.id}"${book.available ? "" : " disabled"}>${book.title}${book.available ? "" : " · 待录入"}</option>`).join("");
    $("#bookSelect").value = currentBook.id;
    $("#chapterSelect").innerHTML = currentBook.chapters.map(chapter => `<option value="${chapter.id}">${chapterLabel(chapter)}</option>`).join("");
    $("#chapterSelect").value = currentChapter.id;
    $("#railLessonTitle").textContent = chapterLabel(currentChapter);
  }

  function renderRailState() {
    $$(".character-item").forEach(item => {
      const char = item.dataset.character;
      item.classList.toggle("active", char === state.character);
      item.classList.toggle("completed", state.completed.has(char));
      const dot = $(".status-dot", item);
      dot?.setAttribute("aria-label", state.completed.has(char) ? "已完成" : "未完成");
    });
    $("#progressCount").textContent = `${characters.filter(character => state.completed.has(character)).length} / ${characters.length}`;
  }

  function setActiveStroke(index) {
    state.activeStroke = index;
    $("#strokeSteps")?.classList.toggle("is-idle", index < 0);
    $$(".stroke-step").forEach((step, i) => step.classList.toggle("active", i === index));
    if (index >= 0) {
      const stroke = lesson().strokes[index];
      $("#coachTitle").textContent = `${index + 1}. ${localized(stroke.name)} · ${stroke.pinyin}`;
      $("#coachText").textContent = localized(stroke.instruction);
    } else {
      $("#coachTitle").textContent = localized(lesson().overview.title);
      $("#coachText").textContent = localized(lesson().overview.text);
    }
    syncAnnotationLines();
  }

  function playSingleStroke(index) {
    if (!state.demoWriter) return;
    setActiveStroke(index);
    state.demoWriter.hideCharacter({ duration: 100 });
    state.demoWriter.animateStroke(index);
  }

  async function playStrokeSequence() {
    if (!state.demoWriter) return;
    state.demoWriter.hideCharacter({ duration: 120 });
    for (let i = 0; i < lesson().strokeCount; i += 1) {
      setActiveStroke(i);
      await new Promise(resolve => state.demoWriter.animateStroke(i, { onComplete: resolve }));
      await new Promise(resolve => setTimeout(resolve, 520));
    }
    setActiveStroke(-1);
    showToast(state.locale === "zh" ? "逐笔讲解完成，可以开始跟写。" : "Stroke guide complete. You can start writing.");
  }

  function playFull(writer = state.demoWriter) {
    if (!writer) return;
    writer.hideCharacter({ duration: 100 });
    writer.animateCharacter();
  }

  function highlightRadical() {
    if (!state.demoWriter) return;
    state.demoWriter.updateColor("strokeColor", "#e9a83f", { duration: 260 });
    state.demoWriter.animateCharacter({ onComplete: () => {
      setTimeout(() => state.demoWriter?.updateColor("strokeColor", "#173654", { duration: 500 }), 600);
    }});
    showToast(state.locale === "zh" ? `“${state.character}”本身就是部首，全部笔画已高亮。` : `${state.character} is itself a radical, so all strokes are highlighted.`);
  }

  const ESSAY_PAGE_SIZE = 200;
  function essaySnapshot() { return state.essayCells.map(cell => ({ ...cell })); }
  function essaySaveHistory() {
    state.essayHistory.push(essaySnapshot());
    if (state.essayHistory.length > 20) state.essayHistory.shift();
  }
  function saveEssayDraft() {
    try {
      localStorage.setItem("hanzi-companion-essay-draft-v1", JSON.stringify({ essayId: state.essayId, mode: state.essayMode, title: state.essayTitle, text: state.essayText, cells: state.essayCells, selectedIndex: state.essaySelectedIndex, page: state.essayPage, versions: state.essayVersions }));
    } catch (_) {}
    saveEssayCloud();
  }
  function essayTextValue() { return state.essayCells.map(cell => cell.char || "").join(""); }
  function saveEssayCloud() {
    if (!essayFunctionUrl || !state.essayCells.length) return;
    const payload = { userId: localStorage.getItem("hanzi-companion-user-id") || "local-user", essayId: state.essayId || "essay-" + Date.now(), version: Math.max(1, state.essayVersions.length || 1), title: state.essayTitle || "我的作文", text: essayTextValue(), cells: state.essayCells, review: state.essayVersions[state.essayVersions.length - 1] || null };
    state.essayId = payload.essayId;
    fetch(`${essayFunctionUrl}/essay/save`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) }).catch(() => {});
  }
  async function requestEssayAssist() {
    const result = $("#essayAiResult");
    if (!essayFunctionUrl) { result.textContent = "AI服务尚未配置。"; return; }
    const request = $("#essayAiRequest").value.trim() || "请给出适合当前水平的写作思路和提纲";
    result.textContent = "正在生成建议…";
    const response = await fetch(`${essayFunctionUrl}/essay/assist`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title: state.essayTitle || $("#essayTitleInput").value || "我的作文", text: essayTextValue(), level: "HSK 1-3", request }) });
    const payload = await response.json();
    if (!payload.ok) throw new Error(payload.message || "AI助写失败");
    const r = payload.result || {};
    result.textContent = [r.title && `主题：${r.title}`, Array.isArray(r.outline) && r.outline.length && `提纲：\n• ${r.outline.join("\n• ")}`, Array.isArray(r.keywords) && r.keywords.length && `关键词：${r.keywords.join("、")}`, Array.isArray(r.sentenceFrames) && r.sentenceFrames.length && `句型：\n${r.sentenceFrames.join("\n")}`, Array.isArray(r.tips) && r.tips.length && `提醒：\n• ${r.tips.join("\n• ")}`, r.englishHelp && `English help: ${r.englishHelp}`].filter(Boolean).join("\n\n") || "暂无建议";
  }
  async function requestEssayReview(version) {
    if (!essayFunctionUrl) return;
    const response = await fetch(`${essayFunctionUrl}/essay/review`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title: state.essayTitle || "我的作文", text: essayTextValue(), level: "HSK 1-3", localReview: version }) });
    const payload = await response.json();
    if (!payload.ok) throw new Error(payload.message || "AI点评失败");
    const ai = payload.result || {};
    if (Number.isFinite(Number(ai.writing))) version.writing = Number(ai.writing);
    if (Number.isFinite(Number(ai.punctuation))) version.punctuation = Number(ai.punctuation);
    if (Number.isFinite(Number(ai.content))) version.content = Number(ai.content);
    version.feedback = ai.summary || ai.feedback || version.feedback;
    $("#essayWritingScore").textContent = version.writing;
    $("#essayPunctuationScore").textContent = version.punctuation;
    $("#essayContentScore").textContent = version.content;
    $("#essayFeedbackText").textContent = version.feedback;
    saveEssayDraft();
  }
  function restoreEssayDraft() {
    if (state.essayCells.length) return;
    try {
      const draft = JSON.parse(localStorage.getItem("hanzi-companion-essay-draft-v1") || "null");
      if (!draft?.cells?.length) return;
      state.essayMode = draft.mode || "direct";
      state.essayId = draft.essayId || "";
      state.essayTitle = draft.title || "我的作文";
      state.essayText = draft.text || "";
      state.essayCells = draft.cells;
      state.essaySelectedIndex = Math.min(Number(draft.selectedIndex) || 0, state.essayCells.length - 1);
      state.essayPage = Number(draft.page) || 0;
      state.essayVersions = Array.isArray(draft.versions) ? draft.versions : [];
      $("#essayTitleInput").value = state.essayTitle;
      $("#essayTextInput").value = state.essayText;
      $("#essaySampleInput").hidden = state.essayMode !== "sample";
    } catch (_) {}
  }
  function essayClearCanvas() {
    const canvas = $("#essayCanvas");
    if (!canvas) return;
    canvas.getContext("2d").clearRect(0, 0, canvas.width, canvas.height);
    state.essayStroke = [];
  }
  function essayCanvasPoint(event) {
    const canvas = $("#essayCanvas");
    const rect = canvas.getBoundingClientRect();
    return { x: (event.clientX - rect.left) * canvas.width / rect.width, y: (event.clientY - rect.top) * canvas.height / rect.height };
  }
  function essayRenderCanvas() {
    essayClearCanvas();
    const cell = state.essayCells[state.essaySelectedIndex];
    if (!cell?.image) return;
    const image = new Image();
    image.onload = () => $("#essayCanvas")?.getContext("2d").drawImage(image, 0, 0, 600, 600);
    image.src = cell.image;
  }
  function essayRenderPages() {
    const pages = $("#essayPages");
    if (!pages) return;
    const pageCount = Math.max(1, Math.ceil(state.essayCells.length / ESSAY_PAGE_SIZE));
    state.essayPage = Math.min(Math.max(0, state.essayPage), pageCount - 1);
    const start = state.essayPage * ESSAY_PAGE_SIZE;
    pages.innerHTML = state.essayCells.slice(start, start + ESSAY_PAGE_SIZE).map((cell, offset) => {
      const index = start + offset;
      const image = cell.image ? `<img src="${cell.image}" alt="用户笔迹">` : "";
      return `<button class="essay-cell ${index === state.essaySelectedIndex ? "active" : ""} ${cell.image ? "written" : ""} ${cell.paragraphStart ? "paragraph-start" : ""}" type="button" data-essay-index="${index}"><span class="cell-char">${cell.char || ""}</span>${image}</button>`;
    }).join("");
    $("#essayPageLabel").textContent = `第${state.essayPage + 1}页 / ${pageCount}`;
    $("#essayProgressLabel").textContent = `${state.essayCells.filter(cell => cell.image).length} / ${state.essayCells.length}`;
    $("#essayPageTitle").textContent = state.essayTitle || (state.essayMode === "sample" ? "样文跟写" : "我的作文");
  }
  function essayRenderCurrent() {
    const cell = state.essayCells[state.essaySelectedIndex];
    const label = $("#essayCurrentLabel");
    if (label) label.textContent = cell?.char ? `请写“${cell.char}”` : (cell ? `第${state.essaySelectedIndex + 1}格` : "准备开始");
    essayRenderCanvas();
  }
  function renderEssay() {
    essayRenderPages();
    essayRenderCurrent();
  }
  function startEssay() {
    const title = $("#essayTitleInput")?.value.trim() || "我的作文";
    const count = Math.min(2000, Math.max(20, Number($("#essayCountInput")?.value || 200)));
    const text = $("#essayTextInput")?.value || "";
    state.essayTitle = title;
    state.essayId = "essay-" + Date.now();
    state.essayText = text;
    const source = state.essayMode === "sample" ? [...text.replace(/\r/g, "")] : Array.from({ length: count }, () => "");
    state.essayCells = source.map((char, index) => ({ char: char === "\n" ? "" : char, image: "", paragraphStart: index === 0 || source[index - 1] === "\n" }));
    state.essaySelectedIndex = 0;
    state.essayPage = 0;
    state.essayHistory = [];
    state.essayVersions = [];
    state.essayFeedbackStale = false;
    essayClearCanvas();
    saveEssayDraft();
    renderEssay();
    showToast("作文田字格已生成");
  }
  function confirmEssayCell() {
    const cell = state.essayCells[state.essaySelectedIndex];
    const canvas = $("#essayCanvas");
    if (!cell || !canvas || !state.essayStroke.length) { showToast("请先在田字格中书写"); return; }
    essaySaveHistory();
    state.essayFeedbackStale = true;
    cell.image = canvas.toDataURL("image/png");
    if (state.essaySelectedIndex < state.essayCells.length - 1) state.essaySelectedIndex += 1;
    essayClearCanvas();
    saveEssayDraft();
    renderEssay();
  }
  function essayEdit(action) {
    if (!state.essayCells.length) return;
    const index = state.essaySelectedIndex;
    if (action === "undo") {
      const previous = state.essayHistory.pop();
      if (previous) { state.essayCells = previous; state.essaySelectedIndex = Math.min(index, state.essayCells.length - 1); renderEssay(); }
      return;
    }
    essaySaveHistory();
    state.essayFeedbackStale = true;
    if (action === "delete") state.essayCells.splice(index, 1);
    if (action === "insert-before") state.essayCells.splice(index, 0, { char: "", image: "", paragraphStart: false });
    if (action === "insert-after") state.essayCells.splice(index + 1, 0, { char: "", image: "", paragraphStart: false });
    if (action === "rewrite") state.essayCells[index].image = "";
    state.essaySelectedIndex = Math.min(index, Math.max(0, state.essayCells.length - 1));
    saveEssayDraft();
    renderEssay();
  }
  function evaluateEssay() {
    const text = state.essayCells.map(cell => cell.char || "□").join("");
    const written = state.essayCells.filter(cell => cell.image).length;
    const punctuation = Math.min(100, 60 + (/[。！？]/.test(text) ? 20 : 0) + (!/[，。！？]/.test(text) ? 0 : 20));
    const writing = state.essayCells.length ? Math.round(written / state.essayCells.length * 100) : 0;
    const content = state.essayMode === "sample" ? 82 : (text.replace(/□/g, "").length >= 20 ? 78 : 60);
    const version = { number: state.essayVersions.length + 1, title: state.essayTitle || "我的作文", date: new Date().toISOString(), writing, punctuation, content, feedback: `你已经完成${written}个字的书写。整体内容${content >= 80 ? "比较完整" : "还可以继续补充"}，标点得分${punctuation}分。下一步建议先检查句号和逗号，再重写字形不稳定的字。` };
    state.essayVersions.push(version);
    state.essayFeedbackStale = false;
    $("#essayWritingScore").textContent = writing;
    $("#essayPunctuationScore").textContent = punctuation;
    $("#essayContentScore").textContent = content;
    $("#essayFeedbackText").textContent = version.feedback;
    $("#essayVersionLabel").textContent = `版本 V${version.number} · ${new Date(version.date).toLocaleDateString()}`;
    $("#essayHistoryList").innerHTML = state.essayVersions.slice().reverse().map(item => `<div class="essay-history-item">V${item.number} · ${item.title} · 书写${item.writing} / 标点${item.punctuation} / 内容${item.content}</div>`).join("");
    $("#essayFeedback").hidden = false;
    saveEssayDraft();
    requestEssayReview(version).catch(() => showToast("AI点评暂时不可用，已保留本地评价"));
  }
  function exportEssayPng() {
    if (!state.essayCells.length) { showToast("请先生成作文格"); return; }
    const cols = 10; const rows = 20; const cellSize = 120; const pageCount = Math.max(1, Math.ceil(state.essayCells.length / ESSAY_PAGE_SIZE));
    state.essayCells.forEach((cell, index) => { if (cell.image) return; });
    for (let page = 0; page < pageCount; page += 1) {
      const canvas = document.createElement("canvas"); canvas.width = cols * cellSize; canvas.height = rows * cellSize;
      const ctx = canvas.getContext("2d"); ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, canvas.width, canvas.height); ctx.strokeStyle = "#b7c6d3"; ctx.lineWidth = 1; ctx.font = "58px Microsoft YaHei"; ctx.fillStyle = "#31465a";
      for (let offset = 0; offset < ESSAY_PAGE_SIZE; offset += 1) {
        const cell = state.essayCells[page * ESSAY_PAGE_SIZE + offset]; if (!cell) break; const x = (offset % cols) * cellSize; const y = Math.floor(offset / cols) * cellSize;
        ctx.strokeRect(x, y, cellSize, cellSize); ctx.beginPath(); ctx.moveTo(x + cellSize / 2, y); ctx.lineTo(x + cellSize / 2, y + cellSize); ctx.moveTo(x, y + cellSize / 2); ctx.lineTo(x + cellSize, y + cellSize / 2); ctx.stroke();
        if (cell.char && !cell.image) { ctx.globalAlpha = .25; ctx.fillText(cell.char, x + 30, y + 82); ctx.globalAlpha = 1; }
        if (cell.image) { const image = new Image(); image.onload = () => ctx.drawImage(image, x + 8, y + 8, cellSize - 16, cellSize - 16); image.src = cell.image; }
      }
      setTimeout(() => { const link = document.createElement("a"); link.download = `${state.essayTitle || "我的作文"}-第${page + 1}页.png`; link.href = canvas.toDataURL("image/png"); link.click(); }, 120 + page * 160);
    }
  }
  function setupEssayCanvas() {
    const canvas = $("#essayCanvas");
    if (!canvas || canvas.dataset.bound) return;
    canvas.dataset.bound = "true";
    canvas.addEventListener("pointerdown", event => { state.essayDrawing = true; state.essayStroke = [essayCanvasPoint(event)]; canvas.setPointerCapture(event.pointerId); });
    canvas.addEventListener("pointermove", event => {
      if (!state.essayDrawing) return;
      const point = essayCanvasPoint(event); const last = state.essayStroke[state.essayStroke.length - 1]; state.essayStroke.push(point);
      const ctx = canvas.getContext("2d"); ctx.strokeStyle = "#163b5c"; ctx.lineWidth = 18; ctx.lineCap = "round"; ctx.lineJoin = "round"; ctx.beginPath(); ctx.moveTo(last.x, last.y); ctx.lineTo(point.x, point.y); ctx.stroke();
    });
    ["pointerup", "pointercancel"].forEach(type => canvas.addEventListener(type, () => { state.essayDrawing = false; }));
  }

  function switchView(view) {
    state.view = view;
    $$("#hanziModule .step-tab").forEach(tab => {
      const active = tab.dataset.view === view;
      tab.classList.toggle("active", active);
      tab.setAttribute("aria-selected", String(active));
    });
    $$("#hanziModule .view-panel").forEach(panel => {
      const active = panel.dataset.panel === view;
      panel.hidden = !active;
      panel.classList.toggle("active", active);
    });
    if (view === "practice") {
      if (state.phraseMode) requestAnimationFrame(() => requestAnimationFrame(renderPhrasePractice));
      else {
        $("#singlePracticeGrid").hidden = false;
        $("#phrasePracticePanel").hidden = true;
        requestAnimationFrame(() => requestAnimationFrame(buildWriters));
      }
    }
    if (view === "culture") {
      renderCulture();
      const entity = cultureEntity();
      ensureRemoteContent(entity.type, entity.id).then(content => {
        if (!content || cultureEntity().key !== `${entity.type}:${entity.id}` || state.view !== "culture") return;
        if (entity.type === "character") {
          const data = lesson();
          $("#pinyinLabel").textContent = data.pinyin;
          $("#meaningLabel").textContent = localized(data.meaning);
          $("#structureLabel").textContent = localized(data.structure);
          renderCharacterRail();
        }
        renderCulture();
        requestAnimationFrame(() => ensureCultureAudio().catch(() => {}));
      });
      if (entity.type === "character") {
        requestAnimationFrame(() => ensureCultureAudio().catch(() => {}));
      }
    }
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function buildSystemLayout() {
    const stage = $(".learning-stage");
    const systemSidebar = $(".character-rail");
    const moduleNav = $(".module-rail-nav");
    if (!stage || !systemSidebar || !moduleNav || $("#hanziModule")) return;
    systemSidebar.classList.add("system-sidebar");

    const home = document.createElement("section");
    home.id = "homeModule";
    home.className = "module-screen home-module";
    home.innerHTML = `<div class="home-hero"><span class="eyebrow">点点汉语 · 智能中文伴学平台</span><h1>从教材出发，按自己的语言节奏学习中文</h1><p>统一学习中心已经接入课程目录、数字书、互动练习和角色导航原型；现有专项训练仍可从学习中心按需进入。</p><div class="home-actions"><a class="primary-button" href="modules/learning-hub/">进入学习中心</a><button class="secondary-button" type="button" data-module="learn">进入汉字伴写 · Character Studio</button></div></div><div class="home-module-cards"><a href="modules/learning-hub/"><strong>我的课程</strong><span>教材目录、课程进度与继续学习</span></a><button type="button" data-module="learn"><strong>汉字伴写</strong><span>动画、跟写、字里文化</span></button><button type="button" data-module="essay"><strong>写作练习</strong><span>田字格作文、AI助写与点评</span></button><button type="button" data-module="listening-speaking"><strong>听说训练</strong><span>智能听力、跟读朗读与情景对话</span></button></div>`;

    const hanzi = document.createElement("section");
    hanzi.id = "hanziModule";
    hanzi.className = "module-screen hanzi-module";
    hanzi.hidden = true;
    const toolbar = document.createElement("div");
    toolbar.className = "hanzi-module-toolbar";
    const curriculum = $(".curriculum-nav");
    if (curriculum) toolbar.appendChild(curriculum);
    const layout = document.createElement("div");
    layout.className = "hanzi-module-layout";
    const libraryPanel = document.createElement("aside");
    libraryPanel.className = "hanzi-library-panel";
    [...systemSidebar.children].filter(child => child !== moduleNav).forEach(child => libraryPanel.appendChild(child));
    const hanziMain = document.createElement("div");
    hanziMain.className = "hanzi-module-main";
    const characterHeader = $(".character-header");
    if (characterHeader) hanziMain.appendChild(characterHeader);
    ["learnView", "practiceView", "cultureView"].forEach(id => { const panel = $("#" + id); if (panel) hanziMain.appendChild(panel); });
    layout.append(libraryPanel, hanziMain);
    hanzi.append(toolbar, layout);

    const essay = $("#essayView");
    if (essay) { essay.classList.add("module-screen", "essay-module"); essay.classList.remove("view-panel"); essay.removeAttribute("data-panel"); }
    const placeholder = $("#modulePlaceholder");
    if (placeholder) { placeholder.classList.add("module-screen"); placeholder.classList.remove("view-panel"); placeholder.removeAttribute("data-panel"); }
    stage.prepend(home, hanzi);
  }

  function selectModule(module) {
    if (module === "listening-speaking") {
      window.location.href = "modules/listening-speaking/index.html";
      return;
    }
    $$("[data-module]").forEach(button => button.classList.toggle("active", button.dataset.module === module));
    document.body.classList.remove("character-module-active", "essay-module-active");
    $$(".module-screen").forEach(screen => { screen.hidden = true; screen.classList.remove("active"); });
    if (module === "home") { const screen = $("#homeModule"); screen.hidden = false; screen.classList.add("active"); return; }
    if (module === "learn") { document.body.classList.add("character-module-active"); const screen = $("#hanziModule"); screen.hidden = false; screen.classList.add("active"); switchView("learn"); return; }
    if (module === "essay") { document.body.classList.add("essay-module-active"); const screen = $("#essayView"); screen.hidden = false; screen.classList.add("active"); restoreEssayDraft(); setupEssayCanvas(); renderEssay(); window.scrollTo({ top: 0, behavior: "smooth" }); return; }
    const screen = $("#modulePlaceholder"); screen.hidden = false; screen.classList.add("active");
    const names = { pinyin: ["拼音入门 · Pinyin", "从声母、韵母和四声开始，配合听辨与跟读练习。"], vocabulary: ["词汇学记 · Vocabulary", "按教材级别和章节学习词义、例句、搭配与文化用法。"], grammar: ["语法精讲 · Grammar", "通过简明讲解、例句和互动练习掌握句型。"], reading: ["阅读训练 · Reading", "逐步训练关键词识别、段落理解和阅读速度。"], mock: ["HSK 全真模考 · Mock", "按考试结构组织完整模拟测试。"], assessment: ["水平测评 · Assessment", "用短测估计当前水平并推荐学习路径。"], mistakes: ["错题本与复习 · Review", "集中查看错题、薄弱知识点和复习计划。"], progress: ["学习看板 · Progress", "查看学习时长、完成度和能力变化趋势。"] };
    const item = names[module] || ["学习模块 · Learning Module", "该模块正在准备中。"];
    $("#placeholderTitle").textContent = item[0];
    $("#placeholderText").textContent = item[1];
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function updateLiveStatus(status) {
    const el = $("#liveStatus");
    el.className = `live-status ${status === "waiting" ? "" : status}`;
    const textKey = status === "success" ? "completed" : status;
    el.innerHTML = `<i></i>${uiText[state.locale][textKey]}`;
  }

  function resetFeedback(incrementAttempt, preserveSample = false) {
    if (incrementAttempt) state.attempts += 1;
    state.capturedStrokes = [];
    state.currentStroke = null;
    state.pendingStroke = null;
    $("#scoreRing").style.setProperty("--score", 0);
    $("#scoreValue").textContent = "--";
    $("#feedbackTitle").textContent = state.locale === "zh" ? "写完后查看评价" : "Finish writing to see feedback";
    $("#feedbackText").textContent = state.locale === "zh" ? "我们会优先指出最重要的一项改进，不让反馈变成负担。" : "Feedback focuses on the single most useful improvement.";
    $("#orderMetric").textContent = state.locale === "zh" ? "待完成" : "Pending";
    $("#pathMetric").textContent = state.locale === "zh" ? "待完成" : "Pending";
    $("#structureMetric").textContent = state.locale === "zh" ? "待完成" : "Pending";
    $("#attemptMetric").textContent = state.locale === "zh" ? `${state.attempts}次` : `${state.attempts}`;
    $("#rewriteButton").disabled = true;
    if (!preserveSample) {
      $("#userWritingPreview").innerHTML = "";
      $("#samplePlaceholder").hidden = false;
      $("#sampleStatus").textContent = state.locale === "zh" ? "完成后固定显示" : "Shown after completion";
      $("#compareButton").disabled = true;
      setComparison(false);
    } else {
      $("#sampleStatus").textContent = state.locale === "zh" ? "上次书写" : "Previous attempt";
      $("#compareButton").disabled = false;
    }
    updateLiveStatus("waiting");
    $("#practiceHelp").textContent = state.locale === "zh" ? "从第一笔开始。连续写错3次，系统会显示正确笔画提示。" : "Start with stroke 1. After three misses, the correct stroke will be highlighted.";
  }

  function completePractice(data) {
    state.attempts += 1;
    const mistakes = data.totalMistakes ?? state.mistakes;
    const structure = analyzeWriting();
    const score = Math.max(60, 100 - mistakes * 7 - structure.penalty);
    const worstStroke = state.mistakesByStroke.reduce((best, value, index, arr) => value > arr[best] ? index : best, 0);
    const perfect = mistakes === 0;

    $("#scoreRing").style.setProperty("--score", score);
    $("#scoreValue").textContent = score;
    $("#feedbackTitle").textContent = perfect && !structure.suggestion
      ? (state.locale === "zh" ? "写得很稳，笔顺正确" : "Stable writing and correct order")
      : (state.locale === "zh" ? "笔顺正确，再调整一处" : "Correct order — refine one detail");
    const baseFeedback = perfect ? localized(lesson().feedback.perfect) : localized(lesson().feedback.retry[worstStroke]);
    $("#feedbackText").textContent = structure.suggestion || baseFeedback;
    $("#orderMetric").textContent = state.locale === "zh" ? "正确" : "Correct";
    $("#pathMetric").textContent = perfect ? (state.locale === "zh" ? "稳定" : "Stable") : (state.locale === "zh" ? "可再调整" : "Refine");
    $("#structureMetric").textContent = structure.label;
    $("#attemptMetric").textContent = state.locale === "zh" ? `${state.attempts}次` : `${state.attempts}`;
    $("#rewriteButton").disabled = false;
    $("#compareButton").disabled = false;
    setComparison(false);
    renderUserWriting();
    updateLiveStatus("success");
    $("#practiceHelp").textContent = state.locale === "zh" ? "书写已完成。查看右侧点评，或点击“再写一次”。" : "Writing complete. Review the feedback or try again.";
    state.completed.add(state.character);
    saveProgress();
    renderRailState();
  }

  function resetPractice(preserveSample = false) {
    buildQuizWriter(preserveSample);
  }

  function setLocale(locale) {
    state.locale = locale;
    document.documentElement.lang = locale === "zh" ? "zh-Hans" : "en";
    $("#languageLabel").textContent = locale === "zh" ? "中文" : "English";
    $$('[data-text]').forEach(el => {
      const key = el.dataset.text;
      if (uiText[locale][key]) el.textContent = uiText[locale][key];
    });
    $("#resetPracticeButton").textContent = uiText[locale].clear;
    $("#showHintButton").textContent = uiText[locale].hint;
    if (state.phraseMode) {
      if (state.view === "practice") renderPhrasePractice();
      else if (state.view === "culture") renderCulture();
    } else renderCharacter();
  }

  function speakCharacter() {
    if (!("speechSynthesis" in window)) {
      showToast("当前浏览器不支持朗读。 ");
      return;
    }
    speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(state.phraseMode ? state.phraseCharacters.join("") : state.character);
    utterance.lang = "zh-CN";
    utterance.rate = .72;
    speechSynthesis.speak(utterance);
  }

  function bindEvents() {
    $$('[data-module]').forEach(button => button.addEventListener('click', () => selectModule(button.dataset.module)));
    $("#loginButton")?.addEventListener("click", () => showToast("登录与云端同步模块即将接入 · Sign-in and sync are coming soon"));
    $("#characterList").addEventListener("click", event => {
      const item = event.target.closest(".character-item");
      if (!item) return;
      if (state.multiSelecting) {
        const character = item.dataset.character;
        const position = state.selectedCharacters.indexOf(character);
        if (position >= 0) state.selectedCharacters.splice(position, 1);
        else state.selectedCharacters.push(character);
        renderMultiSelection();
        return;
      }
      if (item.dataset.chapter !== currentChapter.id) selectChapter(item.dataset.chapter, item.dataset.character);
      else if (item.dataset.character !== state.character) activateCharacter(item.dataset.character);
    });

    $("#chapterSelect").addEventListener("change", event => selectChapter(event.target.value));
    $("#seriesSelect").addEventListener("change", () => showToast("当前版本已录入“发展汉语”，其他教材将在审核后加入。"));
    $("#bookSelect").addEventListener("change", () => showToast("当前版本已录入“初级综合1”，其他册别将在审核后加入。"));
    $("#characterSearch").addEventListener("input", renderCharacterRail);
    $("#searchScope").addEventListener("change", renderCharacterRail);
    $("#clearSearchButton").addEventListener("click", () => {
      $("#characterSearch").value = "";
      $("#characterSearch").focus();
      renderCharacterRail();
    });
    $("#directStudy").addEventListener("click", event => {
      const button = event.target.closest("[data-direct-study]");
      if (!button) return;
      const text = button.dataset.directStudy;
      if (text.length === 1) activateCharacter(text);
      else startPhrasePractice([...text]);
    });

    $$(".step-tab").forEach(tab => tab.addEventListener("click", () => switchView(tab.dataset.view)));
    $$('[data-go-view]').forEach(button => button.addEventListener("click", () => switchView(button.dataset.goView)));
    $("#playSequenceButton").addEventListener("click", playStrokeSequence);
    $("#playFullButton").addEventListener("click", () => playFull());
    $("#radicalButton").addEventListener("click", highlightRadical);
    $("#cultureAnimateButton").addEventListener("click", () => { switchView("learn"); setTimeout(highlightRadical, 220); });
    $("#playAllCultureButton").addEventListener("click", playAllCultureAudio);
    const cultureSpeedRange = $("#cultureSpeedRange");
    const cultureSpeedValue = $("#cultureSpeedValue");
    cultureSpeedRange.value = culturePlayer.playbackRate.toFixed(2);
    cultureSpeedValue.value = `${culturePlayer.playbackRate.toFixed(2)}×`;
    cultureSpeedRange.addEventListener("input", () => {
      culturePlayer.playbackRate = Number(cultureSpeedRange.value);
      cultureSpeedValue.value = `${culturePlayer.playbackRate.toFixed(2)}×`;
      localStorage.setItem("hanzi-culture-audio-rate", String(culturePlayer.playbackRate));
    });
    $(".culture-content").addEventListener("click", event => {
      const button = event.target.closest("[data-culture-audio]");
      if (button) playCultureSection(button.dataset.cultureAudio);
    });
    $("#practiceDemoButton").addEventListener("click", () => playFull(state.modelWriter));
    $("#showHintButton").addEventListener("click", () => playFull(state.modelWriter));
    $("#resetPracticeButton").addEventListener("click", () => resetPractice(false));
    $("#rewriteButton").addEventListener("click", () => resetPractice(true));
    $("#compareButton").addEventListener("click", () => setComparison(!state.comparing));
    $("#multiSelectToggle").addEventListener("click", () => {
      state.multiSelecting = !state.multiSelecting;
      if (!state.multiSelecting) state.selectedCharacters = [];
      renderMultiSelection();
    });
    $$("[data-phrase]").forEach(button => button.addEventListener("click", () => startPhrasePractice([...button.dataset.phrase])));
    $("#startMultiPractice").addEventListener("click", () => startPhrasePractice([...state.selectedCharacters]));
    $("#exitPhraseButton").addEventListener("click", exitPhrasePractice);
    $("#rewritePhraseButton").addEventListener("click", renderPhrasePractice);
    $("#phraseOverlayButton").addEventListener("click", () => {
      const panel = $("#phraseComparison");
      const comparing = panel.classList.toggle("comparing");
      $("#phraseOverlayButton").textContent = comparing ? (state.locale === "zh" ? "只看真实笔迹" : "Show writing only") : (state.locale === "zh" ? "叠加标准字" : "Overlay standard");
    });
    $("#speakButton").addEventListener("click", speakCharacter);
    $$("[data-essay-mode]").forEach(button => button.addEventListener("click", () => {
      state.essayMode = button.dataset.essayMode;
      $$("[data-essay-mode]").forEach(item => item.classList.toggle("active", item === button));
      $("#essaySampleInput").hidden = state.essayMode !== "sample";
    }));
    $("#essayStartButton").addEventListener("click", startEssay);
    $("#essayConfirmButton").addEventListener("click", confirmEssayCell);
    $("#essayClearButton").addEventListener("click", () => { essayClearCanvas(); });
    $$("[data-essay-edit]").forEach(button => button.addEventListener("click", () => essayEdit(button.dataset.essayEdit)));
    $("#essayPages").addEventListener("click", event => {
      const cell = event.target.closest("[data-essay-index]");
      if (!cell) return;
      state.essaySelectedIndex = Number(cell.dataset.essayIndex);
      state.essayPage = Math.floor(state.essaySelectedIndex / ESSAY_PAGE_SIZE);
      renderEssay();
    });
    $("#essayPrevPageButton").addEventListener("click", () => { state.essayPage = Math.max(0, state.essayPage - 1); renderEssay(); });
    $("#essayNextPageButton").addEventListener("click", () => { state.essayPage += 1; renderEssay(); });
    $("#essayEvaluateButton").addEventListener("click", evaluateEssay);
    $("#essayAiFab").addEventListener("click", () => { $("#essayAiPanel").hidden = false; $("#essayAiRequest").focus(); });
    $("#essayAiClose").addEventListener("click", () => { $("#essayAiPanel").hidden = true; });
    $("#essayAiAsk").addEventListener("click", () => requestEssayAssist().catch(error => { $("#essayAiResult").textContent = error.message || "AI助写暂时不可用"; }));
    $("#essayContinueButton").addEventListener("click", () => { $("#essayFeedback").hidden = true; showToast("已进入修改状态，完成后请再次点评"); });
    $("#essayExportButton").addEventListener("click", exportEssayPng);
    $("#strokeSteps").addEventListener("click", event => {
      const step = event.target.closest(".stroke-step");
      if (step) playSingleStroke(Number(step.dataset.strokeIndex));
    });

    const practiceGrid = $(".tianzige.practice");
    practiceGrid.addEventListener("pointerdown", startStrokeCapture, true);
    practiceGrid.addEventListener("pointermove", continueStrokeCapture, true);
    practiceGrid.addEventListener("pointerup", finishStrokeCapture, true);
    practiceGrid.addEventListener("pointercancel", finishStrokeCapture, true);

    $$("[data-practice-mode]").forEach(button => button.addEventListener("click", () => {
      state.practiceMode = button.dataset.practiceMode;
      $$("[data-practice-mode]").forEach(item => item.classList.toggle("active", item === button));
      if (state.phraseMode) renderPhrasePractice();
      else buildQuizWriter();
    }));

    $("#languageButton").addEventListener("click", () => {
      const menu = $("#languageMenu");
      menu.hidden = !menu.hidden;
      $("#languageButton").setAttribute("aria-expanded", String(!menu.hidden));
    });
    $("#languageMenu").addEventListener("click", event => {
      const button = event.target.closest("[data-locale]");
      if (!button) return;
      setLocale(button.dataset.locale);
      $("#languageMenu").hidden = true;
      $("#languageButton").setAttribute("aria-expanded", "false");
    });
    document.addEventListener("click", event => {
      if (!event.target.closest(".topbar-actions")) {
        $("#languageMenu").hidden = true;
        $("#languageButton").setAttribute("aria-expanded", "false");
      }
    });

    culturePlayer.addEventListener("play", updateCultureAudioButtons);
    culturePlayer.addEventListener("pause", updateCultureAudioButtons);
    culturePlayer.addEventListener("timeupdate", () => {
      if (!state.cultureAudioKey || culturePlayer.paused) return;
      const cached = cultureAudioCache.get(cultureEntity().key);
      const section = cached?.manifest.sections.find(item => item.key === state.cultureAudioKey);
      if (!section) return;
      setCultureAudioStatus(`${state.locale === "zh" ? "正在朗读" : "Playing"}：${section.title} · ${formatAudioTime(culturePlayer.currentTime)} / ${formatAudioTime(culturePlayer.duration)}`);
    });
    culturePlayer.addEventListener("ended", () => {
      if (state.culturePlayAllActive && state.cultureQueue.length) {
        const next = state.cultureQueue.shift();
        playCultureSection(next, true);
        return;
      }
      state.cultureAudioKey = "";
      state.cultureQueue = [];
      state.culturePlayAllActive = false;
      setCultureAudioStatus(state.locale === "zh" ? "朗读完成，可再次播放" : "Playback complete");
      updateCultureAudioButtons();
    });
    culturePlayer.addEventListener("error", () => {
      if (!state.cultureAudioKey) return;
      cultureAudioCache.delete(cultureEntity().key);
      state.cultureAudioKey = "";
      state.cultureQueue = [];
      state.culturePlayAllActive = false;
      setCultureAudioStatus(state.locale === "zh" ? "音频地址已失效，请重新点击播放" : "Audio link expired; play again");
      updateCultureAudioButtons();
    });

    let resizeTimer;
    window.addEventListener("resize", () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        if (state.phraseMode && state.view === "practice" && !state.phraseEntries.some(entry => entry.captured.length)) renderPhrasePractice();
        else if (state.view !== "practice" || $("#rewriteButton").disabled) buildWriters();
        syncAnnotationLines();
      }, 240);
    });
  }

  buildSystemLayout();
  initCurriculumNavigation();
  bindEvents();
  setupPwaInstall();
  renderCharacterRail();
  renderMultiSelection();
  renderCharacter();
  switchView("learn");
  const requestedModule = new URLSearchParams(location.search).get("module");
  selectModule(["learn", "essay"].includes(requestedModule) ? requestedModule : "home");
  const initialCharacter = state.character;
  ensureRemoteContent("character", initialCharacter).then(content => {
    if (!content || state.character !== initialCharacter || state.phraseMode) return;
    renderCharacterRail();
    renderCharacter();
  });
  if ("serviceWorker" in navigator && /^https?:$/.test(location.protocol)) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("./sw.js").catch(error => console.warn("PWA service worker registration failed:", error));
    });
  }
})();
