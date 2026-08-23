const terms = ["2026 Fall", "2027 Spring", "2027 Fall", "2028 Spring", "2028 Fall"];
const defaultTeacher = "曹丹丹";
const administrator = "鄢清华";
const TEST_STUDENT_ACCOUNT = "test";
const TEST_INVITE_CODE = "123456";
const REVIEW_DATA_FILES = ["lesson-content.json", "lesson-practice.json", "pronunciation.json", "practice-translations.json", "text-notes.json", "vocabulary-metadata.json"];
const REVIEW_LANGUAGE_CODES = new Set(["zh", "pinyin", "en", "es", "fr", "id", "ja", "ko", "lo", "ms", "my", "ru", "th", "vi"]);
const languageShortLabels = {
  zh: "中文", pinyin: "拼音", en: "英语", es: "西语", fr: "法语", id: "印尼语", ja: "日语", ko: "韩语",
  lo: "老挝语", ms: "马来语", my: "缅甸语", ru: "俄语", th: "泰语", vi: "越南语",
};

function defaultTeacherRegistry() {
  return [{ id: "teacher-seed", account: defaultTeacher, name: defaultTeacher, active: true, createdAt: new Date().toISOString() }];
}

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
  teachers: readStored("learningHubTeachers", defaultTeacherRegistry()),
  publishing: readStored("learningHubPublishing", {}),
  contentReview: readStored("learningHubContentReview", {}),
  teacherContext: { teacher: "", term: terms[0], book: "intermediate-comprehensive-1" },
  studentProfile: null,
  authenticationOptions: { student: null, teacher: null },
};

let pendingRemoveEnrollment = null;

const viewLabels = { home: "首页", courses: "我的课程", writing: "写作专区", games: "趣味游戏", progress: "学习记录", teacher: "教学工作台", admin: "系统管理" };

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
  if (view === "writing") window.WritingZone?.render();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function renderCatalog() {
  const query = state.search.trim().toLowerCase();
  const level = catalog.find((item) => item.id === state.openLevel) || catalog[1];
  const visibleBooks = level.books.filter(([, label]) => !query || `发展汉语 ${label}`.toLowerCase().includes(query));
  document.querySelectorAll("[data-course-level]").forEach((button) => button.classList.toggle("active", button.dataset.courseLevel === level.id));
  elements.levelCatalog.innerHTML = visibleBooks.length
    ? `<div class="course-book-grid">${visibleBooks.map(([id, label]) => {
      const learningBook = learningBooks[id];
      const available = effectiveAvailable(id);
      const open = effectiveBookOpen(id);
      return `<button class="book-choice${state.selectedBookId === id ? " active" : ""}" type="button" data-select-book="${id}"><span>《发展汉语·${label}》</span><small>${learningBook ? (open ? `第1-${available}课可学习` : "暂未开放课程") : (open ? "已开放 · 内容准备中" : "未开放")}</small></button>`;
    }).join("")}</div>`
    : '<p class="empty-state">没有找到符合条件的教材。</p>';
  renderCourseDialogLessons();
}

function renderCourseDialogLessons() {
  const book = bookById(state.selectedBookId);
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
    const inner = `<span>${String(index + 1).padStart(2, "0")}</span><span><strong>${title}</strong><small>${available ? learningBook.contentLabel : "内容准备中"}</small></span><b>${available ? "进入 ›" : "未开放"}</b>`;
    return available ? `<a class="lesson-item available" href="../digital-book/?lesson=${learningBook.lessonPrefix}-${lessonNumber}">${inner}</a>` : `<button class="lesson-item" type="button" data-unavailable-lesson="${lessonNumber}">${inner}</button>`;
  }).join("");
}

