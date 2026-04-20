const statusEl = document.getElementById('status');
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
};

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

function updateHint() {
  const hintEl = document.getElementById('hint');
  if (!hintEl) return;
  const L = activeLabels;
  hintEl.innerHTML = `
    <strong>Controls (${controllerType === 'playstation' ? 'PlayStation' : 'Xbox'}):</strong>
    Left stick moves the cursor.
    <strong>${L[0]}</strong> = left click,
    <strong>${L[1]}</strong> = right click,
    <strong>${L[2]}</strong> = middle click.
    <strong>Hold ${L[4]}</strong> = click &amp; drag.
    <strong>Right stick up/down</strong> = scroll.
    <strong>${L[9]}</strong> = Enter.
    <strong>${L[8]}</strong> = Backspace.
    <strong>Hold ${L[3]}</strong> = Wispr Flow (Ctrl + Win).
  `;
}

window.addEventListener('gamepadconnected', (e) => {
  controllerType = detectControllerType(e.gamepad);
  activeLabels = controllerType === 'playstation' ? PS_LABELS : XBOX_LABELS;
  statusEl.textContent = `Connected: ${e.gamepad.id}`;
  statusEl.classList.add('connected');
  updateHint();
});

window.addEventListener('gamepaddisconnected', () => {
  releaseAllHolds();
  statusEl.textContent = 'Controller disconnected.';
  statusEl.classList.remove('connected');
});

window.addEventListener('beforeunload', () => {
  releaseAllHolds();
});

let pendingMove = false;
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

async function pollGamepads() {
  const pads = navigator.getGamepads();
  const pad = pads.find(Boolean);

  if (pad) {
    if (pad.axes.length >= 2) {
      const rawX = pad.axes[0];
      const rawY = pad.axes[1];
      const x = applyDeadzone(rawX);
      const y = applyDeadzone(rawY);

      lxEl.textContent = rawX.toFixed(2);
      lyEl.textContent = rawY.toFixed(2);

      if ((x !== 0 || y !== 0) && !pendingMove) {
        const dx = curve(x) * MAX_PIXELS_PER_FRAME;
        const dy = curve(y) * MAX_PIXELS_PER_FRAME;
        pendingMove = true;
        window.flashdrive.mouseMoveBy(dx, dy).finally(() => {
          pendingMove = false;
        });
      }
    }

    for (const [indexStr, { action }] of Object.entries(BUTTON_ACTIONS)) {
      const idx = Number(indexStr);
      const btn = pad.buttons[idx];
      if (!btn) continue;
      const wasDown = buttonWasDown.get(idx) ?? false;
      const isDown = btn.pressed;
      if (isDown && !wasDown) {
        showAction(`${label(idx)} → ${action} click`);
        window.flashdrive.mouseClick(action);
      }
      buttonWasDown.set(idx, isDown);
    }

    for (const [indexStr, { keys, name }] of Object.entries(HOLD_COMBOS)) {
      const idx = Number(indexStr);
      const btn = pad.buttons[idx];
      if (!btn) continue;
      const wasDown = buttonWasDown.get(idx) ?? false;
      const isDown = btn.pressed;
      if (isDown && !wasDown) {
        showAction(`${label(idx)} → hold ${keys.join('+')} (${name})`);
        window.flashdrive.keysHold(keys);
      } else if (!isDown && wasDown) {
        showAction(`${label(idx)} released`);
        window.flashdrive.keysRelease(keys);
      }
      buttonWasDown.set(idx, isDown);
    }

    for (const [indexStr, { keys, name }] of Object.entries(TAP_KEYS)) {
      const idx = Number(indexStr);
      const btn = pad.buttons[idx];
      if (!btn) continue;
      const wasDown = buttonWasDown.get(idx) ?? false;
      const isDown = btn.pressed;
      if (isDown && !wasDown) {
        showAction(`${label(idx)} → ${name}`);
        window.flashdrive.keysTap(keys);
      }
      buttonWasDown.set(idx, isDown);
    }

    for (const [indexStr, { action, name }] of Object.entries(HOLD_MOUSE)) {
      const idx = Number(indexStr);
      const btn = pad.buttons[idx];
      if (!btn) continue;
      const wasDown = buttonWasDown.get(idx) ?? false;
      const isDown = btn.pressed;
      if (isDown && !wasDown) {
        showAction(`${label(idx)} → ${name} start`);
        window.flashdrive.mousePress(action);
      } else if (!isDown && wasDown) {
        showAction(`${label(idx)} → ${name} end`);
        window.flashdrive.mouseRelease(action);
      }
      buttonWasDown.set(idx, isDown);
    }

    if (pad.axes.length >= 4) {
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
