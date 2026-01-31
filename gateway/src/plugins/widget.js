/* Discord WebChat Widget (ES5) */
(function () {
  if (window.DiscordWebChat) return;
  window.DiscordWebChat = true;

  var API_BASE = document.currentScript.getAttribute('data-base') || '';
  var ws;
  var sessionUuid;

  function el(tag, cls) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    return e;
  }

  function initUI() {
    var box = el('div', 'ah-chat');
    box.innerHTML =
      '<div class="ah-header">Live Help</div>' +
      '<div class="ah-body"></div>' +
      '<div class="ah-input">' +
      '<input type="text" placeholder="Type a message..." />' +
      '<button>Send</button>' +
      '</div>';
    document.body.appendChild(box);

    var input = box.querySelector('input');
    var btn = box.querySelector('button');
    var body = box.querySelector('.ah-body');

    btn.onclick = function () {
      if (!input.value) return;
      sendMessage(input.value);
      addBubble('You', input.value);
      input.value = '';
    };

    function addBubble(who, text) {
      var b = el('div', 'ah-msg');
      b.innerHTML = '<strong>' + who + ':</strong> ' + text;
      body.appendChild(b);
      body.scrollTop = body.scrollHeight;
    }

    window._ahAddBubble = addBubble;
  }

  function startSession() {
    fetch(API_BASE + '/api/session/start-guest', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    })
      .then(function (r) { return r.json(); })
      .then(function (d) {
        sessionUuid = d.sessionUuid;
        connectWS();
      });
  }

  function connectWS() {
    ws = new WebSocket(API_BASE.replace(/^http/, 'ws') + '/ws');

    ws.onopen = function () {
      ws.send(JSON.stringify({
        type: 'hello',
        sessionUuid: sessionUuid
      }));
    };

    ws.onmessage = function (ev) {
      var msg = JSON.parse(ev.data);
      if (msg.type === 'agent_message') {
        window._ahAddBubble('Agent', msg.text);
      }
    };
  }

  function sendMessage(text) {
    if (!ws) return;
    ws.send(JSON.stringify({
      type: 'visitor_message',
      text: text
    }));
  }

  // boot
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initUI);
  } else {
    initUI();
  }
  startSession();
})();
