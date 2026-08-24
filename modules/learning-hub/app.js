const terms = ["2026 Fall", "2027 Spring", "2027 Fall", "2028 Spring", "2028 Fall"];
const defaultTeacher = "";
const administrator = "";
const TEST_STUDENT_ACCOUNT = "test";
const TEST_INVITE_CODE = "yry20111025";
const REVIEW_DATA_FILES = ["lesson-content.json", "lesson-practice.json", "pronunciation.json", "practice-translations.json", "text-notes.json", "vocabulary-metadata.json"];
const REVIEW_LANGUAGE_CODES = new Set(["zh", "pinyin", "en", "es", "fr", "id", "ja", "ko", "lo", "ms", "my", "ru", "th", "vi"]);
const languageShortLabels = {
  zh: "中文", pinyin: "拼音", en: "英语", es: "西语", fr: "法语", id: "印尼语", ja: "日语", ko: "韩语",
  lo: "老挝语", ms: "马来语", my: "缅甸语", ru: "俄语", th: "泰语", vi: "越南语",
};


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
const learningBooks = Object.freeze({
  "beginner-comprehensive-1": {
    lessonPrefix: "cjzh-1",
    lessons: ["你好", "你是哪国人？", "你叫什么名字？", "你学习法语吗？", "你家有几口人？"],
    available: 5,
    countLabel: "已开放5课",
    contentLabel: "语音、生词、课文、练习、汉字",
    cover: "初级<br>综合Ⅰ",
  },
  "intermediate-comprehensive-1": {
    lessonPrefix: "zjzh-1",
    lessons: ["你咋不早说", "和时间赛跑", "租房那些事", "老舍小时候的故事", "第5课", "第6课", "第7课", "第8课", "第9课", "第10课", "第11课", "第12课", "第13课", "第14课"],
    available: 4,
    countLabel: "共14课 · 已开放4课",
    contentLabel: "词汇、课文、练习",
    cover: "中级<br>综合Ⅰ",
  },
});

function readStored(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback));
  } catch {
    return fallback;
  }
}

const storedBookId = readStored("learningHubSelectedBook", "intermediate-comprehensive-1");

const state = {
  view: "home",
  role: "guest",
  userName: "",
  selectedBookId: learningBooks[storedBookId] ? storedBookId : "intermediate-comprehensive-1",
  openLevel: learningBooks[storedBookId] ? bookById(storedBookId).level : "intermediate",
  search: "",
  enrollments: readStored("learningHubStudentEnrollments", []),
  teachers: readStored("learningHubTeachers", []),
  publishing: readStored("learningHubPublishing", {}),
  contentReview: readStored("learningHubContentReview", {}),
  teacherContext: { teacher: "", term: terms[0], book: "intermediate-comprehensive-1" },
  studentProfile: null,
  studentCourses: [],
  studentProgress: null,
  studentProgressAt: 0,
  activeTeacherCourse: null,
  localCourses: readStored("learningHubTeacherCoursesLocal", defaultLocalCourses()),
  authenticationOptions: { student: null, teacher: null },
};

let pendingRemoveEnrollment = null;

const viewLabels = { home: "首页", courses: "我的课程", writing: "写作专区", games: "趣味游戏", tools: "学习工具", progress: "学习记录", teacher: "教学工作台", admin: "系统管理" };
const STUDENT_SESSION_KEY = "chineseLearningStudentSession";

if ("serviceWorker" in navigator && window.location.protocol !== "file:") {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("../../sw.js", { scope: "../../" })
      .then((registration) => {
        registration.addEventListener("updatefound", () => {
          const newWorker = registration.installing;
          if (!newWorker) return;
          newWorker.addEventListener("statechange", () => {
            if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
              showUpdateBanner();
            }
          });
        });
      })
      .catch(() => {});
  });
}

function showUpdateBanner() {
  if (elements.pwaUpdateBanner) elements.pwaUpdateBanner.hidden = false;
}
const elements = {
  search: document.querySelector("#globalSearch"),
  currentBookLabel: document.querySelector("#currentBookLabel"),
  currentLessonLabel: document.querySelector("#currentLessonLabel"),
  profileButton: document.querySelector("#profileButton"),
  profileAvatar: document.querySelector("#profileAvatar"),
  profileName: document.querySelector("#profileName"),
  profileRole: document.querySelector("#profileRole"),
  logoutButton: document.querySelector("#logoutButton"),
  roleDialog: document.querySelector("#roleDialog"),
  courseDialog: document.querySelector("#courseDialog"),
  courseDialogLessons: document.querySelector("#courseDialogLessons"),
  levelCatalog: document.querySelector("#levelCatalog"),
  lessonTitle: document.querySelector("#lessonDirectoryTitle"),
  lessonCount: document.querySelector("#lessonCount"),
  lessonList: document.querySelector("#lessonList"),
  courseCoverTitle: document.querySelector("#courseCoverTitle"),
  continueTitle: document.querySelector("#continueTitle"),
  continueMeta: document.querySelector("#continueMeta"),
  continueLink: document.querySelector("#continueLink"),
  primaryTaskLink: document.querySelector("#primaryTaskLink"),
  primaryTaskMeta: document.querySelector("#primaryTaskMeta"),
  secondaryTaskLink: document.querySelector("#secondaryTaskLink"),
  secondaryTaskTitle: document.querySelector("#secondaryTaskTitle"),
  secondaryTaskMeta: document.querySelector("#secondaryTaskMeta"),
  gameTaskLink: document.querySelector("#gameTaskLink"),
  studentLoginForm: document.querySelector("#studentLoginForm"),
  teacherLoginForm: document.querySelector("#teacherLoginForm"),
  adminLoginForm: document.querySelector("#adminLoginForm"),
  teacherTerm: document.querySelector("#teacherTermSelect"),
  teacherBook: document.querySelector("#teacherBookSelect"),
  teacherName: document.querySelector("#teacherContextName"),
  classStudentList: document.querySelector("#classStudentList"),
  classStudentCount: document.querySelector("#classStudentCount"),
  addStudentDialog: document.querySelector("#addStudentDialog"),
  confirmDialog: document.querySelector("#confirmDialog"),
  confirmDialogMessage: document.querySelector("#confirmDialogMessage"),
  addStudentForm: document.querySelector("#addStudentForm"),
  addStudentContextLabel: document.querySelector("#addStudentContextLabel"),
  addTeacherForm: document.querySelector("#addTeacherForm"),
  teacherCount: document.querySelector("#teacherCount"),
  adminTeacherList: document.querySelector("#adminTeacherList"),
  adminPublishingList: document.querySelector("#adminPublishingList"),
  adminReviewList: document.querySelector("#adminReviewList"),
  writingInputMode: document.querySelector("#writingInputModeSelect"),
  saveWritingPolicy: document.querySelector("#saveWritingPolicyButton"),
  writingPolicyStatus: document.querySelector("#writingPolicyStatus"),
  studentCourseList: document.querySelector("#studentCourseList"),
  coursePageIntro: document.querySelector("#coursePageIntro"),
  teacherCoursePanel: document.querySelector("#teacherCoursePanel"),
  teacherCourseList: document.querySelector("#teacherCourseList"),
  courseStudentPanel: document.querySelector("#courseStudentPanel"),
  courseStudentTitle: document.querySelector("#courseStudentTitle"),
  courseStudentMeta: document.querySelector("#courseStudentMeta"),
  courseStudentTable: document.querySelector("#courseStudentTable"),
  courseImportResult: document.querySelector("#courseImportResult"),
  homeProgressBar: document.querySelector("#homeProgressBar"),
  homeProgressText: document.querySelector("#homeProgressText"),
  statStudyDays: document.querySelector("#statStudyDays"),
  statWords: document.querySelector("#statWords"),
  statExercises: document.querySelector("#statExercises"),
  progressTableTitle: document.querySelector("#progressTableTitle"),
  progressRows: document.querySelector("#progressRows"),
  newCourseDialog: document.querySelector("#newCourseDialog"),
  newCourseForm: document.querySelector("#newCourseForm"),
  studentExcelInput: document.querySelector("#studentExcelInput"),
  toast: document.querySelector("#toast"),
  pwaUpdateBanner: document.querySelector("#pwaUpdateBanner"),
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
  if (isInstalledApp() || localStorage.getItem("pwaInstallNoticeDismissed")) return;
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
  if (id === "elementary-comprehensive-1") id = "beginner-comprehensive-1";
  return books.find((book) => book.id === id) || books.find((book) => book.id === "intermediate-comprehensive-1");
}

