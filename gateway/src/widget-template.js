/**
 * Discord WebChat Widget (ES5-safe)
 * Loaded via <script src="https://your-gateway.example.com/widget.js?v=5" defer data-mode="guest" data-baseurl="https://your-gateway.example.com"></script>
 */
(function () {
  function $(sel, root) {
    return (root || document).querySelector(sel);
  }
  function el(tag, attrs) {
    var e = document.createElement(tag);
    if (attrs) {
      for (var k in attrs) {
        if (!Object.prototype.hasOwnProperty.call(attrs, k)) continue;
        if (k === "class") e.className = attrs[k];
        else if (k === "text") e.textContent = attrs[k];
        else e.setAttribute(k, attrs[k]);
      }
    }
    return e;
  }
  function safeJsonParse(s) {
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

  // Collect config from data-* and global
  var cs = document.currentScript;
  var ds = {};
  if (cs && cs.dataset) ds = cs.dataset;

  var cfg = window.DWC_CONFIG || window.DWC || {};
  var mode = cfg.mode || ds.mode || "guest";
  var baseUrl = cfg.baseUrl || cfg.baseurl || ds.baseurl || ds.baseUrl || "";
  if (!baseUrl) {
    // infer from script src
    if (cs && cs.src) {
      var m = cs.src.match(/^(https?:\/\/[^\/]+)/i);
      if (m) baseUrl = m[1];
    }
  }
  if (!baseUrl) baseUrl = "";

  // Theme / branding
  var theme = cfg.theme || ds.theme || "dark";
  var label = cfg.chatLabel || ds.chatLabel || ds.label || "Live Help";
  var logoUrl = cfg.logoUrl || ds.logoUrl || "";

  function applyTheme(root) {
    // CSS variables; values are injected server-side if present, but we also support runtime cfg
    var vars = cfg.vars || null;
    if (!vars) return;
    for (var k in vars) {
      if (!Object.prototype.hasOwnProperty.call(vars, k)) continue;
      root.style.setProperty(k, vars[k]);
    }
  }

  // DOM
  var host = el("div", { class: "dwc-host" });
  var bubble = el("button", {
    class: "dwc-bubble",
    type: "button",
    "aria-label": "Open chat",
  });
  bubble.textContent = "Chat";
  var panel = el("div", { class: "dwc-panel", "aria-hidden": "true" });

  var header = el("div", { class: "dwc-header" });
  if (logoUrl) {
    var img = el("img", { class: "dwc-logo", src: logoUrl, alt: "" });
    header.appendChild(img);
  }
  header.appendChild(el("div", { class: "dwc-title", text: label }));
  var closeBtn = el("button", {
    class: "dwc-close",
    type: "button",
    "aria-label": "Close chat",
    text: "×",
  });
  header.appendChild(closeBtn);

  var body = el("div", { class: "dwc-body" });
  var messages = el("div", { class: "dwc-messages" });

  var pre = el("div", { class: "dwc-pre" });
  var nameInput = el("input", {
    class: "dwc-input",
    placeholder: "Your name",
  });
  var emailInput = el("input", {
    class: "dwc-input",
    placeholder: "Your email (optional)",
  });
  var startBtn = el("button", {
    class: "dwc-start",
    type: "button",
    text: "Start chat",
  });
  pre.appendChild(nameInput);
  pre.appendChild(emailInput);
  pre.appendChild(startBtn);

  var composer = el("div", { class: "dwc-composer" });
  var emojiToggle = el("button", {
    class: "dwc-emoji-toggle",
    type: "button",
    text: "😊",
  });
  var emojiPanel = el("div", { class: "dwc-emoji-panel" });
  var msgInput = el("input", {
    class: "dwc-msg",
    placeholder: "Type a message...",
  });
  var sendBtn = el("button", {
    class: "dwc-send",
    type: "button",
    text: "Send",
  });
  var endBtn = el("button", {
    class: "dwc-end",
    type: "button",
    text: "End",
  });
  composer.appendChild(emojiToggle);
  composer.appendChild(emojiPanel);
  composer.appendChild(msgInput);
  composer.appendChild(sendBtn);
  composer.appendChild(endBtn);

  body.appendChild(messages);
  body.appendChild(pre);
  body.appendChild(composer);

  panel.appendChild(header);
  panel.appendChild(body);

  host.appendChild(panel);
  host.appendChild(bubble);
  document.body.appendChild(host);

  // Base styles (minimal; server can override)
  var css =
    "" +
    ":root{--dwc-accent:#3b82f6;--dwc-bg:#0b0f14;--dwc-panel:#0f172a;--dwc-text:#e5e7eb;--dwc-muted:#94a3b8;--dwc-visitor:#1f2937;--dwc-agent:#111827;--dwc-error:#ef4444;}" +
    ".dwc-host{position:fixed;right:22px;bottom:22px;z-index:2147483646;font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;}" +
    ".dwc-bubble{background:var(--dwc-panel);color:var(--dwc-text);border:1px solid rgba(255,255,255,.08);border-radius:16px;padding:10px 14px;cursor:pointer;}" +
    ".dwc-panel{width:340px;height:520px;background:var(--dwc-bg);border:1px solid rgba(255,255,255,.08);border-radius:18px;box-shadow:0 30px 80px rgba(0,0,0,.45);display:none;overflow:hidden;}" +
    ".dwc-header{position:relative !important;display:flex;align-items:center !important;gap:10px;padding:12px 14px;background:rgba(255,255,255,.03);border-bottom:1px solid rgba(255,255,255,.06);}" +
    ".dwc-logo{width:18px;height:18px;border-radius:4px;}" +
    ".dwc-title{flex:1;color:var(--dwc-text);font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;padding-right:28px;}" +
    ".dwc-close{position:absolute !important;top:6px;right:8px;left:auto;background:transparent;border:0;color:var(--dwc-muted);font-size:22px;line-height:1;cursor:pointer;margin:0;margin-left:auto;padding:0;min-width:0;min-height:0;width:24px;height:24px;display:inline-flex;align-items:center;justify-content:center;}" +
    ".dwc-body{display:flex;flex-direction:column;height:calc(100% - 52px);}" +
    ".dwc-messages{flex:1;overflow:auto;padding:12px;display:flex;flex-direction:column;gap:10px;}" +
    ".dwc-pre{padding:12px;display:flex;flex-direction:column;gap:10px;border-top:1px solid rgba(255,255,255,.06);}" +
    ".dwc-composer{position:relative;padding:12px;display:none;gap:10px;border-top:1px solid rgba(255,255,255,.06);align-items:center;flex-wrap:nowrap;}" +
    ".dwc-composer > *{flex:0 0 auto !important}" +
    ".dwc-composer button{position:static !important;float:none !important;margin:0 !important;width:auto !important;display:inline-flex !important;align-items:center;justify-content:center;}" +
    ".dwc-emoji-toggle{border:1px solid rgba(255,255,255,.12);background:transparent;color:var(--dwc-text);border-radius:8px;padding:6px 8px;cursor:pointer;font-size:14px;line-height:1;}" +
    ".dwc-emoji-panel{position:fixed;bottom:56px;left:12px;right:12px;display:none;grid-template-columns:repeat(10,1fr);gap:6px;padding:8px;border-radius:10px;background:rgba(15,23,42,.98);border:1px solid rgba(255,255,255,.12);max-height:220px;overflow:auto;z-index:2147483002;pointer-events:auto;box-shadow:0 12px 30px rgba(0,0,0,.35);}" +
    ".dwc-emoji-panel *{pointer-events:auto !important}" +
    ".dwc-emoji-panel button{border:1px solid rgba(255,255,255,.08);background:transparent;color:var(--dwc-text);border-radius:8px;padding:6px 0;cursor:pointer;font-size:16px;line-height:1;}" +
    ".dwc-input,.dwc-msg{width:auto !important;min-width:0 !important;max-width:100%;display:block !important;visibility:visible !important;opacity:1 !important;padding:10px 12px;border-radius:12px;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.08);color:var(--dwc-text);outline:none;}" +
    ".dwc-msg{flex:1 1 auto !important;min-width:0 !important;}" +
    ".dwc-send,.dwc-start{background:var(--dwc-accent);color:white;border:0;border-radius:12px;padding:10px 12px;cursor:pointer;font-weight:600;}" +
    ".dwc-send{flex:0 0 auto !important;max-width:90px;white-space:nowrap;font-size:13px;padding:8px 10px;line-height:1.1;display:inline-flex;align-items:center;justify-content:center;}" +
    ".dwc-end{flex:0 0 auto !important;max-width:90px;white-space:nowrap;font-size:13px;padding:8px 10px;line-height:1.1;border-radius:12px;border:1px solid rgba(255,255,255,.2);background:transparent;color:var(--dwc-text);display:inline-flex;align-items:center;justify-content:center;}" +
    ".dwc-b{max-width:78%;padding:10px 12px;border-radius:14px;color:var(--dwc-text);word-wrap:break-word;white-space:pre-wrap;}" +
    ".dwc-b.visitor{align-self:flex-end;background:var(--dwc-visitor);}" +
    ".dwc-b.agent{align-self:flex-start;background:var(--dwc-agent);}" +
    ".dwc-small{font-size:12px;color:var(--dwc-muted);}";
  var style = el("style");
  style.type = "text/css";
  style.appendChild(document.createTextNode(css));
  document.head.appendChild(style);

  applyTheme(document.documentElement);

  // state
  var sessionUuid = null;
  var ws = null;
  var wsUrl = null;
  var reconnectTimer = null;
  var lastHello = null;

  function log() {
    if (window.DWC_DEBUG) {
      try {
        console.log.apply(console, arguments);
      } catch (e) {}
    }
  }

  function addMsg(who, text) {
    var b = el("div", { class: "dwc-b " + who });
    b.innerHTML = renderMessage(text);
    messages.appendChild(b);
    // scroll
    messages.scrollTop = messages.scrollHeight;
    if (sessionUuid) saveHistory(sessionUuid, who, text);
  }

  function saveHistory(sessionId, who, text) {
    if (!sessionId) return;
    try {
      var key = "dwc_history_" + sessionId;
      var raw = localStorage.getItem(key);
      var arr = raw ? safeJsonParse(raw) : [];
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
      var arr = raw ? safeJsonParse(raw) : [];
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
    items.forEach(function (it) {
      var b = el("div", { class: "dwc-b " + (it.who || "agent") });
      b.innerHTML = renderMessage(it.text);
      messages.appendChild(b);
    });
    messages.scrollTop = messages.scrollHeight;
  }

  function setConnectedUI(isConnected) {
    // no-op for now; could set status pill
  }

  function openPanel() {
    panel.style.display = "block";
    panel.setAttribute("aria-hidden", "false");
    bubble.style.display = "none";
    // if we already have session but ws closed, reconnect
    if (sessionUuid && (!ws || ws.readyState > 1)) connectWs();
  }
  function closePanel() {
    panel.style.display = "none";
    panel.setAttribute("aria-hidden", "true");
    bubble.style.display = "inline-block";
  }

  bubble.addEventListener("click", openPanel);
  closeBtn.addEventListener("click", closePanel);

  function http(method, path, body, cb) {
    var xhr = new XMLHttpRequest();
    xhr.open(method, baseUrl + path, true);
    xhr.withCredentials = false;
    if (method !== "GET")
      xhr.setRequestHeader("Content-Type", "application/json");
    xhr.onreadystatechange = function () {
      if (xhr.readyState !== 4) return;
      var ok = xhr.status >= 200 && xhr.status < 300;
      cb(ok, xhr.status, xhr.responseText);
    };
    xhr.send(body ? JSON.stringify(body) : null);
  }

  function startSession() {
    var visitorName = (nameInput.value || "").trim() || "Guest";
    var visitorEmail = (emailInput.value || "").trim() || null;
    var payload = {
      visitorName: visitorName,
      visitorEmail: visitorEmail,
      entryUrl: window.location.href,
      referrer: document.referrer || null,
    };
    log("startSession", payload);
    http(
      "POST",
      "/api/session/start-guest",
      payload,
      function (ok, status, text) {
        if (!ok) {
          addMsg("agent", "Error starting chat (" + status + ").");
          return;
        }
        var data = safeJsonParse(text) || {};
        sessionUuid = data.sessionUuid;
        wsUrl = data.wsUrl || baseUrl;
        addMsg("agent", "Connected. How can we help?");
        pre.style.display = "none";
        composer.style.display = "flex";
        restoreHistory();
        connectWs();
      },
    );
  }

  function connectWs() {
    if (!sessionUuid) return;
    try {
      if (ws && ws.readyState === 1) return;
      var wsBase = wsUrl || baseUrl;
      var u = wsBase.replace(/^http/i, "ws") + "/ws";
      log("connectWs", u);
      ws = new WebSocket(u);
      ws.onopen = function () {
        log("[ws] open");
        setConnectedUI(true);
        // hello
        var hello = { t: "hello", sessionUuid: sessionUuid, mode: mode };
        lastHello = hello;
        ws.send(JSON.stringify(hello));
      };
      ws.onmessage = function (evt) {
        var m = safeJsonParse(evt.data);
        if (!m) return;
        if (m.t === "agent_message" && m.text) addMsg("agent", m.text);
        if (m.t === "system" && m.text) addMsg("agent", m.text);
      };
      ws.onclose = function () {
        log("[ws] close");
        setConnectedUI(false);
        // reconnect if panel open or session exists
        if (reconnectTimer) clearTimeout(reconnectTimer);
        reconnectTimer = setTimeout(function () {
          if (sessionUuid) connectWs();
        }, 1500);
      };
      ws.onerror = function () {
        log("[ws] error");
      };
    } catch (e) {
      log("connectWs error", e);
    }
  }

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
  var emojiHtml = "";
  for (var i = 0; i < emojiList.length; i++) {
    emojiHtml +=
      '<button type="button" data-emoji="' +
      emojiList[i] +
      '">' +
      emojiList[i] +
      "</button>";
  }
  emojiPanel.innerHTML = emojiHtml;
  function positionEmojiPanel() {
    if (!emojiPanel || !panel || !composer) return;
    var panelRect = panel.getBoundingClientRect();
    var compRect = composer.getBoundingClientRect();
    var left = Math.max(8, panelRect.left + 12);
    var width = Math.max(160, panelRect.width - 24);
    var bottom = Math.max(12, window.innerHeight - compRect.top + 8);
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
    msgInput.value = (msgInput.value || "") + emoji;
    msgInput.focus();
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

  function sendMsg() {
    var text = (msgInput.value || "").trim();
    if (!text) return;
    msgInput.value = "";
    addMsg("visitor", text);
    if (ws && ws.readyState === 1) {
      ws.send(
        JSON.stringify({
          t: "visitor_message",
          sessionUuid: sessionUuid,
          text: text,
        }),
      );
    } else {
      addMsg("agent", "Disconnected. Reconnecting…");
      connectWs();
    }
  }

  function endChat() {
    if (!sessionUuid) {
      closePanel();
      return;
    }
    http(
      "POST",
      "/api/session/close",
      { sessionUuid: sessionUuid },
      function () {
        try {
          localStorage.removeItem("dwc_session");
        } catch (e) {}
        try {
          localStorage.removeItem("dwc_history_" + sessionUuid);
        } catch (e) {}
        sessionUuid = null;
        messages.innerHTML = "";
        closePanel();
      },
    );
  }

  startBtn.addEventListener("click", startSession);
  sendBtn.addEventListener("click", sendMsg);
  endBtn.addEventListener("click", endChat);
  msgInput.addEventListener("keydown", function (e) {
    if (e.key === "Enter") sendMsg();
  });

  // If they close the panel we keep session and reconnect on reopen
  restoreHistory();
})();
