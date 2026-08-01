(function () {
  "use strict";

  const TOKEN_KEY = "chineseLearningSessionToken";
  const PROFILE_KEY = "chineseLearningSessionProfile";

  function baseUrl() {
    return String(window.HANZI_COMPANION_CONFIG?.learningApiUrl || "").replace(/\/+$/, "");
  }

  function isConfigured() {
    return /^https:\/\//.test(baseUrl()) || /^http:\/\/127\.0\.0\.1/.test(baseUrl());
  }

  function token() { return sessionStorage.getItem(TOKEN_KEY) || ""; }
  function profile() {
    try { return JSON.parse(sessionStorage.getItem(PROFILE_KEY) || "null"); } catch { return null; }
  }

  async function request(path, body, options = {}) {
    if (!isConfigured()) throw new Error("统一学习云服务尚未配置");
    const headers = { "Content-Type": "application/json" };
    if (options.auth !== false) {
      if (!token()) throw new Error("请先使用邀请码登录");
      headers.Authorization = `Bearer ${token()}`;
    }
    const response = await fetch(`${baseUrl()}${path}`, { method: "POST", headers, body: JSON.stringify(body || {}) });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || payload.ok === false) throw new Error(payload.message || `云服务请求失败：${response.status}`);
    return { ...payload, httpStatus: response.status };
  }

  async function createSession(input) {
    const result = await request("/auth/session", input, { auth: false });
    sessionStorage.setItem(TOKEN_KEY, result.token);
    sessionStorage.setItem(PROFILE_KEY, JSON.stringify(result.profile));
    return result;
  }

  function clearSession() {
    sessionStorage.removeItem(TOKEN_KEY);
    sessionStorage.removeItem(PROFILE_KEY);
  }

  async function resolveAssist(input) {
    const result = await request("/assist/resolve", input);
    if (result.status === "ready") return result;
    if (!result.jobId) throw new Error("云服务没有返回任务编号");
    for (let attempt = 0; attempt < 20; attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, 1500));
      const status = await request("/jobs/status", { jobId: result.jobId });
      if (status.status === "completed") return { status: "ready", source: "job", content: status.result };
      if (status.status === "failed") throw new Error(status.message || "深度解释生成失败");
    }
    throw new Error("深度解释仍在生成，请稍后再试");
  }

  async function waitForJob(jobId, options = {}) {
    const attempts = Number(options.attempts || 60);
    const interval = Number(options.interval || 2000);
    for (let attempt = 0; attempt < attempts; attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, interval));
      options.onProgress?.(attempt < 3 ? "assessing" : "advising", { attempt });
      const status = await request("/jobs/status", { jobId });
      if (status.status === "completed") return status.result;
      if (status.status === "failed") throw new Error(status.message || "AI测评失败");
    }
    throw new Error("AI测评仍在处理中，请稍后从学习记录中查看");
  }

  async function assessArtifact(blob, input, options = {}) {
    if (!(blob instanceof Blob) || !blob.size) throw new Error("学习作品为空，无法上传");
    options.onProgress?.("preparing");
    const ticket = await request("/uploads/ticket", {
      kind: input.kind,
      contentType: blob.type,
      artifactId: input.artifactId,
    });
    options.onProgress?.("uploading");
    const upload = await fetch(ticket.uploadUrl, {
      method: "PUT",
      headers: ticket.headers,
      body: blob,
    });
    if (!upload.ok) throw new Error(`作品上传失败：${upload.status}`);
    options.onProgress?.("submitting");
    const created = await request("/assessments/create", {
      ...input,
      artifactId: ticket.artifactId,
      contentType: blob.type,
      consentGranted: true,
    });
    if (created.status === "completed") return { ...created.result, quota: created.quota || created.result?.quota };
    if (!created.jobId) throw new Error("云服务没有返回测评任务编号");
    const result = await waitForJob(created.jobId, { ...options, onProgress: options.onProgress });
    options.onProgress?.("saving");
    return { ...result, quota: created.quota || result?.quota };
  }

  window.LearningApi = Object.freeze({
    isConfigured,
    token,
    profile,
    createSession,
    clearSession,
    resolveAssist,
    waitForJob,
    assessArtifact,
    mediaUrl: (input) => request("/media/url", input),
    uploadTicket: (input) => request("/uploads/ticket", input),
    assessmentHistory: () => request("/assessments/history", {}),
    classStudents: () => request("/classes/students", {}),
    classSettings: () => request("/classes/settings", {}),
    updateClassSettings: (input) => request("/classes/settings/update", input),
  });
})();