function bookOptionMarkup(selected = "") {
  return catalog.map((level) => `<optgroup label="${level.label}">${level.books.map(([id, label]) => {
    const available = effectiveBookOpen(id);
    return `<option value="${id}"${id === selected ? " selected" : ""}${available ? "" : " disabled"}>发展汉语·${label}${available ? "" : "（未开放）"}</option>`;
  }).join("")}</optgroup>`).join("");
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
  if (view === "admin") renderAdminView();
  if (view === "courses") renderStudentCoursesView();
  if (view === "progress") void renderProgressView();
  if (view === "home") { applyHomeStats(); if (state.role === "student") void loadStudentProgress(); }
  if (view === "writing") window.WritingZone?.render();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function renderCatalog() {
  const query = state.search.trim().toLowerCase();
  const level = catalog.find((item) => item.id === state.openLevel) || catalog[1];
  const visibleBooks = level.books.filter(([id, label]) => (!query || `发展汉语 ${label}`.toLowerCase().includes(query)) && (state.role === "admin" || courseAccessible(id)));
  document.querySelectorAll("[data-course-level]").forEach((button) => button.classList.toggle("active", button.dataset.courseLevel === level.id));
  elements.levelCatalog.innerHTML = visibleBooks.length
    ? `<div class="course-book-grid">${visibleBooks.map(([id, label]) => {
      const learningBook = learningBooks[id];
      const available = effectiveAvailable(id);
      const open = effectiveBookOpen(id);
      return `<button class="book-choice${state.selectedBookId === id ? " active" : ""}" type="button" data-select-book="${id}"><span>《发展汉语·${label}》</span><small>${learningBook ? (open ? `第1-${available}课可学习` : "暂未开放课程") : (open ? "已开放 · 内容准备中" : "未开放")}</small></button>`;
    }).join("")}</div>`
    : state.role === "guest" ? '<p class="empty-state">请先登录，再选择教材 / Please sign in first</p>' : (allowedBookIds().length ? '<p class="empty-state">没有找到符合条件的教材。</p>' : '<p class="empty-state">您还没有可进入的课程，请联系教师获取邀请码。</p>');
  renderCourseDialogLessons();
}

function renderCourseDialogLessons() {
  const book = bookById(state.selectedBookId);
  if (state.role !== "admin" && !courseAccessible(book.id)) {
    elements.courseDialogLessons.innerHTML = `<header><span>已选择</span><strong>《发展汉语·${book.label}》</strong></header><p>该教材不在您的课程中，无法进入。</p>`;
    return;
  }
  const learningBook = learningBooks[book.id];
  if (!learningBook || !effectiveBookOpen(book.id)) {
    elements.courseDialogLessons.innerHTML = `<header><span>已选择</span><strong>《发展汉语·${book.label}》</strong></header><p>${learningBook ? "该教材暂未开放课程。" : "该教材已建立入口，内容准备中。"}</p>`;
    return;
  }
  const available = effectiveAvailable(book.id);
  elements.courseDialogLessons.innerHTML = `<header><span>选择课次 / Lesson</span><strong>《发展汉语·${book.label}》</strong></header><div class="dialog-lesson-grid">${learningBook.lessons.map((title, index) => {
    const lessonNumber = index + 1;
    return index < available
      ? `<a href="../digital-book/?lesson=${learningBook.lessonPrefix}-${lessonNumber}"><b>${String(lessonNumber).padStart(2, "0")}</b><span>${title}</span></a>`
      : `<button type="button" data-unavailable-lesson="${lessonNumber}"><b>${String(lessonNumber).padStart(2, "0")}</b><span>${title}</span></button>`;
  }).join("")}</div>`;
}

function renderLessons() {
  const book = bookById(state.selectedBookId);
  const learningBook = learningBooks[book.id];
  elements.lessonTitle.textContent = book.label;
  elements.currentBookLabel.textContent = book.label;
  if (state.role !== "admin" && !courseAccessible(book.id)) {
    elements.lessonCount.textContent = "未加入课程";
    elements.currentLessonLabel.textContent = state.role === "guest" ? "请先登录" : "未加入课程";
    elements.courseCoverTitle.innerHTML = "点点<br>汉语";
    elements.continueTitle.textContent = state.role === "guest" ? "请先登录" : "未加入课程";
    elements.continueMeta.textContent = state.role === "guest" ? "登录后继续你的课程学习 / Sign in to continue" : "该教材不在您的课程中";
    elements.lessonList.innerHTML = `<p class="empty-approval">${state.role === "guest" ? "请先登录，再选择教材进入 / Please sign in first" : "该教材不在您的课程中，无法进入。"}</p>`;
    elements.continueLink.href = "#";
    elements.primaryTaskLink.href = "#";
    elements.secondaryTaskLink.href = "#";
    elements.gameTaskLink.href = "#";
    return;
  }
  if (!learningBook || !effectiveBookOpen(book.id)) {
    elements.lessonCount.textContent = learningBook ? "暂未开放课程" : "内容准备中";
    elements.lessonList.innerHTML = `<p class="empty-approval">《发展汉语·${book.label}》${learningBook ? "暂未开放课程。" : "已建立入口，课程内容尚未接入。"}</p>`;
    elements.currentLessonLabel.textContent = learningBook ? "暂未开放课程" : "内容准备中";
    return;
  }
  const firstLessonUrl = `../digital-book/?lesson=${learningBook.lessonPrefix}-1`;
  elements.lessonCount.textContent = effectiveCountLabel(book.id);
  elements.currentLessonLabel.textContent = `第1课 · ${learningBook.lessons[0]}`;
  elements.courseCoverTitle.innerHTML = learningBook.cover;
  elements.continueTitle.textContent = `第1课 · ${learningBook.lessons[0]}`;
  elements.continueMeta.textContent = `发展汉语 · ${book.label.replace(/[（）]/g, "")}`;
  elements.continueLink.href = firstLessonUrl;
  elements.primaryTaskLink.href = firstLessonUrl;
  elements.primaryTaskMeta.textContent = `${book.label.replace(/[（）]/g, "")} · 第1课`;
  elements.gameTaskLink.href = `../character-hit/?lesson=${learningBook.lessonPrefix}-1`;
  if (book.id === "beginner-comprehensive-1") {
    elements.secondaryTaskLink.href = firstLessonUrl;
    elements.secondaryTaskTitle.textContent = "完成语音练习";
    elements.secondaryTaskMeta.textContent = "听辨音、四声与跟读";
  } else {
    elements.secondaryTaskLink.href = `${firstLessonUrl}#practice`;
    elements.secondaryTaskTitle.textContent = "完成课后练习";
    elements.secondaryTaskMeta.textContent = "第41—48题";
  }
  elements.lessonList.innerHTML = learningBook.lessons.map((title, index) => {
    const available = index < effectiveAvailable(book.id);
    const lessonNumber = index + 1;
    const inner = `<span>${String(index + 1).padStart(2, "0")}</span><span><strong>${title}</strong><small>${available ? learningBook.contentLabel : "内容准备中"}</small></span><b>${available ? "进入 <small>Enter</small> ›" : "未开放 <small>Closed</small>"}</b>`;
    return available ? `<a class="lesson-item available" href="../digital-book/?lesson=${learningBook.lessonPrefix}-${lessonNumber}">${inner}</a>` : `<button class="lesson-item" type="button" data-unavailable-lesson="${lessonNumber}">${inner}</button>`;
  }).join("");
}

function readStudentSession() {
  try { return JSON.parse(sessionStorage.getItem(STUDENT_SESSION_KEY) || "null"); } catch { return null; }
}

function saveStudentSession(account, contexts, signature) {
  sessionStorage.setItem(STUDENT_SESSION_KEY, JSON.stringify({ account, contexts, signature }));
}

function allowedBookIds() {
  if (state.role === "admin") return catalog.flatMap((level) => level.books.map(([id]) => id));
  if (state.role === "student") return [...new Set((state.studentCourses || []).map((course) => course.bookId).filter(Boolean))];
  if (state.role === "teacher") return [...new Set((state.teacherCourses || []).map((course) => course.bookId).filter(Boolean))];
  return [];
}

function courseAccessible(bookId) {
  return allowedBookIds().includes(bookId);
}

function firstAllowedBookId() {
  const ids = allowedBookIds();
  return ids.find((id) => learningBooks[id] && effectiveBookOpen(id)) || ids[0] || "";
}

function selectBook(id) {
  const book = bookById(id);
  if (state.role !== "admin" && !courseAccessible(book.id)) {
    showToast(state.role === "guest" ? "请先登录后选择教材 / Please sign in first" : "该教材不在您的课程中");
    return;
  }
  state.selectedBookId = book.id;
  state.openLevel = book.level;
  localStorage.setItem("learningHubSelectedBook", JSON.stringify(book.id));
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

function handleLogout() {
  try {
    window.LearningApi?.clearSession?.();
    sessionStorage.removeItem(STUDENT_SESSION_KEY);
    localStorage.removeItem("learningHubSelectedBook");
  } catch { /* ignore */ }
  state.studentProfile = null;
  state.teacherContext = { teacher: "", term: terms[0], book: "intermediate-comprehensive-1" };
  state.studentCourses = [];
  state.teacherCourses = [];
  state.authenticationOptions = {};
  if (elements.roleDialog.open) elements.roleDialog.close();
  applyIdentity("guest", "");
  renderCatalog();
  renderLessons();
  setView("home");
  showToast("已退出登录 / Signed out");
}

function applyIdentity(role, name) {
  state.role = role;
  state.userName = name;
  const profile = role === "student"
    ? { mark: "学", label: name, role: "学生 Student" }
    : role === "teacher"
      ? { mark: "教", label: name, role: "教师 Teacher" }
      : role === "admin"
        ? { mark: "管", label: name, role: "管理员 Admin" }
        : { mark: "学", label: "邀请码登录", role: "访客 Guest" };
  elements.profileAvatar.textContent = profile.mark;
  elements.profileName.textContent = profile.label;
  elements.profileRole.textContent = profile.role;
  if (elements.logoutButton) elements.logoutButton.hidden = role === "guest";
  document.querySelectorAll('[data-role-nav="teacher"]').forEach((button) => { button.hidden = !["teacher", "admin"].includes(role); });
  document.querySelectorAll('[data-role-nav="admin"]').forEach((button) => { button.hidden = role !== "admin"; });
  window.WritingZone?.identityChanged();
}

function restoreStoredIdentity() {
  const profile = window.LearningApi?.profile?.();
  const persisted = readStudentSession();
  if (profile?.role === "student") {
    const contexts = (persisted?.contexts || []).filter((context) => context.bookId);
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
    state.studentCourses = contexts.length
      ? contexts
      : profile.courseId
        ? [{ id: `${profile.courseId}:${profile.bookId}`, courseId: profile.courseId, classId: profile.classId || "", className: profile.className || "班", teacher: profile.teacher || defaultTeacher, term: profile.term || terms[0], bookId: profile.bookId || "intermediate-comprehensive-1" }]
        : [];
    if (persisted) state.authenticationOptions.student = { signature: persisted.signature, account: persisted.account, contexts: persisted.contexts || [] };
    applyIdentity("student", state.studentProfile.chineseName);
    renderStudentCoursesView();
    const firstCourseBookId = firstAllowedBookId();
    if (firstCourseBookId) selectBook(firstCourseBookId); else { renderCatalog(); renderLessons(); }
    void loadStudentProgress();
    if (window.LearningApi?.isConfigured?.() && persisted?.signature) {
      const [, inviteCode] = String(persisted.signature || "\u0000").split("\u0000");
      window.LearningApi.authenticationOptions({ role: "student", userId: state.studentProfile.studentId, inviteCode })
        .then((result) => {
          const fresh = (result.contexts || []).filter((context) => context.bookId && context.teacher);
          if (!fresh.length) return;
          state.studentCourses = fresh;
          if (state.authenticationOptions.student) state.authenticationOptions.student = { ...state.authenticationOptions.student, contexts: fresh };
          if (state.view === "courses") renderStudentCoursesView();
        })
        .catch(() => {});
    }
    return;
  }
  if (profile?.role === "teacher") {
    state.teacherContext = { teacher: profile.teacher || profile.name, term: profile.term || terms[0], book: profile.bookId || "intermediate-comprehensive-1" };
    applyIdentity("teacher", profile.teacher || profile.name);
    const firstCourseBookId = firstAllowedBookId();
    if (firstCourseBookId) selectBook(firstCourseBookId); else { renderCatalog(); renderLessons(); }
    if (window.LearningApi?.isConfigured?.()) void loadTeacherCourses();
    return;
  }
  if (profile?.role === "admin") {
    applyIdentity("admin", profile.name || "管理员");
    renderCatalog();
    renderLessons();
    return;
  }
  if (persisted?.contexts?.length) {
    const contexts = persisted.contexts.filter((context) => context.bookId);
    if (contexts.length) {
      state.authenticationOptions.student = { signature: persisted.signature, account: persisted.account, contexts: persisted.contexts || [] };
      state.studentCourses = contexts;
      state.studentProfile = {
        chineseName: persisted.account?.name || persisted.account?.id || "学生",
        englishName: persisted.account?.englishName || "",
        studentId: persisted.account?.id || "",
        teacher: contexts[0].teacher || defaultTeacher,
        term: contexts[0].term || terms[0],
        book: contexts[0].bookId || "intermediate-comprehensive-1",
      };
      applyIdentity("student", state.studentProfile.chineseName);
      renderStudentCoursesView();
      const firstCourseBookId = firstAllowedBookId();
      if (firstCourseBookId) selectBook(firstCourseBookId); else { renderCatalog(); renderLessons(); }
      void loadStudentProgress();
      return;
    }
  }
  applyIdentity("guest", "");
  renderCatalog();
  renderLessons();
  applyHomeStats();
}

function saveEnrollments() {
  localStorage.setItem("learningHubStudentEnrollments", JSON.stringify(state.enrollments));
}

function saveTeachers() {
  localStorage.setItem("learningHubTeachers", JSON.stringify(state.teachers));
}

function savePublishing() {
  localStorage.setItem("learningHubPublishing", JSON.stringify(state.publishing));
}

function saveContentReview() {
  localStorage.setItem("learningHubContentReview", JSON.stringify(state.contentReview));
}

function effectiveBookOpen(bookId) {
  const record = state.publishing[bookId];
  return record ? record.open : Boolean(learningBooks[bookId]);
}

function effectiveAvailable(bookId) {
  const record = state.publishing[bookId];
  const fallback = learningBooks[bookId] ? learningBooks[bookId].available : 0;
  return record && typeof record.available === "number" ? record.available : fallback;
}

function effectiveCountLabel(bookId) {
  const learningBook = learningBooks[bookId];
  if (!learningBook) return "内容准备中";
  const total = learningBook.lessons.length;
  const available = effectiveAvailable(bookId);
  return total === available ? `已开放${available}课` : `共${total}课 · 已开放${available}课`;
}

function findStudentEnrollment(studentId, teacherHint) {
  const candidates = state.enrollments.filter((item) => item.studentId === studentId);
  if (!candidates.length) return null;
  return candidates.find((item) => item.teacher === teacherHint) || candidates[0];
}

function renderStudentRow(student, pending) {
  const sourceLabel = student.source === "teacher" ? "教师录入" : "自助加入";
  return `<div class="student-row"><span><strong>${escapeHtml(student.chineseName)}${student.englishName ? ` · ${escapeHtml(student.englishName)}` : ""}</strong><small>学号 ${escapeHtml(student.studentId)} · ${sourceLabel}${pending ? " · 待确认" : ""}</small></span><span class="student-row-actions">${pending ? `<button class="confirm-button" type="button" data-action="confirm-student" data-id="${escapeHtml(student.id)}">确认加入 <small>Confirm</small></button>` : ""}<button class="danger-button" type="button" data-action="remove-student" data-id="${escapeHtml(student.id)}">移除 <small>Remove</small></button></span></div>`;
}

async function handleStudentLogin(form) {
  const data = new FormData(form);
  const studentId = data.get("studentAccount").trim();
  const inviteCode = data.get("inviteCode").trim();
  if (!studentId || !inviteCode) {
    showToast("请输入学号和邀请码 / Enter your ID and invitation code");
    return;
  }
  let result;
  if (window.LearningApi?.isConfigured()) {
    try {
      result = await window.LearningApi.authenticationOptions({ role: "student", inviteCode, userId: studentId });
    } catch (error) {
      showToast(error.message || "学号或邀请码无效");
      return;
    }
  } else {
    try {
      result = localAuthenticationOptions("student", studentId, inviteCode);
    } catch (error) {
      showToast(error.message || "学号或邀请码无效");
      return;
    }
  }
  const contexts = (result.contexts || []).filter((context) => context.bookId);
  if (!contexts.length) {
    showToast("该学号尚未加入任何课程 / No course found");
    return;
  }
  state.studentCourses = contexts;
  state.authenticationOptions.student = { signature: `${studentId}\u0000${inviteCode}`, account: result.account, contexts };
  saveStudentSession(result.account, contexts, `${studentId}\u0000${inviteCode}`);
  state.studentProfile = {
    chineseName: result.account?.name || studentId,
    englishName: result.account?.englishName || "",
    studentId,
    teacher: contexts[0].teacher || defaultTeacher,
    term: contexts[0].term || terms[0],
    book: contexts[0].bookId || "intermediate-comprehensive-1",
  };
  if (window.LearningApi?.isConfigured() && contexts.length === 1) {
    try {
      const session = await window.LearningApi.createSession({ role: "student", inviteCode, userId: studentId, contextId: contexts[0].id });
      if (session.profile?.teacher) state.studentProfile.teacher = session.profile.teacher;
      if (session.profile?.term) state.studentProfile.term = session.profile.term;
      if (session.profile?.bookId) state.studentProfile.book = session.profile.bookId;
      state.studentProfile.classId = session.profile?.classId || "";
      state.studentProfile.className = session.profile?.className || "";
    } catch { /* 保持基于课程列表的资料，进入课程时再建立会话 */ }
  }
  applyIdentity("student", state.studentProfile.chineseName);
  elements.roleDialog.close();
  renderStudentCoursesView();
  setView("courses");
  const firstCourseBookId = firstAllowedBookId();
  if (firstCourseBookId) selectBook(firstCourseBookId); else { renderCatalog(); renderLessons(); }
  void loadStudentProgress();
  showToast(`欢迎，${state.studentProfile.chineseName}！请选择课程进入 / Choose a course`);
}

function renderStudentCoursesView() {
  const isStudent = state.role === "student";
  const overview = document.querySelector(".course-overview");
  if (!isStudent) {
    if (overview) overview.hidden = false;
    elements.studentCourseList.hidden = true;
    return;
  }
  elements.coursePageIntro.textContent = "选择一门课程，进入对应教材 / Choose a course to enter";
  if (overview) overview.hidden = true;
  elements.studentCourseList.hidden = false;
  if (!state.studentCourses.length) {
    elements.studentCourseList.innerHTML = '<p class="empty-approval">当前学号没有已加入的课程，请联系教师获取邀请码。</p>';
    return;
  }
  elements.studentCourseList.innerHTML = state.studentCourses.map((context) => {
    const book = bookById(context.bookId);
    const open = effectiveBookOpen(context.bookId);
    const teacherLabel = context.teacher ? `${context.teacher} 老师` : "任课教师";
    const label = `${teacherLabel} · ${escapeHtml(context.term)} · ${escapeHtml(context.className || "班")}`;
    return `<button class="student-course-card" type="button" data-enter-course="${escapeHtml(context.id)}"${open ? "" : " disabled"}><span class="student-course-mark">课</span><span><strong>发展汉语·${escapeHtml(book.label)}</strong><small>${label}</small></span><b>进入 <small>Enter</small> ›</b></button>`;
  }).join("");
}

function formatActivityTime(iso) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const now = new Date();
  const sameDay = date.toDateString() === now.toDateString();
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const isYesterday = date.toDateString() === yesterday.toDateString();
  const time = `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
  if (sameDay) return `今天 ${time}`;
  if (isYesterday) return `昨天 ${time}`;
  return `${date.getMonth() + 1}月${date.getDate()}日 ${time}`;
}

function applyHomeStats() {
  const summary = state.studentProgress?.summary;
  if (state.role === "student") {
    elements.statStudyDays.textContent = summary?.studyDays || 0;
    elements.statWords.textContent = summary?.wordsStudied || 0;
    elements.statExercises.textContent = summary?.exercisesDone || 0;
    if (summary && (summary.wordsStudied || summary.exercisesDone || summary.textsStudied)) {
      const score = Math.min(100, summary.wordsStudied * 2 + summary.exercisesDone * 3 + summary.textsStudied * 2);
      elements.homeProgressBar.style.width = `${score}%`;
      elements.homeProgressText.textContent = `已学 ${summary.wordsStudied || 0} 个词语 · 完成 ${summary.exercisesDone || 0} 道练习`;
    } else {
      elements.homeProgressBar.style.width = "0%";
      elements.homeProgressText.textContent = summary ? "还没有学习记录，进入课程开始学习吧" : "学习记录加载中，稍后自动更新";
    }
  } else {
    elements.statStudyDays.textContent = "—";
    elements.statWords.textContent = "—";
    elements.statExercises.textContent = "—";
    elements.homeProgressBar.style.width = "0%";
    elements.homeProgressText.textContent = state.role === "guest" ? "请先登录，查看你的学习记录" : "教师/管理员账号不展示个人学习记录";
  }
}

async function loadStudentProgress(force = false) {
  if (state.role !== "student" || !window.LearningApi?.isConfigured?.()) {
    state.studentProgress = null;
    applyHomeStats();
    return null;
  }
  const cached = state.studentProgress;
  if (!force && cached && Date.now() - (state.studentProgressAt || 0) < 60000) {
    applyHomeStats();
    return cached;
  }
  try {
    const result = await window.LearningApi.progressSummary({});
    state.studentProgress = result;
    state.studentProgressAt = Date.now();
  } catch {
    state.studentProgress = null;
  }
  applyHomeStats();
  return state.studentProgress;
}

async function renderProgressView() {
  if (state.role === "guest") {
    elements.progressTableTitle.textContent = "尚未登录";
    elements.progressRows.innerHTML = '<p class="empty-approval">请先登录，这里将只显示你自己的学习记录。</p>';
    return;
  }
  if (state.role === "teacher") {
    elements.progressTableTitle.textContent = "教师身份";
    elements.progressRows.innerHTML = '<p class="empty-approval">教师账号不展示学生学习记录，请到“教学工作台 · 班级学情”查看班级数据。</p>';
    return;
  }
  if (state.role === "admin") {
    elements.progressTableTitle.textContent = "管理员身份";
    elements.progressRows.innerHTML = '<p class="empty-approval">管理员账号不展示个人学习记录。</p>';
    return;
  }
  elements.progressTableTitle.textContent = "我的学习记录";
  elements.progressRows.innerHTML = '<p class="empty-approval">正在加载学习记录…</p>';
  const result = await loadStudentProgress(true);
  if (!result) {
    elements.progressRows.innerHTML = window.LearningApi?.isConfigured?.()
      ? '<p class="empty-approval">学习记录暂时无法读取，请稍后重试。</p>'
      : '<p class="empty-approval">当前为本地演示模式，登录云端账号后这里将显示你的学习记录。</p>';
    return;
  }
  const activities = result.activities || [];
  if (!activities.length) {
    elements.progressRows.innerHTML = '<p class="empty-approval">还没有学习记录，进入课程开始学习吧。</p>';
    return;
  }
  elements.progressRows.innerHTML = activities.map((item) => {
    const kindLabel = item.kind === "vocabulary" ? "词语学习" : item.kind === "text" ? "课文学习" : "练习作答";
    const status = item.kind === "practice" ? (item.score != null && item.score !== "" ? `${item.score}分` : "已完成") : "已学习";
    return `<div class="record-row"><time>${escapeHtml(formatActivityTime(item.at))}</time><span><strong>${escapeHtml(item.label || "")}</strong><small>${kindLabel}</small></span><b>${escapeHtml(status)}</b></div>`;
  }).join("");
}

async function enterStudentCourse(contextId) {
  const context = state.studentCourses.find((item) => item.id === contextId);
  if (!context) return;
  if (window.LearningApi?.isConfigured()) {
    const stored = state.authenticationOptions.student || {};
    const inviteCode = String(stored.signature || "\u0000").split("\u0000")[1] || "";
    try {
      const session = await window.LearningApi.createSession({ role: "student", inviteCode, userId: state.studentProfile.studentId, contextId });
      state.studentProfile.book = session.profile.bookId;
      state.studentProfile.teacher = session.profile.teacher;
      state.studentProfile.term = session.profile.term;
      state.studentProfile.classId = session.profile.classId || "";
      state.studentProfile.className = session.profile.className || "";
    } catch (error) {
      showToast(error.message || "进入课程失败");
      return;
    }
  }
  const book = bookById(context.bookId);
  const lessonId = `${learningBooks[book.id]?.lessonPrefix || "zjzh-1"}-1`;
  window.location.href = `../digital-book/?lesson=${lessonId}`;
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
      const session = await window.LearningApi.createSession({ role: "teacher", inviteCode, teacherId: teacherAccount, teacher: teacherAccount, ...(selection.context ? { contextId: selection.context.id } : {}) });
      profile = session.profile;
    } catch (error) {
      showToast(error.message || "教师邀请码登录失败");
      return;
    }
  } else {
    profile = { role: "teacher", userId: teacherAccount, name: selection.account?.name || teacherAccount, ...selection.context };
  }
  state.studentProfile = null;
  applyIdentity("teacher", profile.teacher || profile.name);
  state.teacherContext = { teacher: profile.teacher || profile.name, term: profile.term, book: profile.bookId };
  elements.roleDialog.close();
  setView("teacher");
  showToast(`已进入${profile.teacher || profile.name}老师的教学工作台`);
}

function localAuthenticationOptions(role, account, inviteCode) {
  if (role === "student") {
    if (!account) throw new Error("请输入学号");
    const entries = [];
    for (const course of state.localCourses) {
      if (course.active === false) continue;
      const entry = (course.students || []).find((item) => item.studentId === account && item.active !== false);
      if (!entry) continue;
      entries.push({ course, entry });
    }
    if (!entries.length) throw new Error("学号或邀请码无效");
    const verified = entries.some(({ entry }) => entry.inviteCode === inviteCode);
    if (!verified) throw new Error("学号或邀请码无效");
    const matched = entries.map(({ course }) => ({ id: `${course.courseId}:${course.bookId}`, classId: course.courseId, className: course.className || "班", teacher: course.teacher, term: course.term, bookId: course.bookId, courseId: course.courseId }));
    return {
      account: { id: account, name: "本地学生", englishName: "" },
      contexts: matched,
    };
  }
  if (role === "teacher") {
    const teacherRecord = state.teachers.find((item) => item.name === account || item.id === account || item.account === account);
    if (!teacherRecord) throw new Error("教师账号未开通，请联系管理员");
    if (!teacherRecord.active) throw new Error("该教师账号已停用，请联系管理员");
    const validCode = teacherRecord.inviteCode || TEST_INVITE_CODE;
    if (inviteCode !== validCode) throw new Error("邀请码不正确");
    const teacher = teacherRecord.name || account;
    return {
      account: { id: teacher, name: teacher, englishName: "" },
      contexts: [],
    };
  }
  throw new Error("当前原型不支持该身份");
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
  if (!context && role !== "teacher") {
    showToast("该账号尚未分配班级或教材");
    return null;
  }
  return { account: record.account, context: context || null };
}

async function handleAdminLogin(form) {
  const data = new FormData(form);
  const name = data.get("administrator").trim();
  const inviteCode = data.get("inviteCode").trim();
  if (!name) {
    showToast("请输入管理员姓名");
    return;
  }
  if (window.LearningApi?.isConfigured()) {
    try {
      await window.LearningApi.createSession({ role: "admin", inviteCode, name, bookId: "system" });
    } catch (error) {
      showToast(error.message || "管理员邀请码登录失败");
      return;
    }
  } else if (inviteCode !== TEST_INVITE_CODE) {
    showToast("管理员邀请码不正确");
    return;
  }
  state.studentProfile = null;
  applyIdentity("admin", name);
  elements.roleDialog.close();
  setView("admin");
  showToast("已进入管理员界面原型");
}


function defaultLocalCourses() {
  return [{
    courseId: "local-course-1",
    teacher: "本地教师",
    term: terms[0],
    bookId: "intermediate-comprehensive-1",
    className: "本地测试班",
    active: true,
    createdAt: new Date().toISOString(),
    students: [
      { studentId: "test", chineseName: "测试学生", englishName: "Test", inviteCode: "123456", active: true, createdAt: new Date().toISOString() },
    ],
  }];
}

function saveLocalCourses() {
  localStorage.setItem("learningHubTeacherCoursesLocal", JSON.stringify(state.localCourses));
}

function localCourseKey(course) {
  return `${course.teacher}:${course.term}:${course.bookId}:${course.className || ""}`;
}

function simpleHash(value) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = ((hash << 5) - hash + value.charCodeAt(index)) | 0;
  }
  return `local-${Math.abs(hash).toString(36)}`;
}

function teacherIsCloud() {
  return Boolean(window.LearningApi?.isConfigured() && window.LearningApi.profile()?.role === "teacher");
}

function renderTeacherCoursePanel() {
  elements.teacherCoursePanel.hidden = false;
}

async function loadTeacherCourses() {
  let courses;
  if (teacherIsCloud()) {
    try {
      const result = await window.LearningApi.teacherCourses();
      courses = result.courses || [];
    } catch (error) {
      showToast(error.message || "课程列表读取失败");
      return;
    }
  } else {
    const teacher = state.teacherContext.teacher || state.userName;
    courses = state.localCourses.filter((course) => course.teacher === teacher).map((course) => ({ ...course, studentCount: (course.students || []).length })).sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")));
  }
  state.teacherCourses = courses;
  renderTeacherCourses(courses);
  if (state.role === "teacher" && !courseAccessible(state.selectedBookId)) {
    const firstCourseBookId = firstAllowedBookId();
    if (firstCourseBookId) selectBook(firstCourseBookId); else { renderCatalog(); renderLessons(); }
  }
}

function renderTeacherCourses(courses) {
  elements.teacherCourseList.innerHTML = courses.length
    ? courses.map((course) => `<div class="teacher-course-row"><span class="teacher-course-info"><strong>${escapeHtml(course.className || "班")}</strong><small>${escapeHtml(course.term)} · 发展汉语·${escapeHtml(bookById(course.bookId).label)} · ${course.studentCount || 0}名学生</small></span><span class="teacher-course-actions">${course.active === false ? '<b class="muted">已停用</b>' : ""}<button class="quiet-button" type="button" data-open-course-students="${escapeHtml(course.courseId)}">管理学生 <small>Manage</small></button></span></div>`).join("")
    : '<p class="empty-approval">还没有课程，点击“＋新建课程”。</p>';
}

function openNewCourse() {
  elements.newCourseForm.reset();
  elements.newCourseDialog.showModal();
}

async function createTeacherCourseByForm(form) {
  const data = new FormData(form);
  const term = data.get("term").trim();
  const bookId = data.get("bookId");
  const className = data.get("className").trim();
  if (!term || !bookId) throw new Error("学期和教材不能为空");
  if (teacherIsCloud()) {
    await window.LearningApi.createTeacherCourse({ term, bookId, className });
  } else {
    const teacher = state.teacherContext.teacher || state.userName || defaultTeacher;
    const courseId = simpleHash(localCourseKey({ teacher, term, bookId, className }));
    if (state.localCourses.some((course) => course.courseId === courseId)) throw new Error("该课程已存在（同一教师、学期、教材、班名）");
    state.localCourses.push({ courseId, teacher, term, bookId, className: className || `${teacher}班`, active: true, createdAt: new Date().toISOString(), students: [] });
    saveLocalCourses();
  }
  elements.newCourseDialog.close();
  showToast("课程已创建 / Course created");
  await loadTeacherCourses();
}

async function openCourseStudents(courseId) {
  const cloud = teacherIsCloud();
  let course;
  let students = [];
  if (cloud) {
    course = (state.teacherCourses || []).find((item) => item.courseId === courseId);
    try {
      const result = await window.LearningApi.courseStudents({ courseId });
      students = result.students || [];
    } catch (error) {
      showToast(error.message || "学生名单读取失败");
      return;
    }
  } else {
    course = state.localCourses.find((item) => item.courseId === courseId);
    students = course?.students || [];
  }
  if (!course) return;
  state.activeTeacherCourse = { ...course, students };
  window.__activeTeacherCourseId = courseId;
  elements.teacherCourseList.hidden = true;
  elements.courseStudentPanel.hidden = false;
  elements.courseStudentTitle.textContent = `${course.className || "班"} · ${bookById(course.bookId).label}`;
  elements.courseStudentMeta.textContent = `${course.term} · ${course.teacher} 老师 · ${students.length}名学生`;
  renderCourseStudentsTable(students);
  if (cloud) {
    void loadCloudClassSettings();
    window.PracticeAnalytics?.render();
  }
}

function backCourseList() {
  window.__activeTeacherCourseId = "";
  state.activeTeacherCourse = null;
  elements.courseStudentPanel.hidden = true;
  elements.teacherCourseList.hidden = false;
}

function renderCourseStudentsTable(students) {
  if (!students.length) {
    elements.courseStudentTable.innerHTML = '<p class="empty-approval">还没有学生，点击“＋新增学生”或“导入 Excel”。</p>';
    return;
  }
  elements.courseStudentTable.innerHTML = `<div class="course-student-row head"><span>姓名</span><span>英文名</span><span>学号</span><span>邀请码</span><span>操作</span></div>` + students.map((student) => `<div class="course-student-row"><span><strong>${escapeHtml(student.chineseName || "—")}</strong></span><span>${escapeHtml(student.englishName || "—")}</span><span>${escapeHtml(student.studentId)}</span><span class="invite-cell"><code>${escapeHtml(student.inviteCode)}</code><button class="quiet-button" type="button" data-copy-invite="${escapeHtml(student.studentId)}">复制信息 <small>Copy</small></button></span><span class="course-student-actions"><button class="quiet-button" type="button" data-reset-invite="${escapeHtml(student.studentId)}">重置码 <small>Reset</small></button><button class="quiet-button" type="button" data-edit-student="${escapeHtml(student.studentId)}">编辑 <small>Edit</small></button><button class="danger-button" type="button" data-remove-student-course="${escapeHtml(student.studentId)}">移除 <small>Remove</small></button></span></div>`).join("");
}

function openAddStudentDialog(entry) {
  const course = state.activeTeacherCourse;
  if (course) {
    elements.addStudentContextLabel.textContent = `${course.term} · ${bookById(course.bookId).label} · ${course.teacher} 老师`;
  } else {
    const context = state.teacherContext;
    elements.addStudentContextLabel.textContent = `${context.term} · ${bookById(context.book).label} · ${context.teacher} 老师`;
  }
  state.pendingEditStudent = entry || null;
  const form = elements.addStudentForm;
  form.reset();
  if (entry) {
    form.querySelector('[name="chineseName"]').value = entry.chineseName || "";
    form.querySelector('[name="englishName"]').value = entry.englishName || "";
    form.querySelector('[name="studentId"]').value = entry.studentId || "";
    form.querySelector('[name="studentId"]').disabled = true;
    form.querySelector('[name="inviteCode"]').value = "";
    form.querySelector('[name="inviteCode"]').placeholder = "留空保持不变";
    document.querySelector("#addStudentDialogTitle").textContent = "编辑学生 / Edit student";
  } else {
    form.querySelector('[name="studentId"]').disabled = false;
    form.querySelector('[name="inviteCode"]').placeholder = "留空则自动生成";
    document.querySelector("#addStudentDialogTitle").textContent = "新增学生 / Add student";
  }
  elements.addStudentDialog.showModal();
}

async function addCourseStudentByForm(data) {
  const course = state.activeTeacherCourse;
  if (!course) throw new Error("请先选择课程");
  const chineseName = data.get("chineseName").trim();
  const studentId = data.get("studentId").trim();
  const englishName = data.get("englishName").trim();
  const inviteCode = data.get("inviteCode").trim();
  if (!chineseName || !studentId) throw new Error("姓名和学号不能为空");
  if (teacherIsCloud()) {
    const result = await window.LearningApi.addCourseStudents({ courseId: course.courseId, students: [{ studentId, chineseName, englishName, inviteCode }] });
    if (result.imported !== 1) throw new Error(result.results?.[0]?.message || "添加失败");
    return { studentId, inviteCode: result.results[0].inviteCode };
  }
  const local = state.localCourses.find((item) => item.courseId === course.courseId);
  if (!local) throw new Error("课程不存在");
  if (local.students.some((item) => item.studentId === studentId)) throw new Error("该学号已存在");
  const code = inviteCode || generateLocalStudentInviteCode();
  local.students.push({ studentId, chineseName, englishName, inviteCode: code, active: true, createdAt: new Date().toISOString() });
  saveLocalCourses();
  return { studentId, inviteCode: code };
}

async function updateCourseStudentByForm(data) {
  const course = state.activeTeacherCourse;
  const entry = state.pendingEditStudent;
  if (!course || !entry) throw new Error("请先选择课程");
  const chineseName = data.get("chineseName").trim();
  const englishName = data.get("englishName").trim();
  const inviteCode = data.get("inviteCode").trim();
  if (!chineseName) throw new Error("姓名不能为空");
  if (teacherIsCloud()) {
    const result = await window.LearningApi.updateCourseStudent({ courseId: course.courseId, studentId: entry.studentId, chineseName, englishName, ...(inviteCode ? { inviteCode } : {}) });
    return result;
  }
  const local = state.localCourses.find((item) => item.courseId === course.courseId);
  const target = local?.students.find((item) => item.studentId === entry.studentId);
  if (!local || !target) throw new Error("该学生在课程中不存在");
  target.chineseName = chineseName;
  target.englishName = englishName;
  if (inviteCode) target.inviteCode = inviteCode;
  saveLocalCourses();
  return { studentId: entry.studentId, inviteCode: target.inviteCode };
}

async function removeCourseStudentEntry(courseId, studentId) {
  if (teacherIsCloud()) {
    await window.LearningApi.removeCourseStudent({ courseId, studentId });
    return;
  }
  const local = state.localCourses.find((item) => item.courseId === courseId);
  if (!local) return;
  local.students = local.students.filter((item) => item.studentId !== studentId);
  saveLocalCourses();
}

async function resetCourseStudentInvite(courseId, studentId) {
  let code;
  if (teacherIsCloud()) {
    const result = await window.LearningApi.resetCourseStudentInvite({ courseId, studentId });
    code = result.inviteCode;
  } else {
    const local = state.localCourses.find((item) => item.courseId === courseId);
    const target = local?.students.find((item) => item.studentId === studentId);
    if (!target) throw new Error("该学生在课程中不存在");
    target.inviteCode = generateLocalStudentInviteCode();
    saveLocalCourses();
    code = target.inviteCode;
  }
  showToast(`已生成新邀请码 / New code: ${code}`);
  await refreshActiveCourseStudents();
}

function generateLocalInviteCode(length = 8) {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  let code = "";
  for (let index = 0; index < length; index += 1) code += alphabet[Math.floor(Math.random() * alphabet.length)];
  return code;
}

function generateLocalStudentInviteCode(length = 6) {
  let code = "";
  for (let index = 0; index < length; index += 1) code += "123456789"[Math.floor(Math.random() * 9)];
  return code;
}

async function refreshActiveCourseStudents() {
  const course = state.activeTeacherCourse;
  if (!course) return;
  let students;
  if (teacherIsCloud()) {
    const result = await window.LearningApi.courseStudents({ courseId: course.courseId });
    students = result.students || [];
  } else {
    const local = state.localCourses.find((item) => item.courseId === course.courseId);
    students = local?.students || [];
  }
  course.students = students;
  state.activeTeacherCourse = course;
  renderCourseStudentsTable(students);
  elements.courseStudentMeta.textContent = `${course.term} · ${course.teacher} 老师 · ${students.length}名学生`;
}

function studentInviteText(entry) {
  const course = state.activeTeacherCourse || {};
  const book = bookById(course.bookId);
  const name = [entry.chineseName, entry.englishName].filter(Boolean).join(" / ") || entry.studentId;
  return `Student: ${name}\nYour Id: ${entry.studentId}\nInvitation code: ${entry.inviteCode}\nCourse: ${book.label}\nSign in with your Id and Invitation code.\nhttps://steven2025.github.io/chinese-learning-companion`;
}

async function copyTextToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    document.body.appendChild(textarea);
    textarea.select();
    const copied = document.execCommand("copy");
    textarea.remove();
    return copied;
  }
}

