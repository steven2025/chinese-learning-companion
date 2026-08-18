const terms = ["2026 Fall", "2027 Spring", "2027 Fall", "2028 Spring", "2028 Fall"];
const defaultTeacher = "曹丹丹";
const administrator = "鄢清华";
const TEST_STUDENT_ACCOUNT = "test";
const TEST_INVITE_CODE = "123456";

const catalog = [
  {
    id: "beginner",
    label: "初级",
    books: [
      ["beginner-comprehensive-1", "初级综合（Ⅰ）"],
      ["beginner-comprehensive-2", "初级综合（Ⅱ）"],
      ["beginner-speaking-1", "初级口语（Ⅰ）"],
      ["beginner-speaking-2", "初级口语（Ⅱ）"],
      ["beginner-listening-1", "初级听力（Ⅰ）"],
      ["beginner-listening-2", "初级听力（Ⅱ）"],
      ["beginner-reading-writing-1", "初级读写（Ⅰ）"],
      ["beginner-reading-writing-2", "初级读写（Ⅱ）"],
    ],
  },
  {
    id: "intermediate",
    label: "中级",
    books: [
      ["intermediate-comprehensive-1", "中级综合（Ⅰ）"],
      ["intermediate-comprehensive-2", "中级综合（Ⅱ）"],
      ["intermediate-speaking-1", "中级口语（Ⅰ）"],
      ["intermediate-speaking-2", "中级口语（Ⅱ）"],
      ["intermediate-listening-1", "中级听力（Ⅰ）"],
      ["intermediate-listening-2", "中级听力（Ⅱ）"],
      ["intermediate-reading-1", "中级阅读（Ⅰ）"],
      ["intermediate-reading-2", "中级阅读（Ⅱ）"],
      ["intermediate-writing-1", "中级写作（Ⅰ）"],
      ["intermediate-writing-2", "中级写作（Ⅱ）"],
    ],
  },
  {
    id: "advanced",
    label: "高级",
    books: [
      ["advanced-comprehensive-1", "高级综合（Ⅰ）"],
      ["advanced-comprehensive-2", "高级综合（Ⅱ）"],
      ["advanced-speaking-1", "高级口语（Ⅰ）"],
      ["advanced-speaking-2", "高级口语（Ⅱ）"],
      ["advanced-listening-1", "高级听力（Ⅰ）"],
      ["advanced-listening-2", "高级听力（Ⅱ）"],
      ["advanced-reading-1", "高级阅读（Ⅰ）"],
      ["advanced-reading-2", "高级阅读（Ⅱ）"],
      ["advanced-writing-1", "高级写作（Ⅰ）"],
      ["advanced-writing-2", "高级写作（Ⅱ）"],
    ],
  },
];

const books = catalog.flatMap((level) => level.books.map(([id, label]) => ({ id, label, level: level.id })));
const lessonTitles = ["你咋不早说", "和时间赛跑", "租房那些事", "第4课", "第5课", "第6课", "第7课", "第8课", "第9课", "第10课", "第11课", "第12课", "第13课", "第14课"];
const availableLessonCount = 3;

function readStored(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback));
  } catch {
    return fallback;
  }
}

const state = {
  view: "home",
  role: "guest",
  userName: "",
  selectedBookId: "intermediate-comprehensive-1",
  openLevel: "intermediate",
  search: "",
  enrollments: readStored("learningHubStudentEnrollments", []),
  teacherContext: { teacher: "", term: terms[0], book: "intermediate-comprehensive-1" },
  studentProfile: null,
  authenticationOptions: { student: null, teacher: null },
};

const viewLabels = { home: "首页", courses: "我的课程", writing: "写作专区", games: "趣味游戏", progress: "学习记录", teacher: "教学工作台", admin: "系统管理" };

