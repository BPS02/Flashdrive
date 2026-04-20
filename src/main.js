const { app, BrowserWindow, ipcMain, screen } = require('electron');
const path = require('path');
const { mouse, Point, Button, keyboard, Key } = require('@nut-tree-fork/nut-js');

mouse.config.mouseSpeed = 2000;

function createWindow() {
  const win = new BrowserWindow({
    width: 700,
    height: 500,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      backgroundThrottling: false,
    },
  });

  win.loadFile(path.join(__dirname, 'index.html'));
  win.webContents.openDevTools({ mode: 'detach' });
}

app.whenReady().then(createWindow);

async function emergencyRelease() {
  const modifiers = [
    Key.LeftControl, Key.RightControl,
    Key.LeftSuper, Key.RightSuper,
    Key.LeftAlt, Key.RightAlt,
    Key.LeftShift, Key.RightShift,
  ];
  try {
    await keyboard.releaseKey(...modifiers);
  } catch {}
  for (const btn of [Button.LEFT, Button.RIGHT, Button.MIDDLE]) {
    try { await mouse.releaseButton(btn); } catch {}
  }
}

let cleaningUp = false;
app.on('before-quit', (e) => {
  if (cleaningUp) return;
  e.preventDefault();
  cleaningUp = true;
  emergencyRelease().finally(() => app.exit(0));
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

ipcMain.handle('mouse:move-by', async (_event, dx, dy) => {
  try {
    const current = await mouse.getPosition();
    const { width, height } = screen.getPrimaryDisplay().size;
    const nextX = Math.min(Math.max(0, Math.round(current.x + dx)), width - 1);
    const nextY = Math.min(Math.max(0, Math.round(current.y + dy)), height - 1);
    await mouse.setPosition(new Point(nextX, nextY));
  } catch (err) {
    console.error('mouse:move-by failed', err);
  }
});

const CLICK_BUTTONS = {
  left: Button.LEFT,
  right: Button.RIGHT,
  middle: Button.MIDDLE,
};

ipcMain.handle('mouse:click', async (_event, which) => {
  const btn = CLICK_BUTTONS[which];
  if (btn === undefined) return;
  try {
    await mouse.click(btn);
  } catch (err) {
    console.error('mouse:click failed', err);
  }
});

ipcMain.handle('mouse:press', async (_event, which) => {
  const btn = CLICK_BUTTONS[which];
  if (btn === undefined) return;
  try {
    await mouse.pressButton(btn);
  } catch (err) {
    console.error('mouse:press failed', err);
  }
});

ipcMain.handle('mouse:release', async (_event, which) => {
  const btn = CLICK_BUTTONS[which];
  if (btn === undefined) return;
  try {
    await mouse.releaseButton(btn);
  } catch (err) {
    console.error('mouse:release failed', err);
  }
});

ipcMain.handle('mouse:scroll', async (_event, direction, amount) => {
  try {
    const steps = Math.max(1, Math.round(amount ?? 2));
    if (direction === 'up') await mouse.scrollUp(steps);
    else if (direction === 'down') await mouse.scrollDown(steps);
  } catch (err) {
    console.error('mouse:scroll failed', err);
  }
});

const KEY_NAMES = {
  ctrl: Key.LeftControl,
  win: Key.LeftSuper,
  alt: Key.LeftAlt,
  shift: Key.LeftShift,
  space: Key.Space,
  enter: Key.Enter,
  escape: Key.Escape,
  delete: Key.Delete,
  backspace: Key.Backspace,
};

function resolveKeys(names) {
  return names.map((n) => KEY_NAMES[n]).filter((k) => k !== undefined);
}

ipcMain.handle('keys:hold', async (_event, names) => {
  const keys = resolveKeys(names);
  if (keys.length === 0) return;
  try {
    await keyboard.pressKey(...keys);
  } catch (err) {
    console.error('keys:hold failed', err);
  }
});

ipcMain.handle('keys:release', async (_event, names) => {
  const keys = resolveKeys(names);
  if (keys.length === 0) return;
  try {
    await keyboard.releaseKey(...keys);
  } catch (err) {
    console.error('keys:release failed', err);
  }
});

ipcMain.handle('keys:tap', async (_event, names) => {
  const keys = resolveKeys(names);
  if (keys.length === 0) return;
  try {
    await keyboard.pressKey(...keys);
    await keyboard.releaseKey(...keys);
  } catch (err) {
    console.error('keys:tap failed', err);
  }
});
