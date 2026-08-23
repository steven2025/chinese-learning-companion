(function () {
  "use strict";

  const TRACKED_TYPES = new Set(["choice", "fillBlank", "dialogueFill", "wordBankFill", "readingCloze"]);
  const SUBJECTIVE_TYPES = new Set(["rewrite", "openDialogue", "shortAnswer", "personalReflection", "guidedProduction", "guidedWriting", "dialogueCompletion", "cultureComparison", "needsReview"]);
  const DIMENSION_LABELS = Object.freeze({ taskCompletion: "任务完成", targetVocabulary: "目标词汇", contentStructure: "内容结构", chineseExpression: "汉语表达" });
  const lessonNames = {
    "zjzh-1-1": "第1课 · 你咋不早说",
    "zjzh-1-2": "第2课 · 和时间赛跑",
    "zjzh-1-3": "第3课 · 租房那些事",
    "zjzh-1-4": "第4课 · 老舍小时候的故事",
  };
  const elements = {
    panel: document.querySelector("#teacherPracticePanel"),
    lesson: document.querySelector("#practiceReportLesson"),
    refresh: document.querySelector("#refreshPracticeReport"),
    status: document.querySelector("#practiceReportStatus"),
    content: document.querySelector("#practiceReportContent"),
    tabs: [...document.querySelectorAll("[data-learning-report]")],
    kindTabs: document.querySelector("#practiceKindTabs"),
    kindButtons: [...document.querySelectorAll("[data-practice-kind]")],
  };
  let loading = false;
  let pendingLoad = false;
  let mode = "vocabulary";
  let practiceKind = "objective";
  let currentReport = null;
  const reportCache = new Map();

  function escapeHtml(value) {
    return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
  }

  function percent(value) {
    return value === null || value === undefined ? "—" : `${Number(value).toFixed(Number(value) % 1 ? 1 : 0)}%`;
  }

  function practiceCatalog(data) {
    const items = [];
    let questionNumber = 0;
    (data.sections || []).forEach((section) => {
      const groups = Array.isArray(section.groups) && section.groups.length ? section.groups : [{ id: "", title: "", items: section.items || [] }];
      groups.forEach((group) => {
        (group.items || []).forEach((item) => {
          questionNumber += 1;
          const explicit = Number.parseInt(item.displayNumber, 10);
          const resolved = Number.isFinite(explicit) ? explicit : questionNumber;
          questionNumber = Math.max(questionNumber, resolved);
          if (!TRACKED_TYPES.has(item.type)) return;
          items.push({
            itemId: item.id,
            itemType: item.type,
            sectionId: section.id,
            sectionTitle: section.title,
            groupId: group.id || "",
            groupTitle: group.title || "",
            questionNumber: resolved,
          });
        });
      });
    });
    return items;
  }

  function subjectiveCatalog(data) {
    const items = [];
    let questionNumber = 0;
    (data.sections || []).forEach((section) => {
      const groups = Array.isArray(section.groups) && section.groups.length ? section.groups : [{ id: "", title: "", items: section.items || [] }];
      groups.forEach((group) => {
        (group.items || []).forEach((item) => {
          questionNumber += 1;
          const explicit = Number.parseInt(item.displayNumber, 10);
          const resolved = Number.isFinite(explicit) ? explicit : questionNumber;
          questionNumber = Math.max(questionNumber, resolved);
          if (!SUBJECTIVE_TYPES.has(item.type)) return;
          items.push({ itemId: item.id, itemType: item.type, sectionId: section.id, sectionTitle: section.title, groupId: group.id || "", groupTitle: group.title || "", questionNumber: resolved });
        });
      });
    });
    return items;
  }

  function vocabularyCatalog(data) {
    return (data.entries || []).map((word, index) => ({
      wordId: word.id,
      hanzi: word.hanzi,
      pinyin: word.pinyin,
      order: Number(word.order || index + 1),
    }));
  }

  function textCatalog(data) {
    return (data.cues || []).filter((cue) => cue.role === "sentence").map((cue, index) => ({
      unitId: cue.id,
      label: cue.texts?.["zh-CN"] || "",
      order: index + 1,
    }));
  }

  function metric(label, value, note) {
    return `<div class="practice-metric"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong><small>${escapeHtml(note)}</small></div>`;
  }

  function studentTableDefinition(report) {
    const students = report.students || [];
    if (mode === "vocabulary") return {
      headers: ["学生", "学号", "已学词语", "覆盖率", "播放", "已掌握", "待复习"],
      rows: students.map((item) => [item.name || item.englishName, item.studentId, item.studiedCount, percent(item.coverageRate), item.playedCount, item.masteredCount, item.reviewCount]),
    };
    if (mode === "text") return {
      headers: ["学生", "学号", "已学句子", "句子覆盖率", "已播放", "跟读单元", "测评单元", "平均分"],
      rows: students.map((item) => [item.name || item.englishName, item.studentId, item.studiedSentenceCount, percent(item.sentenceCoverageRate), item.playedSentenceCount, item.recordedUnitCount, item.assessedUnitCount, score(item.averageScore)]),
    };
    if (practiceKind === "subjective") return {
      headers: ["学生", "学号", "已完成", "完成率", "AI评价", "AI覆盖", "平均分", "薄弱维度"],
      rows: students.map((item) => [item.name || item.englishName, item.studentId, item.completedCount, percent(item.completionRate), item.assessedCount, percent(item.assessmentCoverageRate), score(item.averageScore), item.weakestDimension ? `${DIMENSION_LABELS[item.weakestDimension.key]} ${item.weakestDimension.score}` : "—"]),
    };
    return {
      headers: ["学生", "学号", "已完成", "完成率", "首次正确率", "当前正确率", "平均尝试"],
      rows: students.map((item) => [item.name || item.englishName, item.studentId, item.completedCount, percent(item.completionRate), percent(item.firstAttemptAccuracy), percent(item.latestAccuracy), item.averageAttempts]),
    };
  }

  function appendStudentDetails(report) {
    currentReport = report;
    const table = studentTableDefinition(report);
    elements.content.insertAdjacentHTML("beforeend", `
      <details class="student-report-details">
        <summary><span>查看学生明细 <small>Student details</small></span><button type="button" data-export-students title="导出当前学生明细 / Export current student details">↓ 导出 <small>Export CSV</small></button></summary>
        <div class="student-report-table" style="--student-columns:${table.headers.length}">
          <div class="student-report-head">${table.headers.map((header) => `<span>${escapeHtml(header)}</span>`).join("")}</div>
          ${table.rows.map((row) => `<div>${row.map((cell) => `<span>${escapeHtml(cell)}</span>`).join("")}</div>`).join("") || `<p class="practice-empty">本班还没有学生名单。</p>`}
        </div>
      </details>`);
  }

  function csvCell(value) {
    return `"${String(value ?? "").replaceAll('"', '""')}"`;
  }

  function exportStudentDetails() {
    if (!currentReport) return;
    const table = studentTableDefinition(currentReport);
    const csv = [table.headers, ...table.rows].map((row) => row.map(csvCell).join(",")).join("\r\n");
    const blob = new Blob(["\ufeff", csv], { type: "text/csv;charset=utf-8" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    const type = mode === "practice" ? `${practiceKind}-practice` : mode;
    link.download = `${elements.lesson.value}-${type}-students.csv`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(link.href), 500);
  }

  function renderPracticeReport(report) {
    const summary = report.summary || {};
    const focus = report.focusItems || [];
    const sections = report.sections || [];
    elements.content.innerHTML = `
      <div class="practice-metrics">
        ${metric("参与学生", `${summary.activeStudentCount || 0}/${summary.studentCount || 0}`, "Active / Class")}
        ${metric("整体完成率", percent(summary.completionRate), `${summary.expectedItemCount || 0}道客观题`)}
        ${metric("当前正确率", percent(summary.latestAccuracy), "Latest accuracy")}
        ${metric("首次正确率", percent(summary.firstAttemptAccuracy), `平均尝试 ${summary.averageAttempts || 0}次`)}
      </div>
      <section class="practice-focus">
        <header><div><span>优先讲解</span><h3>课堂先看这几题</h3></div><small>按当前正确率排序</small></header>
        ${focus.length ? `<div class="practice-focus-list">${focus.map((item, index) => `
          <div><b>${index + 1}</b><span><strong>第${item.questionNumber || "—"}题 · ${escapeHtml(item.sectionTitle)}</strong><small>${item.attemptedStudents}人作答 · 平均${item.averageAttempts}次</small></span><em>${percent(item.latestAccuracy)}</em></div>
        `).join("")}</div>` : `<p class="practice-empty">还没有学生提交本课客观题。</p>`}
      </section>
      <details class="practice-section-details">
        <summary>查看各大题明细 <small>Section details</small></summary>
        <div class="practice-section-list">${sections.map((section) => `
          <details>
            <summary><span><strong>${escapeHtml(section.sectionTitle)}</strong><small>${section.itemCount}题 · 完成率 ${percent(section.completionRate)}</small></span><b>${percent(section.latestAccuracy)}</b></summary>
            <div class="practice-item-table">
              <div class="practice-item-head"><span>题目</span><span>作答人数</span><span>首次</span><span>当前</span></div>
              ${section.items.map((item) => `<div><span>第${item.questionNumber || "—"}题</span><span>${item.attemptedStudents}</span><span>${percent(item.firstAttemptAccuracy)}</span><strong>${percent(item.latestAccuracy)}</strong></div>`).join("")}
            </div>
          </details>
        `).join("")}</div>
      </details>`;
  }

  function score(value) {
    return value === null || value === undefined ? "—" : `${Number(value).toFixed(Number(value) % 1 ? 1 : 0)}分`;
  }

  function renderSubjectivePracticeReport(report) {
    const summary = report.summary || {};
    const focus = report.focusItems || [];
    const sections = report.sections || [];
    const dimensions = report.dimensions || {};
    elements.content.innerHTML = `
      <div class="practice-metrics">
        ${metric("参与学生", `${summary.activeStudentCount || 0}/${summary.studentCount || 0}`, "Active / Class")}
        ${metric("整体完成率", percent(summary.completionRate), `${summary.expectedItemCount || 0}道主观题`)}
        ${metric("AI评价覆盖", percent(summary.assessmentCoverageRate), `${summary.assessedCount || 0}份已评价`)}
        ${metric("AI平均分", score(summary.averageScore), "仅统计已评价作答")}
      </div>
      <section class="subjective-dimensions" aria-label="主观题评价维度">
        <header><div><span>能力维度</span><h3>班级表现概览</h3></div><small>AI assessment dimensions</small></header>
        <div>${Object.entries(DIMENSION_LABELS).map(([key, label]) => `<article><span><b>${label}</b><em>${score(dimensions[key])}</em></span><i><u style="width:${Number(dimensions[key] || 0)}%"></u></i></article>`).join("")}</div>
      </section>
      <section class="practice-focus subjective-focus">
        <header><div><span>优先关注</span><h3>需要课堂支持的题目</h3></div><small>综合AI均分与完成率</small></header>
        ${focus.length ? `<div class="practice-focus-list">${focus.map((item, index) => `
          <div><b>${index + 1}</b><span><strong>第${item.questionNumber || "—"}题 · ${escapeHtml(item.sectionTitle)}</strong><small>${item.completedStudents}人完成 · ${item.assessedCount}份AI评价</small></span><em>${score(item.averageScore)}</em></div>
        `).join("")}</div>` : `<p class="practice-empty">还没有学生提交本课主观题。</p>`}
      </section>
      <details class="practice-section-details">
        <summary>查看各大题明细 <small>Section details</small></summary>
        <div class="practice-section-list">${sections.map((section) => `
          <details>
            <summary><span><strong>${escapeHtml(section.sectionTitle)}</strong><small>${section.itemCount}题 · 完成率 ${percent(section.completionRate)} · ${section.assessedCount}份AI评价</small></span><b>${score(section.averageScore)}</b></summary>
            <div class="practice-item-table subjective-item-table">
              <div class="practice-item-head"><span>题目</span><span>完成人数</span><span>AI覆盖</span><span>均分</span><span>薄弱维度</span></div>
              ${section.items.map((item) => `<div><span>第${item.questionNumber || "—"}题</span><span>${item.completedStudents}</span><span>${percent(item.assessmentCoverageRate)}</span><strong>${score(item.averageScore)}</strong><span>${item.weakestDimension ? `${DIMENSION_LABELS[item.weakestDimension.key]} ${item.weakestDimension.score}` : "—"}</span></div>`).join("")}
            </div>
          </details>
        `).join("")}</div>
      </details>`;
  }

  function renderVocabularyReport(report) {
    const summary = report.summary || {};
    const focus = report.focusWords || [];
    const words = report.words || [];
    elements.content.innerHTML = `
      <div class="practice-metrics">
        ${metric("参与学生", `${summary.activeStudentCount || 0}/${summary.studentCount || 0}`, "Active / Class")}
        ${metric("词汇覆盖率", percent(summary.coverageRate), `${summary.expectedWordCount || 0}个词语`)}
        ${metric("班级掌握率", percent(summary.masteryRate), "Marked mastered")}
        ${metric("待复习标记", `${summary.reviewCount || 0}次`, `人均接触 ${summary.averageStudiedWords || 0}词`)}
      </div>
      <section class="practice-focus vocabulary-focus">
        <header><div><span>共性难词</span><h3>课堂优先复习</h3></div><small>综合待复习人数与掌握率</small></header>
        ${focus.length ? `<div class="vocabulary-focus-list">${focus.map((word, index) => `
          <div><b>${index + 1}</b><span><strong>${escapeHtml(word.hanzi)}</strong><small>${escapeHtml(word.pinyin)} · ${word.studiedStudents}人接触</small></span><em>${word.reviewStudents}人待复习</em></div>
        `).join("")}</div>` : `<p class="practice-empty">${summary.activeStudentCount ? "目前没有学生标记需要复习的词语。" : "还没有学生产生本课词汇学习记录。"}</p>`}
      </section>
      <details class="practice-section-details">
        <summary>查看词汇明细 <small>Vocabulary details</small></summary>
        <div class="practice-item-table vocabulary-item-table">
          <div class="practice-item-head"><span>词语</span><span>接触</span><span>播放</span><span>掌握</span><span>复习</span></div>
          ${words.map((word) => `<div><span><strong>${escapeHtml(word.hanzi)}</strong><small>${escapeHtml(word.pinyin)}</small></span><span>${word.studiedStudents}</span><span>${word.playedStudents}</span><span>${word.masteredStudents}</span><strong>${word.reviewStudents}</strong></div>`).join("")}
        </div>
      </details>`;
  }

  function renderTextReport(report) {
    const summary = report.summary || {};
    const focus = report.focusSentences || [];
    const sentences = (report.sentences || []).filter((item) => item.studiedStudents > 0);
    const paragraphs = report.paragraphs || [];
    elements.content.innerHTML = `
      <div class="practice-metrics">
        ${metric("参与学生", `${summary.activeStudentCount || 0}/${summary.studentCount || 0}`, "Active / Class")}
        ${metric("句子覆盖率", percent(summary.sentenceCoverageRate), `${summary.expectedSentenceCount || 0}句 · 播放${percent(summary.listeningRate)}`)}
        ${metric("跟读参与率", percent(summary.repeatParticipationRate), "Sentence / Paragraph")}
        ${metric("测评平均分", summary.averageScore === null || summary.averageScore === undefined ? "—" : `${summary.averageScore}分`, `${summary.assessedUnitCount || 0}个测评记录`)}
      </div>
      <section class="practice-focus text-focus">
        <header><div><span>跟读薄弱句</span><h3>课堂优先示范</h3></div><small>按口语测评平均分排序</small></header>
        ${focus.length ? `<div class="text-focus-list">${focus.map((item, index) => `
          <div><b>${index + 1}</b><span><strong>第${item.order}句 · ${escapeHtml(item.label)}</strong><small>${item.assessedStudents}人测评 · ${item.recordedStudents}人跟读</small></span><em>${item.averageScore}分</em></div>
        `).join("")}</div>` : `<p class="practice-empty">${summary.activeStudentCount ? "目前还没有可比较的句子口语测评。" : "还没有学生产生本课课文学习记录。"}</p>`}
      </section>
      <details class="practice-section-details">
        <summary>查看跟读明细 <small>Reading details</small></summary>
        ${paragraphs.length ? `<h4 class="text-detail-title">段落跟读</h4><div class="practice-item-table text-item-table">
          <div class="practice-item-head"><span>段落</span><span>接触</span><span>播放</span><span>跟读</span><span>均分</span></div>
          ${paragraphs.map((item) => `<div><span>${escapeHtml(item.label)}</span><span>${item.studiedStudents}</span><span>${item.playedStudents}</span><span>${item.recordedStudents}</span><strong>${item.averageScore === null ? "—" : item.averageScore}</strong></div>`).join("")}
        </div>` : ""}
        <h4 class="text-detail-title">已学习句子</h4>
        ${sentences.length ? `<div class="practice-item-table text-item-table">
          <div class="practice-item-head"><span>句子</span><span>接触</span><span>播放</span><span>跟读</span><span>均分</span></div>
          ${sentences.map((item) => `<div><span><strong>第${item.order}句</strong><small>${escapeHtml(item.label)}</small></span><span>${item.studiedStudents}</span><span>${item.playedStudents}</span><span>${item.recordedStudents}</span><strong>${item.averageScore === null ? "—" : item.averageScore}</strong></div>`).join("")}
        </div>` : `<p class="practice-empty">尚无已学习句子。</p>`}
      </details>`;
  }

  function renderCurrentReport(report) {
    if (mode === "vocabulary") renderVocabularyReport(report);
    else if (mode === "text") renderTextReport(report);
    else if (practiceKind === "subjective") renderSubjectivePracticeReport(report);
    else renderPracticeReport(report);
    appendStudentDetails(report);
  }

  async function load(force = false) {
    const profile = window.LearningApi?.profile?.();
    if (profile?.role !== "teacher") return;
    const courseId = window.__activeTeacherCourseId || "";
    if (!courseId) {
      elements.status.textContent = "请先在“教学工作台”打开一门课程，再查看班级学情。";
      elements.content.innerHTML = "";
      return;
    }
    const lessonId = elements.lesson.value;
    const loadKey = `${mode}:${practiceKind}:${lessonId}`;
    if (loading) {
      pendingLoad = true;
      return;
    }
    if (!force && reportCache.has(loadKey)) {
      const cached = reportCache.get(loadKey);
      renderCurrentReport(cached);
      elements.status.textContent = `${lessonNames[lessonId]} · 更新于 ${new Date(cached.generatedAt).toLocaleString("zh-CN")}`;
      return;
    }
    loading = true;
    elements.refresh.disabled = true;
    elements.status.textContent = mode === "vocabulary" ? "正在汇总班级词汇记录…" : mode === "text" ? "正在汇总班级课文记录…" : `正在汇总班级${practiceKind === "subjective" ? "主观" : "客观"}练习记录…`;
    try {
      const file = mode === "vocabulary" ? "vocabulary-metadata.json" : mode === "text" ? "text-audio.json" : "lesson-practice.json";
      const dataRoot = window.HANZI_COMPANION_CONFIG?.runtimeDataRoot || "../../data";
      const response = await fetch(`${dataRoot}/lessons/${lessonId}/${file}`, { cache: "no-cache" });
      if (!response.ok) throw new Error("课程数据读取失败");
      const source = await response.json();
      const reportInput = { lessonId, courseId };
      const result = mode === "vocabulary"
        ? await window.LearningApi.vocabularyReport({ ...reportInput, words: vocabularyCatalog(source) })
        : mode === "text"
          ? await window.LearningApi.textReport({ ...reportInput, sentences: textCatalog(source) })
          : practiceKind === "subjective"
            ? await window.LearningApi.subjectivePracticeReport({ ...reportInput, items: subjectiveCatalog(source) })
            : await window.LearningApi.practiceReport({ ...reportInput, items: practiceCatalog(source) });
      renderCurrentReport(result.report);
      reportCache.set(loadKey, result.report);
      elements.status.textContent = `${lessonNames[lessonId]} · 更新于 ${new Date(result.report.generatedAt).toLocaleString("zh-CN")}`;
    } catch (error) {
      elements.content.innerHTML = "";
      elements.status.textContent = error.message || "练习学情读取失败";
    } finally {
      loading = false;
      elements.refresh.disabled = false;
      if (pendingLoad) {
        pendingLoad = false;
        void load(false);
      }
    }
  }

  elements.lesson?.addEventListener("change", () => void load(true));
  elements.refresh?.addEventListener("click", () => void load(true));
  elements.tabs.forEach((tab) => tab.addEventListener("click", () => {
    mode = tab.dataset.learningReport;
    elements.tabs.forEach((item) => item.classList.toggle("active", item === tab));
    elements.kindTabs.hidden = mode !== "practice";
    void load(false);
  }));
  elements.kindButtons.forEach((tab) => tab.addEventListener("click", () => {
    practiceKind = tab.dataset.practiceKind;
    elements.kindButtons.forEach((item) => item.classList.toggle("active", item === tab));
    void load(false);
  }));
  elements.content?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-export-students]");
    if (!button) return;
    event.preventDefault();
    exportStudentDetails();
  });
  window.PracticeAnalytics = Object.freeze({ render: () => void load(false) });
})();
