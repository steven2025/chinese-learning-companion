(function createWritingZone() {
  "use strict";

  const STORAGE_KEY = "diandianWritingEssaysV1";
  const PAGE_SIZE = 80;
  const MAX_CELLS = 600;
  const localeOptions = [
    ["zh-CN", "中文"], ["en", "English"], ["es", "Español"], ["fr", "Français"],
    ["id", "Bahasa Indonesia"], ["ja", "日本語"], ["ko", "한국어"], ["lo", "ພາສາລາວ"],
    ["ms", "Bahasa Melayu"], ["my", "မြန်မာဘာသာ"], ["ru", "Русский"], ["th", "ไทย"],
  ];
  const statusLabels = { draft: "草稿", submitted: "待教师批阅", returned: "待修改", completed: "已完成" };
  const localState = {
    essays: loadEssays(),
    filter: "all",
    activeEssayId: "",
    selectedCell: null,
    page: 0,
    drawing: false,
    strokeCount: 0,
    fullscreen: false,
    assistTab: "understand",
    drag: null,
    syncing: false,
    selectedIds: new Set(),
    analysisClassroom: false,
  };

  const el = {
    list: document.querySelector("#writingList"),
    count: document.querySelector("#writingItemCount"),
    tabs: document.querySelector("#writingStatusTabs"),
    newButton: document.querySelector("#newEssayButton"),
    setupDialog: document.querySelector("#writingSetupDialog"),
    setupForm: document.querySelector("#writingSetupForm"),
    titleInput: document.querySelector("#essayTitleInput"),
    requirementsInput: document.querySelector("#essayRequirementsInput"),
    teacherSelect: document.querySelector("#essayTeacherSelect"),
    localeSelect: document.querySelector("#essayLocaleSelect"),
    assistDialog: document.querySelector("#writingAssistDialog"),
    assistTitle: document.querySelector("#writingAssistTitle"),
    assistTabs: document.querySelector("#writingAssistTabs"),
    assistContent: document.querySelector("#writingAssistContent"),
    canvasDialog: document.querySelector("#essayWritingDialog"),
    canvasWindow: document.querySelector("#essayWritingWindow"),
    canvas: document.querySelector("#essayHandwritingCanvas"),
    writingTitle: document.querySelector("#essayWritingTitle"),
    writingMeta: document.querySelector("#essayWritingMeta"),
    promptTitle: document.querySelector("#essayPromptTitle"),
    promptRequirements: document.querySelector("#essayPromptRequirements"),
    activeCellLabel: document.querySelector("#activeCellLabel"),
    wordCount: document.querySelector("#essayWordCount"),
    manuscript: document.querySelector("#essayManuscriptGrid"),
    pageLabel: document.querySelector("#essayPageLabel"),
    saveStatus: document.querySelector("#essaySaveStatus"),
    reviewDialog: document.querySelector("#writingReviewDialog"),
    reviewEyebrow: document.querySelector("#writingReviewEyebrow"),
    reviewTitle: document.querySelector("#writingReviewTitle"),
    reviewContent: document.querySelector("#writingReviewContent"),
    aiOverlay: document.querySelector("#writingAiOverlay"),
    aiStatus: document.querySelector("#writingAiStatus"),
    teacherPending: document.querySelector("#teacherWritingPending"),
    batchToolbar: document.querySelector("#writingBatchToolbar"),
    selectAll: document.querySelector("#writingSelectAll"),
    selectedCount: document.querySelector("#writingSelectedCount"),
    analysisMode: document.querySelector("#writingAnalysisMode"),
    analyzeButton: document.querySelector("#writingAnalyzeButton"),
    analysisDialog: document.querySelector("#writingAnalysisDialog"),
    analysisContent: document.querySelector("#writingAnalysisContent"),
  };

  function loadEssays() {
    try {
      const value = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
      return Array.isArray(value) ? value : [];
    } catch {
      return [];
    }
  }

  function saveEssays() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(localState.essays));
      return true;
    } catch {
      showToast("本地存储空间不足，请提交或清理较早的作文草稿");
      return false;
    }
  }

  function currentEssay() {
    return localState.essays.find((essay) => essay.id === localState.activeEssayId) || null;
  }

  function cloudProfile() {
    return window.LearningApi?.profile?.() || null;
  }

  function studentProfile() {
    if (state.studentProfile) return state.studentProfile;
    const profile = cloudProfile();
    if (profile?.role === "student") {
      return {
        chineseName: profile.chineseName || profile.name || profile.userId,
        englishName: profile.englishName || "",
        studentId: profile.userId,
        teacher: profile.teacher || teachers[0],
      };
    }
    return null;
  }

  function roleIsTeacher() {
    return state.role === "teacher" || state.role === "admin";
  }

  function safe(value) {
    return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
  }

  function formatDate(value) {
    if (!value) return "—";
    return new Intl.DateTimeFormat("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(value));
  }

  function uid(prefix) {
    return window.crypto?.randomUUID?.() || `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  function openDialog(dialog) {
    if (!dialog) return;
    if (typeof dialog.showModal === "function") {
      if (!dialog.open) dialog.showModal();
    } else dialog.setAttribute("open", "");
  }

  function closeDialog(dialog) {
    if (!dialog) return;
    if (dialog.open && typeof dialog.close === "function") dialog.close();
    else dialog.removeAttribute("open");
  }

  function wordCount(essay) {
    return Array.isArray(essay.cells) && essay.cells.length
      ? essay.cells.filter((cell) => cell.type === "image").length
      : Number(essay.characterCount || 0);
  }

  function cloudReady() {
    return Boolean(window.LearningApi?.isConfigured?.() && cloudProfile());
  }

  function mergeEssay(incoming) {
    const index = localState.essays.findIndex((essay) => essay.id === incoming.id);
    const prior = index >= 0 ? localState.essays[index] : null;
    const merged = { ...(prior || {}), ...incoming, cells: incoming.cells || prior?.cells || [], strokeCounts: incoming.strokeCounts || prior?.strokeCounts || [], _cloud: true };
    if (index >= 0) localState.essays[index] = merged;
    else localState.essays.push(merged);
    return merged;
  }

  async function syncFromCloud() {
    if (!cloudReady() || localState.syncing) return;
    localState.syncing = true;
    try {
      const result = await window.LearningApi.writingList();
      const remote = Array.isArray(result.essays) ? result.essays : [];
      const remoteIds = new Set(remote.map((essay) => essay.id));
      localState.essays = localState.essays.filter((essay) => !essay._cloud || remoteIds.has(essay.id));
      remote.forEach(mergeEssay);
      saveEssays();
      render();
    } catch (error) {
      console.warn("Writing sync unavailable", error.message);
    } finally {
      localState.syncing = false;
    }
  }

  function visibleEssays() {
    if (roleIsTeacher()) {
      const teacherName = state.role === "admin" ? "" : (state.teacherContext.teacher || state.userName);
      return localState.essays.filter((essay) => !teacherName || essay.teacher === teacherName);
    }
    const student = studentProfile();
    return student ? localState.essays.filter((essay) => essay.studentId === student.studentId) : [];
  }

  function render() {
    if (!el.list) return;
    el.batchToolbar.hidden = !roleIsTeacher();
    if (roleIsTeacher()) renderTeacherInbox();
    else renderStudentWriting();
    renderTeacherSummary();
    updateBatchToolbar();
  }

  function renderStudentWriting() {
    const student = studentProfile();
    el.newButton.hidden = !student;
    if (!student) {
      el.count.textContent = "0篇";
      el.list.innerHTML = `<div class="writing-empty"><strong>登录后进入写作专区</strong><p>学生登录后可以录入作文题目和要求，并使用田字格完成手写作文。</p><button class="primary-button" type="button" data-writing-action="login">学生登录</button></div>`;
      return;
    }
    const own = visibleEssays().sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
    const filtered = localState.filter === "all" ? own : own.filter((essay) => essay.status === localState.filter);
    el.count.textContent = `${filtered.length}篇`;
    if (!filtered.length) {
      el.list.innerHTML = `<div class="writing-empty"><strong>${own.length ? "当前分类暂无作文" : "开始第一篇手写作文"}</strong><p>题目和要求可以键盘录入，作文正文只在田字格中手写。</p>${own.length ? "" : '<button class="primary-button" type="button" data-writing-action="new">新建作文</button>'}</div>`;
      return;
    }
    el.list.innerHTML = filtered.map((essay) => {
      const canWrite = ["draft", "returned"].includes(essay.status);
      const actionLabel = essay.status === "returned" ? "开始改写" : essay.status === "draft" ? "继续写作" : "查看详情";
      return `<article class="writing-row" data-status="${essay.status}">
        <span class="writing-row-mark" aria-hidden="true">写</span>
        <div class="writing-row-copy"><strong>${safe(essay.title)}</strong><p>${safe(essay.requirements)}</p><small>提交给 ${safe(essay.teacher)} · ${wordCount(essay)}字 · 第${essay.version || 1}稿 · ${formatDate(essay.updatedAt)}</small></div>
        <span class="writing-row-status">${statusLabels[essay.status] || essay.status}</span>
        <div class="writing-row-actions">${canWrite ? `<button class="resume-button" type="button" data-writing-open="${essay.id}">${actionLabel}</button>` : `<button type="button" data-writing-review="${essay.id}">${actionLabel}</button>`}</div>
      </article>`;
    }).join("");
  }

  function renderTeacherInbox() {
    el.newButton.hidden = true;
    const essays = visibleEssays().filter((essay) => essay.status !== "draft").sort((a, b) => String(b.submittedAt || b.updatedAt).localeCompare(String(a.submittedAt || a.updatedAt)));
    const filtered = localState.filter === "all" ? essays : essays.filter((essay) => essay.status === localState.filter);
    el.count.textContent = `${filtered.length}篇`;
    if (!filtered.length) {
      el.list.innerHTML = `<div class="writing-empty"><strong>当前没有作文</strong><p>学生提交后的手写全文、字数和AI评价会出现在这里。</p></div>`;
      return;
    }
    el.list.innerHTML = filtered.map((essay) => `<article class="writing-row teacher-writing-row" data-status="${essay.status}">
      <label class="writing-row-select"><input type="checkbox" data-writing-select="${essay.id}"${localState.selectedIds.has(essay.id) ? " checked" : ""}><span aria-hidden="true"></span><b class="sr-only">选择${safe(essay.title)}</b></label>
      <span class="writing-row-mark" aria-hidden="true">阅</span>
      <div class="writing-row-copy"><strong>${safe(essay.title)}</strong><p>${safe(essay.studentName)} · 学号 ${safe(essay.studentId)}</p><small>${wordCount(essay)}字 · 第${essay.version || 1}稿 · 提交于 ${formatDate(essay.submittedAt)}</small></div>
      <span class="writing-row-status">${essay.teacherFeedback?.published ? "已反馈" : statusLabels[essay.status] || essay.status}</span>
      <div class="writing-row-actions"><button class="resume-button" type="button" data-writing-review="${essay.id}">批阅</button></div>
    </article>`).join("");
  }

  function updateBatchToolbar() {
    if (!roleIsTeacher() || !el.batchToolbar) return;
    const visible = [...el.list.querySelectorAll("[data-writing-select]")];
    const selectedVisible = visible.filter((input) => localState.selectedIds.has(input.dataset.writingSelect));
    el.selectedCount.textContent = `已选${localState.selectedIds.size}篇${localState.selectedIds.size === 1 ? "（至少2篇）" : ""}`;
    el.analyzeButton.disabled = localState.selectedIds.size < 2;
    el.selectAll.checked = visible.length > 0 && selectedVisible.length === visible.length;
    el.selectAll.indeterminate = selectedVisible.length > 0 && selectedVisible.length < visible.length;
  }

  function setVisibleSelection(checked) {
    el.list.querySelectorAll("[data-writing-select]").forEach((input) => {
      input.checked = checked;
      if (checked) localState.selectedIds.add(input.dataset.writingSelect);
      else localState.selectedIds.delete(input.dataset.writingSelect);
    });
    updateBatchToolbar();
  }

  function renderTeacherSummary() {
    if (!el.teacherPending) return;
    const teacherName = state.role === "admin" ? "" : (state.teacherContext.teacher || state.userName);
    const pending = localState.essays.filter((essay) => essay.status === "submitted" && (!teacherName || essay.teacher === teacherName)).length;
    el.teacherPending.textContent = `${pending}篇待批阅`;
  }

  function openSetup() {
    const student = studentProfile();
    if (!student) {
      openAuth("student-login");
      showToast("请先以学生身份登录");
      return;
    }
    el.setupForm.reset();
    el.teacherSelect.innerHTML = teachers.map((teacher) => `<option${teacher === student.teacher ? " selected" : ""}>${teacher}</option>`).join("");
    el.localeSelect.innerHTML = localeOptions.map(([code, label]) => `<option value="${code}">${label}</option>`).join("");
    openDialog(el.setupDialog);
    window.setTimeout(() => el.titleInput.focus(), 80);
  }

  function createEssay(form) {
    const student = studentProfile();
    if (!student) return;
    const data = new FormData(form);
    const now = new Date().toISOString();
    const essay = {
      id: uid("essay"),
      title: String(data.get("title") || "").trim(),
      requirements: String(data.get("requirements") || "").trim(),
      teacher: String(data.get("teacher") || teachers[0]),
      locale: String(data.get("locale") || "zh-CN"),
      studentName: student.chineseName || state.userName,
      studentEnglishName: student.englishName || "",
      studentId: student.studentId || student.userId || "test",
      status: "draft",
      version: 1,
      cells: [],
      strokeCounts: [],
      versions: [],
      aiSupport: {},
      aiAssessment: null,
      teacherFeedback: { evaluation: "", suggestions: "", score: "", published: false },
      createdAt: now,
      updatedAt: now,
    };
    if (!essay.title || !essay.requirements) return;
    localState.essays.unshift(essay);
    saveEssays();
    closeDialog(el.setupDialog);
    render();
    openCanvas(essay.id);
  }

  async function hydrateEssay(essayId) {
    let essay = localState.essays.find((item) => item.id === essayId);
    if (cloudReady() && essay?._cloud && !essay.cells?.length) {
      setAiWorking(true, "正在读取云端手写草稿");
      try {
        const result = await window.LearningApi.writingDetail(essayId);
        essay = mergeEssay(result.essay);
        saveEssays();
      } finally {
        setAiWorking(false);
      }
    }
    return essay;
  }

  async function openCanvas(essayId) {
    const essay = await hydrateEssay(essayId);
    if (!essay || !["draft", "returned"].includes(essay.status)) return;
    localState.activeEssayId = essay.id;
    localState.selectedCell = null;
    localState.page = Math.max(0, Math.floor(Math.max(0, essay.cells.length - 1) / PAGE_SIZE));
    localState.fullscreen = false;
    el.canvasWindow.classList.remove("is-fullscreen");
    el.canvasWindow.style.transform = "";
    el.writingTitle.textContent = essay.title;
    el.writingMeta.textContent = `第${essay.version || 1}稿 · 手写正文`;
    el.promptTitle.textContent = essay.title;
    el.promptRequirements.textContent = essay.requirements;
    openDialog(el.canvasDialog);
    renderManuscript();
    setupCanvas();
  }

  function renderManuscript() {
    const essay = currentEssay();
    if (!essay) return;
    const pageCount = Math.max(1, Math.ceil(Math.max(1, essay.cells.length) / PAGE_SIZE));
    localState.page = Math.min(localState.page, pageCount - 1);
    const start = localState.page * PAGE_SIZE;
    el.manuscript.innerHTML = Array.from({ length: PAGE_SIZE }, (_, offset) => {
      const index = start + offset;
      const cell = essay.cells[index];
      const selected = index === localState.selectedCell;
      if (!cell) return `<button class="manuscript-cell" type="button" disabled aria-label="空白格"></button>`;
      const content = cell.type === "image" ? `<img src="${cell.data}" alt="第${index + 1}个手写字">` : `<b>${safe(cell.value)}</b>`;
      return `<button class="manuscript-cell has-content${selected ? " is-selected" : ""}" type="button" data-essay-cell="${index}" aria-label="第${index + 1}格，点击修改">${content}</button>`;
    }).join("");
    el.wordCount.textContent = `${wordCount(essay)}字`;
    el.pageLabel.textContent = `第${localState.page + 1} / ${pageCount}页`;
    el.activeCellLabel.textContent = localState.selectedCell === null ? `写下第${essay.cells.length + 1}个字` : `修改第${localState.selectedCell + 1}格`;
    el.saveStatus.textContent = essay.status === "returned" ? "教师已退回，请完成修改后重新提交" : `草稿已记录 · ${formatDate(essay.updatedAt)}`;
  }

  function setupCanvas() {
    const canvas = el.canvas;
    const context = canvas.getContext("2d");
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.lineWidth = 18;
    context.lineCap = "round";
    context.lineJoin = "round";
    context.strokeStyle = "#10292d";
    localState.strokeCount = 0;

    function point(event) {
      const rect = canvas.getBoundingClientRect();
      return { x: (event.clientX - rect.left) * canvas.width / rect.width, y: (event.clientY - rect.top) * canvas.height / rect.height };
    }
    canvas.onpointerdown = (event) => {
      event.preventDefault();
      canvas.setPointerCapture(event.pointerId);
      localState.drawing = true;
      localState.strokeCount += 1;
      const current = point(event);
      context.beginPath();
      context.moveTo(current.x, current.y);
    };
    canvas.onpointermove = (event) => {
      if (!localState.drawing) return;
      const current = point(event);
      context.lineTo(current.x, current.y);
      context.stroke();
    };
    canvas.onpointerup = canvas.onpointercancel = () => { localState.drawing = false; };
  }

  function clearCanvas() {
    const context = el.canvas.getContext("2d");
    context.clearRect(0, 0, el.canvas.width, el.canvas.height);
    localState.strokeCount = 0;
  }

  function compactCanvasImage() {
    const output = document.createElement("canvas");
    output.width = 140;
    output.height = 140;
    output.getContext("2d").drawImage(el.canvas, 0, 0, output.width, output.height);
    return output.toDataURL("image/png");
  }

  function confirmCell() {
    const essay = currentEssay();
    if (!essay || !localState.strokeCount) {
      showToast("请先在田字格中写一个汉字");
      return;
    }
    const cell = { type: "image", data: compactCanvasImage(), strokes: localState.strokeCount };
    if (localState.selectedCell === null) {
      if (essay.cells.length >= MAX_CELLS) return showToast(`每篇作文暂时最多${MAX_CELLS}格`);
      essay.cells.push(cell);
      essay.strokeCounts.push(localState.strokeCount);
    } else {
      essay.cells[localState.selectedCell] = cell;
      essay.strokeCounts[localState.selectedCell] = localState.strokeCount;
      localState.selectedCell = null;
    }
    essay.updatedAt = new Date().toISOString();
    localState.page = Math.floor((essay.cells.length - 1) / PAGE_SIZE);
    saveEssays();
    clearCanvas();
    renderManuscript();
  }

  function addPunctuation(value) {
    const essay = currentEssay();
    if (!essay || essay.cells.length >= MAX_CELLS) return;
    const cell = { type: "punctuation", value, strokes: 0 };
    if (localState.selectedCell === null) {
      essay.cells.push(cell);
      essay.strokeCounts.push(0);
    } else {
      essay.cells[localState.selectedCell] = cell;
      essay.strokeCounts[localState.selectedCell] = 0;
      localState.selectedCell = null;
    }
    essay.updatedAt = new Date().toISOString();
    localState.page = Math.floor((essay.cells.length - 1) / PAGE_SIZE);
    saveEssays();
    clearCanvas();
    renderManuscript();
  }

  function selectCell(index) {
    const essay = currentEssay();
    const cell = essay?.cells[index];
    if (!cell) return;
    localState.selectedCell = index;
    clearCanvas();
    if (cell.type === "image") {
      const image = new Image();
      image.onload = () => {
        el.canvas.getContext("2d").drawImage(image, 0, 0, el.canvas.width, el.canvas.height);
        localState.strokeCount = cell.strokes || 1;
      };
      image.src = cell.data;
    }
    renderManuscript();
  }

  function undoCell() {
    const essay = currentEssay();
    if (!essay?.cells.length) return;
    const index = localState.selectedCell === null ? essay.cells.length - 1 : localState.selectedCell;
    essay.cells.splice(index, 1);
    essay.strokeCounts.splice(index, 1);
    localState.selectedCell = null;
    essay.updatedAt = new Date().toISOString();
    saveEssays();
    clearCanvas();
    renderManuscript();
  }

  function draftPayload(essay) {
    return { schemaVersion: 1, essayId: essay.id, cells: essay.cells, strokeCounts: essay.strokeCounts, characterCount: wordCount(essay), updatedAt: essay.updatedAt };
  }

  async function uploadAndSaveDraft(essay) {
    const ticket = await window.LearningApi.uploadJson(draftPayload(essay), `writing-${essay.id}-draft`);
    const result = await window.LearningApi.writingSave({ id: essay.id, title: essay.title, requirements: essay.requirements, teacher: essay.teacher, locale: essay.locale, version: essay.version || 1, characterCount: wordCount(essay), draftObjectKey: ticket.objectKey });
    Object.assign(essay, result.essay, { _cloud: true });
    return ticket;
  }

  async function saveDraft() {
    const essay = currentEssay();
    if (!essay) return;
    essay.updatedAt = new Date().toISOString();
    if (saveEssays()) {
      if (cloudReady()) {
        setAiWorking(true, "正在把作文草稿保存到云端");
        try {
          await uploadAndSaveDraft(essay);
          el.saveStatus.textContent = `本机和云端均已保存 · ${formatDate(essay.updatedAt)}`;
          showToast("作文草稿已保存到云端");
        } catch (error) {
          el.saveStatus.textContent = `已保存在本机 · 云端同步失败`;
          showToast(error.message || "云端草稿保存失败，本机草稿仍然保留");
        } finally { setAiWorking(false); }
      } else {
        el.saveStatus.textContent = `已保存在本机 · ${formatDate(essay.updatedAt)}`;
        showToast("作文草稿已保存在本机");
      }
      render();
    }
  }

  function loadImage(src) {
    return new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = reject;
      image.src = src;
    });
  }

  function drawGrid(context, x, y, size) {
    context.strokeStyle = "#b9c9c6";
    context.lineWidth = 1;
    context.strokeRect(x, y, size, size);
    context.save();
    context.setLineDash([4, 5]);
    context.strokeStyle = "#d8e2e0";
    context.beginPath();
    context.moveTo(x + size / 2, y); context.lineTo(x + size / 2, y + size);
    context.moveTo(x, y + size / 2); context.lineTo(x + size, y + size / 2);
    context.moveTo(x, y); context.lineTo(x + size, y + size);
    context.moveTo(x + size, y); context.lineTo(x, y + size);
    context.stroke();
    context.restore();
  }

  async function combineCells(cells) {
    const columns = 10;
    const rows = Math.max(8, Math.ceil(cells.length / columns));
    const size = 100;
    const canvas = document.createElement("canvas");
    canvas.width = columns * size;
    canvas.height = rows * size;
    const context = canvas.getContext("2d");
    context.fillStyle = "#fff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    for (let index = 0; index < rows * columns; index += 1) drawGrid(context, (index % columns) * size, Math.floor(index / columns) * size, size);
    for (let index = 0; index < cells.length; index += 1) {
      const cell = cells[index];
      const x = (index % columns) * size;
      const y = Math.floor(index / columns) * size;
      if (cell.type === "image") {
        const image = await loadImage(cell.data);
        context.drawImage(image, x + 4, y + 4, size - 8, size - 8);
      } else {
        context.fillStyle = "#10292d";
        context.font = '700 58px "KaiTi", serif';
        context.textAlign = "center";
        context.textBaseline = "middle";
        context.fillText(cell.value, x + size / 2, y + size / 2);
      }
    }
    return new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
  }

  function setAiWorking(active, message = "正在整理手写作文") {
    el.aiOverlay.hidden = !active;
    el.aiStatus.textContent = message;
  }

  async function submitEssay() {
    const essay = currentEssay();
    if (!essay || wordCount(essay) < 5) {
      showToast("正文至少需要写5个汉字后才能提交");
      return;
    }
    essay.updatedAt = new Date().toISOString();
    essay.submittedAt = essay.updatedAt;
    setAiWorking(true, "正在生成作文图片");
    let assessmentJobId = "";
    try {
      const blob = await combineCells(essay.cells);
      if (cloudReady()) {
        setAiWorking(true, "正在保存作文草稿");
        const draftTicket = await uploadAndSaveDraft(essay);
        setAiWorking(true, "正在识别手写全文并生成多语言评价");
        essay.aiAssessment = await window.LearningApi.assessArtifact(blob, {
          kind: "handwriting",
          artifactId: uid("free-writing"),
          lessonId: "writing-zone",
          unitType: "practiceHandwriting",
          unitId: essay.id,
          referenceText: essay.title,
          locale: essay.locale,
          metrics: {
            prompt: `${essay.title}\n${essay.requirements}`,
            requiredVocabulary: [],
            writingStructure: essay.aiSupport?.outline || [],
            keywordGuidance: essay.aiSupport?.expressions || [],
            referencePoints: [],
            rubric: ["切题", "结构", "表达", "书写"],
            characterCount: wordCount(essay),
            recordedStrokeCounts: essay.strokeCounts,
          },
        }, { onProgress: (phase) => {
          const labels = { preparing: "正在准备作品", uploading: "正在保存手写稿", submitting: "正在提交AI评价", assessing: "正在识别手写全文", advising: "正在生成多语言建议", saving: "正在保存评价" };
          setAiWorking(true, labels[phase] || "AI正在评价作文");
        } });
        assessmentJobId = essay.aiAssessment?._jobId || "";
        essay.aiError = "";
        setAiWorking(true, "正在提交给教师");
        const submitted = await window.LearningApi.writingSubmit({ id: essay.id, title: essay.title, requirements: essay.requirements, teacher: essay.teacher, locale: essay.locale, version: essay.version || 1, characterCount: wordCount(essay), draftObjectKey: draftTicket.objectKey, assessmentJobId, aiError: "" });
        Object.assign(essay, submitted.essay, { _cloud: true });
      } else {
        essay.aiAssessment = null;
        essay.aiError = "AI云服务尚未登录，教师端暂时只显示手写全文。";
        essay.status = "submitted";
      }
    } catch (error) {
      essay.aiError = error.message || "AI评价暂时不可用";
      essay.status = "draft";
      showToast(`提交未完成：${essay.aiError}`);
    } finally {
      saveEssays();
      setAiWorking(false);
      render();
      if (essay.status === "submitted") {
        closeDialog(el.canvasDialog);
        showToast(`作文已提交给${essay.teacher}老师`);
      }
    }
  }

  function openAssist() {
    const essay = currentEssay();
    if (!essay) return;
    el.assistTitle.textContent = essay.title;
    localState.assistTab = "understand";
    renderAssist();
    openDialog(el.assistDialog);
  }

  function assistContentMarkup(content) {
    if (typeof content === "string") return `<p>${safe(content)}</p>`;
    if (Array.isArray(content)) return `<ul>${content.map((item) => `<li>${safe(typeof item === "string" ? item : JSON.stringify(item))}</li>`).join("")}</ul>`;
    if (!content || typeof content !== "object") return "";
    return Object.entries(content).map(([key, value]) => `<section><strong>${safe(key)}</strong>${assistContentMarkup(value)}</section>`).join("");
  }

  function renderAssist() {
    const essay = currentEssay();
    if (!essay) return;
    el.assistTabs.querySelectorAll("[data-assist-tab]").forEach((button) => button.classList.toggle("active", button.dataset.assistTab === localState.assistTab));
    const stored = essay.aiSupport?.[localState.assistTab];
    const labels = {
      understand: ["理解题目", "用选定母语解释题目要完成什么，不直接代写作文。"],
      outline: ["写作结构", "给出开头、主体和结尾的组织方向。"],
      expressions: ["参考表达", "提供可选择的中文词语和句式，不生成完整范文。"],
    };
    if (stored) {
      const content = assistContentMarkup(stored);
      el.assistContent.innerHTML = `<div class="assist-note"><strong>${labels[localState.assistTab][0]}</strong><p>${labels[localState.assistTab][1]}</p></div><section class="assist-result-section">${content}</section>`;
      return;
    }
    el.assistContent.innerHTML = `<div class="assist-note"><strong>${labels[localState.assistTab][0]}</strong><p>${labels[localState.assistTab][1]}</p></div><section class="assist-result-section"><h3>按“${safe(localeOptions.find(([code]) => code === essay.locale)?.[1] || "中文")}”生成辅助</h3><p>AI只给出理解、结构或表达方向，不代写完整作文。</p><button class="primary-button" type="button" data-writing-assist-generate>生成本项辅助</button></section>`;
  }

  async function generateAssist() {
    const essay = currentEssay();
    if (!essay || !cloudReady()) return showToast("请先登录后使用AI写作辅助");
    setAiWorking(true, "AI正在准备写作辅助");
    try {
      const result = await window.LearningApi.writingAssist({ title: essay.title, requirements: essay.requirements, locale: essay.locale, assistType: localState.assistTab });
      essay.aiSupport = essay.aiSupport || {};
      essay.aiSupport[localState.assistTab] = result;
      saveEssays();
      renderAssist();
    } catch (error) { showToast(error.message || "写作辅助生成失败"); }
    finally { setAiWorking(false); }
  }

  function manuscriptMarkup(cells) {
    const pages = Math.max(1, Math.ceil(cells.length / PAGE_SIZE));
    return Array.from({ length: pages }, (_, page) => `<div class="review-page-grid">${Array.from({ length: PAGE_SIZE }, (__, offset) => {
      const cell = cells[page * PAGE_SIZE + offset];
      if (!cell) return '<span class="manuscript-cell"></span>';
      return `<span class="manuscript-cell has-content">${cell.type === "image" ? `<img src="${cell.data}" alt="手写字">` : `<b>${safe(cell.value)}</b>`}</span>`;
    }).join("")}</div>`).join("");
  }

  function adviceMarkup(assessment, showScore) {
    if (!assessment) return '<div class="ai-feedback-copy"><strong>AI评价尚未生成</strong><p>教师仍可直接查看全文并填写评价。</p></div>';
    const advice = assessment.advice || {};
    const score = Math.round(Number(assessment.scores?.total || 0));
    return `${showScore ? `<div class="ai-score-panel"><strong>${score}</strong><span>AI参考分，仅供教师批阅参考，学生端不显示。</span></div>` : ""}
      <div class="ai-feedback-copy"><strong>AI评价</strong><p>${safe(advice.summary || "已完成评价")}</p>
      ${advice.strengths?.length ? `<strong>优点</strong><ul>${advice.strengths.map((item) => `<li>${safe(item)}</li>`).join("")}</ul>` : ""}
      ${advice.priorities?.length ? `<strong>优先修改</strong><ul>${advice.priorities.map((item) => `<li>${safe(item)}</li>`).join("")}</ul>` : ""}
      ${advice.practiceSteps?.length ? `<strong>修改建议</strong><ul>${advice.practiceSteps.map((item) => `<li>${safe(item)}</li>`).join("")}</ul>` : ""}</div>`;
  }

  function analysisItems(items, kind) {
    return (items || []).map((item) => {
      if (typeof item === "string") return `<li><strong>${safe(item)}</strong></li>`;
      const detail = kind === "strength" ? item.teachingUse : item.improvement;
      return `<li><strong>${safe(item.title || "")}</strong><p>${safe(item.evidence || "")}</p>${detail ? `<small>${safe(detail)}</small>` : ""}</li>`;
    }).join("");
  }

  function renderWritingAnalysis(result) {
    const statistics = result.statistics || {};
    const analysis = result.analysis || {};
    const basis = result.mode === "ai" ? "AI初评" : "教师终评";
    const eligible = Math.max(1, Number(statistics.eligibleCount || 0));
    const distribution = (statistics.distribution || []).map((range) => {
      const percent = Math.round(Number(range.count || 0) / eligible * 100);
      return `<div class="score-range-row"><span>${safe(range.label)}</span><i><b style="width:${percent}%"></b></i><strong>${range.count || 0}人</strong><small>${percent}%</small></div>`;
    }).join("");
    el.analysisContent.innerHTML = `<section class="analysis-summary-band"><div><span>分析依据</span><strong>${basis}</strong></div><p>${safe(analysis.summary || "班级分析已生成")}</p><small>已选择${statistics.selectedCount || 0}篇，纳入${statistics.eligibleCount || 0}篇，排除${statistics.excludedCount || 0}篇未完成对应评价的作文。</small></section>
      <section class="analysis-stat-grid"><div><span>平均分</span><strong>${statistics.average ?? "—"}</strong></div><div><span>最高分</span><strong>${statistics.highest ?? "—"}</strong></div><div><span>最低分</span><strong>${statistics.lowest ?? "—"}</strong></div><div><span>统计人数</span><strong>${statistics.eligibleCount || 0}</strong></div></section>
      <section class="analysis-chart"><header><h3>分数区间分布</h3><small>Score distribution</small></header>${distribution}</section>
      <div class="analysis-findings"><section class="analysis-positive"><h3>普遍优点</h3><ul>${analysisItems(analysis.commonStrengths, "strength")}</ul></section><section class="analysis-priority"><h3>需要改进</h3><ul>${analysisItems(analysis.commonWeaknesses, "weakness")}</ul></section></div>
      <section class="analysis-teaching"><div><h3>课堂讲解重点</h3><ul>${(analysis.classroomFocus || []).map((item) => `<li>${safe(item)}</li>`).join("")}</ul></div><div><h3>后续教学建议</h3><ul>${(analysis.teachingSuggestions || []).map((item) => `<li>${safe(item)}</li>`).join("")}</ul></div></section>
      <footer class="analysis-private-note"><strong>教师参考</strong><span>${safe(analysis.dataCaveat || "统计只反映本次所选作文。")}</span></footer>`;
  }

  async function analyzeSelectedWriting() {
    if (!cloudReady()) return showToast("请先以教师身份登录云服务");
    const essayIds = [...localState.selectedIds];
    if (!essayIds.length) return;
    setAiWorking(true, "正在汇总匿名作文评价");
    try {
      const result = await window.LearningApi.writingAnalyze({ essayIds, mode: el.analysisMode.value }, { onProgress: () => setAiWorking(true, "AI正在归纳班级普遍优缺点") });
      localState.analysisClassroom = false;
      el.analysisDialog.classList.remove("is-classroom");
      renderWritingAnalysis(result);
      openDialog(el.analysisDialog);
    } catch (error) { showToast(error.message || "班级分析生成失败"); }
    finally { setAiWorking(false); }
  }

  function toggleClassroomAnalysis() {
    localState.analysisClassroom = !localState.analysisClassroom;
    el.analysisDialog.classList.toggle("is-classroom", localState.analysisClassroom);
    const button = el.analysisDialog.querySelector('[data-analysis-action="classroom"]');
    button.textContent = localState.analysisClassroom ? "❐" : "⛶";
    button.title = localState.analysisClassroom ? "恢复窗口 / Restore" : "课堂展示 / Classroom view";
  }

  async function openReview(essayId) {
    const essay = await hydrateEssay(essayId);
    if (!essay) return;
    localState.activeEssayId = essay.id;
    el.reviewTitle.textContent = essay.title;
    el.reviewEyebrow.textContent = roleIsTeacher() ? "作文批阅" : "作文详情";
    const meta = `<div class="review-meta"><span>学生：${safe(essay.studentName)}</span><span>学号：${safe(essay.studentId)}</span><span>提交：${formatDate(essay.submittedAt)}</span><span>${wordCount(essay)}字</span><span>第${essay.version || 1}稿</span></div>`;
    const manuscript = `<section class="review-manuscript"><div class="review-title-block"><h3>${safe(essay.title)}</h3><p>${safe(essay.requirements)}</p></div>${meta}<div class="review-manuscript-pages">${manuscriptMarkup(essay.cells)}</div></section>`;
    if (roleIsTeacher()) {
      const feedback = essay.teacherFeedback || {};
      el.reviewContent.innerHTML = `<div class="writing-review-layout">${manuscript}<aside class="review-feedback"><h3>AI原始评价</h3>${adviceMarkup(essay.aiAssessment, true)}${essay.aiError ? `<p class="empty-approval">${safe(essay.aiError)}</p>` : ""}
        <form class="teacher-feedback-form" id="teacherFeedbackForm">
          <label><span>教师评价</span><textarea name="evaluation" placeholder="可修改AI评价或补充教师评价">${safe(feedback.evaluation || "")}</textarea></label>
          <label><span>修改建议</span><textarea name="suggestions" placeholder="给学生明确、可执行的修改方向">${safe(feedback.suggestions || "")}</textarea></label>
          <label><span>最终分数</span><input name="score" type="number" min="0" max="100" value="${safe(feedback.score || "")}" placeholder="0—100"></label>
          <div class="teacher-review-actions"><button class="quiet-button" type="button" data-review-action="save">保存批阅</button><button class="quiet-button" type="button" data-review-action="return">退回修改</button><button class="primary-button" type="button" data-review-action="publish">发布反馈</button></div>
        </form></aside></div>`;
    } else {
      const feedback = essay.teacherFeedback || {};
      el.reviewContent.innerHTML = `<div class="writing-review-layout">${manuscript}<aside class="review-feedback"><h3>学习建议</h3>${adviceMarkup(essay.aiAssessment, false)}
        ${feedback.published ? `<div class="student-feedback-panel"><section><h3>教师评价</h3><p>${safe(feedback.evaluation || "暂无文字评价")}</p></section><section><h3>修改建议</h3><p>${safe(feedback.suggestions || "暂无补充建议")}</p></section><section><h3>教师最终分</h3><p>${safe(feedback.score || "未评分")}</p></section></div>` : '<p class="empty-approval">教师尚未发布正式反馈。</p>'}
        ${essay.status === "returned" ? '<button class="primary-button" type="button" data-writing-revise>开始修改</button>' : ""}</aside></div>`;
    }
    openDialog(el.reviewDialog);
  }

  function feedbackValues() {
    const form = document.querySelector("#teacherFeedbackForm");
    if (!form) return null;
    const data = new FormData(form);
    return { evaluation: String(data.get("evaluation") || "").trim(), suggestions: String(data.get("suggestions") || "").trim(), score: String(data.get("score") || "").trim() };
  }

  async function saveTeacherFeedback(action) {
    const essay = currentEssay();
    const values = feedbackValues();
    if (!essay || !values) return;
    let savedToCloud = false;
    if (cloudReady() && essay._cloud) {
      setAiWorking(true, "正在保存教师批阅");
      try {
        const result = await window.LearningApi.writingReview({ id: essay.id, action, ...values });
        Object.assign(essay, result.essay, { _cloud: true });
        savedToCloud = true;
      } catch (error) {
        setAiWorking(false);
        return showToast(error.message || "教师批阅保存失败");
      }
      setAiWorking(false);
    }
    essay.teacherFeedback = { ...essay.teacherFeedback, ...values, updatedAt: new Date().toISOString(), teacher: state.userName || state.teacherContext.teacher };
    if (!savedToCloud && action === "return") {
      essay.status = "returned";
      essay.version = (essay.version || 1) + 1;
      essay.teacherFeedback.published = false;
    } else if (!savedToCloud && action === "publish") {
      essay.status = "completed";
      essay.teacherFeedback.published = true;
      essay.teacherFeedback.publishedAt = new Date().toISOString();
    } else {
      essay.teacherFeedback.published = action === "publish";
    }
    essay.updatedAt = new Date().toISOString();
    saveEssays();
    closeDialog(el.reviewDialog);
    render();
    showToast(action === "publish" ? "教师反馈已发布给学生" : action === "return" ? "作文已退回学生修改" : "批阅内容已保存");
  }

  function toggleFullscreen() {
    localState.fullscreen = !localState.fullscreen;
    el.canvasWindow.classList.toggle("is-fullscreen", localState.fullscreen);
    const button = el.canvasWindow.querySelector('[data-essay-action="toggle-fullscreen"]');
    button.textContent = localState.fullscreen ? "❐" : "⛶";
    button.title = localState.fullscreen ? "恢复 / Restore" : "全屏 / Full screen";
    if (localState.fullscreen) el.canvasWindow.style.transform = "";
  }

  function changePage(direction) {
    const essay = currentEssay();
    const pageCount = Math.max(1, Math.ceil(Math.max(1, essay?.cells.length || 0) / PAGE_SIZE));
    localState.page = Math.max(0, Math.min(pageCount - 1, localState.page + direction));
    renderManuscript();
  }

  function handleEssayAction(action) {
    if (action === "clear-cell") clearCanvas();
    else if (action === "confirm-cell") confirmCell();
    else if (action === "undo-cell") undoCell();
    else if (action === "save-draft") saveDraft();
    else if (action === "submit") void submitEssay();
    else if (action === "previous-page") changePage(-1);
    else if (action === "next-page") changePage(1);
    else if (action === "toggle-fullscreen") toggleFullscreen();
    else if (action === "assist") openAssist();
  }

  function setupDrag() {
    const handle = el.canvasWindow.querySelector("[data-essay-drag-handle]");
    handle.addEventListener("pointerdown", (event) => {
      if (localState.fullscreen || event.target.closest("button") || window.innerWidth <= 760) return;
      const matrix = new DOMMatrixReadOnly(getComputedStyle(el.canvasWindow).transform);
      localState.drag = { x: event.clientX, y: event.clientY, tx: matrix.m41, ty: matrix.m42 };
      handle.setPointerCapture(event.pointerId);
    });
    handle.addEventListener("pointermove", (event) => {
      if (!localState.drag) return;
      const x = localState.drag.tx + event.clientX - localState.drag.x;
      const y = localState.drag.ty + event.clientY - localState.drag.y;
      el.canvasWindow.style.transform = `translate(${x}px, ${y}px)`;
    });
    handle.addEventListener("pointerup", () => { localState.drag = null; });
    handle.addEventListener("pointercancel", () => { localState.drag = null; });
  }

  function identityChanged() {
    if (state.view === "writing") render();
    renderTeacherSummary();
    void syncFromCloud();
  }

  document.addEventListener("click", (event) => {
    const writingAction = event.target.closest("[data-writing-action]")?.dataset.writingAction;
    if (writingAction === "new") return openSetup();
    if (writingAction === "login") return openAuth("student-login");
    const closeTarget = event.target.closest("[data-writing-close]")?.dataset.writingClose;
    if (closeTarget) {
      const dialogs = { setup: el.setupDialog, assist: el.assistDialog, canvas: el.canvasDialog, review: el.reviewDialog, analysis: el.analysisDialog };
      closeDialog(dialogs[closeTarget]);
      return;
    }
    const essayId = event.target.closest("[data-writing-open]")?.dataset.writingOpen;
    if (essayId) return void openCanvas(essayId);
    const reviewId = event.target.closest("[data-writing-review]")?.dataset.writingReview;
    if (reviewId) return void openReview(reviewId);
    const filter = event.target.closest("[data-writing-filter]")?.dataset.writingFilter;
    if (filter) {
      localState.filter = filter;
      el.tabs.querySelectorAll("[data-writing-filter]").forEach((button) => button.classList.toggle("active", button.dataset.writingFilter === filter));
      render();
      return;
    }
    const essayAction = event.target.closest("[data-essay-action]")?.dataset.essayAction;
    if (essayAction) return handleEssayAction(essayAction);
    const punctuation = event.target.closest("[data-essay-punctuation]")?.dataset.essayPunctuation;
    if (punctuation) return addPunctuation(punctuation);
    const cellIndex = event.target.closest("[data-essay-cell]")?.dataset.essayCell;
    if (cellIndex !== undefined) return selectCell(Number(cellIndex));
    const assistTab = event.target.closest("[data-assist-tab]")?.dataset.assistTab;
    if (assistTab) { localState.assistTab = assistTab; renderAssist(); return; }
    if (event.target.closest("[data-writing-assist-generate]")) return void generateAssist();
    const reviewAction = event.target.closest("[data-review-action]")?.dataset.reviewAction;
    if (reviewAction) return void saveTeacherFeedback(reviewAction);
    if (event.target.closest('[data-analysis-action="classroom"]')) return toggleClassroomAnalysis();
    if (event.target.closest("[data-writing-revise]")) {
      closeDialog(el.reviewDialog);
      void openCanvas(localState.activeEssayId);
    }
  });

  el.newButton?.addEventListener("click", openSetup);
  el.selectAll?.addEventListener("change", () => setVisibleSelection(el.selectAll.checked));
  el.analyzeButton?.addEventListener("click", () => void analyzeSelectedWriting());
  el.list?.addEventListener("change", (event) => {
    const input = event.target.closest("[data-writing-select]");
    if (!input) return;
    if (input.checked) localState.selectedIds.add(input.dataset.writingSelect);
    else localState.selectedIds.delete(input.dataset.writingSelect);
    updateBatchToolbar();
  });
  el.setupForm?.addEventListener("submit", (event) => { event.preventDefault(); createEssay(event.currentTarget); });
  [el.setupDialog, el.assistDialog, el.reviewDialog, el.analysisDialog].forEach((dialog) => dialog?.addEventListener("click", (event) => { if (event.target === dialog) closeDialog(dialog); }));
  el.canvasDialog?.addEventListener("click", (event) => { if (event.target === el.canvasDialog) closeDialog(el.canvasDialog); });
  setupDrag();

  window.WritingZone = Object.freeze({ render, renderTeacherSummary, identityChanged });
  renderTeacherSummary();
  if (state.view === "writing") render();
  void syncFromCloud();
})();