async function copyStudentInvite(studentId) {
  const entry = (state.activeTeacherCourse?.students || []).find((item) => item.studentId === studentId);
  if (!entry) return;
  await copyTextToClipboard(studentInviteText(entry));
  showToast("已复制邀请信息 / Invite copied");
}

async function copyAllInvites() {
  const students = state.activeTeacherCourse?.students || [];
  if (!students.length) {
    showToast("该课程还没有学生");
    return;
  }
  await copyTextToClipboard(students.map((entry) => studentInviteText(entry)).join("\n\n"));
  showToast(`已复制 ${students.length} 条邀请信息 / ${students.length} copied`);
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

async function downloadStudentTemplate() {
  try {
    const response = await fetch("templates/student-import-template.xlsx", { cache: "no-cache" });
    if (!response.ok) throw new Error("模板文件未找到");
    downloadBlob(await response.blob(), "学生导入模板.xlsx");
    showToast("模板已下载 / Template downloaded");
    return;
  } catch (error) {
    if (!window.XLSX) {
      showToast("模板文件缺失，且 Excel 组件未加载");
      return;
    }
  }
  const sheet = window.XLSX.utils.aoa_to_sheet([
    ["学号 (Student ID)", "中文名 (Chinese name)", "英文名 (English name)"],
    ["20260001", "王小明", ""],
    ["20260002", "", "Mike"],
  ]);
  const workbook = window.XLSX.utils.book_new();
  window.XLSX.utils.book_append_sheet(workbook, sheet, "学生名单");
  const output = window.XLSX.write(workbook, { bookType: "xlsx", type: "array" });
  downloadBlob(new Blob([output], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), "学生导入模板.xlsx");
  showToast("模板已生成，请检查下载 / Template ready");
}

function parseCsvRows(text) {
  return String(text || "").replace(/\r/g, "").split("\n").filter((line) => line.trim().length > 0).map((line) => line.split(",").map((cell) => String(cell || "").trim().replace(/^"|"$/g, "")));
}

async function importStudentExcel(file) {
  const course = state.activeTeacherCourse;
  if (!course) throw new Error("请先选择课程");
  let rows;
  if (window.XLSX) {
    const buffer = await file.arrayBuffer();
    const workbook = window.XLSX.read(buffer, { type: "array" });
    rows = window.XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]], { header: 1 });
  } else if (/.csv$/i.test(file.name)) {
    rows = parseCsvRows(await file.text());
  } else {
    showToast("Excel 组件未加载，请改用 CSV 模板导入");
    return;
  }
  const students = [];
  for (let index = 1; index < rows.length; index += 1) {
    const [studentId, chineseName, englishName, inviteCode] = rows[index] || [];
    const id = String(studentId ?? "").trim();
    const cn = String(chineseName ?? "").trim();
    const en = String(englishName ?? "").trim();
    if (!id && !cn && !en) continue;
    students.push({ studentId: id, chineseName: cn, englishName: en, inviteCode: String(inviteCode ?? "").trim() });
  }
  if (!students.length) {
    showToast("Excel 中没有可导入的学生");
    return;
  }
  let result;
  if (teacherIsCloud()) {
    result = await window.LearningApi.addCourseStudents({ courseId: course.courseId, students });
  } else {
    const local = state.localCourses.find((item) => item.courseId === course.courseId);
    if (!local) throw new Error("课程不存在");
    const imported = [];
    const skipped = [];
    for (const entry of students) {
      if (!entry.studentId || (!entry.chineseName && !entry.englishName)) { skipped.push({ studentId: entry.studentId || "?", message: "学号或姓名无效" }); continue; }
      if (local.students.some((item) => item.studentId === entry.studentId)) { skipped.push({ studentId: entry.studentId, message: "学号已存在" }); continue; }
      const code = entry.inviteCode || generateLocalStudentInviteCode();
      local.students.push({ studentId: entry.studentId, chineseName: entry.chineseName, englishName: entry.englishName, inviteCode: code, active: true, createdAt: new Date().toISOString() });
      imported.push({ studentId: entry.studentId, inviteCode: code, ok: true });
    }
    saveLocalCourses();
    result = { imported: imported.length, skipped: skipped.length, results: [...imported, ...skipped] };
  }
  const summary = `导入成功 ${result.imported} 条${result.skipped ? `，跳过 ${result.skipped} 条` : ""}`;
  const failures = (result.results || []).filter((item) => !item.ok).map((item) => `${item.studentId}: ${item.message}`).join("；");
  elements.courseImportResult.hidden = false;
  elements.courseImportResult.textContent = failures ? `${summary}。失败：${failures}` : summary;
  showToast(summary);
  await refreshActiveCourseStudents();
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
    state.teacherContext = { teacher: cloudProfile.teacher, term: cloudProfile.term, book: cloudProfile.bookId, courseId: cloudProfile.courseId || "" };
    renderTeacherCoursePanel();
    void loadTeacherCourses();
    void loadCloudClassSettings();
    return;
  }
  renderTeacherCoursePanel();
  void loadTeacherCourses();
  const students = state.enrollments.filter((enrollment) => enrollment.teacher === context.teacher && enrollment.term === context.term && enrollment.book === context.book);
  const pendingStudents = students.filter((student) => student.status === "pending");
  const confirmedStudents = students.filter((student) => student.status !== "pending");
  elements.classStudentCount.textContent = `${students.length}人`;
  elements.classStudentList.innerHTML = `<div class="class-list-toolbar"><span>已确认 <b>${confirmedStudents.length}</b> · 待确认 <b>${pendingStudents.length}</b></span><button class="quiet-button" type="button" data-action="open-add-student">＋ 新增学生 <small>Add student</small></button></div>${pendingStudents.length ? `<div class="class-subgroup"><header>待确认 <small>学生用邀请码自助加入，需确认后生效</small></header>${pendingStudents.map((student) => renderStudentRow(student, true)).join("")}</div>` : ""}${confirmedStudents.length ? `<div class="class-subgroup"><header>已确认</header>${confirmedStudents.map((student) => renderStudentRow(student, false)).join("")}</div>` : ""}${!students.length ? '<p class="empty-approval">还没有学生。点“＋新增学生”录入名单，或让学生用邀请码自助加入。</p>' : ""}`;
}

