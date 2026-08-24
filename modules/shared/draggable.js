(function () {
  "use strict";

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function attachDraggable(options) {
    const element = options.element;
    const handle = options.handle || "header";
    const enabled = options.enabled || (() => true);
    const gap = Number.isFinite(options.gap) ? options.gap : 8;
    let drag = null;

    function handlePointerDown(event) {
      if (event.button !== 0 || !enabled()) return;
      const header = event.target.closest(handle);
      if (!header) return;
      if (event.target.closest("button, input, select, textarea, a, [contenteditable='true']")) return;
      const matrix = new DOMMatrixReadOnly(getComputedStyle(element).transform);
      drag = {
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        translateX: matrix.m41,
        translateY: matrix.m42,
      };
      try { header.setPointerCapture(event.pointerId); } catch (error) {}
    }

    function handlePointerMove(event) {
      if (!drag || drag.pointerId !== event.pointerId) return;
      const nextX = drag.translateX + event.clientX - drag.startX;
      const nextY = drag.translateY + event.clientY - drag.startY;
      const width = element.offsetWidth;
      const height = element.offsetHeight;
      const fitsX = width + gap * 2 <= window.innerWidth;
      const fitsY = height + gap * 2 <= window.innerHeight;
      const maxLeft = fitsX ? window.innerWidth - width - gap : nextX;
      const minLeft = fitsX ? gap : nextX;
      const maxTop = fitsY ? window.innerHeight - height - gap : nextY;
      const minTop = fitsY ? gap : nextY;
      element.style.transform = `translate(${clamp(nextX, minLeft, maxLeft)}px, ${clamp(nextY, minTop, maxTop)}px)`;
    }

    function handlePointerUp(event) {
      if (drag && drag.pointerId === event.pointerId) drag = null;
    }

    element.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    window.addEventListener("pointercancel", handlePointerUp);

    return function detach() {
      element.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
      window.removeEventListener("pointercancel", handlePointerUp);
    };
  }

  window.attachDraggable = attachDraggable;
})();
