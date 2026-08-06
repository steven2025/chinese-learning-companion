const DATA_URL = "../../data/games/character-hit/zjzh-1-1-2.json";
const STAGES = ["components", "pinyin", "meaning"];
const AUDIO_FILES = {
  launch: "assets/audio/launch.wav",
  correct: "assets/audio/correct.wav",
  wrong: "assets/audio/shatter.wav",
  place: "assets/audio/place.wav",
  stage: "assets/audio/stage.wav",
  victory: "assets/audio/victory.wav",
};

const elements = {
  game: document.querySelector("#game"),
  scene: document.querySelector("#scene"),
  playfield: document.querySelector("#playfield"),
  floatLayer: document.querySelector("#floatLayer"),
  effectsLayer: document.querySelector("#effectsLayer"),
  aimLine: document.querySelector("#aimLine"),
  crosshair: document.querySelector("#crosshair"),
  launcher: document.querySelector("#launcher"),
  score: document.querySelector("#score"),
  streak: document.querySelector("#streak"),
  roundLabel: document.querySelector("#roundLabel"),
  roundProgress: document.querySelector("#roundProgress"),
  stageKicker: document.querySelector("#stageKicker"),
  stageTitle: document.querySelector("#stageTitle"),
  stageHint: document.querySelector("#stageHint"),
  currentWord: document.querySelector("#currentWord"),
  wordStatus: document.querySelector("#wordStatus"),
  characterGhost: document.querySelector("#characterGhost"),
  characterComplete: document.querySelector("#characterComplete"),
  placedComponents: document.querySelector("#placedComponents"),
  assembledPinyin: document.querySelector("#assembledPinyin"),
  assembledMeaning: document.querySelector("#assembledMeaning"),
  feedback: document.querySelector("#feedback"),
  language: document.querySelector("#languageSelect"),
  sound: document.querySelector("#soundButton"),
  hint: document.querySelector("#hintButton"),
  pause: document.querySelector("#pauseButton"),
  startScreen: document.querySelector("#startScreen"),
  start: document.querySelector("#startButton"),
  pauseScreen: document.querySelector("#pauseScreen"),
  resume: document.querySelector("#resumeButton"),
  resultScreen: document.querySelector("#resultScreen"),
  finalScore: document.querySelector("#finalScore"),
  resultSummary: document.querySelector("#resultSummary"),
  replay: document.querySelector("#replayButton"),
};

const state = {
  data: null,
  itemIndex: 0,
  stageIndex: 0,
  score: 0,
  streak: 0,
  mistakes: 0,
  hints: 0,
  placed: new Set(),
  targets: [],
  running: false,
  paused: false,
  sound: true,
  locked: false,
  lastFrame: 0,
};

const sounds = Object.fromEntries(Object.entries(AUDIO_FILES).map(([key, src]) => {
  const audio = new Audio(src);
  audio.preload = "auto";
  return [key, audio];
}));

function playSound(name, volume = 0.72) {
  if (!state.sound || !sounds[name]) return;
  const audio = sounds[name].cloneNode();
  audio.volume = volume;
  void audio.play().catch(() => {});
}

function shuffle(values) {
  const copy = [...values];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[randomIndex]] = [copy[randomIndex], copy[index]];
  }
  return copy;
}

function currentItem() {
  return state.data.items[state.itemIndex];
}

function currentStage() {
  return STAGES[state.stageIndex];
}

function setFeedback(message) {
  elements.feedback.textContent = message;
}

function updateHud() {
  const total = state.data?.items.length || 1;
  elements.score.textContent = state.score;
  elements.streak.textContent = state.streak;
  elements.roundLabel.textContent = `第 ${state.itemIndex + 1} / ${total} 词`;
  elements.roundProgress.style.width = `${((state.itemIndex * 3 + state.stageIndex) / (total * 3)) * 100}%`;
  document.querySelectorAll("[data-stage-step]").forEach((step, index) => {
    step.classList.toggle("active", index === state.stageIndex);
    step.classList.toggle("done", index < state.stageIndex);
  });
}