function openAddStudentDialog() {
  const context = state.teacherContext;
  elements.addStudentContextLabel.textContent = `${context.term} · ${bookById(context.book).label} · ${context.teacher} 老师`;
  elements.addStudentDialog.showModal();
}

function addStudentByTeacher(name, studentId, englishName) {
  if (!name || !studentId) throw new Error("姓名和学号不能为空");
  const context = state.teacherContext;
  const now = new Date().toISOString();
  const id = `student-${studentId}-${context.term}-${context.book}`;
  const existingIndex = state.enrollments.findIndex((item) => item.id === id);
  const enrollment = {
    id,
    chineseName: name,
    englishName: englishName || "",
    studentId,
    classId: "local-class",
    className: "本地测试班",
    term: context.term,
    teacher: context.teacher,
    book: context.book,
    status: "confirmed",
    source: "teacher",
    joinedAt: existingIndex >= 0 ? state.enrollments[existingIndex].joinedAt : now,
    updatedAt: now,
  };
  if (existingIndex >= 0) state.enrollments[existingIndex] = enrollment;
  else state.enrollments.push(enrollment);
  saveEnrollments();
  renderTeacherWorkspace();
  return enrollment;
}

function confirmEnrollment(id) {
  const enrollment = state.enrollments.find((item) => item.id === id);
  if (!enrollment) return;
  enrollment.status = "confirmed";
  enrollment.updatedAt = new Date().toISOString();
  saveEnrollments();
  renderTeacherWorkspace();
  showToast(`已确认 ${enrollment.chineseName} 加入本班`);
}

