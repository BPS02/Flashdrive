const statusEl = document.getElementById('status');
const statusTextEl = document.getElementById('statusText');
const lxEl = document.getElementById('lx');
const lyEl = document.getElementById('ly');
const lastActionEl = document.getElementById('lastAction');

const DEADZONE = 0.15;
const MAX_PIXELS_PER_FRAME = 20;

const BUTTON_ACTIONS = {
  0: { action: 'left' },
  1: { action: 'right' },
  2: { action: 'middle' },
};

const HOLD_COMBOS = {
  3: { keys: ['ctrl', 'win'], name: 'Wispr Flow' },
};

const HOLD_MOUSE = {
  4: { action: 'left', name: 'Click & drag' },
};

const TAP_KEYS = {
  9: { keys: ['enter'], name: 'Enter' },
  8: { keys: ['backspace'], name: 'Backspace' },
  16: { keys: ['alt', 'f4'], name: 'Close window (Alt+F4)' },
};

const OSK_TOGGLE_BUTTON = 5;
const OSK_LAYOUT = [
  ['q','w','e','r','t','y','u','i','o','p'],
  ['a','s','d','f','g','h','j','k','l'],
  ['z','x','c','v','b','n','m'],
  ['space','backspace','enter','close'],
];
let oskOpen = false;
let oskRow = 0;
let oskCol = 0;

const XBOX_LABELS = {
  0: 'A', 1: 'B', 2: 'X', 3: 'Y',
  4: 'LB', 5: 'RB', 6: 'LT', 7: 'RT',
  8: 'Back', 9: 'Start',
  10: 'LS', 11: 'RS',
  12: 'DPad Up', 13: 'DPad Down', 14: 'DPad Left', 15: 'DPad Right',
  16: 'Guide',
};

const PS_LABELS = {
  0: 'Cross', 1: 'Circle', 2: 'Square', 3: 'Triangle',
  4: 'L1', 5: 'R1', 6: 'L2', 7: 'R2',
  8: 'Share', 9: 'Options',
  10: 'L3', 11: 'R3',
  12: 'DPad Up', 13: 'DPad Down', 14: 'DPad Left', 15: 'DPad Right',
  16: 'PS',
};

let activeLabels = XBOX_LABELS;
let controllerType = 'xbox';

function detectControllerType(gamepad) {
  const id = (gamepad?.id || '').toLowerCase();
  if (
    id.includes('054c') ||
    id.includes('sony') ||
    id.includes('playstation') ||
    id.includes('dualshock') ||
    id.includes('dualsense') ||
    id.includes('wireless controller')
  ) {
    return 'playstation';
  }
  return 'xbox';
}

function label(idx) {
  return activeLabels[idx] ?? `Button ${idx}`;
}

const SCROLL_DEADZONE = 0.18;
const SCROLL_INTERVAL_MS = 25;
const SCROLL_MAX_STEPS = 6;
let scrollLastFired = 0;

function applyDeadzone(value) {
  if (Math.abs(value) < DEADZONE) return 0;
  const sign = Math.sign(value);
  const scaled = (Math.abs(value) - DEADZONE) / (1 - DEADZONE);
  return sign * scaled;
}

function curve(value) {
  const sign = Math.sign(value);
  return sign * value * value;
}

function showAction(text) {
  if (!lastActionEl) return;
  lastActionEl.textContent = text;
}

function chip(text) {
  return `<span class="btn-chip">${text}</span>`;
}

function row(buttons, description) {
  const group = Array.isArray(buttons)
    ? `<div class="btn-group">${buttons.map(chip).join('')}</div>`
    : chip(buttons);
  return `${group}<div class="control-desc">${description}</div>`;
}

function updateHint() {
  const hintEl = document.getElementById('hint');
  if (!hintEl) return;
  const L = activeLabels;
  hintEl.className = '';
  hintEl.innerHTML = `
    <div class="controls-grid">
      ${row('Left stick', 'Move cursor')}
      ${row('Right stick', 'Scroll (tilt harder to scroll faster)')}
      ${row(L[0], 'Left click')}
      ${row(L[1], 'Right click')}
      ${row(L[2], 'Middle click')}
      ${row([`Hold ${L[4]}`], 'Click &amp; drag')}
      ${row([`Hold ${L[3]}`], 'Wispr Flow — Ctrl + Win')}
      ${row(L[9], 'Enter')}
      ${row(L[8], 'Backspace')}
      ${row(L[16], 'Close window — Alt + F4')}
      ${row(L[5], 'Open / close on-screen keyboard')}
    </div>
    <div class="osk-note">
      <strong>On-screen keyboard mode:</strong>
      Flick the left stick to move between keys.
      ${chip(L[0])} types the highlighted key, ${chip(L[1])} closes the OSK.
    </div>
  `;
}