function setMission(stage) {
  const item = currentItem();
  const mission = {
    components: ["第一步 · 组汉字", "射中正确部件", `找到构成“${item.targetCharacter}”的${item.components.length}个部件`],
    pinyin: ["第二步 · 辨拼音", "射中词语的正确拼音", `注意声调，选择“${item.word}”的读音`],
    meaning: ["第三步 · 认词义", "射中正确的母语解释", "排除相近选项，确认整个词语的意义"],
  }[stage];
  [elements.stageKicker.textContent, elements.stageTitle.textContent, elements.stageHint.textContent] = mission;
  elements.wordStatus.textContent = stage === "components" ? `先完成“${item.targetCharacter}”的字形` : stage === "pinyin" ? "字形完成，继续辨音" : "最后确认整个词语的意义";
}

function resetAssembly() {
  const item = currentItem();
  state.placed.clear();
  elements.currentWord.textContent = item.word;
  elements.characterGhost.textContent = item.targetCharacter;
  elements.characterComplete.textContent = item.targetCharacter;
  elements.characterComplete.classList.remove("show");
  elements.placedComponents.replaceChildren();
  elements.assembledPinyin.textContent = "";
  elements.assembledMeaning.textContent = "";
}

function clearTargets() {
  state.targets.forEach((target) => target.element.remove());
  state.targets = [];
}

function targetChoices(stage) {
  const item = currentItem();
  if (stage === "components") {
    return shuffle([
      ...item.components.map((component, index) => ({ value: component.value, correct: true, componentIndex: index })),
      ...item.componentDistractors.map((value) => ({ value, correct: false })),
    ]);
  }
  if (stage === "pinyin") {
    return shuffle([{ value: item.pinyin, correct: true }, ...item.pinyinDistractors.map((value) => ({ value, correct: false }))]);
  }
  const language = elements.language.value;
  const correct = item.meanings[language] || item.meanings.en;
  const configured = item.meaningDistractors?.[language] || item.meaningDistractors?.en;
  const distractors = configured || shuffle(state.data.items
    .filter((entry) => entry.wordId !== item.wordId || entry.lessonId !== item.lessonId)
    .map((entry) => entry.meanings[language] || entry.meanings.en)
    .filter(Boolean)).slice(0, 3);
  return shuffle([{ value: correct, correct: true }, ...distractors.map((value) => ({ value, correct: false }))]);
}

function positionFor(index, total, width, height) {
  const safeTop = width < 720 ? 150 : 122;
  const safeBottom = Math.max(safeTop + 100, height - 245);
  const columns = width < 720 ? 2 : total > 4 ? 3 : 2;
  const rows = Math.ceil(total / columns);
  const column = index % columns;
  const row = Math.floor(index / columns);
  const usableWidth = Math.max(250, width - 300);
  const leftStart = width < 720 ? 12 : 150;
  const x = leftStart + (column + .45) * (usableWidth / columns) + (Math.random() * 34 - 17);
  const y = safeTop + (row + .35) * ((safeBottom - safeTop) / Math.max(rows, 1)) + (Math.random() * 24 - 12);
  return { x: Math.max(8, Math.min(width - 180, x)), y: Math.max(safeTop, Math.min(safeBottom, y)) };
}

function spawnTargets() {
  clearTargets();
  const stage = currentStage();
  const choices = targetChoices(stage);
  const width = elements.playfield.clientWidth;
  const height = elements.playfield.clientHeight;
  choices.forEach((choice, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "target";
    button.dataset.kind = stage;
    button.dataset.correct = String(choice.correct);
    button.dataset.componentIndex = choice.componentIndex ?? "";
    if (stage !== "components") {
      button.classList.add("balloon", `balloon-${(index % 6) + 1}`);
    }
    button.textContent = choice.value;
    if (stage !== "components") {
      button.innerHTML = `<span>${escapeHtml(choice.value)}</span><i class="balloon-string" aria-hidden="true"></i>`;
    }
    button.setAttribute("aria-label", `射击 ${choice.value}`);
    const position = positionFor(index, choices.length, width, height);
    const target = {
      element: button,
      x: position.x,
      y: position.y,
      vx: (18 + Math.random() * 16) * (index % 2 ? 1 : -1),
      vy: (5 + Math.random() * 8) * (index % 3 ? 1 : -1),
      choice,
    };
    button.style.left = `${target.x}px`;
    button.style.top = `${target.y}px`;
    button.addEventListener("pointerenter", () => button.classList.add("aimed"));
    button.addEventListener("pointerleave", () => button.classList.remove("aimed"));
    button.addEventListener("pointerdown", (event) => {
      event.preventDefault();
      void shootTarget(target);
    });
    elements.floatLayer.append(button);
    state.targets.push(target);
  });
}

