/**
 * Host-page loader for the chat widget.
 *
 * Usage:
 *   <script src="https://yourapp.com/embed.js" data-bot="pk_live_xxx" async></script>
 *
 * Talks to the iframe with postMessage:
 *   host  → widget  { source: "chatbot-embed",  type: "host" | "open" | "close" }
 *   widget → host   { source: "chatbot-widget", type: "ready" | "resize" | "close" }
 */
(function () {
  var script = document.currentScript;
  if (!script || !script.src) {
    return;
  }

  var publicKey = script.getAttribute("data-bot");
  if (!publicKey) {
    return;
  }

  var widgetOrigin = new URL(script.src).origin;
  var iframeSrc =
    widgetOrigin + "/widget.html?bot=" + encodeURIComponent(publicKey);

  var HOST_SOURCE = "chatbot-embed";
  var WIDGET_SOURCE = "chatbot-widget";

  var PANEL_WIDTH = 380;
  var PANEL_HEIGHT = 640;
  var BUBBLE_SIZE = 56;
  var GAP = 12;

  var root = document.createElement("div");
  root.setAttribute("data-chatbot-widget", publicKey);
  root.style.cssText = [
    "all: initial",
    "position: fixed",
    "right: 20px",
    "bottom: 20px",
    "z-index: 2147483000",
    "width: " + BUBBLE_SIZE + "px",
    "height: " + BUBBLE_SIZE + "px",
    "font-family: Segoe UI, system-ui, sans-serif",
  ].join(";");

  var frame = document.createElement("iframe");
  frame.src = iframeSrc;
  frame.title = "Chat widget";
  frame.setAttribute(
    "sandbox",
    "allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox",
  );
  frame.setAttribute("allow", "clipboard-write");
  frame.style.cssText = [
    "position: absolute",
    "right: 0",
    "bottom: " + (BUBBLE_SIZE + GAP) + "px",
    "width: " + PANEL_WIDTH + "px",
    "height: " + PANEL_HEIGHT + "px",
    "border: 0",
    "border-radius: 16px",
    "box-shadow: 0 12px 40px rgba(15, 23, 42, 0.22)",
    "background: #fff",
    "opacity: 0",
    "pointer-events: none",
    "transform: translateY(10px)",
    "transition: opacity 160ms ease, transform 160ms ease",
  ].join(";");

  var bubble = document.createElement("button");
  bubble.type = "button";
  bubble.setAttribute("aria-label", "Open chat");
  bubble.setAttribute("aria-expanded", "false");
  bubble.style.cssText = [
    "position: absolute",
    "right: 0",
    "bottom: 0",
    "width: " + BUBBLE_SIZE + "px",
    "height: " + BUBBLE_SIZE + "px",
    "border: 0",
    "border-radius: 50%",
    "padding: 0",
    "cursor: pointer",
    "color: #fff",
    "background: #4f46e5",
    "box-shadow: 0 8px 24px rgba(79, 70, 229, 0.45)",
    "display: grid",
    "place-items: center",
  ].join(";");
  bubble.innerHTML =
    '<svg width="26" height="26" viewBox="0 0 24 24" fill="none" aria-hidden="true">' +
    '<path d="M5 6.8A2.8 2.8 0 0 1 7.8 4h8.4A2.8 2.8 0 0 1 19 6.8v6.4A2.8 2.8 0 0 1 16.2 16H9l-4 3.2V6.8Z" fill="currentColor"/>' +
    "</svg>";

  var open = false;

  var postToWidget = function (type) {
    if (!frame.contentWindow) {
      return;
    }
    frame.contentWindow.postMessage(
      { source: HOST_SOURCE, type: type },
      widgetOrigin,
    );
  };

  var applyOpen = function (next) {
    open = next;
    bubble.setAttribute("aria-expanded", open ? "true" : "false");
    bubble.setAttribute("aria-label", open ? "Close chat" : "Open chat");
    frame.style.opacity = open ? "1" : "0";
    frame.style.pointerEvents = open ? "auto" : "none";
    frame.style.transform = open ? "translateY(0)" : "translateY(10px)";
    postToWidget(open ? "open" : "close");
  };

  bubble.addEventListener("click", function () {
    applyOpen(!open);
  });

  frame.addEventListener("load", function () {
    postToWidget("host");
  });

  window.addEventListener("message", function (event) {
    if (
      event.origin !== widgetOrigin ||
      !event.data ||
      event.data.source !== WIDGET_SOURCE
    ) {
      return;
    }

    if (event.data.type === "ready" && event.data.accentColor) {
      bubble.style.background = String(event.data.accentColor);
      return;
    }

    if (event.data.type === "close") {
      applyOpen(false);
      return;
    }

    if (event.data.type === "resize") {
      var width = Number(event.data.width);
      var height = Number(event.data.height);
      if (width > 0) {
        frame.style.width = Math.min(width, window.innerWidth - 24) + "px";
      }
      if (height > 0) {
        frame.style.height =
          Math.min(height, window.innerHeight - BUBBLE_SIZE - 40) + "px";
      }
    }
  });

  root.appendChild(frame);
  root.appendChild(bubble);
  document.body.appendChild(root);
})();