const buttonWasDown = new Map();

function releaseAllHolds() {
  for (const [indexStr, { keys }] of Object.entries(HOLD_COMBOS)) {
    const idx = Number(indexStr);
    if (buttonWasDown.get(idx)) {
      window.flashdrive.keysRelease(keys);
    }
  }
  for (const [indexStr, { action }] of Object.entries(HOLD_MOUSE)) {
    const idx = Number(indexStr);
    if (buttonWasDown.get(idx)) {
      window.flashdrive.mouseRelease(action);
    }
  }
  buttonWasDown.clear();
}

window.addEventListener('gamepadconnected', (e) => {
  controllerType = detectControllerType(e.gamepad);
  activeLabels = controllerType === 'playstation' ? PS_LABELS : XBOX_LABELS;
  statusTextEl.textContent = `Connected · ${e.gamepad.id}`;
  statusEl.classList.add('connected');
  updateHint();
});

window.addEventListener('gamepaddisconnected', () => {
  releaseAllHolds();
  statusTextEl.textContent = 'Controller disconnected';
  statusEl.classList.remove('connected');
});

window.addEventListener('beforeunload', () => {
  releaseAllHolds();
});

function updateOskFocus() {
  window.flashdrive.oskFocus(oskRow, oskCol);
}

function moveOskFocus(dr, dc) {
  const newRow = Math.max(0, Math.min(OSK_LAYOUT.length - 1, oskRow + dr));
  oskRow = newRow;
  oskCol = Math.max(0, Math.min(OSK_LAYOUT[oskRow].length - 1, oskCol + dc));
  updateOskFocus();
  showAction(`OSK focus: ${OSK_LAYOUT[oskRow][oskCol]}`);
}

async function toggleOsk() {
  releaseAllHolds();
  oskOpen = await window.flashdrive.oskToggle();
  if (oskOpen) {
    oskRow = 0;
    oskCol = 0;
    updateOskFocus();
    showAction('OSK opened');
  } else {
    showAction('OSK closed');
  }
}

async function pressOskKey() {
  const key = OSK_LAYOUT[oskRow][oskCol];
  if (key === 'space') {
    await window.flashdrive.oskTypeChar(' ');
    showAction('OSK → Space');
  } else if (key === 'backspace') {
    await window.flashdrive.keysTap(['backspace']);
    showAction('OSK → Backspace');
  } else if (key === 'enter') {
    await window.flashdrive.keysTap(['enter']);
    showAction('OSK → Enter');
  } else if (key === 'close') {
    await toggleOsk();
  } else {
    await window.flashdrive.oskTypeChar(key);
    showAction(`OSK → ${key}`);
  }
}

let pendingMove = false;

function computeEdges(pad) {
  const pressed = new Set();
  const released = new Set();
  for (let i = 0; i < pad.buttons.length; i++) {
    const btn = pad.buttons[i];
    if (!btn) continue;
    const wasDown = buttonWasDown.get(i) ?? false;
    const isDown = btn.pressed;
    if (isDown && !wasDown) pressed.add(i);
    if (!isDown && wasDown) released.add(i);
    buttonWasDown.set(i, isDown);
  }
  return { pressed, released };
}

