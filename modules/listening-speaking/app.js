(function () {
  "use strict";

  const demo = window.LISTENING_SPEAKING_DEMO;
  const config = window.LISTENING_SPEAKING_CONFIG || {};
  const $ = selector => document.querySelector(selector);
  const $$ = selector => [...document.querySelectorAll(selector)];
  const storageKeys = {
    records: "tiantian-listening-speaking-records-v1",
    queue: "tiantian-speaking-practice-queue-v1"
  };
  const state = {
    screen: "home",
    listeningTab: "dictation",
    readingTab: "repeat",
    answerMode: "typing",
    dictationPlays: 0,
    dictationSlow: false,
    tileWords: [],
    testChoice: "",
    testPlays: 0,
    testSlow: false,
    scenario: "restaurant",
    turns: 0,
    autoPlay: config.autoPlayFeedback !== false,
    mediaRecorder: null,
    mediaStream: null,
    chunks: [],
    recordTarget: "",
    recordingUrl: "",
    lastTalkSpeech: "",
    replayAudio: null,
    timer: null,
    startedAt: 0,
    records: readJson(storageKeys.records, []),
    queue: readJson(storageKeys.queue, [])
  };
  const orbs = {};
  let activeSpeechOrb = null;

  function initVoiceOrbs() {
    if (!window.VoiceOrb) return;
    orbs.dictation = new VoiceOrb($("#dictationOrb"), { theme: "cyan" });
    orbs.test = new VoiceOrb($("#testOrb"), { theme: "cyan" });
    orbs.model = new VoiceOrb($("#modelOrb"), { theme: "cyan" });
    orbs.record = new VoiceOrb($("#recordOrb"), { theme: "violet" });
    orbs.talkPlayback = new VoiceOrb($("#talkPlaybackOrb"), { theme: "cyan" });
    orbs.talkRecord = new VoiceOrb($("#talkRecordOrb"), { theme: "violet" });
  }

  function setOrbGlyph(orb, glyph) {
    const element = orb?.root.querySelector(".orb-glyph");
    if (element) element.textContent = glyph;
  }

  function settleOrb(orb, stateName = "idle") {
    if (!orb) return;
    orb.detachAudio();
    orb.setTheme(stateName === "complete" ? "green" : orb === orbs.record || orb === orbs.talkRecord ? "violet" : "cyan");
    orb.setState(stateName);
    setOrbGlyph(orb, stateName === "complete" ? "✓" : orb === orbs.record || orb === orbs.talkRecord ? "●" : "▶");
  }

  function readJson(key, fallback) {
    try { return JSON.parse(localStorage.getItem(key) || "null") || fallback; }
    catch (_) { return fallback; }
  }

  function writeJson(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); }
    catch (_) {}
  }

  function toast(message) {
    const element = $("#toast");
    element.textContent = message;
    element.classList.add("show");
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => element.classList.remove("show"), 2600);
  }

  function normalize(text) {
    return String(text || "").replace(/[\s，。！？、,.!?]/g, "").trim();
  }

  function saveRecord(type, result) {
    state.records.push({ type, result, createdAt: new Date().toISOString() });
    state.records = state.records.slice(-100);
    writeJson(storageKeys.records, state.records);
    renderDashboard();
  }

  function addToQueue(text, source) {
    if (!text) return;
    if (!state.queue.some(item => item.text === text)) state.queue.push({ text, source, createdAt: new Date().toISOString() });
    writeJson(storageKeys.queue, state.queue);
    renderQueue();
    toast("已加入跟读练习 · Added to practice queue");
  }

  function renderDashboard() {
    const today = new Date().toDateString();
    const todayRecords = state.records.filter(record => new Date(record.createdAt).toDateString() === today);
    const count = type => state.records.filter(record => record.type === type).length;
    $("#todayCount").textContent = todayRecords.length;
    $("#reviewCount").textContent = state.records.filter(record => record.result === "review").length;
    $("#lastTraining").textContent = state.records.length ? new Date(state.records.at(-1).createdAt).toLocaleString("zh-CN", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "尚未开始";
    $("#listeningCount").textContent = `${count("dictation") + count("listening_test")} 次`;
    $("#readingCount").textContent = `${count("repeat") + count("oral_reading")} 次`;
    $("#talkCount").textContent = `${count("dialogue")} 次`;
  }

  function openScreen(name) {
    if (state.mediaRecorder?.state === "recording") stopRecording();
    state.screen = name;
    $$("[data-screen-panel]").forEach(panel => { panel.hidden = panel.dataset.screenPanel !== name; panel.classList.toggle("active", panel.dataset.screenPanel === name); });
    $$("[data-screen]").forEach(button => button.classList.toggle("active", button.dataset.screen === name));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function speak(text, rate = .82, orb = orbs.talkPlayback) {
    if (!("speechSynthesis" in window)) { toast("当前浏览器不支持语音播放"); return; }
    if (activeSpeechOrb && activeSpeechOrb !== orb) settleOrb(activeSpeechOrb);
    speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "zh-CN";
    utterance.rate = rate;
    activeSpeechOrb = orb;
    if (orb) {
      orb.setTheme("cyan");
      orb.setState("playing", { synthetic: true });
      setOrbGlyph(orb, "❚❚");
    }
    const finish = () => {
      if (activeSpeechOrb === orb) activeSpeechOrb = null;
      settleOrb(orb);
    };
    utterance.addEventListener("end", finish, { once: true });
    utterance.addEventListener("error", finish, { once: true });
    speechSynthesis.speak(utterance);
  }

  function setListeningTab(tab) {
    state.listeningTab = tab;
    $$('[data-listening-tab]').forEach(button => button.classList.toggle("active", button.dataset.listeningTab === tab));
    $("#dictationPanel").hidden = tab !== "dictation";
    $("#listeningTestPanel").hidden = tab !== "test";
  }

  function setAnswerMode(mode) {
    state.answerMode = mode;
    $$('[data-answer-mode]').forEach(button => button.classList.toggle("active", button.dataset.answerMode === mode));
    $("#typingAnswer").hidden = mode !== "typing";
    $("#tileAnswer").hidden = mode !== "tiles";
    $("#handwritingAnswer").hidden = mode !== "handwriting";
    $("#answerModeLabel").textContent = { typing: "输入", tiles: "选字", handwriting: "手写" }[mode];
  }

  function renderTiles() {
    const container = $("#wordTiles");
    container.innerHTML = "";
    demo.dictation.tiles.forEach((word, index) => {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = word;
      button.disabled = state.tileWords.some(item => item.index === index);
      button.addEventListener("click", () => {
        state.tileWords.push({ word, index });
        renderTiles();
      });
      container.appendChild(button);
    });
    const slots = $("#answerSlots");
    slots.textContent = state.tileWords.length ? state.tileWords.map(item => item.word).join("") : "点击下面的词语组成句子";
    if (state.tileWords.length) {
      slots.title = "点击清空并重新排列";
      slots.onclick = () => { state.tileWords = []; renderTiles(); };
    }
  }

  function submitDictation() {
    if (state.answerMode === "handwriting") { toast("手写画布将在下一阶段接入；请先使用输入或选字方式"); return; }
    const answer = state.answerMode === "typing" ? $("#dictationInput").value : state.tileWords.map(item => item.word).join("");
    if (!answer.trim()) { toast("请先填写答案 · Please answer first"); return; }
    const correct = normalize(answer) === normalize(demo.dictation.text);
    const feedback = $("#dictationFeedback");
    feedback.hidden = false;
    feedback.classList.toggle("error", !correct);
    if (correct) {
      feedback.innerHTML = `<strong>听写正确 · Correct</strong>你已经听清了句子中的主要词语。播放 ${state.dictationPlays} 次${state.dictationSlow ? "，使用过慢速" : ""}。`;
      saveRecord("dictation", state.dictationPlays > 2 || state.dictationSlow ? "review" : "mastered");
    } else {
      feedback.innerHTML = `<strong>再听一次 · Try again</strong>标准句子是：“${demo.dictation.text}”<br>你可能需要重点听“每天、地铁、学校”。<br><button class="ghost-button" id="dictationToReading" type="button">加入模仿跟读 · Add to Repeat</button>`;
      $("#dictationToReading").addEventListener("click", () => addToQueue(demo.dictation.keySentence, "听写错题"));
      saveRecord("dictation", "review");
    }
  }

  function setReadingTab(tab) {
    state.readingTab = tab;
    $$('[data-reading-tab]').forEach(button => button.classList.toggle("active", button.dataset.readingTab === tab));
    const material = demo.reading[tab];
    $("#readingModeLabel").textContent = tab === "repeat" ? "模仿跟读 · REPEAT" : "独立朗读 · READ ALOUD";
    $("#readingText").textContent = material.text;
    $("#readingPinyin").textContent = material.pinyin;
    $("#readingTip").innerHTML = tab === "repeat" ? "<strong>本次重点</strong><p>先听标准语音，再模仿声调、停顿和自然语速。</p>" : "<strong>本次重点</strong><p>先独立朗读；录完以后再听示范，检查断句和语调。</p>";
    resetReadingFeedback();
  }

  function resetReadingFeedback() {
    $("#readingFeedback").innerHTML = `<span class="eyebrow">反馈 · FEEDBACK</span><h3>完成录音后查看反馈</h3><p>真实API未配置时只演示流程，不生成数字评分。</p><div class="feedback-tags"><span>发音准确度 · 待评测</span><span>流利度 · 待评测</span><span>完整度 · 待评测</span><span>声调 · 待评测</span></div>`;
  }

  async function startRecording(target) {
    if (!navigator.mediaDevices?.getUserMedia || !("MediaRecorder" in window)) {
      toast("当前浏览器不支持录音，请使用最新版Chrome、Edge或Safari");
      return;
    }
    try {
      state.mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      state.chunks = [];
      state.recordTarget = target;
      state.mediaRecorder = new MediaRecorder(state.mediaStream);
      state.mediaRecorder.addEventListener("dataavailable", event => { if (event.data.size) state.chunks.push(event.data); });
      state.mediaRecorder.addEventListener("stop", finishRecording);
      state.mediaRecorder.start();
      state.startedAt = Date.now();
      startTimer();
      const recordingOrb = target === "reading" ? orbs.record : orbs.talkRecord;
      recordingOrb?.setTheme("violet");
      await recordingOrb?.attachStream(state.mediaStream);
      recordingOrb?.setState("recording");
      setOrbGlyph(recordingOrb, "■");
      if (target === "reading") {
        $("#recordButton").classList.add("recording");
        $("#recordStatus").textContent = "正在录音，请自然朗读";
      } else {
        $("#talkRecordStatus").textContent = "正在录音 · 00:00";
      }
    } catch (error) {
      toast(error.name === "NotAllowedError" ? "麦克风权限被拒绝，请在浏览器设置中允许录音" : `无法开始录音：${error.message}`);
    }
  }

  function stopRecording() {
    if (state.mediaRecorder?.state === "recording") state.mediaRecorder.stop();
  }

  function startTimer() {
    clearInterval(state.timer);
    state.timer = setInterval(() => {
      const seconds = Math.floor((Date.now() - state.startedAt) / 1000);
      const time = `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
      $("#recordTimer").textContent = time;
      if (state.recordTarget === "talk") $("#talkRecordStatus").textContent = `正在录音 · ${time}`;
    }, 250);
  }

  function finishRecording() {
    clearInterval(state.timer);
    state.mediaStream?.getTracks().forEach(track => track.stop());
    const recordingOrb = state.recordTarget === "reading" ? orbs.record : orbs.talkRecord;
    recordingOrb?.detachAudio();
    recordingOrb?.setState("complete");
    setOrbGlyph(recordingOrb, "✓");
    const blob = new Blob(state.chunks, { type: state.mediaRecorder.mimeType || "audio/webm" });
    if (state.recordingUrl) URL.revokeObjectURL(state.recordingUrl);
    state.recordingUrl = URL.createObjectURL(blob);
    if (state.recordTarget === "reading") {
      const player = $("#recordingPlayer");
      player.src = state.recordingUrl;
      $("#playRecording").disabled = false;
      $("#submitReading").disabled = false;
      $("#recordButton").classList.remove("recording");
      $("#recordStatus").textContent = "录音完成，可以试听或确认提交";
    } else {
      $("#talkReplay").disabled = false;
      $("#talkRecordStatus").textContent = "录音完成，可试听或重新录制";
      toast("录音已保留；演示模式未接ASR，请在输入框填写识别文字");
    }
    state.mediaRecorder = null;
  }

  async function playRecordedAudio(orb) {
    if (!state.recordingUrl) return;
    if (state.replayAudio) state.replayAudio.pause();
    const audio = new Audio(state.recordingUrl);
    state.replayAudio = audio;
    try {
      await orb?.attachMediaElement(audio);
      orb?.setTheme("violet");
      orb?.setState("playing");
      setOrbGlyph(orb, "❚❚");
      const finish = () => {
        if (state.replayAudio === audio) state.replayAudio = null;
        settleOrb(orb, "complete");
      };
      audio.addEventListener("ended", finish, { once: true });
      audio.addEventListener("error", finish, { once: true });
      await audio.play();
    } catch (_) {
      settleOrb(orb, "error");
      toast("录音暂时无法播放，请重新录制");
    }
  }

  function submitReading() {
    const type = state.readingTab === "repeat" ? "repeat" : "oral_reading";
    orbs.record?.setState("processing", { synthetic: true });
    setOrbGlyph(orbs.record, "…");
    $("#readingFeedback").innerHTML = `<span class="eyebrow">演示反馈 · DEMO FEEDBACK</span><h3>录音流程已经完成</h3><p>尚未接入腾讯云智聆SOE-N，因此不会显示或保存虚假分数。接入后这里将展示真实的准确度、流利度、完整度和声调结果。</p><div class="feedback-tags"><span>录音 · 已完成</span><span>SOE-N · 待接入</span><span>AI解释 · 待接入</span><span>再次练习 · 可进行</span></div>`;
    saveRecord(type, "completed");
    toast("演示录音已完成；没有生成模拟分数");
    setTimeout(() => settleOrb(orbs.record, "complete"), 650);
  }

  function renderQueue() {
    const container = $("#practiceQueue");
    container.innerHTML = "";
    if (!state.queue.length) {
      container.innerHTML = "<span class=\"status-pill\">暂无待跟读句子</span>";
      return;
    }
    state.queue.slice(-5).forEach(item => {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = `${item.text} · ${item.source}`;
      button.addEventListener("click", () => { openScreen("reading"); setReadingTab("repeat"); $("#readingText").textContent = item.text; speak(item.text, .82, orbs.model); });
      container.appendChild(button);
    });
  }

  function selectScenario(id) {
    state.scenario = id;
    state.turns = 0;
    const scenario = demo.scenarios[id];
    $$('[data-scenario]').forEach(button => button.classList.toggle("active", button.dataset.scenario === id));
    $("#scenarioTitle").textContent = scenario.title;
    $("#turnCount").textContent = "0";
    $("#dialogueSummary").hidden = true;
    state.lastTalkSpeech = scenario.opening;
    $("#dialogueStream").innerHTML = `<article class="message ai" data-speak="${scenario.opening}" tabindex="0"><span>AI角色</span><p>${scenario.opening}</p><small>点击消息后由上方声音球播放</small></article>`;
    ["#mealGoal", "#drinkGoal", "#finishGoal"].forEach(selector => { $(selector).classList.remove("done"); $(selector).textContent = `○ ${$(selector).textContent.replace(/^[✓○]\s*/, "")}`; });
    if (state.autoPlay) speak(scenario.opening, .82, orbs.talkPlayback);
  }

  function appendMessage(role, text) {
    const article = document.createElement("article");
    article.className = `message ${role}`;
    const name = document.createElement("span");
    name.textContent = role === "user" ? "你" : "AI角色";
    const paragraph = document.createElement("p");
    paragraph.textContent = text;
    article.append(name, paragraph);
    if (role === "ai") {
      article.dataset.speak = text;
      article.tabIndex = 0;
      const hint = document.createElement("small");
      hint.textContent = "点击消息后由上方声音球播放";
      article.appendChild(hint);
      state.lastTalkSpeech = text;
    }
    $("#dialogueStream").appendChild(article);
    $("#dialogueStream").scrollTop = $("#dialogueStream").scrollHeight;
  }

  function sendDialogue() {
    const input = $("#dialogueInput");
    const text = input.value.trim();
    if (!text) { toast("请输入中文回答，或先完成录音"); return; }
    appendMessage("user", text);
    if (state.recordingUrl) {
      orbs.talkRecord?.setState("processing", { synthetic: true });
      setOrbGlyph(orbs.talkRecord, "…");
    }
    input.value = "";
    state.turns += 1;
    $("#turnCount").textContent = state.turns;
    if (state.turns >= 1) { $("#mealGoal").classList.add("done"); $("#mealGoal").textContent = "✓ 已表达主要需要"; }
    if (state.turns >= 2) { $("#drinkGoal").classList.add("done"); $("#drinkGoal").textContent = "✓ 已回应追问"; }
    const reply = demo.scenarios[state.scenario].reply;
    setTimeout(() => {
      appendMessage("ai", reply);
      if (state.recordingUrl) settleOrb(orbs.talkRecord, "complete");
      if (state.autoPlay) speak(reply, .82, orbs.talkPlayback);
    }, 380);
  }

  function finishDialogue() {
    $("#finishGoal").classList.add("done");
    $("#finishGoal").textContent = "✓ 对话已经结束";
    $("#dialogueSummary").hidden = false;
    saveRecord("dialogue", "completed");
    $("#dialogueSummary").scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  function bindEvents() {
    $$('[data-screen]').forEach(button => button.addEventListener("click", () => openScreen(button.dataset.screen)));
    $$('[data-open-screen]').forEach(button => button.addEventListener("click", () => openScreen(button.dataset.openScreen)));
    $$('[data-listening-tab]').forEach(button => button.addEventListener("click", () => setListeningTab(button.dataset.listeningTab)));
    $$('[data-answer-mode]').forEach(button => button.addEventListener("click", () => setAnswerMode(button.dataset.answerMode)));
    $$('[data-reading-tab]').forEach(button => button.addEventListener("click", () => setReadingTab(button.dataset.readingTab)));
    $$('[data-scenario]').forEach(button => button.addEventListener("click", () => selectScenario(button.dataset.scenario)));
    document.addEventListener("click", event => {
      const message = event.target.closest("[data-speak]");
      if (!message) return;
      state.lastTalkSpeech = message.dataset.speak;
      speak(message.dataset.speak, .82, orbs.talkPlayback);
    });
    document.addEventListener("keydown", event => {
      if (!["Enter", " "].includes(event.key)) return;
      const message = event.target.closest("[data-speak]");
      if (!message) return;
      event.preventDefault();
      state.lastTalkSpeech = message.dataset.speak;
      speak(message.dataset.speak, .82, orbs.talkPlayback);
    });

    $("#autoPlayToggle").addEventListener("click", event => { state.autoPlay = !state.autoPlay; event.currentTarget.setAttribute("aria-pressed", state.autoPlay); event.currentTarget.textContent = `语音自动播放 · ${state.autoPlay ? "On" : "Off"}`; });
    $("#dictationPlay").addEventListener("click", () => { state.dictationPlays += 1; $("#dictationPlays").textContent = state.dictationPlays; $("#dictationPlayStatus").textContent = `已播放 ${state.dictationPlays} 次 · ${state.dictationSlow ? "慢速" : "正常语速"}`; speak(demo.dictation.text, state.dictationSlow ? .62 : .84, orbs.dictation); });
    $("#dictationSpeed").addEventListener("click", event => { state.dictationSlow = !state.dictationSlow; event.currentTarget.textContent = state.dictationSlow ? "1.0× 正常" : "0.8× 慢速"; $("#slowUsed").textContent = state.dictationSlow ? "是" : "否"; });
    $("#dictationHint").addEventListener("click", () => toast(demo.dictation.hint));
    $("#dictationSubmit").addEventListener("click", submitDictation);
    $("#openCharacterStudio").addEventListener("click", () => { location.href = "../../index.html?module=learn"; });

    $("#testPlay").addEventListener("click", () => { state.testPlays += 1; $("#testPlayStatus").textContent = `已播放 ${state.testPlays} 次 · ${state.testSlow ? "慢速" : "正常语速"}`; speak(demo.listeningTest.audioText, state.testSlow ? .62 : .84, orbs.test); });
    $("#testSpeed").addEventListener("click", event => { state.testSlow = !state.testSlow; event.currentTarget.textContent = state.testSlow ? "1.0× 正常" : "0.8× 慢速"; });
    $$('[data-choice]').forEach(button => button.addEventListener("click", () => { state.testChoice = button.dataset.choice; $$('[data-choice]').forEach(item => item.classList.toggle("selected", item === button)); }));
    $("#transcriptToggle").addEventListener("click", event => { const hidden = $("#testTranscript").hidden; $("#testTranscript").hidden = !hidden; event.currentTarget.textContent = hidden ? "隐藏原文 · Hide" : "显示原文 · Transcript"; });
    $("#testSubmit").addEventListener("click", () => {
      if (!state.testChoice) { toast("请选择一个答案"); return; }
      const confidence = $('input[name="confidence"]:checked').value;
      const correct = state.testChoice === demo.listeningTest.answer;
      const needsReview = !correct || confidence === "guess" || state.testPlays > 2 || state.testSlow;
      const feedback = $("#testFeedback");
      feedback.hidden = false;
      feedback.classList.toggle("error", !correct);
      feedback.innerHTML = correct ? `<strong>回答正确 · Correct</strong>“下午三点怎么样？”是女方提出的新时间。${needsReview ? "虽然答对了，但本题会进入待复习。" : "你在正常条件下完成了理解。"}` : `<strong>回答错误 · Let’s review</strong>对话先提到“上午”，随后女方说上午有课，并提出“下午三点”。<br><button class="ghost-button" id="testToReading" type="button">关键句加入跟读 · Add to Repeat</button>`;
      if (!correct) $("#testToReading").addEventListener("click", () => addToQueue(demo.listeningTest.keySentence, "听力错题"));
      saveRecord("listening_test", needsReview ? "review" : "mastered");
    });

    $("#standardPlay").addEventListener("click", () => speak(demo.reading[state.readingTab].text, .82, orbs.model));
    $("#pinyinToggle").addEventListener("click", event => { const hidden = $("#readingPinyin").hidden; $("#readingPinyin").hidden = !hidden; event.currentTarget.textContent = hidden ? "隐藏拼音 · Pinyin" : "显示拼音 · Pinyin"; });
    $("#recordButton").addEventListener("click", () => state.mediaRecorder?.state === "recording" ? stopRecording() : startRecording("reading"));
    $("#playRecording").addEventListener("click", () => playRecordedAudio(orbs.record));
    $("#submitReading").addEventListener("click", submitReading);

    $("#talkRecord").addEventListener("click", () => state.mediaRecorder?.state === "recording" ? stopRecording() : startRecording("talk"));
    $("#talkPlayback").addEventListener("click", () => speak(state.lastTalkSpeech || demo.scenarios[state.scenario].opening, .82, orbs.talkPlayback));
    $("#talkReplay").addEventListener("click", () => playRecordedAudio(orbs.talkRecord));
    $("#sendDialogue").addEventListener("click", sendDialogue);
    $("#finishDialogue").addEventListener("click", finishDialogue);
    $("#addTalkToReading").addEventListener("click", () => addToQueue("我想要一份牛肉面，再来一杯茶。", "Let’s Talk"));
  }

  function init() {
    initVoiceOrbs();
    renderTiles();
    renderQueue();
    renderDashboard();
    bindEvents();
    selectScenario("restaurant");
    if ("serviceWorker" in navigator && /^https?:$/.test(location.protocol)) navigator.serviceWorker.register("../../sw.js").catch(() => {});
  }

  init();
})();