function escapeHtml(value) {
  return String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
}

function startStage() {
  state.locked = false;
  setMission(currentStage());
  updateHud();
  spawnTargets();
  setFeedback(elements.stageHint.textContent);
}

function launcherPoint() {
  const fieldRect = elements.playfield.getBoundingClientRect();
  const launcherRect = elements.launcher.getBoundingClientRect();
  return {
    x: launcherRect.left - fieldRect.left + launcherRect.width * .5,
    y: launcherRect.top - fieldRect.top + launcherRect.height * .3,
  };
}

function targetPoint(target) {
  const fieldRect = elements.playfield.getBoundingClientRect();
  const rect = target.element.getBoundingClientRect();
  return { x: rect.left - fieldRect.left + rect.width / 2, y: rect.top - fieldRect.top + rect.height / 2 };
}

async function animateProjectile(target) {
  const start = launcherPoint();
  const end = targetPoint(target);
  const projectile = document.createElement("i");
  projectile.className = "projectile";
  projectile.style.left = `${start.x}px`;
  projectile.style.top = `${start.y}px`;
  elements.effectsLayer.append(projectile);
  playSound("launch", .62);
  const animation = projectile.animate([
    { transform: "translate(-50%, -50%) scale(.7)", left: `${start.x}px`, top: `${start.y}px` },
    { transform: "translate(-50%, -50%) scale(1.15)", left: `${end.x}px`, top: `${end.y}px` },
  ], { duration: 250, easing: "cubic-bezier(.2,.75,.2,1)" });
  await animation.finished.catch(() => {});
  projectile.remove();
  return end;
}

function addScore(value, point, wrong = false) {
  state.score = Math.max(0, state.score + value);
  const pop = document.createElement("span");
  pop.className = `score-pop${wrong ? " wrong" : ""}`;
  pop.textContent = value > 0 ? `+${value}` : String(value);
  pop.style.left = `${point.x}px`;
  pop.style.top = `${point.y}px`;
  elements.effectsLayer.append(pop);
  setTimeout(() => pop.remove(), 750);
  updateHud();
}

function shatterTarget(target, point) {
  const value = target.choice.value;
  for (let index = 0; index < 9; index += 1) {
    const fragment = document.createElement("i");
    fragment.className = "fragment";
    fragment.textContent = value[index % value.length] || "·";
    fragment.style.left = `${point.x}px`;
    fragment.style.top = `${point.y}px`;
    elements.effectsLayer.append(fragment);
    const angle = (Math.PI * 2 * index) / 9;
    fragment.animate([
      { transform: "translate(-50%, -50%) rotate(0deg)", opacity: 1 },
      { transform: `translate(${Math.cos(angle) * (50 + index * 4)}px, ${Math.sin(angle) * 38 + 70}px) rotate(${index * 75}deg)`, opacity: 0 },
    ], { duration: 620, easing: "cubic-bezier(.15,.7,.4,1)" });
    setTimeout(() => fragment.remove(), 650);
  }
  target.element.remove();
  state.targets = state.targets.filter((entry) => entry !== target);
}

