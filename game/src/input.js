// Keyboard + mouse input, with a virtual layer the autopilot (and the
// screenshot scenes) drive through the exact same keys a player presses.
export function createInput(canvas) {
  const keys = new Set();
  const virtual = new Set();
  const mouse = { x: 0, y: 0, down: false, virtualDown: false };
  const pressed = new Set();
  // Keys a consumer already acted on this frame: wasPressed() stops
  // reporting them, so one tap can never double-fire across sub-steps.
  const consumed = new Set();

  function keyName(e) {
    return e.key.length === 1 ? e.key.toLowerCase() : e.key;
  }

  window.addEventListener('keydown', (e) => {
    const k = keyName(e);
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) e.preventDefault();
    if (!keys.has(k)) pressed.add(k);
    keys.add(k);
  });
  window.addEventListener('keyup', (e) => keys.delete(keyName(e)));
  window.addEventListener('blur', () => keys.clear());

  canvas.addEventListener('mousemove', (e) => {
    const r = canvas.getBoundingClientRect();
    mouse.x = ((e.clientX - r.left) / r.width) * canvas.width;
    mouse.y = ((e.clientY - r.top) / r.height) * canvas.height;
  });
  canvas.addEventListener('mousedown', (e) => {
    if (e.button === 0) mouse.down = true;
  });
  window.addEventListener('mouseup', () => {
    mouse.down = false;
  });

  return {
    keys,
    mouse,
    // True while the key is held, real or virtual.
    down(code) {
      return keys.has(code) || virtual.has(code);
    },
    // True only on the frame the key went down, and only until consumed.
    wasPressed(code) {
      return pressed.has(code) && !consumed.has(code);
    },
    // Mark a press handled so later sub-steps in the same frame ignore it.
    consume(code) {
      consumed.add(code);
    },
    // The autopilot / tests press keys through here.
    setVirtual(code, on) {
      if (on) virtual.add(code);
      else virtual.delete(code);
    },
    // A virtual tap: held this frame and counts as freshly pressed.
    pressVirtual(code) {
      virtual.add(code);
      pressed.add(code);
    },
    clearVirtual() {
      virtual.clear();
      mouse.virtualDown = false;
    },
    setVirtualMouse(x, y, down) {
      mouse.x = x;
      mouse.y = y;
      mouse.virtualDown = down;
    },
    get mouseDown() {
      return mouse.down || mouse.virtualDown;
    },
    endFrame() {
      pressed.clear();
      consumed.clear();
    },
  };
}
