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

  window.LearningApi = Object.freeze({
    isConfigured,
    token,
    profile,
    createSession,
    clearSession,
    resolveAssist,
    mediaUrl: (input) => request("/media/url", input),
    uploadTicket: (input) => request("/uploads/ticket", input),
    classStudents: () => request("/classes/students", {}),
  });
})();