function selectBook(id) {
  const book = bookById(id);
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
    if (profile.bookId && learningBooks[bookById(profile.bookId).id]) selectBook(profile.bookId);
    return;
  }
  if (profile.role === "teacher") {
    state.teacherContext = { teacher: profile.teacher || profile.name, term: profile.term || terms[0], book: profile.bookId || "intermediate-comprehensive-1" };
    applyIdentity("teacher", profile.teacher || profile.name);
    if (profile.bookId && learningBooks[bookById(profile.bookId).id]) selectBook(profile.bookId);
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
  return `<div class="student-row"><span><strong>${escapeHtml(student.chineseName)}${student.englishName ? ` · ${escapeHtml(student.englishName)}` : ""}</strong><small>学号 ${escapeHtml(student.studentId)} · ${sourceLabel}${pending ? " · 待确认" : ""}</small></span><span class="student-row-actions">${pending ? `<button class="confirm-button" type="button" data-action="confirm-student" data-id="${escapeHtml(student.id)}">确认加入</button>` : ""}<button class="danger-button" type="button" data-action="remove-student" data-id="${escapeHtml(student.id)}">移除</button></span></div>`;
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
  let enrollment;
  const existing = window.LearningApi?.isConfigured() ? null : findStudentEnrollment(profile.userId, profile.teacher);
  const joinedAt = new Date().toISOString();
  if (existing) {
    enrollment = { ...existing, joinedAt: existing.joinedAt, updatedAt: joinedAt, status: existing.status || "confirmed", source: existing.source || "self" };
  } else {
    enrollment = {
      id: `student-${profile.userId}-${profile.classId || profile.term}-${profile.bookId}`,
      chineseName: profile.name || profile.userId,
      englishName: profile.englishName || "",
      studentId: profile.userId,
      classId: profile.classId || "",
      className: profile.className || "",
      term: profile.term,
      teacher: profile.teacher,
      book: profile.bookId,
      status: "pending",
      source: "self",
      joinedAt,
      updatedAt: joinedAt,
    };
  }
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
  showToast(enrollment.status === "pending"
    ? "已提交加入申请，等待教师确认 / Pending teacher approval"
    : `已进入 ${enrollment.term} · 发展汉语·${bookById(enrollment.book).label}`);
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
  if (inviteCode !== TEST_INVITE_CODE) throw new Error("邀请码不正确");
  if (role === "student") {
    if (!account) throw new Error("请输入学号或姓名");
    return {
      account: { id: account, name: "测试学生", englishName: "Test" },
      contexts: [{ id: `local-class:${books[0].id}`, classId: "local-class", className: "本地测试班", teacher: defaultTeacher, term: terms[0], bookId: books[0].id }],
    };
  }
  if (role === "teacher") {
    const teacherRecord = state.teachers.find((item) => item.account === account);
    if (!teacherRecord) throw new Error("教师账号未开通，请联系管理员");
    if (!teacherRecord.active) throw new Error("该教师账号已停用，请联系管理员");
    const teacher = teacherRecord.name || account;
    return {
      account: { id: account, name: teacher, englishName: "" },
      contexts: [{ id: `local-class:${books[0].id}`, classId: "local-class", className: "本地测试班", teacher, term: terms[0], bookId: books[0].id }],
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
  const pendingStudents = students.filter((student) => student.status === "pending");
  const confirmedStudents = students.filter((student) => student.status !== "pending");
  elements.classStudentCount.textContent = `${students.length}人`;
  elements.classStudentList.innerHTML = `<div class="class-list-toolbar"><span>已确认 <b>${confirmedStudents.length}</b> · 待确认 <b>${pendingStudents.length}</b></span><button class="quiet-button" type="button" data-action="open-add-student">＋ 新增学生</button></div>${pendingStudents.length ? `<div class="class-subgroup"><header>待确认 <small>学生用邀请码自助加入，需确认后生效</small></header>${pendingStudents.map((student) => renderStudentRow(student, true)).join("")}</div>` : ""}${confirmedStudents.length ? `<div class="class-subgroup"><header>已确认</header>${confirmedStudents.map((student) => renderStudentRow(student, false)).join("")}</div>` : ""}${!students.length ? '<p class="empty-approval">还没有学生。点“＋新增学生”录入名单，或让学生用邀请码自助加入。</p>' : ""}`;
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

function showAdminTab(tab) {
  document.querySelectorAll("[data-admin-tab]").forEach((button) => button.classList.toggle("active", button.dataset.adminTab === tab));
  document.querySelectorAll("[data-admin-panel]").forEach((panel) => {
    const active = panel.dataset.adminPanel === tab;
    panel.hidden = !active;
    panel.classList.toggle("active", active);
  });
}

function renderAdminView() {
  renderAdminUsers();
  renderAdminPublishing();
  renderAdminReview();
}

function renderAdminUsers() {
  const activeCount = state.teachers.filter((teacher) => teacher.active).length;
  elements.teacherCount.textContent = `${state.teachers.length} 个账号 · ${activeCount} 个启用`;
  elements.adminTeacherList.innerHTML = state.teachers.length
    ? state.teachers.map((teacher) => `<div class="admin-row"><span><strong>${escapeHtml(teacher.name)}</strong><small>登录账号 ${escapeHtml(teacher.account)} · ${teacher.active ? "已启用" : "已停用"} · ${new Date(teacher.createdAt).toLocaleDateString() || ""} 开通</small></span><button class="quiet-button" type="button" data-action="toggle-teacher" data-id="${escapeHtml(teacher.id)}">${teacher.active ? "停用" : "启用"}</button></div>`).join("")
    : '<p class="empty-approval">还没有教师账号，请点击“新增教师”。</p>';
}

function renderAdminPublishing() {
  elements.adminPublishingList.innerHTML = catalog.map((level) => `<div class="publish-level"><h3>${level.label}</h3><div class="admin-list">${level.books.map(([id, label]) => {
    const learningBook = learningBooks[id];
    const isOpen = effectiveBookOpen(id);
    const available = effectiveAvailable(id);
    const total = learningBook ? learningBook.lessons.length : 0;
    return `<div class="admin-row publish-row"><span><strong>《发展汉语·${label}》</strong><small>${learningBook ? `共 ${total} 课 · 当前开放 ${available} 课` : "内容尚未接入，仅可开放入口"}</small></span><span class="publish-controls">${learningBook ? `<label><span>开放课数</span><select data-publish-available="${id}">${Array.from({ length: total }, (_, index) => index + 1).map((count) => `<option value="${count}"${count === available ? " selected" : ""}>${count}课</option>`).join("")}</select></label><button class="quiet-button" type="button" data-action="reset-publish" data-id="${id}">默认</button>` : ""}<button class="switch-button${isOpen ? " on" : ""}" type="button" data-action="toggle-publish" data-id="${id}" role="switch" aria-checked="${isOpen}"><i></i><span>${isOpen ? "已开放" : "未开放"}</span></button></span></div>`;
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
      return `<div class="admin-row review-row"><span><strong>第${index + 1}课 · ${escapeHtml(title)}</strong><small>${badges || '<span class="muted">尚未统计语种覆盖</span>'}</small></span><span class="review-controls"><button class="quiet-button" type="button" data-action="refresh-review" data-id="${lessonId}">刷新统计</button><button class="review-toggle${record.reviewed ? " on" : ""}" type="button" data-action="toggle-review" data-id="${lessonId}">${record.reviewed ? "已审核 ✓" : "标记通过"}</button></span></div>`;
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

function addTeacher(name, account) {
  if (!name || !account) throw new Error("教师姓名和登录账号不能为空");
  if (state.teachers.some((item) => item.account === account)) throw new Error("该登录账号已存在");
  state.teachers.push({ id: `teacher-${Date.now()}`, account, name, active: true, createdAt: new Date().toISOString() });
  saveTeachers();
  renderAdminUsers();
}

function toggleTeacherActive(id) {
  const teacher = state.teachers.find((item) => item.id === id);
  if (!teacher) return;
  teacher.active = !teacher.active;
  saveTeachers();
  renderAdminUsers();
  showToast(teacher.active ? `已启用教师 ${teacher.name}` : `已停用教师 ${teacher.name}`);
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
  if (event.target.closest("[data-add-student-close]")) { elements.addStudentDialog.close(); return; }
  if (event.target.closest("[data-action='open-add-student']")) { openAddStudentDialog(); return; }
  const confirmStudent = event.target.closest("[data-action='confirm-student']");
  if (confirmStudent) { confirmEnrollment(confirmStudent.dataset.id); return; }
  const removeStudent = event.target.closest("[data-action='remove-student']");
  if (removeStudent) { removeEnrollment(removeStudent.dataset.id); return; }
  if (event.target.closest("[data-confirm-cancel]")) { elements.confirmDialog.close(); pendingRemoveEnrollment = null; return; }
  if (event.target.closest("[data-confirm-ok]")) { confirmPendingRemoveEnrollment(); return; }
  const adminTab = event.target.closest("[data-admin-tab]")?.dataset.adminTab;
  if (adminTab) { showAdminTab(adminTab); return; }
  if (event.target.closest("[data-action='open-add-teacher']")) { elements.addTeacherForm.hidden = false; elements.addTeacherForm.querySelector('[name="teacherName"]')?.focus(); return; }
  if (event.target.closest("[data-action='cancel-add-teacher']")) { elements.addTeacherForm.hidden = true; elements.addTeacherForm.reset(); return; }
  const toggleTeacher = event.target.closest("[data-action='toggle-teacher']");
  if (toggleTeacher) { toggleTeacherActive(toggleTeacher.dataset.id); return; }
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
[["roleDialog", "header"], ["courseDialog", "header"], ["addStudentDialog", "header"], ["confirmDialog", "header"]].forEach(([key, handle]) => {
  if (elements[key]) window.attachDraggable?.({ element: elements[key], handle });
});
elements.addStudentDialog.addEventListener("close", () => { elements.addStudentForm.reset(); });
elements.addStudentForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const data = new FormData(event.currentTarget);
  try {
    const enrollment = addStudentByTeacher(data.get("chineseName").trim(), data.get("studentId").trim(), data.get("englishName").trim());
    elements.addStudentDialog.close();
    showToast(`已添加并确认 ${enrollment.chineseName} 加入本班`);
  } catch (error) {
    showToast(error.message || "添加失败");
  }
});
elements.addTeacherForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const data = new FormData(event.currentTarget);
  try {
    addTeacher(data.get("teacherName").trim(), data.get("teacherAccount").trim());
    event.currentTarget.reset();
    event.currentTarget.hidden = true;
    showToast("已新增教师账号");
  } catch (error) {
    showToast(error.message || "添加失败");
  }
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
