// NEON HARBOR — input: keyboard + mouse state, camera orbit drag, aim.
(function () {
  var NH = window.NH;
  var input = NH.input = {
    keys: {},
    mouseX: 0, mouseY: 0, dragging: false, lastX: 0, lastY: 0,
    yawDelta: 0, pitchDelta: 0,
    leftDown: false, rightDown: false,
    clicked: false, // left click edge (consumed by combat)
    pressed: {},    // key edge (consumed by game code)
    aim: false
  };

  window.addEventListener('keydown', function (e) {
    if (e.repeat) return;
    input.keys[e.code] = true;
    input.pressed[e.code] = true;
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].indexOf(e.code) >= 0) e.preventDefault();
  });
  window.addEventListener('keyup', function (e) { input.keys[e.code] = false; });
  window.addEventListener('blur', function () { input.keys = {}; input.dragging = false; });

  function onMove(e) {
    if (!input.dragging) return;
    input.yawDelta -= (e.clientX - input.lastX) * 0.005;
    input.pitchDelta -= (e.clientY - input.lastY) * 0.004;
    input.lastX = e.clientX; input.lastY = e.clientY;
  }
  window.addEventListener('mousemove', onMove);
  window.addEventListener('mousedown', function (e) {
    if (e.button === 0) { input.leftDown = true; input.clicked = true; }
    if (e.button === 2) { input.rightDown = true; input.aim = true; }
    if (e.button === 0 || e.button === 2) {
      input.dragging = true; input.lastX = e.clientX; input.lastY = e.clientY;
    }
  });
  window.addEventListener('mouseup', function (e) {
    if (e.button === 0) input.leftDown = false;
    if (e.button === 2) { input.rightDown = false; input.aim = false; }
    if (!input.leftDown && !input.rightDown) input.dragging = false;
  });
  window.addEventListener('contextmenu', function (e) { e.preventDefault(); });

  // Movement axes relative to the camera yaw: x = strafe, z = forward.
  input.moveAxis = function (camYaw) {
    var f = 0, s = 0;
    if (input.keys['KeyW'] || input.keys['ArrowUp']) f += 1;
    if (input.keys['KeyS'] || input.keys['ArrowDown']) f -= 1;
    if (input.keys['KeyA'] || input.keys['ArrowLeft']) s -= 1;
    if (input.keys['KeyD'] || input.keys['ArrowRight']) s += 1;
    var sin = Math.sin(camYaw), cos = Math.cos(camYaw);
    // forward = (-sin, -cos) in world xz for yaw around Y
    return { x: -sin * f + cos * s, z: -cos * f - sin * s };
  };

  input.consumeClick = function () { var c = input.clicked; input.clicked = false; return c; };
  input.consumeKey = function (code) { var p = !!input.pressed[code]; input.pressed[code] = false; return p; };
  input.endFrame = function () {
    input.yawDelta = 0; input.pitchDelta = 0;
    input.clicked = false;
  };
})();
