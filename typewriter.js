/* Keeps the active visual line of an autosizing textarea centered in its scroll pane. */
(() => {
  "use strict";

  function attach({ editor, scroller, before, after, isEnabled }) {
    let frame = 0;
    let composing = false;
    let dragging = false;
    let destroyed = false;
    let trackingStarted = false;
    const listeners = [];
    const originalBeforeHeight = before.style.height;
    const originalAfterHeight = after.style.height;
    const mirror = document.createElement("div");
    mirror.setAttribute("aria-hidden", "true");
    mirror.setAttribute("inert", "");
    Object.assign(mirror.style, {
      position: "fixed",
      left: "-100000px",
      top: "0",
      visibility: "hidden",
      pointerEvents: "none",
      height: "auto",
      minHeight: "0",
      maxHeight: "none",
      overflow: "visible",
    });
    document.body.append(mirror);

    const metricProperties = [
      "boxSizing",
      "width",
      "paddingTop",
      "paddingRight",
      "paddingBottom",
      "paddingLeft",
      "borderTopWidth",
      "borderRightWidth",
      "borderBottomWidth",
      "borderLeftWidth",
      "borderTopStyle",
      "borderRightStyle",
      "borderBottomStyle",
      "borderLeftStyle",
      "fontFamily",
      "fontSize",
      "fontWeight",
      "fontStyle",
      "fontStretch",
      "fontVariant",
      "fontKerning",
      "fontFeatureSettings",
      "fontVariationSettings",
      "lineHeight",
      "letterSpacing",
      "wordSpacing",
      "textIndent",
      "textTransform",
      "textAlign",
      "textRendering",
      "direction",
      "tabSize",
      "whiteSpace",
      "overflowWrap",
      "wordBreak",
      "lineBreak",
    ];

    function listen(target, name, callback, options) {
      target.addEventListener(name, callback, options);
      listeners.push(() => target.removeEventListener(name, callback, options));
    }

    function reserveSpace() {
      const enabled = isEnabled();
      if (!enabled) trackingStarted = false;
      else if (document.activeElement === editor) trackingStarted = true;
      const height =
        enabled && trackingStarted
          ? Math.ceil(scroller.clientHeight / 2) + "px"
          : "0px";
      if (before.style.height !== height) before.style.height = height;
      if (after.style.height !== height) after.style.height = height;
    }

    function caretLineCenter() {
      const style = getComputedStyle(editor);
      for (const property of metricProperties)
        mirror.style[property] = style[property];
      // A visible editor has a definite pixel width; keep its exact wrapping width.
      mirror.style.width = style.width;
      const lineHeight =
        parseFloat(style.lineHeight) || parseFloat(style.fontSize) * 1.2;
      // The editor uses unitless leading. Keeping that ratio also preserves the
      // browser's subpixel rounding; copying its computed pixel value can make
      // the mirror drift by several pixels over a long wrapped scene.
      mirror.style.lineHeight = String(lineHeight / parseFloat(style.fontSize));
      const paddingTop = parseFloat(style.paddingTop) || 0;
      const borderTop = parseFloat(style.borderTopWidth) || 0;
      const marker = document.createElement("span");
      marker.textContent = "\u200b";
      mirror.replaceChildren(marker);
      const firstGlyphTop = marker.getBoundingClientRect().top;
      const position =
        editor.selectionDirection === "backward"
          ? editor.selectionStart
          : editor.selectionEnd;
      const value = editor.value;
      marker.textContent = value.slice(position) || "\u200b";
      mirror.replaceChildren(
        document.createTextNode(value.slice(0, position)),
        marker,
      );
      // getBoundingClientRect() spans every wrapped fragment. The first fragment
      // identifies the active line, including a caret immediately before a newline.
      const fragment =
        marker.getClientRects()[0] || marker.getBoundingClientRect();
      // Use the browser's measured line-box displacement. Multiplying a row
      // count by nominal line-height accumulates subpixel rounding on long text.
      const lineOffset = Math.max(0, fragment.top - firstGlyphTop);
      return (
        borderTop + paddingTop + lineOffset + lineHeight / 2 - editor.scrollTop
      );
    }

    function center() {
      frame = 0;
      if (
        destroyed ||
        composing ||
        dragging ||
        !isEnabled() ||
        document.activeElement !== editor ||
        document.querySelector("dialog[open]") ||
        !editor.getClientRects().length ||
        scroller.clientHeight <= 0
      )
        return;
      const pane = scroller.getBoundingClientRect();
      const target =
        scroller.scrollTop +
        editor.getBoundingClientRect().top +
        caretLineCenter() -
        (pane.top + scroller.clientTop + scroller.clientHeight / 2);
      const bounded = Math.max(
        0,
        Math.min(target, scroller.scrollHeight - scroller.clientHeight),
      );
      if (Math.abs(scroller.scrollTop - bounded) < 0.5) return;
      try {
        scroller.scrollTo({
          top: bounded,
          left: scroller.scrollLeft,
          behavior: "instant",
        });
      } catch {
        scroller.scrollTop = bounded;
      }
    }

    function schedule() {
      if (!destroyed && !frame) frame = requestAnimationFrame(center);
    }

    function sync() {
      if (destroyed) return;
      reserveSpace();
      schedule();
    }

    listen(editor, "input", schedule);
    listen(editor, "keyup", schedule);
    listen(editor, "click", schedule);
    listen(editor, "select", schedule);
    listen(editor, "focus", sync);
    listen(editor, "blur", () => {
      composing = false;
      if (frame) cancelAnimationFrame(frame);
      frame = 0;
    });
    listen(editor, "compositionstart", () => {
      composing = true;
    });
    listen(editor, "compositionend", () => {
      composing = false;
      schedule();
    });
    listen(editor, "pointerdown", () => {
      dragging = true;
    });
    const releasePointer = () => {
      if (!dragging) return;
      dragging = false;
      schedule();
    };
    listen(document, "pointerup", releasePointer);
    listen(document, "pointercancel", releasePointer);
    listen(window, "blur", () => {
      dragging = false;
    });
    listen(document, "selectionchange", () => {
      if (document.activeElement === editor && !dragging) schedule();
    });
    listen(window, "resize", sync);
    const observer =
      typeof ResizeObserver === "function" ? new ResizeObserver(sync) : null;
    observer?.observe(editor);
    observer?.observe(scroller);
    // No scroll listener: a writer may browse away from the caret manually.
    sync();

    return {
      sync,
      destroy() {
        if (destroyed) return;
        destroyed = true;
        if (frame) cancelAnimationFrame(frame);
        observer?.disconnect();
        listeners.forEach((remove) => remove());
        mirror.remove();
        before.style.height = originalBeforeHeight;
        after.style.height = originalAfterHeight;
      },
    };
  }

  window.YeobaekTypewriter = Object.freeze({ attach });
})();
