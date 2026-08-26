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
    insertAt: null,
    page: 0,
    drawing: false,
    strokeCount: 0,
    fullscreen: false,
    assistTab: "understand",
    drag: null,
    syncing: false,
    selectedIds: new Set(),
    analysisClassroom: false,
    feedbackTabs: new Map(),
    aiStartedAt: 0,
    aiTimer: null,
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
    setupHint: document.querySelector("#writingSetupHint"),
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
    cellEditToolbar: document.querySelector("#essayCellEditToolbar"),
    cellEditLabel: document.querySelector("#essayCellEditLabel"),
    pageLabel: document.querySelector("#essayPageLabel"),
    saveStatus: document.querySelector("#essaySaveStatus"),
    reviewDialog: document.querySelector("#writingReviewDialog"),
    reviewEyebrow: document.querySelector("#writingReviewEyebrow"),
    reviewTitle: document.querySelector("#writingReviewTitle"),
    reviewContent: document.querySelector("#writingReviewContent"),
    aiOverlay: document.querySelector("#writingAiOverlay"),
    aiStatus: document.querySelector("#writingAiStatus"),
    aiElapsed: document.querySelector("#writingAiElapsed"),
    aiHint: document.querySelector("#writingAiHint"),
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
        teacher: profile.teacher || "",
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

  function hasCurrentAiReview(essay) {
    return Boolean(essay?.aiAssessment && (essay.assessmentJobId || essay.aiAssessment?._jobId) && essay.aiReviewStale !== true && Number(essay.aiReviewedRevision || 0) === Number(essay.draftRevision || 1));
  }

  function markEssayEdited(essay) {
    essay.draftRevision = Math.max(1, Number(essay.draftRevision || 1)) + 1;
    essay.aiReviewStale = Boolean(essay.aiAssessment);
    essay.updatedAt = new Date().toISOString();
  }

  function cloudReady() {
    return Boolean(window.LearningApi?.isConfigured?.() && cloudProfile());
  }

  function cloudAuthFailure(error) {
    return /登录|token|会话|邀请码|401|403/i.test(String(error?.message || ""));
  }

  function expireCloudSession() {
    try { window.LearningApi?.clearSession?.(); } catch { /* ignore */ }
  }

  function mergeEssay(incoming) {
    const index = localState.essays.findIndex((essay) => essay.id === incoming.id);
    const prior = index >= 0 ? localState.essays[index] : null;
    const merged = { ...(prior || {}), ...incoming, cells: incoming.cells || prior?.cells || [], strokeCounts: incoming.strokeCounts || prior?.strokeCounts || [], draftRevision: Math.max(1, Number(incoming.draftRevision || prior?.draftRevision || 1)), _cloud: true };
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
      const teacherName = state.role === "admin" ? "" : (state.teacherContext?.teacher || state.userName);
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
      el.list.innerHTML = `<div class="writing-empty"><strong>登录后进入写作专区</strong><p>学生登录后可以录入作文题目和要求，并使用田字格完成手写作文。</p><button class="primary-button" type="button" data-writing-action="login">学生登录 <small>Sign in</small></button></div>`;
      return;
    }
    const own = visibleEssays().sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
    const filtered = localState.filter === "all" ? own : own.filter((essay) => essay.status === localState.filter);
    el.count.textContent = `${filtered.length}篇`;
    if (!filtered.length) {
      el.list.innerHTML = `<div class="writing-empty"><strong>${own.length ? "当前分类暂无作文" : "开始第一篇手写作文"}</strong><p>题目和要求可以键盘录入，作文正文只在田字格中手写。</p>${own.length ? "" : '<button class="primary-button" type="button" data-writing-action="new">新建作文 <small>New essay</small></button>'}</div>`;
      return;
    }
    el.list.innerHTML = filtered.map((essay) => {
      const canWrite = ["draft", "returned"].includes(essay.status);
      const actionLabel = essay.status === "returned" ? "开始改写 <small>Revise</small>" : essay.status === "draft" ? "继续写作 <small>Write</small>" : "查看详情 <small>View</small>";
      const displayStatus = essay.status === "draft" && hasCurrentAiReview(essay) ? "AI预评完成" : essay.status === "draft" && essay.aiReviewStale ? "AI评价已过期" : statusLabels[essay.status] || essay.status;
      return `<article class="writing-row" data-status="${essay.status}">
        <span class="writing-row-mark" aria-hidden="true">写</span>
        <div class="writing-row-copy"><strong>${safe(essay.title)}</strong><p>${safe(essay.requirements)}</p><small>提交给 ${safe(essay.teacher || "本机草稿")} · ${wordCount(essay)}字 · 第${essay.version || 1}稿 · ${formatDate(essay.updatedAt)}</small></div>
        <span class="writing-row-status">${displayStatus}</span>
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
      <div class="writing-row-actions"><button class="resume-button" type="button" data-writing-review="${essay.id}">批阅 <small>Review</small></button></div>
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
    const teacherName = state.role === "admin" ? "" : (state.teacherContext?.teacher || state.userName);
    const pending = localState.essays.filter((essay) => essay.status === "submitted" && (!teacherName || essay.teacher === teacherName)).length;
    el.teacherPending.textContent = `${pending}篇待批阅`;
  }

  function teacherOptions() {
    const courses = (typeof state !== "undefined" && Array.isArray(state.studentCourses) && state.studentCourses.length) ? state.studentCourses : [];
    const student = studentProfile();
    const fallbackTeacher = student?.teacher || "";
    const seen = new Set();
    const options = [];
    const addOption = (value, label) => {
      if (!value || seen.has(value)) return;
      seen.add(value);
      options.push({ value, label });
    };
    if (courses.length) courses.forEach((course) => addOption(course.teacher || fallbackTeacher, `${course.teacher || "教师"} 老师 · ${bookById(course.bookId).label}`));
    if (fallbackTeacher && !seen.has(fallbackTeacher)) options.push({ value: fallbackTeacher, label: `${fallbackTeacher} 老师` });
    return options;
  }

  function openSetup() {
    const student = studentProfile();
    if (!student) {
      openAuth("student-login");
      showToast("请先以学生身份登录");
      return;
    }
    el.setupForm.reset();
    const options = teacherOptions();
    el.teacherSelect.required = Boolean(options.length);
    el.teacherSelect.innerHTML = options.length
      ? options.map((option) => `<option value="${safe(option.value)}"${option.value === student.teacher ? " selected" : ""}>${safe(option.label)}</option>`).join("")
      : '<option value="">尚未加入课程 / No course yet</option>';
    if (el.setupHint) el.setupHint.hidden = Boolean(options.length);
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
      teacher: String(data.get("teacher") || teacherOptions()[0]?.value || "").trim(),
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
      assessmentJobId: "",
      draftRevision: 1,
      aiReviewedRevision: 0,
      aiReviewStale: false,
      aiPreviewCount: 0,
      teacherFeedback: { evaluation: "", suggestions: "", score: "", published: false },
      createdAt: now,
      updatedAt: now,
    };
    if (!essay.title || !essay.requirements) return;
    if (!essay.teacher) showToast("提示：尚未绑定教师，作文会保存在本机，教师端暂不可见。请先联系教师获取课程邀请码。");
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
    localState.insertAt = null;
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
    const hasSelection = localState.selectedCell !== null;
    el.cellEditToolbar.hidden = !hasSelection;
    if (hasSelection) el.cellEditLabel.textContent = `当前选中：第${localState.selectedCell + 1}格 / Selected: cell ${localState.selectedCell + 1}`;
    el.wordCount.textContent = `${wordCount(essay)}字`;
    el.pageLabel.textContent = `第${localState.page + 1} / ${pageCount}页`;
    el.activeCellLabel.textContent = localState.insertAt !== null
      ? `插入到第${localState.insertAt + 1}格 / Insert at cell ${localState.insertAt + 1}`
      : localState.selectedCell === null
        ? `写下第${essay.cells.length + 1}个字`
        : `修改第${localState.selectedCell + 1}格 / Edit cell ${localState.selectedCell + 1}`;
    const currentReview = hasCurrentAiReview(essay);
    el.saveStatus.textContent = essay.aiReviewStale
      ? "正文已修改，上一次AI评价对应旧稿，请重新预评"
      : currentReview
        ? `AI预评完成 · 本稿已预评${Number(essay.aiPreviewCount || 1)}次`
        : essay.status === "returned" ? "教师已退回，请修改后进行AI预评" : `草稿已记录 · ${formatDate(essay.updatedAt)}`;
    const previewButton = el.canvasWindow.querySelector('[data-essay-action="ai-preview"]');
    const submitButton = el.canvasWindow.querySelector('[data-essay-action="submit"]');
    if (previewButton) previewButton.innerHTML = currentReview
      ? "查看已有AI预评 <small>View saved review</small>"
      : `${essay.aiAssessment ? "重新AI预评" : "AI预评"} <small>${essay.aiAssessment ? "Review revised draft" : "AI review"}</small>`;
    if (submitButton) {
      submitButton.disabled = !currentReview;
      submitButton.title = currentReview ? "提交当前稿件给教师 / Submit to teacher" : "请先完成当前稿件的AI预评 / Complete AI review first";
    }
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
    if (localState.insertAt !== null) {
      const index = Math.max(0, Math.min(essay.cells.length, localState.insertAt));
      essay.cells.splice(index, 0, cell);
      essay.strokeCounts.splice(index, 0, localState.strokeCount);
      localState.insertAt = null;
    } else if (localState.selectedCell === null) {
      if (essay.cells.length >= MAX_CELLS) return showToast(`每篇作文暂时最多${MAX_CELLS}格`);
      essay.cells.push(cell);
      essay.strokeCounts.push(localState.strokeCount);
    } else {
      essay.cells[localState.selectedCell] = cell;
      essay.strokeCounts[localState.selectedCell] = localState.strokeCount;
      localState.selectedCell = null;
    }
    markEssayEdited(essay);
    localState.page = Math.floor((essay.cells.length - 1) / PAGE_SIZE);
    saveEssays();
    clearCanvas();
    renderManuscript();
  }

  function addPunctuation(value) {
    const essay = currentEssay();
    if (!essay || (essay.cells.length >= MAX_CELLS && localState.selectedCell === null && localState.insertAt === null)) return;
    const cell = { type: "punctuation", value, strokes: 0 };
    if (localState.insertAt !== null) {
      const index = Math.max(0, Math.min(essay.cells.length, localState.insertAt));
      essay.cells.splice(index, 0, cell);
      essay.strokeCounts.splice(index, 0, 0);
      localState.insertAt = null;
    } else if (localState.selectedCell === null) {
      essay.cells.push(cell);
      essay.strokeCounts.push(0);
    } else {
      essay.cells[localState.selectedCell] = cell;
      essay.strokeCounts[localState.selectedCell] = 0;
      localState.selectedCell = null;
    }
    markEssayEdited(essay);
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
    localState.insertAt = null;
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
    localState.insertAt = null;
    markEssayEdited(essay);
    saveEssays();
    clearCanvas();
    renderManuscript();
  }

  function beginInsert(offset) {
    const essay = currentEssay();
    if (!essay || localState.selectedCell === null) return;
    if (essay.cells.length >= MAX_CELLS) return showToast(`每篇作文暂时最多${MAX_CELLS}格`);
    localState.insertAt = Math.max(0, Math.min(essay.cells.length, localState.selectedCell + offset));
    localState.selectedCell = null;
    clearCanvas();
    renderManuscript();
    el.canvas.focus?.();
  }

  function deleteSelectedCell() {
    if (localState.selectedCell === null) return;
    undoCell();
    showToast("已删除选中格 / Selected cell deleted");
  }

  function cancelCellSelection() {
    localState.selectedCell = null;
    localState.insertAt = null;
    clearCanvas();
    renderManuscript();
  }

  function draftPayload(essay) {
    return { schemaVersion: 1, essayId: essay.id, cells: essay.cells, strokeCounts: essay.strokeCounts, characterCount: wordCount(essay), draftRevision: Math.max(1, Number(essay.draftRevision || 1)), updatedAt: essay.updatedAt };
  }

  async function uploadAndSaveDraft(essay) {
    const ticket = await window.LearningApi.uploadJson(draftPayload(essay), `writing-${essay.id}-draft`);
    const result = await window.LearningApi.writingSave({ id: essay.id, title: essay.title, requirements: essay.requirements, teacher: essay.teacher, locale: essay.locale, version: essay.version || 1, characterCount: wordCount(essay), draftRevision: Math.max(1, Number(essay.draftRevision || 1)), draftObjectKey: ticket.objectKey });
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
          const authLost = cloudAuthFailure(error);
          if (authLost) expireCloudSession();
          el.saveStatus.textContent = authLost ? `云端登录已失效 · 已保存在本机` : `已保存在本机 · 云端同步失败`;
          showToast(authLost ? "云端登录已失效，草稿已保存在本机，请重新登录后再同步" : (error.message || "云端草稿保存失败，本机草稿仍然保留"));
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

  async function combineCells(cells, options = {}) {
    const cleanForOcr = options.cleanForOcr === true;
    const columns = Math.max(1, Math.min(10, cells.length));
    const rows = cleanForOcr ? Math.max(1, Math.ceil(cells.length / columns)) : Math.max(8, Math.ceil(cells.length / columns));
    const size = cleanForOcr ? 132 : 100;
    const gap = cleanForOcr ? 16 : 0;
    const canvas = document.createElement("canvas");
    canvas.width = cleanForOcr ? gap + columns * (size + gap) : columns * size;
    canvas.height = cleanForOcr ? gap + rows * (size + gap) : rows * size;
    const context = canvas.getContext("2d");
    context.fillStyle = "#fff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    if (!cleanForOcr) for (let index = 0; index < rows * columns; index += 1) drawGrid(context, (index % columns) * size, Math.floor(index / columns) * size, size);
    for (let index = 0; index < cells.length; index += 1) {
      const cell = cells[index];
      const x = (cleanForOcr ? gap : 0) + (index % columns) * (size + gap);
      const y = (cleanForOcr ? gap : 0) + Math.floor(index / columns) * (size + gap);
      if (cell.type === "image") {
        const image = await loadImage(cell.data);
        const padding = cleanForOcr ? 3 : 4;
        context.drawImage(image, x + padding, y + padding, size - padding * 2, size - padding * 2);
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

  function suspiciousWritingOcr(text, expectedCharacters) {
    const normalized = String(text || "").trim();
    if (!normalized) return true;
    const arithmeticRows = normalized.split(/\r?\n/).filter((line) => /^\s*\d+\s*[-+−]\s*\d+\s*=\s*\d+\s*$/.test(line));
    if (arithmeticRows.length >= 3) return true;
    const compact = normalized.replace(/\s/g, "");
    return expectedCharacters >= 4 && (compact.length < Math.max(2, Math.floor(expectedCharacters * 0.35)) || compact.length > expectedCharacters * 4);
  }

  function confirmRecognizedWriting(recognizedText, manuscriptBlob, expectedRevision) {
    return new Promise((resolve) => {
      const dialog = document.createElement("dialog");
      const imageUrl = URL.createObjectURL(manuscriptBlob);
      dialog.className = "writing-ocr-dialog";
      dialog.innerHTML = `<form method="dialog" class="writing-ocr-window">
        <header data-ocr-drag-handle><div><span>手写识别确认 <small>Recognition confirmation</small></span><h2>请核对识别文本</h2></div><nav class="ocr-window-controls" aria-label="窗口控制 / Window controls"><button type="button" data-ocr-action="minimize" aria-label="缩小 / Minimize" title="缩小 / Minimize">—</button><button type="button" data-ocr-action="maximize" aria-label="放大 / Maximize" title="放大 / Maximize">□</button><button type="button" data-ocr-action="cancel" aria-label="关闭 / Close" title="关闭 / Close">×</button></nav></header>
        <div class="writing-ocr-body"><p class="writing-ocr-notice">请只修正OCR识别错误。可以缩小或移动本窗口，对照手写稿修改；原稿一旦改变，需要重新识别。<small>Please correct recognition errors only. You may move or minimize this window while checking the manuscript.</small></p>
        <details class="writing-ocr-original"><summary>查看手写原稿 <small>View handwriting</small></summary><img src="${imageUrl}" alt="手写作文原稿"></details>
        <label class="writing-ocr-editor"><span>识别文本 <small>Recognized text</small></span><textarea rows="12" data-ocr-text>${safe(recognizedText)}</textarea></label>
        <label class="writing-ocr-check"><input type="checkbox" data-ocr-confirm> <span>我已核对，以上文本与我的手写内容一致。<small>I have checked that the text matches my handwriting.</small></span></label></div>
        <footer><button class="quiet-button" type="button" data-ocr-action="cancel">返回修改 <small>Back to edit</small></button><button class="primary-button" type="button" data-ocr-action="confirm">确认并获取AI评价 <small>Confirm and review</small></button></footer>
      </form>`;
      (el.canvasDialog || document.body).appendChild(dialog);
      let settled = false;
      const finish = (value) => {
        if (settled) return;
        settled = true;
        URL.revokeObjectURL(imageUrl);
        closeDialog(dialog);
        dialog.remove();
        resolve(value);
      };
      dialog.addEventListener("cancel", (event) => { event.preventDefault(); finish(null); });
      dialog.addEventListener("click", (event) => {
        const action = event.target.closest("[data-ocr-action]")?.dataset.ocrAction;
        if (action === "cancel") return finish(null);
        if (action === "minimize") {
          dialog.classList.toggle("is-minimized");
          dialog.classList.remove("is-maximized");
          event.target.textContent = dialog.classList.contains("is-minimized") ? "▣" : "—";
          event.target.title = dialog.classList.contains("is-minimized") ? "恢复 / Restore" : "缩小 / Minimize";
          return;
        }
        if (action === "maximize") {
          dialog.classList.toggle("is-maximized");
          dialog.classList.remove("is-minimized");
          event.target.textContent = dialog.classList.contains("is-maximized") ? "❐" : "□";
          event.target.title = dialog.classList.contains("is-maximized") ? "恢复 / Restore" : "放大 / Maximize";
          return;
        }
        if (action !== "confirm") return;
        if (Number(currentEssay()?.draftRevision || 1) !== Number(expectedRevision || 1)) {
          dialog.classList.add("is-stale");
          return showToast("手写原稿已经修改，请关闭本窗口后重新识别");
        }
        const text = dialog.querySelector("[data-ocr-text]").value.trim();
        const checked = dialog.querySelector("[data-ocr-confirm]").checked;
        if (!text) return showToast("请先核对识别文本");
        if (!checked) return showToast("请确认文本与手写内容一致");
        finish(text);
      });
      if (typeof dialog.show === "function") dialog.show();
      else dialog.setAttribute("open", "");
      dialog.classList.add("is-floating");
      const rect = dialog.getBoundingClientRect();
      dialog.style.left = `${Math.max(12, (window.innerWidth - rect.width) / 2)}px`;
      dialog.style.top = `${Math.max(12, (window.innerHeight - rect.height) / 2)}px`;
      const dragHandle = dialog.querySelector("[data-ocr-drag-handle]");
      let drag = null;
      dragHandle?.addEventListener("pointerdown", (event) => {
        if (event.target.closest("button") || window.innerWidth <= 700 || dialog.classList.contains("is-maximized")) return;
        const current = dialog.getBoundingClientRect();
        drag = { id: event.pointerId, x: event.clientX - current.left, y: event.clientY - current.top };
        dragHandle.setPointerCapture(event.pointerId);
      });
      dragHandle?.addEventListener("pointermove", (event) => {
        if (!drag || drag.id !== event.pointerId) return;
        dialog.style.left = `${Math.max(0, Math.min(window.innerWidth - 220, event.clientX - drag.x))}px`;
        dialog.style.top = `${Math.max(0, Math.min(window.innerHeight - 64, event.clientY - drag.y))}px`;
      });
      ["pointerup", "pointercancel"].forEach((name) => dragHandle?.addEventListener(name, () => { drag = null; }));
      dialog.querySelector("[data-ocr-text]")?.focus();
    });
  }

  function setAiWorking(active, message = "正在整理手写作文") {
    el.aiOverlay.hidden = !active;
    el.aiStatus.textContent = message;
    document.querySelectorAll("[data-writing-assist-generate], [data-essay-action='ai-preview'], [data-essay-action='submit'], [data-review-action='publish'], [data-writing-analyze]").forEach((button) => { button.disabled = active; });
    if (!active) {
      const submitButton = document.querySelector("[data-essay-action='submit']");
      if (submitButton) submitButton.disabled = !hasCurrentAiReview(currentEssay());
      if (localState.aiTimer) window.clearInterval(localState.aiTimer);
      localState.aiTimer = null;
      localState.aiStartedAt = 0;
      if (el.aiElapsed) el.aiElapsed.textContent = "已等待 00:00 · Elapsed 00:00";
      return;
    }
    if (!localState.aiStartedAt) localState.aiStartedAt = Date.now();
    const updateElapsed = () => {
      const seconds = Math.max(0, Math.floor((Date.now() - localState.aiStartedAt) / 1000));
      const formatted = `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
      if (el.aiElapsed) el.aiElapsed.textContent = `已等待 ${formatted} · Elapsed ${formatted}`;
      if (el.aiHint) el.aiHint.textContent = seconds >= 60
        ? "处理时间较长，您可以继续等待，请不要重复提交。 · Still working; please do not submit again."
        : seconds >= 30
          ? "当前请求较多，AI仍在处理中。 · AI is still processing the request."
          : "请不要重复提交 · Please do not submit again";
    };
    updateElapsed();
    if (!localState.aiTimer) localState.aiTimer = window.setInterval(updateElapsed, 1000);
  }

  async function runAiPreview() {
    const essay = currentEssay();
    if (!essay || wordCount(essay) < 5) {
      showToast("正文至少需要写5个汉字后才能进行AI预评");
      return;
    }
    if (!cloudReady()) return showToast("请先登录云服务，再进行AI预评");
    if (hasCurrentAiReview(essay)) {
      showToast("本稿已经完成识别和AI预评，正在使用已有结果");
      renderManuscript();
      return;
    }
    essay.updatedAt = new Date().toISOString();
    setAiWorking(true, "正在生成作文图片");
    try {
      const [manuscriptBlob, ocrBlob] = await Promise.all([
        combineCells(essay.cells),
        combineCells(essay.cells, { cleanForOcr: true }),
      ]);
      setAiWorking(true, "正在保存作文草稿");
      await uploadAndSaveDraft(essay);
      let confirmedText = Number(essay.confirmedRevision || 0) === Number(essay.draftRevision || 1) ? String(essay.confirmedText || "").trim() : "";
      if (!confirmedText) {
        setAiWorking(true, "正在识别手写全文");
        const recognition = await window.LearningApi.assessArtifact(ocrBlob, {
          kind: "handwriting",
          artifactId: uid("free-writing-ocr"),
          lessonId: "writing-zone",
          unitType: "practiceHandwritingOcr",
          unitId: essay.id,
          referenceText: essay.title,
          locale: essay.locale,
          metrics: { ocrOnly: true, characterCount: wordCount(essay) },
        }, { onProgress: (phase) => setAiWorking(true, phase === "uploading" ? "正在上传手写稿" : phase === "assessing" || phase === "advising" ? "正在识别手写全文" : "正在准备OCR识别") });
        setAiWorking(false);
        if (suspiciousWritingOcr(recognition.recognizedText, wordCount(essay))) throw new Error("OCR识别结果异常，已停止内容评价；请重新识别手写稿");
        confirmedText = await confirmRecognizedWriting(recognition.recognizedText || "", manuscriptBlob, essay.draftRevision);
        if (!confirmedText) {
          showToast("已保留手写草稿，尚未生成AI评价");
          return;
        }
        essay.ocrText = recognition.recognizedText || "";
        essay.ocrJobId = recognition?._jobId || "";
        essay.confirmedText = confirmedText;
        essay.confirmedRevision = Math.max(1, Number(essay.draftRevision || 1));
      }
      setAiWorking(true, "正在评价已确认的作文内容");
      const textBlob = new Blob([JSON.stringify({ text: confirmedText })], { type: "application/json" });
      const assessment = await window.LearningApi.assessArtifact(textBlob, {
        kind: "essay",
        artifactId: uid("free-writing-confirmed"),
        lessonId: "writing-zone",
        unitType: "practiceHandwriting",
        unitId: essay.id,
        referenceText: confirmedText,
        locale: essay.locale,
        metrics: {
          prompt: `${essay.title}\n${essay.requirements}`,
          requiredVocabulary: [],
          writingStructure: essay.aiSupport?.outline || [],
          keywordGuidance: essay.aiSupport?.expressions || [],
          referencePoints: [],
          rubric: ["切题", "结构", "表达", "书写"],
          characterCount: wordCount(essay),
          includeHandwritingAdvice: true,
          writingMetrics: { characterCount: wordCount(essay), recordedStrokeCounts: essay.strokeCounts },
        },
      }, { onProgress: (phase) => {
        const labels = { preparing: "正在准备已确认文本", uploading: "正在保存确认文本", submitting: "正在提交AI预评", assessing: "正在评价作文内容", advising: "正在生成中文及学生语言建议", saving: "正在保存预评" };
        setAiWorking(true, labels[phase] || "AI正在预评作文");
      } });
      const assessmentJobId = assessment?._jobId || "";
      setAiWorking(true, "正在保存AI预评，尚未发送教师");
      const preview = await window.LearningApi.writingPreview({ id: essay.id, assessmentJobId, manuscriptJobId: essay.ocrJobId || "", draftRevision: Math.max(1, Number(essay.draftRevision || 1)) });
      Object.assign(essay, preview.essay, { aiAssessment: assessment, assessmentJobId, aiReviewStale: false, _cloud: true });
      essay.aiError = "";
    } catch (error) {
      const authLost = cloudAuthFailure(error);
      if (authLost) expireCloudSession();
      essay.aiError = authLost ? "云端登录已失效，请重新登录后再预评" : (error.message || "AI预评暂时不可用");
      showToast(`AI预评未完成：${essay.aiError}`);
    } finally {
      saveEssays();
      setAiWorking(false);
      render();
      renderManuscript();
      if (hasCurrentAiReview(essay)) {
        closeDialog(el.canvasDialog);
        showToast("AI预评已完成，作文尚未发送给教师");
        void openReview(essay.id);
      }
    }
  }

  async function submitEssay() {
    const essay = currentEssay();
    if (!essay || !hasCurrentAiReview(essay)) return showToast("请先对当前稿件完成AI预评");
    if (!cloudReady()) return showToast("请先登录云服务，再提交教师");
    if (!window.confirm(`确认提交给${essay.teacher}老师？\n\n提交后暂时不能继续修改，除非教师退回作文。`)) return;
    setAiWorking(true, "正在确认最终稿件");
    try {
      const draftTicket = await uploadAndSaveDraft(essay);
      setAiWorking(true, "正在提交最终稿给教师");
      const submitted = await window.LearningApi.writingSubmit({ id: essay.id, title: essay.title, requirements: essay.requirements, teacher: essay.teacher, locale: essay.locale, version: essay.version || 1, characterCount: wordCount(essay), draftRevision: Math.max(1, Number(essay.draftRevision || 1)), draftObjectKey: draftTicket.objectKey, assessmentJobId: essay.assessmentJobId || essay.aiAssessment?._jobId || "", aiError: "" });
      Object.assign(essay, submitted.essay, { _cloud: true });
      essay.submittedAt = essay.submittedAt || new Date().toISOString();
      saveEssays();
      closeDialog(el.canvasDialog);
      closeDialog(el.reviewDialog);
      render();
      showToast(`最终稿已提交给${essay.teacher}老师`);
    } catch (error) {
      const authLost = cloudAuthFailure(error);
      if (authLost) expireCloudSession();
      showToast(authLost ? "云端登录已失效，请重新登录后再提交" : (error.message || "提交教师失败"));
    } finally { setAiWorking(false); }
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
    el.assistContent.innerHTML = `<div class="assist-note"><strong>${labels[localState.assistTab][0]}</strong><p>${labels[localState.assistTab][1]}</p></div><section class="assist-result-section"><h3>按“${safe(localeOptions.find(([code]) => code === essay.locale)?.[1] || "中文")}”生成辅助</h3><p>AI只给出理解、结构或表达方向，不代写完整作文。</p><button class="primary-button" type="button" data-writing-assist-generate>生成本项辅助 <small>Generate</small></button></section>`;
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

  function localeLabel(locale) {
    return localeOptions.find(([code]) => code === locale)?.[1] || locale || "中文";
  }

  function languageTabs(scope, available, selected, localizedIsAi = false) {
    const locales = Object.keys(available || {}).filter((locale) => available[locale]);
    if (locales.length < 2) return "";
    const ordered = ["zh-CN", ...locales.filter((locale) => locale !== "zh-CN")];
    return `<nav class="feedback-language-tabs" aria-label="反馈语言 / Feedback language">${ordered.map((locale) => `<button class="${locale === selected ? "active" : ""}" type="button" data-feedback-language="${safe(locale)}" data-feedback-scope="${safe(scope)}">${locale === "zh-CN" ? "中文" : safe(localeLabel(locale))}</button>`).join("")}</nav>${localizedIsAi && selected !== "zh-CN" ? '<small class="feedback-language-note">AI辅助翻译 · AI-assisted translation</small>' : ""}`;
  }

  function adviceMarkup(assessment, showScore, essay, teacherView = false) {
    if (!assessment) return '<div class="ai-feedback-copy"><strong>AI评价尚未生成</strong><p>教师仍可直接查看全文并填写评价。</p></div>';
    const scope = `ai:${essay.id}`;
    const legacyLocale = assessment.feedbackLocale || essay.locale || "zh-CN";
    const feedback = assessment.feedback && typeof assessment.feedback === "object"
      ? assessment.feedback
      : { [legacyLocale]: assessment.advice || {} };
    const preferred = teacherView ? "zh-CN" : (localState.feedbackTabs.get(scope) || essay.locale || "zh-CN");
    const selected = feedback[preferred] ? preferred : (feedback["zh-CN"] ? "zh-CN" : Object.keys(feedback)[0]);
    const advice = feedback[selected] || assessment.advice || {};
    const handwritingMap = assessment.handwritingFeedback && typeof assessment.handwritingFeedback === "object"
      ? assessment.handwritingFeedback
      : assessment.handwritingAdvice ? { "zh-CN": assessment.handwritingAdvice } : {};
    const handwritingAdvice = handwritingMap[selected] || handwritingMap["zh-CN"] || null;
    const score = Math.round(Number(assessment.scores?.total || 0));
    const tabs = teacherView ? "" : languageTabs(scope, feedback, selected);
    return `${tabs}${showScore ? `<div class="ai-score-panel"><strong>${score}</strong><span>AI参考分，仅供教师批阅参考，学生端不显示。</span></div>` : ""}
      <div class="ai-feedback-copy"><strong>AI评价</strong><p>${safe(advice.summary || "已完成评价")}</p>
      ${advice.strengths?.length ? `<strong>优点</strong><ul>${advice.strengths.map((item) => `<li>${safe(item)}</li>`).join("")}</ul>` : ""}
      ${advice.priorities?.length ? `<strong>优先修改</strong><ul>${advice.priorities.map((item) => `<li>${safe(item)}</li>`).join("")}</ul>` : ""}
      ${advice.practiceSteps?.length ? `<strong>修改建议</strong><ul>${advice.practiceSteps.map((item) => `<li>${safe(item)}</li>`).join("")}</ul>` : ""}</div>
      ${handwritingAdvice ? `<div class="ai-feedback-copy handwriting-feedback-copy"><strong>手写与版面建议 / Handwriting</strong><p>${safe(handwritingAdvice.summary || "")}</p>${handwritingAdvice.strengths?.length ? `<strong>优点</strong><ul>${handwritingAdvice.strengths.map((item) => `<li>${safe(item)}</li>`).join("")}</ul>` : ""}${handwritingAdvice.priorities?.length ? `<strong>需要注意</strong><ul>${handwritingAdvice.priorities.map((item) => `<li>${safe(item)}</li>`).join("")}</ul>` : ""}${handwritingAdvice.practiceSteps?.length ? `<strong>练习建议</strong><ul>${handwritingAdvice.practiceSteps.map((item) => `<li>${safe(item)}</li>`).join("")}</ul>` : ""}</div>` : ""}`;
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
      el.reviewContent.innerHTML = `<div class="writing-review-layout">${manuscript}<aside class="review-feedback"><h3>AI中文评价 <small>Chinese AI feedback</small></h3>${adviceMarkup(essay.aiAssessment, true, essay, true)}${essay.aiError ? `<p class="empty-approval">${safe(essay.aiError)}</p>` : ""}
        <form class="teacher-feedback-form" id="teacherFeedbackForm">
          <p class="feedback-language-note">请使用中文填写；发布时系统自动生成学生所选语言译文。 / Please write in Chinese.</p>
          <label><span>教师评价（中文）</span><textarea name="evaluation" placeholder="可修改AI评价或补充教师评价">${safe(feedback.evaluation || "")}</textarea></label>
          <label><span>修改建议（中文）</span><textarea name="suggestions" placeholder="给学生明确、可执行的修改方向">${safe(feedback.suggestions || "")}</textarea></label>
          <label><span>最终分数</span><input name="score" type="number" min="0" max="100" value="${safe(feedback.score || "")}" placeholder="0—100"></label>
          <div class="teacher-review-actions"><button class="quiet-button" type="button" data-review-action="save">保存批阅 <small>Save</small></button><button class="quiet-button" type="button" data-review-action="return">退回修改 <small>Return</small></button><button class="primary-button" type="button" data-review-action="publish">发布反馈 <small>Publish</small></button></div>
        </form></aside></div>`;
    } else {
      const feedback = essay.teacherFeedback || {};
      const teacherScope = `teacher:${essay.id}`;
      const teacherLanguages = { "zh-CN": { evaluation: feedback.evaluation || "", suggestions: feedback.suggestions || "" }, ...(feedback.translations || {}) };
      const teacherPreferred = localState.feedbackTabs.get(teacherScope) || essay.locale || "zh-CN";
      const teacherSelected = teacherLanguages[teacherPreferred] ? teacherPreferred : "zh-CN";
      const shownTeacherFeedback = teacherLanguages[teacherSelected] || teacherLanguages["zh-CN"];
      const canRevise = essay.status === "draft" || essay.status === "returned";
      const canSubmit = canRevise && hasCurrentAiReview(essay);
      el.reviewContent.innerHTML = `<div class="writing-review-layout">${manuscript}<aside class="review-feedback"><h3>学习建议</h3>${adviceMarkup(essay.aiAssessment, false, essay, false)}
        ${feedback.published ? `${languageTabs(teacherScope, teacherLanguages, teacherSelected, true)}<div class="student-feedback-panel"><section><h3>教师评价${teacherSelected === "zh-CN" ? "（中文原文）" : ""}</h3><p>${safe(shownTeacherFeedback.evaluation || "暂无文字评价")}</p></section><section><h3>修改建议${teacherSelected === "zh-CN" ? "（中文原文）" : ""}</h3><p>${safe(shownTeacherFeedback.suggestions || "暂无补充建议")}</p></section><section><h3>教师最终分</h3><p>${safe(feedback.score || "未评分")}</p></section></div>` : '<p class="empty-approval">教师尚未发布正式反馈。</p>'}
        ${canRevise ? `<div class="student-review-actions"><button class="quiet-button" type="button" data-writing-revise>返回修改 <small>Continue editing</small></button><button class="primary-button" type="button" data-writing-submit-final ${canSubmit ? "" : "disabled"}>提交教师 <small>Submit to teacher</small></button></div>${canSubmit ? '<p class="feedback-language-note">AI预评仅供修改参考；点击“提交教师”后教师才会收到作文。</p>' : '<p class="feedback-language-note">修改后的稿件需重新完成AI预评，才能提交教师。</p>'}` : ""}</aside></div>`;
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
    if (action === "publish" && essay.locale !== "zh-CN" && (!cloudReady() || !essay._cloud)) return showToast("生成学生语言译文需要连接云服务，请登录后再发布");
    let savedToCloud = false;
    let translatedFeedback = null;
    if (cloudReady() && essay._cloud) {
      setAiWorking(true, "正在保存教师批阅");
      try {
        if (action === "publish" && essay.locale !== "zh-CN" && (values.evaluation || values.suggestions)) {
          setAiWorking(true, `正在生成${localeLabel(essay.locale)}译文 · Translating teacher feedback`);
          translatedFeedback = await window.LearningApi.writingTranslateFeedback({ id: essay.id, evaluation: values.evaluation, suggestions: values.suggestions }, { onProgress: () => setAiWorking(true, "正在翻译教师中文反馈 · Translating Chinese feedback") });
        }
        setAiWorking(true, "正在发布教师反馈 · Publishing feedback");
        const result = await window.LearningApi.writingReview({ id: essay.id, action, ...values, translationJobId: translatedFeedback?._jobId || "" });
        Object.assign(essay, result.essay, { _cloud: true });
        savedToCloud = true;
      } catch (error) {
        setAiWorking(false);
        return showToast(error.message || "教师批阅保存失败");
      }
      setAiWorking(false);
    }
    essay.teacherFeedback = {
      ...essay.teacherFeedback,
      ...values,
      sourceLocale: "zh-CN",
      studentLocale: essay.locale || "zh-CN",
      translations: translatedFeedback && essay.locale !== "zh-CN" ? { [essay.locale]: { evaluation: translatedFeedback.evaluation || "", suggestions: translatedFeedback.suggestions || "" } } : (action === "publish" ? {} : essay.teacherFeedback?.translations || {}),
      translationSource: translatedFeedback ? "ai" : null,
      updatedAt: new Date().toISOString(),
      teacher: state.userName || state.teacherContext?.teacher,
    };
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
    else if (action === "ai-preview") void runAiPreview();
    else if (action === "submit") void submitEssay();
    else if (action === "previous-page") changePage(-1);
    else if (action === "next-page") changePage(1);
    else if (action === "toggle-fullscreen") toggleFullscreen();
    else if (action === "assist") openAssist();
    else if (action === "edit-selected") el.canvas.focus?.();
    else if (action === "insert-before") beginInsert(0);
    else if (action === "insert-after") beginInsert(1);
    else if (action === "delete-selected") deleteSelectedCell();
    else if (action === "cancel-selection") cancelCellSelection();
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
    const feedbackLanguageButton = event.target.closest("[data-feedback-language]");
    if (feedbackLanguageButton) {
      localState.feedbackTabs.set(feedbackLanguageButton.dataset.feedbackScope, feedbackLanguageButton.dataset.feedbackLanguage);
      if (localState.activeEssayId) void openReview(localState.activeEssayId);
      return;
    }
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
      return;
    }
    if (event.target.closest("[data-writing-submit-final]")) return void submitEssay();
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
  [el.setupDialog, el.assistDialog, el.reviewDialog, el.analysisDialog].forEach((dialog) => {
    if (dialog) window.attachDraggable?.({ element: dialog, handle: "header" });
  });
  el.canvasDialog?.addEventListener("click", (event) => { if (event.target === el.canvasDialog) closeDialog(el.canvasDialog); });
  setupDrag();

  window.WritingZone = Object.freeze({ render, renderTeacherSummary, identityChanged });
  renderTeacherSummary();
  if (state.view === "writing") render();
  void syncFromCloud();
})();