function removeEnrollment(id) {
  const enrollment = state.enrollments.find((item) => item.id === id);
  if (!enrollment) return;
  pendingRemoveEnrollment = enrollment;
  elements.confirmDialogMessage.textContent = `确定移除学生“${enrollment.chineseName}”（学号 ${enrollment.studentId}）？`;
  elements.confirmDialog.showModal();
}

function confirmPendingRemoveEnrollment() {
  elements.confirmDialog.close();
  const enrollment = pendingRemoveEnrollment;
  pendingRemoveEnrollment = null;
  if (!enrollment) return;
  state.enrollments = state.enrollments.filter((item) => item.id !== enrollment.id);
  saveEnrollments();
  renderTeacherWorkspace();
  showToast("已移除该学生");
}

async function loadCloudClassSettings() {
  const courseId = state.activeTeacherCourse?.courseId || window.__activeTeacherCourseId || "";
  if (!courseId) {
    elements.writingPolicyStatus.textContent = "请先打开一门课程，再读取班级设置。";
    return;
  }
  elements.writingPolicyStatus.textContent = "正在读取班级设置…";
  try {
    const result = await window.LearningApi.classSettings({ courseId });
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
    await window.LearningApi.updateClassSettings({ courseId: state.activeTeacherCourse?.courseId || window.__activeTeacherCourseId || "", writingInputMode: elements.writingInputMode.value });
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
    const result = await window.LearningApi.classStudents({ courseId: state.activeTeacherCourse?.courseId || window.__activeTeacherCourseId || "" });
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

function showTeacherTab(tab) {
  document.querySelectorAll("[data-teacher-tab]").forEach((button) => button.classList.toggle("active", button.dataset.teacherTab === tab));
  document.querySelectorAll("[data-teacher-panel]").forEach((panel) => {
    const active = panel.dataset.teacherPanel === tab;
    panel.hidden = !active;
    panel.classList.toggle("active", active);
  });
}

function showAdminTab(tab) {
  document.querySelectorAll("[data-admin-tab]").forEach((button) => button.classList.toggle("active", button.dataset.adminTab === tab));
  document.querySelectorAll("[data-admin-panel]").forEach((panel) => {
    const active = panel.dataset.adminPanel === tab;
    panel.hidden = !active;
    panel.classList.toggle("active", active);
  });
}

function renderAdminView() {
  void loadAdminTeachers();
  renderAdminPublishing();
  renderAdminReview();
}

function adminIsCloud() {
  return Boolean(window.LearningApi?.isConfigured() && window.LearningApi.profile()?.role === "admin");
}

function adminAssignmentLabel(teacher) {
  const assignments = Array.isArray(teacher.assignments) && teacher.assignments.length ? teacher.assignments : [];
  if (!assignments.length) return "未分配学期/教材";
  return assignments.map((assignment) => `${assignment.term} · ${(assignment.bookIds || []).map((id) => bookById(id).label).join("、")}${assignment.className ? ` · ${assignment.className}` : ""}`).join("；");
}

async function loadAdminTeachers() {
  if (!adminIsCloud()) {
    renderAdminUsersLocal();
    return;
  }
  try {
    const result = await window.LearningApi.adminTeachers();
    state.adminTeachers = result.teachers || [];
    renderAdminUsersCloud();
  } catch (error) {
    showToast(error.message || "教师列表读取失败");
    elements.adminTeacherList.innerHTML = `<p class="empty-approval">${escapeHtml(error.message || "教师列表读取失败")}</p>`;
  }
}

function renderAdminUsersCloud() {
  const teachers = state.adminTeachers || [];
  const activeCount = teachers.filter((teacher) => teacher.active).length;
  elements.teacherCount.textContent = `${teachers.length} 个账号 · ${activeCount} 个启用`;
  elements.adminTeacherList.innerHTML = teachers.length
    ? teachers.map((teacher) => `<div class="admin-row"><span><strong>${escapeHtml(teacher.name)}</strong><small>登录账号 ${escapeHtml(teacher.account)} · ${teacher.active ? "已启用" : "已停用"}<br>邀请码 <code class="admin-invite-code">${escapeHtml(teacher.inviteCode)}</code> · ${escapeHtml(adminAssignmentLabel(teacher))}</small></span><span class="teacher-row-actions"><button class="quiet-button" type="button" data-copy-teacher-invite="${escapeHtml(teacher.id)}">复制邀请码 <small>Copy</small></button><button class="quiet-button" type="button" data-reset-teacher-invite="${escapeHtml(teacher.id)}">重置邀请码 <small>Reset</small></button><button class="quiet-button" type="button" data-action="toggle-teacher" data-id="${escapeHtml(teacher.id)}">${teacher.active ? "停用 <small>Disable</small>" : "启用 <small>Enable</small>"}</button><button class="quiet-button danger-button" type="button" data-remove-teacher="${escapeHtml(teacher.id)}">删除 <small>Delete</small></button></span></div>`).join("")
    : '<p class="empty-approval">还没有教师账号，请点击“新增教师”。</p>';
}

function renderAdminUsersLocal() {
  const teachers = state.teachers;
  const activeCount = teachers.filter((teacher) => teacher.active).length;
  elements.teacherCount.textContent = `${teachers.length} 个账号 · ${activeCount} 个启用`;
  elements.adminTeacherList.innerHTML = teachers.length
    ? teachers.map((teacher) => `<div class="admin-row"><span><strong>${escapeHtml(teacher.name)}</strong><small>登录账号 ${escapeHtml(teacher.account)} · ${teacher.active ? "已启用" : "已停用"} · ${new Date(teacher.createdAt).toLocaleDateString() || ""} 开通${teacher.inviteCode ? `<br>邀请码 <code class="admin-invite-code">${escapeHtml(teacher.inviteCode)}</code>` : ""}</small></span><span class="teacher-row-actions">${teacher.inviteCode ? `<button class="quiet-button" type="button" data-copy-teacher-invite="${escapeHtml(teacher.id)}">复制邀请码 <small>Copy</small></button><button class="quiet-button" type="button" data-reset-teacher-invite="${escapeHtml(teacher.id)}">重置邀请码 <small>Reset</small></button>` : ""}<button class="quiet-button" type="button" data-action="toggle-teacher" data-id="${escapeHtml(teacher.id)}">${teacher.active ? "停用 <small>Disable</small>" : "启用 <small>Enable</small>"}</button><button class="quiet-button danger-button" type="button" data-remove-teacher="${escapeHtml(teacher.id)}">删除 <small>Delete</small></button></span></div>`).join("")
    : '<p class="empty-approval">还没有教师账号，请点击“新增教师”。</p>';
}

function renderAdminPublishing() {
  elements.adminPublishingList.innerHTML = catalog.map((level) => `<div class="publish-level"><h3>${level.label}</h3><div class="admin-list">${level.books.map(([id, label]) => {
    const learningBook = learningBooks[id];
    const isOpen = effectiveBookOpen(id);
    const available = effectiveAvailable(id);
    const total = learningBook ? learningBook.lessons.length : 0;
    return `<div class="admin-row publish-row"><span><strong>《发展汉语·${label}》</strong><small>${learningBook ? `共 ${total} 课 · 当前开放 ${available} 课` : "内容尚未接入，仅可开放入口"}</small></span><span class="publish-controls">${learningBook ? `<label><span>开放课数</span><select data-publish-available="${id}">${Array.from({ length: total }, (_, index) => index + 1).map((count) => `<option value="${count}"${count === available ? " selected" : ""}>${count}课</option>`).join("")}</select></label><button class="quiet-button" type="button" data-action="reset-publish" data-id="${id}">默认 <small>Default</small></button>` : ""}<button class="switch-button${isOpen ? " on" : ""}" type="button" data-action="toggle-publish" data-id="${id}" role="switch" aria-checked="${isOpen}"><i></i><span>${isOpen ? "已开放" : "未开放"}</span></button></span></div>`;
  }).join("")}</div></div>`).join("");
}

function renderAdminReview() {
  const contentBooks = books.filter((book) => learningBooks[book.id] && effectiveBookOpen(book.id));
  if (!contentBooks.length) {
    elements.adminReviewList.innerHTML = '<p class="empty-approval">当前没有已开放的教材，语种审核列表为空。</p>';
    return;
  }
  elements.adminReviewList.innerHTML = contentBooks.map((book) => {
    const learningBook = learningBooks[book.id];
    const available = effectiveAvailable(book.id);
    return `<div class="publish-level"><h3>《发展汉语·${book.label}》</h3><div class="admin-list">${learningBook.lessons.slice(0, available).map((title, index) => {
      const lessonId = `${learningBook.lessonPrefix}-${index + 1}`;
      const record = state.contentReview[lessonId] || {};
      const badges = (record.languages || []).map((code) => `<i class="lang-badge${record.reviewed ? " reviewed" : ""}">${escapeHtml(languageShortLabels[code] || code)}</i>`).join("");
      return `<div class="admin-row review-row"><span><strong>第${index + 1}课 · ${escapeHtml(title)}</strong><small>${badges || '<span class="muted">尚未统计语种覆盖</span>'}</small></span><span class="review-controls"><button class="quiet-button" type="button" data-action="refresh-review" data-id="${lessonId}">刷新统计 <small>Refresh</small></button><button class="review-toggle${record.reviewed ? " on" : ""}" type="button" data-action="toggle-review" data-id="${lessonId}">${record.reviewed ? "已审核 ✓ <small>Done</small>" : "标记通过 <small>Approve</small>"}</button></span></div>`;
    }).join("")}</div></div>`;
  }).join("");
}

async function refreshAllReview() {
  elements.adminReviewList.innerHTML = '<p class="empty-approval">正在从云端数据统计语种覆盖，请稍候…</p>';
  const lessonIds = [];
  for (const book of books) {
    const learningBook = learningBooks[book.id];
    if (!learningBook || !effectiveBookOpen(book.id)) continue;
    for (let index = 0; index < effectiveAvailable(book.id); index += 1) lessonIds.push(`${learningBook.lessonPrefix}-${index + 1}`);
  }
  await Promise.all(lessonIds.map((lessonId) => refreshReviewForLesson(lessonId).catch(() => null)));
  renderAdminReview();
  showToast("语种覆盖统计完成 / Language coverage updated");
}

async function refreshReviewForLesson(lessonId) {
  const root = window.HANZI_COMPANION_CONFIG?.runtimeDataRoot || "";
  if (!root) return [];
  const documents = await Promise.all(REVIEW_DATA_FILES.map((file) => fetch(`${root}/lessons/${lessonId}/${file}`).then((response) => (response.ok ? response.json() : null)).catch(() => null)));
  const codes = new Set();
  documents.forEach((document) => { if (document) collectLanguageCodes(document, codes); });
  const record = state.contentReview[lessonId] || {};
  record.languages = Array.from(codes).sort((a, b) => languageOrder(a) - languageOrder(b));
  state.contentReview[lessonId] = record;
  saveContentReview();
  return record.languages;
}

function collectLanguageCodes(node, codes) {
  if (Array.isArray(node)) {
    node.forEach((item) => collectLanguageCodes(item, codes));
    return;
  }
  if (!node || typeof node !== "object") return;
  for (const [key, value] of Object.entries(node)) {
    if (REVIEW_LANGUAGE_CODES.has(key)) codes.add(key);
    if (value && typeof value === "object") collectLanguageCodes(value, codes);
  }
}

function languageOrder(code) {
  const order = ["zh", "pinyin", "en", "es", "fr", "id", "ja", "ko", "lo", "ms", "my", "ru", "th", "vi"];
  const index = order.indexOf(code);
  return index === -1 ? 99 : index;
}

function addTeacher(name, inviteCode) {
  if (!name) throw new Error("教师姓名不能为空");
  if (state.teachers.some((item) => item.name === name)) throw new Error("该教师姓名已存在");
  state.teachers.push({
    id: name, account: name, name, active: true,
    inviteCode: inviteCode || generateLocalInviteCode(), assignments: [],
    createdAt: new Date().toISOString(),
  });
  saveTeachers();
  renderAdminUsersLocal();
}

async function handleAddTeacherForm(form) {
  const data = new FormData(form);
  const name = data.get("teacherName").trim();
  const inviteCode = data.get("teacherInviteCode").trim();
  if (!name) throw new Error("教师姓名不能为空");
  if (!inviteCode) throw new Error("请设置教师邀请码");
  if (adminIsCloud()) {
    const result = await window.LearningApi.createAdminTeacher({ name, inviteCode });
    return { name, inviteCode: result.inviteCode };
  }
  addTeacher(name, inviteCode);
  return { name, inviteCode };
}

async function removeAdminTeacher(id) {
  let teacher;
  if (adminIsCloud()) {
    teacher = (state.adminTeachers || []).find((item) => item.id === id);
    if (!teacher) return;
    if (!window.confirm(`确定删除教师“${teacher.name}”？删除后该教师无法再登录。`)) return;
    try {
      const result = await window.LearningApi.removeAdminTeacher({ teacherId: id });
      showToast(`已删除教师 ${result.name || teacher.name}`);
    } catch (error) {
      showToast(error.message || "删除失败");
    }
    void loadAdminTeachers();
    return;
  }
  teacher = state.teachers.find((item) => item.id === id);
  if (!teacher) return;
  if (!window.confirm(`确定删除教师“${teacher.name}”？删除后该教师无法再登录。`)) return;
  state.teachers = state.teachers.filter((item) => item.id !== id);
  saveTeachers();
  renderAdminUsersLocal();
  showToast(`已删除教师 ${teacher.name}`);
}

async function toggleTeacherActive(id) {
  if (adminIsCloud()) {
    const teacher = (state.adminTeachers || []).find((item) => item.id === id);
    if (!teacher) return;
    try {
      await window.LearningApi.updateAdminTeacher({ teacherId: id, active: !teacher.active });
      showToast(teacher.active ? `已停用教师 ${teacher.name}` : `已启用教师 ${teacher.name}`);
    } catch (error) {
      showToast(error.message || "操作失败");
    }
    void loadAdminTeachers();
    return;
  }
  const teacher = state.teachers.find((item) => item.id === id);
  if (!teacher) return;
  teacher.active = !teacher.active;
  saveTeachers();
  renderAdminUsersLocal();
  showToast(teacher.active ? `已启用教师 ${teacher.name}` : `已停用教师 ${teacher.name}`);
}

async function resetAdminTeacherInvite(id) {
  if (adminIsCloud()) {
    const result = await window.LearningApi.resetAdminTeacherInvite({ teacherId: id });
    showToast(`新邀请码：${result.inviteCode}`);
    void loadAdminTeachers();
    return;
  }
  const teacher = state.teachers.find((item) => item.id === id);
  if (!teacher) return;
  teacher.inviteCode = generateLocalInviteCode();
  saveTeachers();
  renderAdminUsersLocal();
  showToast(`新邀请码：${teacher.inviteCode}`);
}

async function copyAdminTeacherInvite(id) {
  let code = "";
  if (adminIsCloud()) {
    code = (state.adminTeachers || []).find((item) => item.id === id)?.inviteCode || "";
  } else {
    code = state.teachers.find((item) => item.id === id)?.inviteCode || "";
  }
  if (!code) {
    showToast("该教师还没有邀请码");
    return;
  }
  await copyTextToClipboard(code);
  showToast("邀请码已复制 / Invite copied");
}

function firstOpenContentBookId() {
  const book = books.find((item) => learningBooks[item.id] && effectiveBookOpen(item.id));
  return book ? book.id : "intermediate-comprehensive-1";
}

function refreshBookSelects() {
  const fallback = firstOpenContentBookId();
  document.querySelectorAll("[data-book-options]").forEach((select) => {
    const current = select.value;
    select.innerHTML = bookOptionMarkup(current && effectiveBookOpen(current) ? current : fallback);
  });
  const current = elements.teacherBook.value;
  elements.teacherBook.innerHTML = bookOptionMarkup(current && effectiveBookOpen(current) ? current : fallback);
}

function toggleBookPublish(bookId) {
  const record = state.publishing[bookId] || {};
  const wasOpen = effectiveBookOpen(bookId);
  record.open = !wasOpen;
  if (record.open && typeof record.available !== "number" && learningBooks[bookId]) record.available = learningBooks[bookId].available;
  state.publishing[bookId] = record;
  savePublishing();
  refreshAfterPublishingChange();
  showToast(record.open ? "教材已开放" : "教材已关闭");
}

function setPublishAvailable(bookId, count) {
  const record = state.publishing[bookId] || {};
  record.available = count;
  if (record.open === undefined) record.open = Boolean(learningBooks[bookId]);
  state.publishing[bookId] = record;
  savePublishing();
  refreshAfterPublishingChange();
}

function resetBookPublish(bookId) {
  delete state.publishing[bookId];
  savePublishing();
  refreshAfterPublishingChange();
  showToast("已恢复默认开放设置");
}

function refreshAfterPublishingChange() {
  renderAdminPublishing();
  renderAdminReview();
  refreshBookSelects();
  renderCatalog();
  renderLessons();
}

function toggleLessonReview(lessonId) {
  const record = state.contentReview[lessonId] || {};
  record.reviewed = !record.reviewed;
  record.reviewedAt = record.reviewed ? new Date().toISOString() : "";
  state.contentReview[lessonId] = record;
  saveContentReview();
  renderAdminReview();
  showToast(record.reviewed ? `第 ${lessonId} 课已标记审核通过` : "已取消审核标记");
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
  if (event.target.closest("[data-pwa-refresh]")) { window.location.reload(); return; }
  if (event.target.closest("[data-pwa-dismiss]")) {
    elements.pwaInstallBanner.hidden = true;
    localStorage.setItem("pwaInstallNoticeDismissed", "1");
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
  const enterCourse = event.target.closest("[data-enter-course]");
  if (enterCourse) { void enterStudentCourse(enterCourse.dataset.enterCourse); return; }
  if (event.target.closest("[data-new-course-close]")) { elements.newCourseDialog.close(); return; }
  if (event.target.closest("[data-action='open-new-course']")) { openNewCourse(); return; }
  const openCourseStudentsBtn = event.target.closest("[data-open-course-students]");
  if (openCourseStudentsBtn) { void openCourseStudents(openCourseStudentsBtn.dataset.openCourseStudents); return; }
  if (event.target.closest("[data-action='back-course-list']")) { backCourseList(); return; }
  if (event.target.closest("[data-action='copy-all-invites']")) { void copyAllInvites(); return; }
  if (event.target.closest("[data-action='download-student-template']")) { event.preventDefault(); void downloadStudentTemplate(); return; }
  const copyInvite = event.target.closest("[data-copy-invite]");
  if (copyInvite) { void copyStudentInvite(copyInvite.dataset.copyInvite); return; }
  const resetInvite = event.target.closest("[data-reset-invite]");
  if (resetInvite) { void resetCourseStudentInvite(state.activeTeacherCourse?.courseId, resetInvite.dataset.resetInvite).catch((error) => showToast(error.message || "重置失败")); return; }
  const editStudent = event.target.closest("[data-edit-student]");
  if (editStudent) {
    const entry = (state.activeTeacherCourse?.students || []).find((item) => item.studentId === editStudent.dataset.editStudent);
    if (entry) openAddStudentDialog(entry);
    return;
  }
  const removeStudentCourse = event.target.closest("[data-remove-student-course]");
  if (removeStudentCourse) {
    void removeCourseStudentEntry(state.activeTeacherCourse?.courseId, removeStudentCourse.dataset.removeStudentCourse)
      .then(() => { showToast("已移除该学生"); return refreshActiveCourseStudents(); })
      .catch((error) => showToast(error.message || "移除失败"));
    return;
  }
  if (event.target.closest("[data-add-student-close]")) { elements.addStudentDialog.close(); return; }
  if (event.target.closest("[data-action='open-add-student']")) { openAddStudentDialog(); return; }
  const confirmStudent = event.target.closest("[data-action='confirm-student']");
  if (confirmStudent) { confirmEnrollment(confirmStudent.dataset.id); return; }
  const removeStudent = event.target.closest("[data-action='remove-student']");
  if (removeStudent) { removeEnrollment(removeStudent.dataset.id); return; }
  if (event.target.closest("[data-confirm-cancel]")) { elements.confirmDialog.close(); pendingRemoveEnrollment = null; return; }
  if (event.target.closest("[data-confirm-ok]")) { confirmPendingRemoveEnrollment(); return; }
  const teacherTab = event.target.closest("[data-teacher-tab]")?.dataset.teacherTab;
  if (teacherTab) { showTeacherTab(teacherTab); return; }
  const adminTab = event.target.closest("[data-admin-tab]")?.dataset.adminTab;
  if (adminTab) { showAdminTab(adminTab); return; }
  if (event.target.closest("[data-action='open-add-teacher']")) { elements.addTeacherForm.hidden = false; elements.addTeacherForm.querySelector('[name="teacherName"]')?.focus(); return; }
  if (event.target.closest("[data-action='cancel-add-teacher']")) { elements.addTeacherForm.hidden = true; elements.addTeacherForm.reset(); return; }
  const removeTeacherBtn = event.target.closest("[data-remove-teacher]");
  if (removeTeacherBtn) { void removeAdminTeacher(removeTeacherBtn.dataset.removeTeacher); return; }
  const toggleTeacher = event.target.closest("[data-action='toggle-teacher']");
  if (toggleTeacher) { void toggleTeacherActive(toggleTeacher.dataset.id); return; }
  const copyTeacherInviteBtn = event.target.closest("[data-copy-teacher-invite]");
  if (copyTeacherInviteBtn) { void copyAdminTeacherInvite(copyTeacherInviteBtn.dataset.copyTeacherInvite); return; }
  const resetTeacherInviteBtn = event.target.closest("[data-reset-teacher-invite]");
  if (resetTeacherInviteBtn) { void resetAdminTeacherInvite(resetTeacherInviteBtn.dataset.resetTeacherInvite); return; }
  const togglePublish = event.target.closest("[data-action='toggle-publish']");
  if (togglePublish) { toggleBookPublish(togglePublish.dataset.id); return; }
  const resetPublish = event.target.closest("[data-action='reset-publish']");
  if (resetPublish) { resetBookPublish(resetPublish.dataset.id); return; }
  const refreshReview = event.target.closest("[data-action='refresh-review']");
  if (refreshReview) { void refreshReviewForLesson(refreshReview.dataset.id).then(() => renderAdminReview()).catch(() => { showToast("统计失败，请检查网络或数据文件"); }); return; }
  if (event.target.closest("[data-action='review-refresh-all']")) { void refreshAllReview(); return; }
  const toggleReview = event.target.closest("[data-action='toggle-review']");
  if (toggleReview) { toggleLessonReview(toggleReview.dataset.id); return; }
  const unavailableLesson = event.target.closest("[data-unavailable-lesson]")?.dataset.unavailableLesson;
  if (unavailableLesson) showToast(`第${unavailableLesson}课内容尚未接入`);
});

elements.profileButton.addEventListener("click", () => openAuth("student-login"));
if (elements.logoutButton) elements.logoutButton.addEventListener("click", () => { void handleLogout(); });
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
elements.addStudentDialog.addEventListener("click", (event) => { if (event.target === elements.addStudentDialog) elements.addStudentDialog.close(); });
elements.confirmDialog.addEventListener("click", (event) => { if (event.target === elements.confirmDialog) { elements.confirmDialog.close(); pendingRemoveEnrollment = null; } });
[["roleDialog", "header"], ["courseDialog", "header"], ["addStudentDialog", "header"], ["confirmDialog", "header"], ["newCourseDialog", "header"]].forEach(([key, handle]) => {
  if (elements[key]) window.attachDraggable?.({ element: elements[key], handle });
});
elements.addStudentDialog.addEventListener("close", () => { elements.addStudentForm.reset(); state.pendingEditStudent = null; });
elements.newCourseDialog.addEventListener("click", (event) => { if (event.target === elements.newCourseDialog) elements.newCourseDialog.close(); });
elements.newCourseForm.addEventListener("submit", (event) => {
  event.preventDefault();
  void createTeacherCourseByForm(event.currentTarget).catch((error) => showToast(error.message || "创建失败"));
});
elements.studentExcelInput.addEventListener("change", () => {
  const file = elements.studentExcelInput.files?.[0];
  if (!file) return;
  void importStudentExcel(file).catch((error) => showToast(error.message || "导入失败")).finally(() => { elements.studentExcelInput.value = ""; });
});
elements.addStudentForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const data = new FormData(event.currentTarget);
  void (async () => {
    try {
      if (state.pendingEditStudent) {
        const result = await updateCourseStudentByForm(data);
        elements.addStudentDialog.close();
        state.pendingEditStudent = null;
        showToast(`已更新学生 ${result.studentId} / Student updated`);
      } else if (state.activeTeacherCourse) {
        const result = await addCourseStudentByForm(data);
        elements.addStudentDialog.close();
        showToast(`已添加学生，邀请码：${result.inviteCode}`);
      } else {
        const enrollment = addStudentByTeacher(data.get("chineseName").trim(), data.get("studentId").trim(), data.get("englishName").trim());
        elements.addStudentDialog.close();
        showToast(`已添加并确认 ${enrollment.chineseName} 加入本班`);
      }
      await refreshActiveCourseStudents();
    } catch (error) {
      showToast(error.message || "添加失败");
    }
  })();
});
elements.addTeacherForm.addEventListener("submit", (event) => {
  event.preventDefault();
  void (async () => {
    try {
      const result = await handleAddTeacherForm(event.currentTarget);
      event.currentTarget.reset();
      event.currentTarget.hidden = true;
      showToast(`已新增教师 ${result.name}，邀请码：${result.inviteCode || "—"}`);
      renderAdminView();
    } catch (error) {
      showToast(error.message || "添加失败");
    }
  })();
});
document.addEventListener("change", (event) => {
  const publishAvailable = event.target.closest("[data-publish-available]")?.dataset.publishAvailable;
  if (publishAvailable) setPublishAvailable(publishAvailable, Number(event.target.value));
});

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