if ("serviceWorker" in navigator && window.location.protocol !== "file:") {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("../../sw.js?v=31", { scope: "../../" }).catch(() => {});
  });
}
const elements = {
  search: document.querySelector("#globalSearch"),
  currentBookLabel: document.querySelector("#currentBookLabel"),
  currentLessonLabel: document.querySelector("#currentLessonLabel"),
  profileButton: document.querySelector("#profileButton"),
  profileAvatar: document.querySelector("#profileAvatar"),
  profileName: document.querySelector("#profileName"),
  profileRole: document.querySelector("#profileRole"),
  roleDialog: document.querySelector("#roleDialog"),
  courseDialog: document.querySelector("#courseDialog"),
  courseDialogLessons: document.querySelector("#courseDialogLessons"),
  levelCatalog: document.querySelector("#levelCatalog"),
  lessonTitle: document.querySelector("#lessonDirectoryTitle"),
  lessonCount: document.querySelector("#lessonCount"),
  lessonList: document.querySelector("#lessonList"),
  studentLoginForm: document.querySelector("#studentLoginForm"),
  teacherLoginForm: document.querySelector("#teacherLoginForm"),
  adminLoginForm: document.querySelector("#adminLoginForm"),
  teacherTerm: document.querySelector("#teacherTermSelect"),
  teacherBook: document.querySelector("#teacherBookSelect"),
  teacherName: document.querySelector("#teacherContextName"),
  classStudentList: document.querySelector("#classStudentList"),
  classStudentCount: document.querySelector("#classStudentCount"),
  writingInputMode: document.querySelector("#writingInputModeSelect"),
  saveWritingPolicy: document.querySelector("#saveWritingPolicyButton"),
  writingPolicyStatus: document.querySelector("#writingPolicyStatus"),
  toast: document.querySelector("#toast"),
  installAppButton: document.querySelector("#installAppButton"),
  pwaInstallBanner: document.querySelector("#pwaInstallBanner"),
  pwaInstallMessage: document.querySelector("#pwaInstallMessage"),
};

let deferredInstallPrompt = null;

function isInstalledApp() {
  return window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;
}

function hideInstallUi() {
  elements.installAppButton.hidden = true;
  elements.pwaInstallBanner.hidden = true;
}

function showInstallNotice() {
  if (isInstalledApp() || sessionStorage.getItem("pwaInstallNoticeDismissed")) return;
  elements.pwaInstallBanner.hidden = false;
}

async function requestAppInstall() {
  if (isInstalledApp()) {
    hideInstallUi();
    return;
  }
  if (deferredInstallPrompt) {
    await deferredInstallPrompt.prompt().catch(() => {});
    const choice = await deferredInstallPrompt.userChoice.catch(() => null);
    deferredInstallPrompt = null;
    if (choice?.outcome === "accepted") {
      hideInstallUi();
      showToast("正在安装点点汉语 / Installing Diandian Chinese", 3600);
      return;
    }
  }
  const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent);
  showToast(
    isIos
      ? "请点浏览器“分享”，再选“添加到主屏幕” / Share → Add to Home Screen"
      : "请点地址栏右侧的安装图标，或浏览器菜单中的“安装应用” / Use the browser Install app menu",
    6200,
  );
}

window.addEventListener("beforeinstallprompt", (event) => {
  event.preventDefault();
  deferredInstallPrompt = event;
  elements.pwaInstallMessage.textContent = "添加到桌面，像应用一样打开 / Install this app";
  showInstallNotice();
});

window.addEventListener("appinstalled", () => {
  deferredInstallPrompt = null;
  hideInstallUi();
  showToast("点点汉语已安装 / App installed", 3600);
});

function bookById(id) {
  return books.find((book) => book.id === id) || books[0];
}

function bookOptionMarkup(selected = "") {
  return catalog.map((level) => `<optgroup label="${level.label}">${level.books.map(([id, label]) => `<option value="${id}"${id === selected ? " selected" : ""}${id !== "intermediate-comprehensive-1" ? " disabled" : ""}>发展汉语·${label}${id !== "intermediate-comprehensive-1" ? "（未开放）" : ""}</option>`).join("")}</optgroup>`).join("");
}

function populateFormOptions() {
  document.querySelectorAll("[data-term-options]").forEach((select) => {
    select.innerHTML = terms.map((term) => `<option>${term}</option>`).join("");
  });
  document.querySelectorAll("[data-book-options]").forEach((select) => {
    select.innerHTML = bookOptionMarkup("intermediate-comprehensive-1");
  });
  elements.teacherTerm.innerHTML = terms.map((term) => `<option>${term}</option>`).join("");
  elements.teacherBook.innerHTML = bookOptionMarkup("intermediate-comprehensive-1");
}

