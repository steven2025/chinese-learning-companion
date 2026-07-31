(function () {
  "use strict";
  const config = window.LISTENING_SPEAKING_CONFIG || {};

  async function request(action, payload) {
    if (config.mode === "mock" || !config.apiBaseUrl) {
      return { ok: false, mock: true, message: "真实听说训练API尚未配置" };
    }
    const response = await fetch(String(config.apiBaseUrl).replace(/\/$/, ""), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, ...payload })
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || data.ok === false) throw new Error(data.message || `API请求失败：${response.status}`);
    return data;
  }

  window.ListeningSpeakingApi = Object.freeze({
    listListeningPapers: payload => request("listListeningPapers", payload),
    submitListeningAnswer: payload => request("submitListeningAnswer", payload),
    explainListeningError: payload => request("explainListeningError", payload),
    recognizeSpeech: payload => request("recognizeSpeech", payload),
    createSoeSession: payload => request("createSoeSession", payload),
    continueDialogue: payload => request("continueDialogue", payload),
    synthesizeFeedback: payload => request("synthesizeFeedback", payload),
    saveLearningRecord: payload => request("saveLearningRecord", payload),
    getLearningReport: payload => request("getLearningReport", payload)
  });
})();