function placeComponent(componentIndex) {
  if (state.placed.has(componentIndex)) return;
  const component = currentItem().components[componentIndex];
  state.placed.add(componentIndex);
  const piece = document.createElement("b");
  piece.className = "placed-component";
  piece.textContent = component.value;
  piece.style.left = `${component.x}%`;
  piece.style.top = `${component.y}%`;
  piece.style.fontSize = `${component.size}px`;
  elements.placedComponents.append(piece);
  playSound("place", .72);
  if (state.placed.size === currentItem().components.length) {
    setTimeout(() => {
      elements.characterComplete.classList.add("show");
      elements.placedComponents.style.opacity = "0";
    }, 280);
  }
}

function pronounceWord(word) {
  if (!("speechSynthesis" in window) || !state.sound) return;
  speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(word);
  utterance.lang = "zh-CN";
  utterance.rate = .76;
  utterance.pitch = 1;
  speechSynthesis.speak(utterance);
}

async function shootTarget(target) {
  if (!state.running || state.paused || state.locked || target.element.classList.contains("shot")) return;
  target.element.classList.add("shot");
  const point = await animateProjectile(target);
  if (!target.choice.correct) {
    state.mistakes += 1;
    state.streak = 0;
    addScore(-20, point, true);
    playSound("wrong", .72);
    shatterTarget(target, point);
    setFeedback("这个目标不属于当前答案，再观察一次");
    return;
  }

  state.streak += 1;
  addScore(100 + Math.min(state.streak, 5) * 10, point);
  playSound("correct", .75);
  target.element.remove();
  state.targets = state.targets.filter((entry) => entry !== target);

  if (currentStage() === "components") {
    placeComponent(Number(target.choice.componentIndex));
    if (state.placed.size < currentItem().components.length) {
      setFeedback(`正确，还差 ${currentItem().components.length - state.placed.size} 个部件`);
      return;
    }
    setFeedback(`组合成功：“${currentItem().targetCharacter}”`);
  } else if (currentStage() === "pinyin") {
    elements.assembledPinyin.textContent = currentItem().pinyin;
    pronounceWord(currentItem().word);
    setFeedback("拼音正确，听一听完整词语");
  } else {
    const language = elements.language.value;
    elements.assembledMeaning.textContent = currentItem().meanings[language] || currentItem().meanings.en;
    setFeedback(`完成“${currentItem().word}”`);
  }
  state.locked = true;
  clearTargets();
  setTimeout(advanceStage, currentStage() === "meaning" ? 1200 : 780);
}

function advanceStage() {
  if (!state.running) return;
  if (state.stageIndex < STAGES.length - 1) {
    state.stageIndex += 1;
    playSound("stage", .7);
    startStage();
    return;
  }
  if (state.itemIndex < state.data.items.length - 1) {
    state.itemIndex += 1;
    state.stageIndex = 0;
    elements.placedComponents.style.opacity = "1";
    resetAssembly();
    playSound("stage", .75);
    startStage();
    return;
  }
  finishGame();
}

function finishGame() {
  state.running = false;
  clearTargets();
  elements.roundProgress.style.width = "100%";
  elements.finalScore.textContent = state.score;
  elements.resultSummary.textContent = `完成 ${state.data.items.length} 个教材词语，失误 ${state.mistakes} 次，使用提示 ${state.hints} 次。`;
  elements.resultScreen.hidden = false;
  playSound("victory", .82);
}

function startGame() {
  state.itemIndex = 0;
  state.stageIndex = 0;
  state.score = 0;
  state.streak = 0;
  state.mistakes = 0;
  state.hints = 0;
  state.running = true;
  state.paused = false;
  state.lastFrame = performance.now();
  elements.startScreen.hidden = true;
  elements.resultScreen.hidden = true;
  elements.pauseScreen.hidden = true;
  elements.placedComponents.style.opacity = "1";
  resetAssembly();
  startStage();
  requestAnimationFrame(tick);
}

function setPaused(paused) {
  if (!state.running) return;
  state.paused = paused;
  elements.pauseScreen.hidden = !paused;
  state.lastFrame = performance.now();
}