function setView(view) {
  if (!viewLabels[view]) return;
  state.view = view;
  document.querySelectorAll("[data-view-panel]").forEach((panel) => {
    const active = panel.dataset.viewPanel === view;
    panel.hidden = !active;
    panel.classList.toggle("active", active);
  });
  document.querySelectorAll("[data-view]").forEach((button) => button.classList.toggle("active", button.dataset.view === view));
  if (view === "teacher") renderTeacherWorkspace();
  if (view === "writing") window.WritingZone?.render();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function renderCatalog() {
  const query = state.search.trim().toLowerCase();
  const level = catalog.find((item) => item.id === state.openLevel) || catalog[1];
  const visibleBooks = level.books.filter(([, label]) => !query || `发展汉语 ${label}`.toLowerCase().includes(query));
  document.querySelectorAll("[data-course-level]").forEach((button) => button.classList.toggle("active", button.dataset.courseLevel === level.id));
  elements.levelCatalog.innerHTML = visibleBooks.length
    ? `<div class="course-book-grid">${visibleBooks.map(([id, label]) => `<button class="book-choice${state.selectedBookId === id ? " active" : ""}" type="button" data-select-book="${id}"><span>《发展汉语·${label}》</span><small>${id === "intermediate-comprehensive-1" ? `第1-${availableLessonCount}课可学习` : "内容准备中"}</small></button>`).join("")}</div>`
    : '<p class="empty-state">没有找到符合条件的教材。</p>';
  renderCourseDialogLessons();
}

function renderCourseDialogLessons() {
  const book = bookById(state.selectedBookId);
  if (book.id !== "intermediate-comprehensive-1") {
    elements.courseDialogLessons.innerHTML = `<header><span>已选择</span><strong>《发展汉语·${book.label}》</strong></header><p>该教材已建立入口，内容准备中。</p>`;
    return;
  }
  elements.courseDialogLessons.innerHTML = `<header><span>选择课次 / Lesson</span><strong>《发展汉语·${book.label}》</strong></header><div class="dialog-lesson-grid">${lessonTitles.map((title, index) => {
    const lessonNumber = index + 1;
    return index < availableLessonCount
      ? `<a href="../digital-book/?lesson=zjzh-1-${lessonNumber}"><b>${String(lessonNumber).padStart(2, "0")}</b><span>${title}</span></a>`
      : `<button type="button" data-unavailable-lesson="${lessonNumber}"><b>${String(lessonNumber).padStart(2, "0")}</b><span>${title}</span></button>`;
  }).join("")}</div>`;
}

function renderLessons() {
  const book = bookById(state.selectedBookId);
  elements.lessonTitle.textContent = book.label;
  elements.currentBookLabel.textContent = book.label;
  if (book.id !== "intermediate-comprehensive-1") {
    elements.lessonCount.textContent = "内容准备中";
    elements.lessonList.innerHTML = `<p class="empty-approval">《发展汉语·${book.label}》已建立入口，课程内容尚未接入。</p>`;
    elements.currentLessonLabel.textContent = "内容准备中";
    return;
  }
  elements.lessonCount.textContent = "共14课";
  elements.currentLessonLabel.textContent = "第1课 · 你咋不早说";
  elements.lessonList.innerHTML = lessonTitles.map((title, index) => {
    const available = index < availableLessonCount;
    const lessonNumber = index + 1;
    const inner = `<span>${String(index + 1).padStart(2, "0")}</span><span><strong>${title}</strong><small>${available ? "词汇、课文、练习" : "内容准备中"}</small></span><b>${available ? "进入 ›" : "未开放"}</b>`;
    return available ? `<a class="lesson-item available" href="../digital-book/?lesson=zjzh-1-${lessonNumber}">${inner}</a>` : `<button class="lesson-item" type="button" data-unavailable-lesson="${lessonNumber}">${inner}</button>`;
  }).join("");
}

function selectBook(id) {
  const book = bookById(id);
  state.selectedBookId = book.id;
  state.openLevel = book.level;
  renderCatalog();
  renderLessons();
}

function openCourseDialog() {
  state.search = "";
  elements.search.value = "";
  renderCatalog();
  elements.courseDialog.showModal();
}

function showAuthTab(tab) {
  document.querySelectorAll("[data-auth-tab]").forEach((button) => button.classList.toggle("active", button.dataset.authTab === tab));
  document.querySelectorAll("[data-auth-panel]").forEach((panel) => {
    const active = panel.dataset.authPanel === tab;
    panel.hidden = !active;
    panel.classList.toggle("active", active);
  });
}

function openAuth(tab = "student-login") {
  showAuthTab(tab);
  elements.roleDialog.showModal();
}

function applyIdentity(role, name) {
  state.role = role;
  state.userName = name;
  const profile = role === "student"
    ? { mark: "学", label: name, role: "学生" }
    : role === "teacher"
      ? { mark: "教", label: name, role: "教师" }
      : role === "admin"
        ? { mark: "管", label: name, role: "管理员" }
        : { mark: "学", label: "邀请码登录", role: "访客" };
  elements.profileAvatar.textContent = profile.mark;
  elements.profileName.textContent = profile.label;
  elements.profileRole.textContent = profile.role;
  document.querySelectorAll('[data-role-nav="teacher"]').forEach((button) => { button.hidden = !["teacher", "admin"].includes(role); });
  document.querySelectorAll('[data-role-nav="admin"]').forEach((button) => { button.hidden = role !== "admin"; });
  window.WritingZone?.identityChanged();
}

function restoreStoredIdentity() {
  const profile = window.LearningApi?.profile?.();
  if (!profile?.role) {
    applyIdentity("guest", "");
    return;
  }
  if (profile.role === "student") {
    state.studentProfile = {
      chineseName: profile.name || profile.chineseName || profile.userId,
      englishName: profile.englishName || "",
      studentId: profile.userId,
      classId: profile.classId || "",
      className: profile.className || "",
      teacher: profile.teacher || defaultTeacher,
      term: profile.term || terms[0],
      book: profile.bookId || "intermediate-comprehensive-1",
    };
    applyIdentity("student", state.studentProfile.chineseName);
    return;
  }
  if (profile.role === "teacher") {
    state.teacherContext = { teacher: profile.teacher || profile.name, term: profile.term || terms[0], book: profile.bookId || "intermediate-comprehensive-1" };
    applyIdentity("teacher", profile.teacher || profile.name);
    return;
  }
  if (profile.role === "admin") {
    applyIdentity("admin", profile.name || administrator);
    return;
  }
  applyIdentity("guest", "");
}

function saveEnrollments() {
  localStorage.setItem("learningHubStudentEnrollments", JSON.stringify(state.enrollments));
}

async function handleStudentLogin(form) {
  const data = new FormData(form);
  const studentId = data.get("studentAccount").trim();
  const inviteCode = data.get("inviteCode").trim();
  const selection = await resolveAuthenticationContext(form, "student", studentId, inviteCode);
  if (!selection) return;
  let profile;
  if (window.LearningApi?.isConfigured()) {
    try {
      const session = await window.LearningApi.createSession({ role: "student", inviteCode, userId: studentId, contextId: selection.context.id });
      profile = session.profile;
    } catch (error) {
      showToast(error.message || "邀请码登录失败");
      return;
    }
  } else {
    profile = {
      role: "student", userId: studentId, name: "测试学生", englishName: TEST_STUDENT_ACCOUNT,
      ...selection.context,
    };
  }
  const enrollment = {
    id: `student-${profile.userId}-${profile.classId || profile.term}-${profile.bookId}`,
    chineseName: profile.name || profile.userId,
    englishName: profile.englishName || "",
    studentId: profile.userId,
    classId: profile.classId || "",
    className: profile.className || "",
    term: profile.term,
    teacher: profile.teacher,
    book: profile.bookId,
    joinedAt: new Date().toISOString(),
  };
  if (!window.LearningApi?.isConfigured()) {
    const existingIndex = state.enrollments.findIndex((item) => item.id === enrollment.id);
    if (existingIndex >= 0) state.enrollments[existingIndex] = enrollment;
    else state.enrollments.push(enrollment);
    saveEnrollments();
  }
  state.studentProfile = enrollment;
  applyIdentity("student", enrollment.chineseName);
  elements.roleDialog.close();
  selectBook(enrollment.book);
  setView("courses");
  showToast(`已进入 ${enrollment.term} · 发展汉语·${bookById(enrollment.book).label}`);
}

async function handleTeacherLogin(form) {
  const data = new FormData(form);
  const teacherAccount = data.get("teacherAccount").trim();
  const inviteCode = data.get("inviteCode").trim();
  const selection = await resolveAuthenticationContext(form, "teacher", teacherAccount, inviteCode);
  if (!selection) return;
  let profile;
  if (window.LearningApi?.isConfigured()) {
    try {
      const session = await window.LearningApi.createSession({ role: "teacher", inviteCode, teacherId: teacherAccount, teacher: teacherAccount, contextId: selection.context.id });
      profile = session.profile;
    } catch (error) {
      showToast(error.message || "教师邀请码登录失败");
      return;
    }
  } else {
    profile = { role: "teacher", userId: teacherAccount, name: teacherAccount, ...selection.context };
  }
  state.studentProfile = null;
  applyIdentity("teacher", profile.teacher || profile.name);
  state.teacherContext = { teacher: profile.teacher || profile.name, term: profile.term, book: profile.bookId };
  elements.roleDialog.close();
  setView("teacher");
  showToast(`已进入${profile.teacher || profile.name}老师的教学工作台`);
}

function localAuthenticationOptions(role, account, inviteCode) {
  const validAccount = role === "student" ? account === TEST_STUDENT_ACCOUNT : Boolean(account);
  if (!validAccount || inviteCode !== TEST_INVITE_CODE) throw new Error("账号或邀请码不正确");
  const teacher = role === "teacher" ? account : defaultTeacher;
  return {
    account: { id: account, name: role === "student" ? "测试学生" : teacher, englishName: role === "student" ? "Test" : "" },
    contexts: [{ id: `local-class:${books[0].id}`, classId: "local-class", className: "本地测试班", teacher, term: terms[0], bookId: books[0].id }],
  };
}

function authenticationContextLabel(context) {
  return `${context.term} · ${context.className} · ${context.teacher} · 发展汉语·${bookById(context.bookId).label}`;
}

function showAuthenticationContexts(form, contexts) {
  const field = form.querySelector("[data-auth-context]");
  const select = field.querySelector("select");
  select.innerHTML = contexts.map((context) => `<option value="${escapeHtml(context.id)}">${escapeHtml(authenticationContextLabel(context))}</option>`).join("");
  field.hidden = false;
  form.querySelector("[data-auth-submit]").textContent = "进入所选课程 / Continue";
}

async function resolveAuthenticationContext(form, role, account, inviteCode) {
  const signature = `${account}\u0000${inviteCode}`;
  let record = state.authenticationOptions[role];
  if (!record || record.signature !== signature) {
    try {
      const result = window.LearningApi?.isConfigured()
        ? await window.LearningApi.authenticationOptions({ role, inviteCode, ...(role === "student" ? { userId: account } : { teacherId: account, teacher: account }) })
        : localAuthenticationOptions(role, account, inviteCode);
      record = { signature, account: result.account, contexts: result.contexts || [] };
      state.authenticationOptions[role] = record;
    } catch (error) {
      showToast(error.message || "账号验证失败");
      return null;
    }
    if (record.contexts.length > 1) {
      showAuthenticationContexts(form, record.contexts);
      showToast("请选择本次进入的班级和教材");
      return null;
    }
  }
  const selectedId = form.querySelector('[name="contextId"]')?.value || record.contexts[0]?.id;
  const context = record.contexts.find((item) => item.id === selectedId) || record.contexts[0];
  if (!context) {
    showToast("该账号尚未分配班级或教材");
    return null;
  }
  return { account: record.account, context };
}

async function handleAdminLogin(form) {
  const data = new FormData(form);
  const inviteCode = data.get("inviteCode").trim();
  if (window.LearningApi?.isConfigured()) {
    try {
      await window.LearningApi.createSession({ role: "admin", inviteCode, name: administrator, bookId: "system" });
    } catch (error) {
      showToast(error.message || "管理员邀请码登录失败");
      return;
    }
  } else if (inviteCode !== TEST_INVITE_CODE) {
    showToast("管理员邀请码不正确");
    return;
  }
  state.studentProfile = null;
  applyIdentity("admin", administrator);
  elements.roleDialog.close();
  setView("admin");
  showToast("已进入管理员界面原型");
}

function renderTeacherWorkspace() {
  const cloudProfile = window.LearningApi?.isConfigured() ? window.LearningApi.profile() : null;
  if (cloudProfile?.role === "teacher") {
    state.teacherContext = { teacher: cloudProfile.teacher, term: cloudProfile.term, book: cloudProfile.bookId };
  }
  const context = state.teacherContext;
  elements.teacherTerm.value = context.term;
  elements.teacherBook.value = context.book;
  elements.teacherTerm.disabled = Boolean(cloudProfile?.role === "teacher");
  elements.teacherBook.disabled = Boolean(cloudProfile?.role === "teacher");
  elements.teacherName.textContent = context.teacher || state.userName || "—";
  window.WritingZone?.renderTeacherSummary();
  window.PracticeAnalytics?.render();
  if (cloudProfile?.role === "teacher") {
    elements.classStudentCount.textContent = "读取中";
    elements.classStudentList.innerHTML = '<p class="empty-approval">正在读取本班学生名单…</p>';
    void loadCloudTeacherStudents();
    void loadCloudClassSettings();
    return;
  }
  const students = state.enrollments.filter((enrollment) => enrollment.teacher === context.teacher && enrollment.term === context.term && enrollment.book === context.book);
  elements.classStudentCount.textContent = `${students.length}人`;
  elements.classStudentList.innerHTML = students.length
    ? students.map((student) => `<div class="student-row"><span><strong>${escapeHtml(student.chineseName)} · ${escapeHtml(student.englishName)}</strong><small>学号 ${escapeHtml(student.studentId)}</small></span><b>已加入</b></div>`).join("")
    : '<p class="empty-approval">当前学期和教材还没有学生使用邀请码加入。</p>';
}

async function loadCloudClassSettings() {
  elements.writingPolicyStatus.textContent = "正在读取班级设置…";
  try {
    const result = await window.LearningApi.classSettings();
    elements.writingInputMode.value = result.settings?.writingInputMode || "both";
    elements.writingPolicyStatus.textContent = "已读取当前班级设置。";
  } catch (error) {
    elements.writingPolicyStatus.textContent = error.message || "班级设置读取失败";
  }
}

async function saveCloudClassSettings() {
  if (window.LearningApi?.profile()?.role !== "teacher") {
    localStorage.setItem("prototypeWritingInputMode", elements.writingInputMode.value);
    elements.writingPolicyStatus.textContent = "原型设置已保存在当前设备。";
    return;
  }
  elements.saveWritingPolicy.disabled = true;
  elements.writingPolicyStatus.textContent = "正在保存…";
  try {
    await window.LearningApi.updateClassSettings({ writingInputMode: elements.writingInputMode.value });
    elements.writingPolicyStatus.textContent = "已保存，学生下次进入数字书时生效。";
    showToast("班级写作方式已更新 / Writing mode updated");
  } catch (error) {
    elements.writingPolicyStatus.textContent = error.message || "保存失败";
  } finally {
    elements.saveWritingPolicy.disabled = false;
  }
}

async function loadCloudTeacherStudents() {
  try {
    const result = await window.LearningApi.classStudents();
    const students = result.students || [];
    elements.classStudentCount.textContent = `${students.length}人`;
    elements.classStudentList.innerHTML = students.length
      ? students.map((student) => `<div class="student-row"><span><strong>${escapeHtml(student.name)}${student.englishName ? ` · ${escapeHtml(student.englishName)}` : ""}</strong><small>学号 ${escapeHtml(student.userId)}</small></span><b>已加入</b></div>`).join("")
      : '<p class="empty-approval">当前学期和教材还没有学生使用邀请码加入。</p>';
  } catch (error) {
    elements.classStudentCount.textContent = "读取失败";
    elements.classStudentList.innerHTML = `<p class="empty-approval">${escapeHtml(error.message || "暂时无法读取学生名单")}</p>`;
  }
}

let toastTimer;
function showToast(message, duration = 2400) {
  clearTimeout(toastTimer);
  elements.toast.textContent = message;
  elements.toast.hidden = false;
  toastTimer = setTimeout(() => { elements.toast.hidden = true; }, duration);
}

function escapeHtml(value) {
  return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
}

document.addEventListener("click", (event) => {
  if (event.target.closest("[data-pwa-install]")) { void requestAppInstall(); return; }
  if (event.target.closest("[data-pwa-dismiss]")) {
    elements.pwaInstallBanner.hidden = true;
    sessionStorage.setItem("pwaInstallNoticeDismissed", "1");
    return;
  }
  const view = event.target.closest("[data-view]")?.dataset.view;
  if (view) { setView(view); return; }
  if (event.target.closest('[data-action="open-course-dialog"]')) { openCourseDialog(); return; }
  if (event.target.closest("[data-course-close]")) { elements.courseDialog.close(); return; }
  const courseLevel = event.target.closest("[data-course-level]")?.dataset.courseLevel;
  if (courseLevel) { state.openLevel = courseLevel; state.search = ""; elements.search.value = ""; renderCatalog(); return; }
  if (event.target.closest('[data-action="open-role-dialog"]')) { openAuth("student-login"); return; }
  const authTab = event.target.closest("[data-auth-tab]")?.dataset.authTab;
  if (authTab) { showAuthTab(authTab); return; }
  if (event.target.closest("[data-auth-close]")) { elements.roleDialog.close(); return; }
  const selectedBook = event.target.closest("[data-select-book]")?.dataset.selectBook;
  if (selectedBook) { selectBook(selectedBook); return; }
  const unavailableLesson = event.target.closest("[data-unavailable-lesson]")?.dataset.unavailableLesson;
  if (unavailableLesson) showToast(`第${unavailableLesson}课内容尚未接入`);
});

elements.profileButton.addEventListener("click", () => openAuth("student-login"));
elements.installAppButton.addEventListener("click", () => { void requestAppInstall(); });
elements.roleDialog.addEventListener("click", (event) => { if (event.target === elements.roleDialog) elements.roleDialog.close(); });
elements.courseDialog.addEventListener("click", (event) => { if (event.target === elements.courseDialog) elements.courseDialog.close(); });
elements.studentLoginForm.addEventListener("submit", (event) => { event.preventDefault(); void handleStudentLogin(event.currentTarget); });
elements.teacherLoginForm.addEventListener("submit", (event) => { event.preventDefault(); void handleTeacherLogin(event.currentTarget); });
elements.adminLoginForm.addEventListener("submit", (event) => { event.preventDefault(); void handleAdminLogin(event.currentTarget); });
elements.search.addEventListener("input", () => { state.search = elements.search.value; renderCatalog(); if (state.view !== "courses") setView("courses"); });
elements.teacherTerm.addEventListener("change", () => { state.teacherContext.term = elements.teacherTerm.value; renderTeacherWorkspace(); });
elements.teacherBook.addEventListener("change", () => { state.teacherContext.book = elements.teacherBook.value; renderTeacherWorkspace(); });
elements.saveWritingPolicy.addEventListener("click", () => { void saveCloudClassSettings(); });

populateFormOptions();
renderCatalog();
renderLessons();
restoreStoredIdentity();
const requestedView = new URL(window.location.href).searchParams.get("view");
setView(viewLabels[requestedView] ? requestedView : "home");

if (isInstalledApp()) {
  hideInstallUi();
} else {
  setTimeout(() => {
    elements.pwaInstallMessage.textContent = deferredInstallPrompt
      ? "添加到桌面，像应用一样打开 / Install this app"
      : "可从浏览器菜单安装到桌面 / Install from the browser menu";
    showInstallNotice();
  }, 1600);
}
