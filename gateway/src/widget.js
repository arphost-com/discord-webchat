/* ARPHost Live Chat Widget (ES5) */
(function () {
  if (window.__ARPCHAT_WIDGET_LOADED) return;
  window.__ARPCHAT_WIDGET_LOADED = true;
  // --- helpers ---
  function $(sel, root) {
    return (root || document).querySelector(sel);
  }
  function el(tag, cls) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    return e;
  }
  function escapeHtml(s) {
    return String(s || "").replace(/[&<>"']/g, function (c) {
      return {
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      }[c];
    });
  }
  function renderMessage(text) {
    var raw = String(text || "");
    var out = "";
    var re = /https?:\/\/[^\s<]+/g;
    var last = 0;
    var m;
    while ((m = re.exec(raw))) {
      out += escapeHtml(raw.slice(last, m.index));
      var url = m[0];
      out +=
        '<a href="' +
        escapeHtml(url) +
        '" target="_blank" rel="noopener noreferrer">' +
        escapeHtml(url) +
        "</a>";
      last = m.index + url.length;
    }
    out += escapeHtml(raw.slice(last));
    return out;
  }
  function assignStyle(node, styles) {
    for (var k in styles) {
      if (styles.hasOwnProperty(k)) node.style[k] = styles[k];
    }
  }
  function nowIso() {
    try {
      return new Date().toISOString();
    } catch (e) {
      return "";
    }
  }

  function getCurrentScript() {
    // document.currentScript is best, but not always available in old browsers
    var cs = document.currentScript;
    if (cs) return cs;
    var scripts = document.getElementsByTagName("script");
    return scripts[scripts.length - 1];
  }

  // --- config ---
  var cs = getCurrentScript();
  var globalCfg = window.ARPCHAT || {};
  var baseUrl =
    (cs && (cs.getAttribute("data-base") || cs.getAttribute("data-baseurl"))) ||
    globalCfg.baseUrl ||
    "";
  baseUrl = String(baseUrl || "").replace(/\/+$/, "");
  if (!baseUrl) return;

  var mode = (cs && cs.getAttribute("data-mode")) || globalCfg.mode || "guest";
  var token = (cs && cs.getAttribute("data-token")) || globalCfg.token || "";

  var label =
    globalCfg.label ||
    (cs && cs.getAttribute("data-label")) ||
    window.WIDGET_CHAT_LABEL ||
    "Live Help";
  var logoUrl =
    globalCfg.logo ||
    (cs && cs.getAttribute("data-logo")) ||
    window.WIDGET_LOGO_URL ||
    "";
  var position =
    globalCfg.position ||
    (cs && cs.getAttribute("data-position")) ||
    window.WIDGET_POSITION ||
    "";
  position = String(position || "").toLowerCase();
  var dockRight = position === "right";
  var theme = globalCfg.theme || "dark";

  // theme vars can be injected by gateway in the future; for now read CSS vars from page or defaults
  function getVar(name, fallback) {
    try {
      var v = getComputedStyle(document.documentElement).getPropertyValue(name);
      if (v) v = String(v).trim();
      return v || fallback;
    } catch (e) {
      return fallback;
    }
  }

  var colors = {
    accent: getVar("--arpchat-accent", "#3b82f6"),
    bg: getVar("--arpchat-bg", "#0b0f14"),
    panelBg: getVar("--arpchat-panel-bg", "#0f172a"),
    text: getVar("--arpchat-text", "#e5e7eb"),
    muted: getVar("--arpchat-muted", "#94a3b8"),
    bubbleVisitor: getVar("--arpchat-bubble-visitor", "#1f2937"),
    bubbleAgent: getVar("--arpchat-bubble-agent", "#111827"),
    error: getVar("--arpchat-error", "#ef4444"),
  };

  // --- state ---
  var STORAGE_KEY = "arpchat.sessionUuid";
  var sessionUuid = null;
  try {
    sessionUuid = localStorage.getItem(STORAGE_KEY) || null;
  } catch (e) {}
  var VISITOR_KEY = "arpchat.visitorId";
  var visitorId = null;
  try {
    visitorId = localStorage.getItem(VISITOR_KEY) || null;
  } catch (e) {}
  if (!visitorId) {
    visitorId =
      "v_" + Math.random().toString(36).slice(2) + Date.now().toString(36);
    try {
      localStorage.setItem(VISITOR_KEY, visitorId);
    } catch (e) {}
  }
  var ws = null;
  var wsBackoff = 500;
  var wsMaxBackoff = 10000;
  var connected = false;

  // --- UI ---
  var bubble = el("button", "arpchat-bubble");
  bubble.type = "button";
  bubble.innerHTML =
    '<span style="display:inline-block;width:10px;height:10px;border-radius:999px;background:#22c55e;margin-right:8px;vertical-align:middle"></span><span>' +
    label +
    "</span>";

  var panel = el("div", "arpchat-panel");
  var header = el("div", "arpchat-header");
  var title = el("div", "arpchat-title");
  var titleLogo = el("img", "arpchat-logo");
  titleLogo.alt = "";
  if (logoUrl) {
    titleLogo.src = logoUrl;
    titleLogo.style.display = "inline-block";
  } else {
    titleLogo.style.display = "none";
  }
  var titleText = el("span", "arpchat-titletext");
  titleText.textContent = label;
  title.appendChild(titleLogo);
  title.appendChild(titleText);
  var closeBtn = el("button", "arpchat-close");
  closeBtn.type = "button";
  closeBtn.textContent = "×";
  header.appendChild(title);
  header.appendChild(closeBtn);

  var status = el("div", "arpchat-status");
  status.textContent = "Connecting…";

  var messages = el("div", "arpchat-messages");

  var form = el("div", "arpchat-form");
  var emojiToggle = el("button", "arpchat-emoji-toggle");
  emojiToggle.type = "button";
  emojiToggle.textContent = "😊";
  var emojiPanel = el("div", "arpchat-emoji-panel");
  var input = el("input", "arpchat-input");
  input.type = "text";
  input.placeholder = "Type a message…";
  var sendBtn = el("button", "arpchat-send");
  sendBtn.type = "button";
  sendBtn.textContent = "Send";
  var endBtn = el("button", "arpchat-end");
  endBtn.type = "button";
  endBtn.textContent = "End";
  form.appendChild(emojiToggle);
  form.appendChild(emojiPanel);
  form.appendChild(input);
  form.appendChild(sendBtn);
  form.appendChild(endBtn);

  panel.appendChild(header);
  panel.appendChild(status);
  panel.appendChild(messages);
  panel.appendChild(form);

  // mount
  document.documentElement.appendChild(bubble);
  document.documentElement.appendChild(panel);

  // styles
  var style = el("style");
  style.type = "text/css";
  var dockSide = dockRight ? "right:16px;" : "left:16px;";
  style.textContent =
    ".arpchat-bubble,.arpchat-panel,.arpchat-panel *{box-sizing:border-box}" +
    ".arpchat-bubble{position:fixed !important;bottom:16px;" +
    dockSide +
    "z-index:2147483000;border:0;border-radius:999px;padding:10px 14px;font:600 14px/1.2 system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial;color:" +
    colors.text +
    ";background:" +
    colors.panelBg +
    ";box-shadow:0 10px 24px rgba(0,0,0,.35);cursor:pointer;width:auto !important;max-width:calc(100vw - 32px)}" +
    ".arpchat-panel{position:fixed !important;bottom:72px;" +
    dockSide +
    "width:320px !important;max-width:calc(100vw - 32px) !important;height:480px !important;max-height:calc(100vh - 96px) !important;z-index:2147483001;border-radius:16px;overflow:hidden;display:none;box-shadow:0 20px 50px rgba(0,0,0,.45);background:" +
    colors.bg +
    ";color:" +
    colors.text +
    ";font:14px/1.35 system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial}" +
    ".arpchat-header{position:relative !important;display:flex;align-items:center !important;justify-content:flex-start;padding:12px 12px;background:" +
    colors.panelBg +
    ";border-bottom:1px solid rgba(255,255,255,.08);gap:10px}" +
    ".arpchat-title{display:flex;align-items:center;gap:8px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;flex:1 1 auto;min-width:0;padding-right:28px}" +
    ".arpchat-titletext{white-space:nowrap !important;overflow:hidden;text-overflow:ellipsis;display:block}" +
    ".arpchat-logo{width:20px;height:20px;border-radius:4px;display:inline-block}" +
    ".arpchat-close{position:absolute !important;top:6px;right:8px;left:auto;margin:0;margin-left:auto;padding:0;border:0;background:transparent;color:" +
    colors.muted +
    ";font-size:22px;line-height:1;cursor:pointer;min-width:0;min-height:0;width:24px;height:24px;display:inline-flex;align-items:center;justify-content:center}" +
    ".arpchat-status{padding:8px 12px;font-size:12px;color:" +
    colors.muted +
    ";border-bottom:1px solid rgba(255,255,255,.06)}" +
    ".arpchat-messages{height:calc(100% - 44px - 34px - 56px);overflow:auto;padding:10px 12px;box-sizing:border-box}" +
    ".arpchat-row{display:flex;margin:8px 0}" +
    ".arpchat-row.visitor{justify-content:flex-end}" +
    ".arpchat-bubblemsg{max-width:78%;padding:10px 10px;border-radius:12px;white-space:pre-wrap;word-wrap:break-word}" +
    ".arpchat-row.visitor .arpchat-bubblemsg{background:" +
    colors.bubbleVisitor +
    "}" +
    ".arpchat-row.agent .arpchat-bubblemsg{background:" +
    colors.bubbleAgent +
    "}" +
    ".arpchat-row.system .arpchat-bubblemsg{background:rgba(255,255,255,.06);color:" +
    colors.muted +
    "}" +
    ".arpchat-form{position:relative;display:flex;gap:8px;padding:10px 12px;background:" +
    colors.panelBg +
    ";border-top:1px solid rgba(255,255,255,.08);box-sizing:border-box;align-items:center;flex-wrap:nowrap}" +
    ".arpchat-form > *{flex:0 0 auto !important}" +
    ".arpchat-form button{position:static !important;float:none !important;margin:0 !important;width:auto !important;display:inline-flex !important;align-items:center;justify-content:center}" +
    ".arpchat-emoji-toggle{border:1px solid rgba(255,255,255,.12);background:transparent;color:" +
    colors.text +
    ";border-radius:8px;padding:6px 8px;cursor:pointer;font-size:14px;line-height:1;display:inline-flex;align-items:center;justify-content:center}" +
    ".arpchat-emoji-panel{position:fixed;bottom:56px;left:12px;right:12px;display:none;grid-template-columns:repeat(10,1fr);gap:6px;padding:8px;border-radius:10px;background:rgba(15,23,42,.98);border:1px solid rgba(255,255,255,.12);max-height:220px;overflow:auto;z-index:2147483002;pointer-events:auto;box-shadow:0 12px 30px rgba(0,0,0,.35)}" +
    ".arpchat-emoji-panel *{pointer-events:auto !important}" +
    ".arpchat-emoji-panel button{border:1px solid rgba(255,255,255,.08);background:transparent;color:" +
    colors.text +
    ";border-radius:8px;padding:6px 0;cursor:pointer;font-size:16px;line-height:1}" +
    ".arpchat-input{flex:1 1 auto !important;width:auto !important;min-width:0 !important;max-width:100%;display:block !important;visibility:visible !important;opacity:1 !important;padding:10px 10px;border-radius:10px;border:1px solid rgba(255,255,255,.10);background:rgba(0,0,0,.15);color:" +
    colors.text +
    ";outline:none;box-sizing:border-box;font-size:14px;line-height:1.4}" +
    ".arpchat-send{flex:0 0 auto !important;width:auto !important;max-width:90px !important;min-width:0 !important;padding:8px 10px;border-radius:10px;border:1px solid rgba(255,255,255,.14);background:transparent;color:" +
    colors.text +
    ";cursor:pointer;align-self:auto;font-size:13px;line-height:1.1;white-space:nowrap;display:inline-flex;align-items:center;justify-content:center}" +
    ".arpchat-end{flex:0 0 auto !important;width:auto !important;max-width:90px !important;min-width:0 !important;padding:8px 10px;border-radius:10px;border:1px solid rgba(255,255,255,.14);background:transparent;color:" +
    colors.text +
    ";cursor:pointer;align-self:auto;font-size:13px;line-height:1.1;white-space:nowrap;opacity:.85;display:inline-flex;align-items:center;justify-content:center}" +
    ".arpchat-send:hover{border-color:" +
    colors.accent +
    ";color:" +
    colors.accent +
    "}";
  document.head.appendChild(style);

  function openPanel() {
    panel.style.display = "block";
    bubble.style.display = "none";
    try {
      messages.scrollTop = messages.scrollHeight;
    } catch (e) {}
    if (input) input.focus();
  }
  function closePanel() {
    panel.style.display = "none";
    bubble.style.display = "inline-flex";
  }
  bubble.addEventListener("click", openPanel);
  closeBtn.addEventListener("click", closePanel);

  function saveHistory(sessionId, kind, text) {
    if (!sessionId) return;
    try {
      var key = "arpchat_history_" + sessionId;
      var raw = localStorage.getItem(key);
      var arr = raw ? JSON.parse(raw) : [];
      if (!Array.isArray(arr)) arr = [];
      arr.push({ t: Date.now(), kind: kind, text: text });
      if (arr.length > 200) arr = arr.slice(-200);
      localStorage.setItem(key, JSON.stringify(arr));
    } catch (e) {}
  }

  function loadHistory(sessionId) {
    if (!sessionId) return [];
    try {
      var key = "arpchat_history_" + sessionId;
      var raw = localStorage.getItem(key);
      var arr = raw ? JSON.parse(raw) : [];
      return Array.isArray(arr) ? arr : [];
    } catch (e) {
      return [];
    }
  }

  function restoreHistory() {
    if (!sessionUuid) return;
    if (messages.children.length) return;
    var items = loadHistory(sessionUuid);
    if (!items.length) return;
    for (var i = 0; i < items.length; i += 1) {
      var it = items[i];
      var row = el("div", "arpchat-row " + it.kind);
      var b = el("div", "arpchat-bubblemsg");
      b.innerHTML = renderMessage(it.text);
      row.appendChild(b);
      messages.appendChild(row);
    }
    try {
      messages.scrollTop = messages.scrollHeight;
    } catch (e) {}
  }

  function addMsg(kind, text) {
    var row = el("div", "arpchat-row " + kind);
    var b = el("div", "arpchat-bubblemsg");
    b.innerHTML = renderMessage(text);
    row.appendChild(b);
    messages.appendChild(row);
    if (sessionUuid) saveHistory(sessionUuid, kind, text);
    // autoscroll if near bottom
    try {
      var nearBottom =
        messages.scrollHeight - messages.scrollTop - messages.clientHeight <
        120;
      if (nearBottom) messages.scrollTop = messages.scrollHeight;
    } catch (e) {}
  }

  function setStatus(s) {
    status.textContent = s;
  }

  // --- networking ---
  function xhrJson(method, url, body, cb) {
    var x = new XMLHttpRequest();
    x.open(method, url, true);
    x.setRequestHeader("Content-Type", "application/json");
    x.onreadystatechange = function () {
      if (x.readyState !== 4) return;
      var ok = x.status >= 200 && x.status < 300;
      var data = null;
      try {
        data = JSON.parse(x.responseText || "{}");
      } catch (e) {}
      cb(ok, data, x);
    };
    x.send(body ? JSON.stringify(body) : null);
  }

  function trackPage(extra) {
    var payload = {
      visitorId: visitorId,
      sessionUuid: sessionUuid || null,
      url: String(location.href || ""),
      title: document.title || "",
      referrer: document.referrer || "",
    };
    if (extra) {
      for (var k in extra) {
        payload[k] = extra[k];
      }
    }
    xhrJson("POST", baseUrl + "/api/track/page", payload, function () {});
  }

  function wsUrlFromBase() {
    // baseUrl like https://host -> wss://host/ws
    var u = baseUrl;
    u = u.replace(/^http:/, "ws:").replace(/^https:/, "wss:");
    return u + "/ws";
  }

  function startOrResume(cb) {
    if (sessionUuid) {
      xhrJson(
        "POST",
        baseUrl + "/api/session/resume",
        {
          sessionUuid: sessionUuid,
          entryUrl: location.href,
          referrer: document.referrer || "",
          visitorId: visitorId,
        },
        function (ok, data) {
          if (ok && data && data.sessionUuid) return cb(true, data.sessionUuid);
          sessionUuid = null;
          try {
            localStorage.removeItem(STORAGE_KEY);
          } catch (e) {}
          return startFresh(cb);
        },
      );
      return;
    }
    startFresh(cb);
  }

  function startFresh(cb) {
    var endpoint =
      mode === "client"
        ? "/api/session/start-client"
        : "/api/session/start-guest";
    var payload = {
      entryUrl: location.href,
      referrer: document.referrer || "",
      visitorId: visitorId,
    };
    if (mode === "client") payload.token = token || "";
    xhrJson("POST", baseUrl + endpoint, payload, function (ok, data) {
      if (!ok || !data || !data.sessionUuid) return cb(false, null);
      sessionUuid = data.sessionUuid;
      try {
        localStorage.setItem(STORAGE_KEY, sessionUuid);
      } catch (e) {}
      trackPage();
      restoreHistory();
      cb(true, sessionUuid);
    });
  }

  function connectWs() {
    if (ws && (ws.readyState === 0 || ws.readyState === 1)) return;
    startOrResume(function (ok, sid) {
      if (!ok) {
        setStatus("Offline. Retry…");
        scheduleReconnect();
        return;
      }
      var url = wsUrlFromBase();
      setStatus("Connecting…");
      try {
        ws = new WebSocket(url);
      } catch (e) {
        scheduleReconnect();
        return;
      }

      ws.onopen = function () {
        connected = true;
        wsBackoff = 500;
        setStatus("Connected. How can we help?");
        try {
          ws.send(JSON.stringify({ type: "hello", sessionUuid: sid }));
        } catch (e) {}
      };

      ws.onmessage = function (ev) {
        var msg = null;
        try {
          msg = JSON.parse(ev.data);
        } catch (e) {}
        if (!msg) return;
        if (msg.type === "system") addMsg("system", msg.text || "");
        if (msg.type === "agent_message") addMsg("agent", msg.text || "");
        if (msg.type === "hello_ack") {
          /* ok */
        }
      };

      ws.onclose = function () {
        connected = false;
        setStatus("Disconnected. Reconnecting…");
        scheduleReconnect();
      };
      ws.onerror = function () {
        connected = false;
        setStatus("Connection error. Reconnecting…");
        try {
          ws.close();
        } catch (e) {}
      };
    });
  }

  function scheduleReconnect() {
    var t = wsBackoff;
    wsBackoff = Math.min(wsBackoff * 2, wsMaxBackoff);
    setTimeout(connectWs, t);
  }

  function sendVisitor(text) {
    var t = String(text || "").trim();
    if (!t) return;
    addMsg("visitor", t);
    input.value = "";
    if (!ws || ws.readyState !== 1) {
      setStatus("Disconnected. Reconnecting…");
      connectWs();
      return;
    }
    try {
      ws.send(JSON.stringify({ type: "visitor_message", text: t }));
    } catch (e) {}
  }

  function endChat() {
    if (!sessionUuid) {
      closePanel();
      return;
    }
    xhrJson(
      "POST",
      baseUrl + "/api/session/close",
      { sessionUuid: sessionUuid },
      function () {
        try {
          localStorage.removeItem(STORAGE_KEY);
        } catch (e) {}
        try {
          localStorage.removeItem("arpchat_history_" + sessionUuid);
        } catch (e) {}
        sessionUuid = null;
        messages.innerHTML = "";
        closePanel();
      },
    );
  }

  trackPage();

  sendBtn.addEventListener("click", function () {
    sendVisitor(input.value);
  });
  endBtn.addEventListener("click", endChat);
  input.addEventListener("keydown", function (e) {
    e = e || window.event;
    if (e.keyCode === 13) {
      e.preventDefault();
      sendVisitor(input.value);
    }
  });
  var emojiList = [
    "😀",
    "😁",
    "😂",
    "🤣",
    "😃",
    "😄",
    "😅",
    "😆",
    "😉",
    "😊",
    "😇",
    "🙂",
    "🙃",
    "😍",
    "🥰",
    "😘",
    "😗",
    "😙",
    "😚",
    "😋",
    "😜",
    "😝",
    "😛",
    "🤪",
    "🤗",
    "🤔",
    "🤨",
    "😐",
    "😑",
    "😶",
    "🙄",
    "😏",
    "😒",
    "😞",
    "😔",
    "😟",
    "😕",
    "🙁",
    "☹️",
    "😣",
    "😖",
    "😫",
    "😩",
    "🥺",
    "😢",
    "😭",
    "😤",
    "😠",
    "😡",
    "🤬",
    "🤯",
    "😳",
    "🥵",
    "🥶",
    "😱",
    "😨",
    "😰",
    "😥",
    "😓",
    "🤭",
    "🤫",
    "🤥",
    "😶‍🌫️",
    "😴",
    "🤤",
    "😪",
    "😵",
    "😵‍💫",
    "🤐",
    "🥴",
    "🤒",
    "🤕",
    "🤢",
    "🤮",
    "🤧",
    "😷",
    "🤠",
    "🥳",
    "😎",
    "🤓",
    "🧐",
    "😕",
    "😟",
    "🙁",
    "☹️",
    "👍",
    "👎",
    "👊",
    "✊",
    "🤝",
    "🙏",
    "👏",
    "🙌",
    "🫶",
    "💪",
    "❤️",
    "🧡",
    "💛",
    "💚",
    "💙",
    "💜",
    "🖤",
    "🤍",
    "🤎",
    "💔",
    "✨",
    "🎉",
    "🎊",
    "🔥",
    "⭐",
    "🌟",
    "💫",
    "☀️",
    "🌈",
    "⚡",
    "💬",
    "✅",
    "❌",
  ];
  if (emojiPanel) {
    var emojiHtml = "";
    for (var i = 0; i < emojiList.length; i += 1) {
      emojiHtml +=
        '<button type="button" data-emoji="' +
        emojiList[i] +
        '">' +
        emojiList[i] +
        "</button>";
    }
    emojiPanel.innerHTML = emojiHtml;
  }
  function positionEmojiPanel() {
    if (!emojiPanel || !panel || !form) return;
    var panelRect = panel.getBoundingClientRect();
    var formRect = form.getBoundingClientRect();
    var left = Math.max(8, panelRect.left + 12);
    var width = Math.max(160, panelRect.width - 24);
    var bottom = Math.max(12, window.innerHeight - formRect.top + 8);
    emojiPanel.style.left = left + "px";
    emojiPanel.style.width = width + "px";
    emojiPanel.style.bottom = bottom + "px";
  }
  emojiToggle.addEventListener("click", function (e) {
    e.preventDefault();
    e.stopPropagation();
    positionEmojiPanel();
    emojiPanel.style.display =
      emojiPanel.style.display === "grid" ? "none" : "grid";
  });
  function handleEmojiPick(e) {
    if (e && e.preventDefault) e.preventDefault();
    if (e && e.stopPropagation) e.stopPropagation();
    var target = e && e.target;
    var btn = null;
    while (target && target !== emojiPanel && !btn) {
      if (target.getAttribute && target.getAttribute("data-emoji"))
        btn = target;
      target = target.parentNode;
    }
    if (!btn) return;
    var emoji = btn.getAttribute("data-emoji");
    if (!emoji) return;
    input.value = (input.value || "") + emoji;
    input.focus();
    emojiPanel.style.display = "none";
  }
  emojiPanel.addEventListener("mousedown", handleEmojiPick);
  emojiPanel.addEventListener("click", handleEmojiPick);
  emojiPanel.addEventListener("touchstart", handleEmojiPick, {
    passive: false,
  });
  window.addEventListener("resize", function () {
    if (emojiPanel.style.display === "grid") positionEmojiPanel();
  });
  document.addEventListener("click", function (e) {
    if (emojiPanel.style.display !== "grid") return;
    if (emojiPanel.contains(e.target) || emojiToggle.contains(e.target)) return;
    emojiPanel.style.display = "none";
  });

  // connect on load
  connectWs();
  restoreHistory();
})();