function showHint() {
  if (!state.running || state.paused) return;
  state.hints += 1;
  state.score = Math.max(0, state.score - 10);
  const correctTargets = state.targets.filter((target) => target.choice.correct);
  correctTargets.forEach((target) => {
    target.element.animate([
      { boxShadow: "0 6px 0 rgba(29,83,80,.38), 0 0 0 0 rgba(212,148,23,0)" },
      { boxShadow: "0 6px 0 rgba(29,83,80,.38), 0 0 0 10px rgba(212,148,23,.65)" },
      { boxShadow: "0 6px 0 rgba(29,83,80,.38), 0 0 0 0 rgba(212,148,23,0)" },
    ], { duration: 900 });
  });
  setFeedback("金色光圈标出了正确方向");
  updateHud();
}

function tick(now) {
  if (!state.running) return;
  const delta = Math.min((now - state.lastFrame) / 1000, .04);
  state.lastFrame = now;
  if (!state.paused) {
    const width = elements.playfield.clientWidth;
    const height = elements.playfield.clientHeight;
    state.targets.forEach((target) => {
      const targetWidth = target.element.offsetWidth;
      const targetHeight = target.element.offsetHeight;
      const minX = width < 720 ? 6 : 105;
      const maxX = Math.max(minX + 10, width - targetWidth - (width < 720 ? 6 : 130));
      const minY = width < 720 ? 150 : 112;
      const maxY = Math.max(minY + 10, height - targetHeight - 220);
      target.x += target.vx * delta;
      target.y += target.vy * delta;
      if (target.x <= minX || target.x >= maxX) target.vx *= -1;
      if (target.y <= minY || target.y >= maxY) target.vy *= -1;
      target.x = Math.max(minX, Math.min(maxX, target.x));
      target.y = Math.max(minY, Math.min(maxY, target.y));
      target.element.style.left = `${target.x}px`;
      target.element.style.top = `${target.y}px`;
    });
  }
  requestAnimationFrame(tick);
}

function updateAim(event) {
  const rect = elements.playfield.getBoundingClientRect();
  const x = event.clientX - rect.left;
  const y = event.clientY - rect.top;
  const start = launcherPoint();
  elements.crosshair.style.left = `${x}px`;
  elements.crosshair.style.top = `${y}px`;
  elements.aimLine.setAttribute("x1", start.x);
  elements.aimLine.setAttribute("y1", start.y);
  elements.aimLine.setAttribute("x2", x);
  elements.aimLine.setAttribute("y2", y);
  const angle = Math.atan2(y - start.y, x - start.x) * 180 / Math.PI + 90;
  elements.launcher.style.rotate = `${Math.max(-62, Math.min(62, angle))}deg`;
}

async function loadGame() {
  try {
    const response = await fetch(DATA_URL);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    state.data = await response.json();
    elements.roundLabel.textContent = `第 1 / ${state.data.items.length} 词`;
    elements.start.disabled = false;
    elements.start.querySelector("b").textContent = "开始挑战";
    elements.start.querySelector("small").textContent = "Start";
  } catch (error) {
    elements.start.querySelector("b").textContent = "资料加载失败";
    elements.start.disabled = true;
    setFeedback(`无法读取游戏资料：${error.message}`);
  }
}

elements.start.addEventListener("click", startGame);
elements.replay.addEventListener("click", startGame);
elements.pause.addEventListener("click", () => setPaused(true));
elements.resume.addEventListener("click", () => setPaused(false));
elements.hint.addEventListener("click", showHint);
elements.sound.addEventListener("click", () => {
  state.sound = !state.sound;
  elements.sound.setAttribute("aria-pressed", String(state.sound));
  elements.sound.querySelector("b").textContent = state.sound ? "声音" : "静音";
});
elements.language.addEventListener("change", () => {
  if (!state.running) return;
  if (currentStage() === "meaning") spawnTargets();
  if (elements.assembledMeaning.textContent) {
    const item = currentItem();
    elements.assembledMeaning.textContent = item.meanings[elements.language.value] || item.meanings.en;
  }
});
elements.playfield.addEventListener("pointermove", updateAim);
window.addEventListener("blur", () => { if (state.running) setPaused(true); });
document.addEventListener("visibilitychange", () => { if (document.hidden && state.running) setPaused(true); });

void loadGame();