function handleNormalMode(edges) {
  for (const [indexStr, { action }] of Object.entries(BUTTON_ACTIONS)) {
    const idx = Number(indexStr);
    if (edges.pressed.has(idx)) {
      showAction(`${label(idx)} → ${action} click`);
      window.flashdrive.mouseClick(action);
    }
  }

  for (const [indexStr, { keys, name }] of Object.entries(HOLD_COMBOS)) {
    const idx = Number(indexStr);
    if (edges.pressed.has(idx)) {
      showAction(`${label(idx)} → hold ${keys.join('+')} (${name})`);
      window.flashdrive.keysHold(keys);
    } else if (edges.released.has(idx)) {
      showAction(`${label(idx)} released`);
      window.flashdrive.keysRelease(keys);
    }
  }

  for (const [indexStr, { keys, name }] of Object.entries(TAP_KEYS)) {
    const idx = Number(indexStr);
    if (edges.pressed.has(idx)) {
      showAction(`${label(idx)} → ${name}`);
      window.flashdrive.keysTap(keys);
    }
  }

  for (const [indexStr, { action, name }] of Object.entries(HOLD_MOUSE)) {
    const idx = Number(indexStr);
    if (edges.pressed.has(idx)) {
      showAction(`${label(idx)} → ${name} start`);
      window.flashdrive.mousePress(action);
    } else if (edges.released.has(idx)) {
      showAction(`${label(idx)} → ${name} end`);
      window.flashdrive.mouseRelease(action);
    }
  }
}

let lastStickDir = { x: 0, y: 0 };
const NAV_STICK_THRESHOLD = 0.55;

function stickDirection(x, y) {
  let dx = 0, dy = 0;
  if (x > NAV_STICK_THRESHOLD) dx = 1;
  else if (x < -NAV_STICK_THRESHOLD) dx = -1;
  if (y > NAV_STICK_THRESHOLD) dy = 1;
  else if (y < -NAV_STICK_THRESHOLD) dy = -1;
  return { x: dx, y: dy };
}

function handleOskMode(pad, edges) {
  const stick = stickDirection(pad.axes[0] ?? 0, pad.axes[1] ?? 0);
  if ((stick.x !== lastStickDir.x || stick.y !== lastStickDir.y) &&
      (stick.x !== 0 || stick.y !== 0)) {
    moveOskFocus(stick.y, stick.x);
  }
  lastStickDir = stick;

  if (edges.pressed.has(12)) moveOskFocus(-1, 0);
  if (edges.pressed.has(13)) moveOskFocus(1, 0);
  if (edges.pressed.has(14)) moveOskFocus(0, -1);
  if (edges.pressed.has(15)) moveOskFocus(0, 1);
  if (edges.pressed.has(0)) pressOskKey();
  if (edges.pressed.has(1)) toggleOsk();
}

async function pollGamepads() {
  const pads = navigator.getGamepads();
  const pad = pads.find(Boolean);

  if (pad) {
    if (pad.axes.length >= 2) {
      const rawX = pad.axes[0];
      const rawY = pad.axes[1];
      lxEl.textContent = rawX.toFixed(2);
      lyEl.textContent = rawY.toFixed(2);

      if (!oskOpen) {
        const x = applyDeadzone(rawX);
        const y = applyDeadzone(rawY);
        if ((x !== 0 || y !== 0) && !pendingMove) {
          const dx = curve(x) * MAX_PIXELS_PER_FRAME;
          const dy = curve(y) * MAX_PIXELS_PER_FRAME;
          pendingMove = true;
          window.flashdrive.mouseMoveBy(dx, dy).finally(() => {
            pendingMove = false;
          });
        }
      }
    }

    const edges = computeEdges(pad);

    if (edges.pressed.has(OSK_TOGGLE_BUTTON)) {
      toggleOsk();
    } else if (oskOpen) {
      handleOskMode(pad, edges);
    } else {
      handleNormalMode(edges);
    }

    if (!oskOpen && pad.axes.length >= 4) {
      const rawRY = pad.axes[3];
      const ry = Math.abs(rawRY) < SCROLL_DEADZONE ? 0 : rawRY;
      if (ry !== 0) {
        const now = performance.now();
        if (now - scrollLastFired >= SCROLL_INTERVAL_MS) {
          const magnitude = Math.min(1, Math.abs(ry));
          const steps = Math.max(1, Math.round(curve(magnitude) * SCROLL_MAX_STEPS));
          const direction = ry < 0 ? 'up' : 'down';
          window.flashdrive.mouseScroll(direction, steps);
          showAction(`Right stick → scroll ${direction} (${steps})`);
          scrollLastFired = now;
        }
      }
    }
  }

  requestAnimationFrame(pollGamepads);
}

requestAnimationFrame(pollGamepads);
