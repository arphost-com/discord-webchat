/* Discord WebChat Widget (ES5) */
(function () {
  if (window.__DISCORD_WEBCHAT_LOADED) return;
  window.__DISCORD_WEBCHAT_LOADED = true;
  function $(sel, root) {
    return (root || document).querySelector(sel);
  }
  function el(tag, attrs) {
    var n = document.createElement(tag);
    if (attrs) {
      for (var k in attrs) {
        if (k === "style") {
          for (var s in attrs.style) {
            n.style[s] = attrs.style[s];
          }
        } else if (k === "text") {
          n.textContent = attrs[k];
        } else if (k === "html") {
          n.innerHTML = attrs[k];
        } else n.setAttribute(k, attrs[k]);
      }
    }
    return n;
  }
  function parseJson(s) {
    try {
      return JSON.parse(s);
    } catch (e) {
      return null;
    }
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

  var cs = document.currentScript;
  var baseUrl =
    (cs && (cs.getAttribute("data-base") || cs.getAttribute("data-baseurl"))) ||
    window.DWC_BASE_URL ||
    (function () {
      try {
        return new URL(cs.src).origin;
      } catch (e) {
        return "";
      }
    })();

  var mode =
    (cs && cs.getAttribute("data-mode")) || window.DWC_MODE || "guest";
  var token =
    (cs && cs.getAttribute("data-token")) || window.DWC_TOKEN || "";
  function getDataAttr(name) {
    return cs && cs.getAttribute && cs.getAttribute("data-" + name);
  }
  var position = getDataAttr("position") || window.WIDGET_POSITION || "";
  position = String(position || "").toLowerCase();
  var dockRight = position === "right";

  var theme = {
    label: getDataAttr("label") || window.WIDGET_CHAT_LABEL || "Live Help",
    logo: getDataAttr("logo") || window.WIDGET_LOGO_URL || "",
    accent: getDataAttr("accent") || window.WIDGET_ACCENT || "#3b82f6",
    bg: getDataAttr("bg") || window.WIDGET_BG || "#0b0f14",
    panelBg: getDataAttr("panel-bg") || window.WIDGET_PANEL_BG || "#0f172a",
    text: getDataAttr("text") || window.WIDGET_TEXT || "#e5e7eb",
    muted: getDataAttr("muted") || window.WIDGET_MUTED || "#94a3b8",
    bubbleVisitor:
      getDataAttr("bubble-visitor") ||
      window.WIDGET_BUBBLE_VISITOR ||
      "#1f2937",
    bubbleAgent:
      getDataAttr("bubble-agent") || window.WIDGET_BUBBLE_AGENT || "#111827",
    error: getDataAttr("error") || window.WIDGET_ERROR || "#ef4444",
  };

  var btn = el("button", { id: "dwc-btn", type: "button" });
  btn.textContent = theme.label;
  var panel = el("div", { id: "dwc-panel" });
  panel.innerHTML =
    "" +
    '<div id="dwc-head"><div id="dwc-brand"><img id="dwc-logo" alt=""><span id="dwc-title"></span></div><button id="dwc-close" type="button">×</button></div>' +
    '<div id="dwc-status"></div>' +
    '<div id="dwc-messages"></div>' +
    '<div id="dwc-foot"><button id="dwc-emoji-toggle" type="button" aria-label="Emoji">😊</button><div id="dwc-emoji-panel"></div><input id="dwc-input" type="text" placeholder="Type a message..."><button id="dwc-send" type="button">Send</button><button id="dwc-end" type="button">End</button></div>';

  var dockSide = dockRight ? "right:18px;" : "left:18px;";
  var style = el("style", {
    html:
      "#dwc-btn,#dwc-panel,#dwc-panel *{box-sizing:border-box}" +
      "#dwc-btn{position:fixed !important;bottom:18px;" +
      dockSide +
      "z-index:2147483647;border:0;border-radius:999px;padding:10px 14px;cursor:pointer;background:#111;color:#fff;box-shadow:0 10px 30px rgba(0,0,0,.35);display:inline-flex;align-items:center;width:auto !important;max-width:calc(100vw - 36px);white-space:nowrap;font:600 14px/1.2 system-ui,-apple-system,Segoe UI,Roboto,Arial}" +
      "#dwc-panel{position:fixed !important;bottom:58px;" +
      dockSide +
      "width:320px !important;max-width:calc(100vw - 36px) !important;height:480px !important;max-height:calc(100vh - 96px) !important;z-index:2147483647;display:none;flex-direction:column;border-radius:12px;overflow:hidden;box-shadow:0 18px 60px rgba(0,0,0,.45);font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial}" +
      "#dwc-head{position:relative !important;display:flex;align-items:center !important;justify-content:flex-start;padding:10px 12px 10px 12px;font-weight:600;gap:10px}" +
      "#dwc-title{white-space:nowrap !important;overflow:hidden;text-overflow:ellipsis;display:block}" +
      "#dwc-brand{display:flex;align-items:center;gap:8px;flex:1 1 auto;min-width:0;padding-right:28px}" +
      "#dwc-logo{width:20px;height:20px;border-radius:4px;display:none}" +
      "#dwc-close{position:absolute !important;top:6px !important;right:8px !important;left:auto !important;margin:0 !important;margin-left:auto !important;padding:0 !important;border:0;background:transparent;color:inherit;font-size:20px;cursor:pointer;line-height:1;min-width:0;min-height:0;width:24px !important;height:24px !important;display:inline-flex !important;align-items:center;justify-content:center}" +
      "#dwc-status{padding:6px 10px;font-size:12px;opacity:.8;border-top:1px solid rgba(255,255,255,.06);border-bottom:1px solid rgba(255,255,255,.06)}" +
      "#dwc-messages{flex:1;overflow:auto;padding:10px;display:flex;flex-direction:column;gap:8px;box-sizing:border-box}" +
      ".dwc-msg{max-width:80%;padding:8px 10px;border-radius:10px;font-size:13px;line-height:1.3;white-space:pre-wrap;word-wrap:break-word}" +
      ".dwc-me{align-self:flex-end}" +
      ".dwc-agent{align-self:flex-start}" +
      "#dwc-foot{position:relative;display:flex;gap:8px;padding:10px;border-top:1px solid rgba(255,255,255,.06);box-sizing:border-box;align-items:center;flex-wrap:nowrap}" +
      "#dwc-foot > *{flex:0 0 auto !important}" +
      "#dwc-foot button{position:static !important;float:none !important;margin:0 !important;width:auto !important;display:inline-flex !important;align-items:center;justify-content:center}" +
      "#dwc-emoji-toggle{border:1px solid rgba(255,255,255,.12);background:transparent;color:inherit;border-radius:8px;padding:6px 8px;cursor:pointer;font-size:14px;line-height:1;display:inline-flex;align-items:center;justify-content:center}" +
      "#dwc-emoji-panel{position:fixed;bottom:52px;left:10px;right:10px;display:none;grid-template-columns:repeat(10,1fr);gap:6px;padding:8px;border-radius:10px;background:rgba(15,23,42,.98);border:1px solid rgba(255,255,255,.12);max-height:220px;overflow:auto;z-index:2147483647;pointer-events:auto;box-shadow:0 12px 30px rgba(0,0,0,.35)}" +
      "#dwc-emoji-panel *{pointer-events:auto !important}" +
      "#dwc-emoji-panel button{border:1px solid rgba(255,255,255,.08);background:transparent;color:inherit;border-radius:8px;padding:6px 0;cursor:pointer;font-size:16px;line-height:1}" +
      "#dwc-input{flex:1 1 auto !important;width:auto !important;min-width:0 !important;max-width:100%;display:block !important;visibility:visible !important;opacity:1 !important;border-radius:10px;border:1px solid rgba(255,255,255,.10);background:rgba(0,0,0,.15);color:inherit;padding:8px 10px;outline:none;box-sizing:border-box;font-size:14px;line-height:1.4}" +
      "#dwc-send{flex:0 0 auto !important;width:auto !important;max-width:90px !important;min-width:0 !important;align-self:auto;white-space:nowrap}" +
      "#dwc-send{border:1px solid rgba(255,255,255,.12);border-radius:10px;padding:7px 10px;background:transparent;color:inherit;cursor:pointer;font-size:13px;line-height:1.1;display:inline-flex;align-items:center;justify-content:center}" +
      "#dwc-end{flex:0 0 auto !important;width:auto !important;max-width:90px !important;border:1px solid rgba(255,255,255,.12);border-radius:10px;padding:7px 10px;background:transparent;color:inherit;cursor:pointer;font-size:13px;line-height:1.1;opacity:.85;display:inline-flex;align-items:center;justify-content:center}",
  });

  document.head.appendChild(style);
  document.body.appendChild(btn);
  document.body.appendChild(panel);

  function applyTheme() {
    panel.style.background = theme.bg;
    panel.style.color = theme.text;
    $("#dwc-head", panel).style.background = theme.panelBg;
    $("#dwc-title", panel).textContent = theme.label;
    btn.textContent = theme.label;
    var logoEl = $("#dwc-logo", panel);
    if (logoEl) {
      if (theme.logo) {
        logoEl.src = theme.logo;
        logoEl.style.display = "inline-block";
      } else {
        logoEl.style.display = "none";
      }
    }
    btn.style.background = theme.panelBg;
    $("#dwc-send", panel).style.background = theme.panelBg;
    $("#dwc-send", panel).style.borderColor = theme.accent;
  }
  applyTheme();

  function saveHistory(sessionId, text, who) {
    if (!sessionId) return;
    try {
      var key = "dwc_history_" + sessionId;
      var raw = localStorage.getItem(key);
      var arr = raw ? parseJson(raw) : [];
      if (!Array.isArray(arr)) arr = [];
      arr.push({ t: Date.now(), who: who, text: text });
      if (arr.length > 200) arr = arr.slice(-200);
      localStorage.setItem(key, JSON.stringify(arr));
    } catch (e) {}
  }

  function loadHistory(sessionId) {
    if (!sessionId) return [];
    try {
      var key = "dwc_history_" + sessionId;
      var raw = localStorage.getItem(key);
      var arr = raw ? parseJson(raw) : [];
      return Array.isArray(arr) ? arr : [];
    } catch (e) {
      return [];
    }
  }

  function addMsg(text, who) {
    var m = el("div", {
      class: "dwc-msg " + (who === "me" ? "dwc-me" : "dwc-agent"),
    });
    m.style.background = who === "me" ? theme.bubbleVisitor : theme.bubbleAgent;
    m.innerHTML = renderMessage(text);
    $("#dwc-messages", panel).appendChild(m);
    var box = $("#dwc-messages", panel);
    box.scrollTop = box.scrollHeight;
    if (sessionUuid) saveHistory(sessionUuid, text, who);
  }

  var ws = null;
  var sessionUuid = null;
  var reconnectTimer = null;
  var visitorId = null;
  try {
    visitorId = localStorage.getItem("dwc_visitor");
  } catch (e) {}
  if (!visitorId) {
    visitorId =
      "v_" + Math.random().toString(36).slice(2) + Date.now().toString(36);
    try {
      localStorage.setItem("dwc_visitor", visitorId);
    } catch (e) {}
  }

  function setStatus(s) {
    $("#dwc-status", panel).textContent = s;
  }

  function httpPost(path, body, cb) {
    var xhr = new XMLHttpRequest();
    xhr.open("POST", baseUrl + path, true);
    xhr.setRequestHeader("Content-Type", "application/json");
    xhr.onreadystatechange = function () {
      if (xhr.readyState === 4) {
        if (xhr.status >= 200 && xhr.status < 300)
          cb(null, parseJson(xhr.responseText) || {});
        else cb(new Error("HTTP " + xhr.status), null);
      }
    };
    xhr.send(JSON.stringify(body || {}));
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
    httpPost("/api/track/page", payload, function () {});
  }

  function connectWs() {
    if (!sessionUuid) return;
    var wsUrl = baseUrl.replace(/^http/, "ws") + "/ws";
    setStatus("Connecting…");
    ws = new WebSocket(wsUrl);
    ws.onopen = function () {
      setStatus("Connected. How can we help?");
      ws.send(JSON.stringify({ type: "hello", sessionUuid: sessionUuid }));
    };
    ws.onmessage = function (ev) {
      var msg = parseJson(ev.data);
      if (!msg || !msg.type) return;
      if (msg.type === "agent_message") addMsg(msg.text || "", "agent");
      if (msg.type === "system") addMsg(msg.text || "", "agent");
    };
    ws.onclose = function () {
      setStatus("Disconnected. Reconnecting…");
      try {
        ws = null;
      } catch (e) {}
      if (reconnectTimer) clearTimeout(reconnectTimer);
      reconnectTimer = setTimeout(function () {
        resumeOrStart();
      }, 1500);
    };
  }

  function resumeOrStart() {
    var saved = null;
    try {
      saved = localStorage.getItem("dwc_session");
    } catch (e) {}
    if (saved) {
      sessionUuid = saved;
      httpPost(
        "/api/session/resume",
        { sessionUuid: sessionUuid, visitorId: visitorId },
        function (err) {
          if (err) {
            sessionUuid = null;
            try {
              localStorage.removeItem("dwc_session");
            } catch (e) {}
            start();
          } else {
            trackPage();
            restoreHistory();
            connectWs();
          }
        },
      );
    } else {
      start();
    }
  }

  function start() {
    var name = window.DWC_VISITOR_NAME || "Guest";
    var email = window.DWC_VISITOR_EMAIL || "";
    var endpoint =
      mode === "client"
        ? "/api/session/start-client"
        : "/api/session/start-guest";
    var payload = {
      visitorName: name,
      visitorEmail: email,
      entryUrl: String(location.href),
      referrer: String(document.referrer || ""),
      visitorId: visitorId,
    };
    if (mode === "client") payload.token = token || "";
    httpPost(endpoint, payload, function (err, data) {
      if (err) {
        setStatus("Error starting chat");
        return;
      }
      sessionUuid = data.sessionUuid;
      try {
        localStorage.setItem("dwc_session", sessionUuid);
      } catch (e) {}
      trackPage();
      restoreHistory();
      connectWs();
    });
  }

  function restoreHistory() {
    var box = $("#dwc-messages", panel);
    if (!box || box.children.length) return;
    var items = loadHistory(sessionUuid);
    if (!items.length) return;
    for (var i = 0; i < items.length; i++) {
      var it = items[i];
      var who = it.who === "me" ? "me" : "agent";
      var m = el("div", {
        class: "dwc-msg " + (who === "me" ? "dwc-me" : "dwc-agent"),
      });
      m.style.background =
        who === "me" ? theme.bubbleVisitor : theme.bubbleAgent;
      m.innerHTML = renderMessage(it.text);
      box.appendChild(m);
    }
    box.scrollTop = box.scrollHeight;
  }

  function sendCurrent() {
    var input = $("#dwc-input", panel);
    var text = (input.value || "").trim();
    if (!text) return;
    input.value = "";
    addMsg(text, "me");
    if (ws && ws.readyState === 1) {
      ws.send(JSON.stringify({ type: "visitor_message", text: text }));
    }
  }

  function endChat() {
    if (!sessionUuid) {
      panel.style.display = "none";
      return;
    }
    httpPost("/api/session/close", { sessionUuid: sessionUuid }, function () {
      try {
        localStorage.removeItem("dwc_session");
      } catch (e) {}
      try {
        localStorage.removeItem("dwc_history_" + sessionUuid);
      } catch (e) {}
      sessionUuid = null;
      $("#dwc-messages", panel).innerHTML = "";
      panel.style.display = "none";
    });
  }

  btn.addEventListener("click", function () {
    panel.style.display = "flex";
    resumeOrStart();
  });
  $("#dwc-close", panel).addEventListener("click", function () {
    panel.style.display = "none";
  });
  $("#dwc-send", panel).addEventListener("click", sendCurrent);
  $("#dwc-end", panel).addEventListener("click", endChat);
  $("#dwc-input", panel).addEventListener("keydown", function (e) {
    if (e.key === "Enter") {
      e.preventDefault();
      sendCurrent();
    }
  });
  var emojiToggle = $("#dwc-emoji-toggle", panel);
  var emojiPanel = $("#dwc-emoji-panel", panel);
  var foot = $("#dwc-foot", panel);
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
    var html = "";
    for (var i = 0; i < emojiList.length; i++) {
      html +=
        '<button type="button" data-emoji="' +
        emojiList[i] +
        '">' +
        emojiList[i] +
        "</button>";
    }
    emojiPanel.innerHTML = html;
  }
  if (emojiToggle && emojiPanel) {
    function positionEmojiPanel() {
      if (!emojiPanel || !panel || !foot) return;
      var panelRect = panel.getBoundingClientRect();
      var footRect = foot.getBoundingClientRect();
      var left = Math.max(8, panelRect.left + 10);
      var width = Math.max(160, panelRect.width - 20);
      var bottom = Math.max(12, window.innerHeight - footRect.top + 8);
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
      if (!emojiPanel) return;
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
      var input = $("#dwc-input", panel);
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
      if (!emojiPanel || emojiPanel.style.display !== "grid") return;
      if (emojiPanel.contains(e.target) || emojiToggle.contains(e.target))
        return;
      emojiPanel.style.display = "none";
    });
  }
  trackPage();
})();
