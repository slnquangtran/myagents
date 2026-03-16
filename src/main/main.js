const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const Store = require('electron-store');

const store = new Store({
  name: 'cmdmana-config',
  defaults: {
    settings: {
      theme: 'dark',
      shell: 'cmd.exe'
    },
    windowState: {
      width: 1200,
      height: 800
    }
  }
});

let mainWindow = null;
const processes = new Map();

function createWindow() {
  const windowState = store.get('windowState');
  
  mainWindow = new BrowserWindow({
    width: windowState.width || 1200,
    height: windowState.height || 800,
    minWidth: 600,
    minHeight: 400,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    },
    show: false,
    backgroundColor: '#1E1E2E'
  });

  mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    console.log('[CmdMana] Application started');
  });

  mainWindow.on('resize', () => {
    const [width, height] = mainWindow.getSize();
    store.set('windowState', { width, height });
  });

  mainWindow.on('closed', () => {
    for (const [tabId, proc] of processes) {
      if (proc && !proc.killed) {
        proc.kill();
      }
    }
    processes.clear();
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

ipcMain.handle('get-settings', () => {
  return store.get('settings', { theme: 'dark', shell: 'cmd.exe' });
});

ipcMain.handle('save-settings', (event, settings) => {
  store.set('settings', settings);
  return settings;
});

ipcMain.handle('spawn-shell', async (event, { tabId, cwd }) => {
  return new Promise((resolve, reject) => {
    try {
      console.log(`[CmdMana] Spawning shell for ${tabId}`);
      
      const proc = spawn('cmd.exe', ['/Q'], {
        cwd: cwd || process.cwd(),
        env: process.env,
        windowsHide: false,
        stdio: 'pipe'
      });

      console.log(`[CmdMana] Process created with PID: ${proc.pid}`);
      processes.set(tabId, proc);

      proc.stdout.on('data', (data) => {
        console.log(`[CmdMana] stdout: ${data.toString().substring(0, 50)}`);
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('shell-output', { tabId, data: data.toString() });
        }
      });

      proc.stderr.on('data', (data) => {
        console.log(`[CmdMana] stderr: ${data.toString().substring(0, 50)}`);
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('shell-output', { tabId, data: data.toString() });
        }
      });

      proc.on('close', (code) => {
        console.log(`[CmdMana] Process closed with code: ${code}`);
        processes.delete(tabId);
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('shell-exit', { tabId, code });
        }
      });

      proc.on('error', (err) => {
        console.error(`[CmdMana] Shell error: ${err.message}`);
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('shell-error', { tabId, error: err.message });
        }
      });

      console.log(`[CmdMana] Shell spawned for tab ${tabId}`);
      resolve({ pid: proc.pid });
    } catch (error) {
      console.error(`[CmdMana] Failed to spawn shell: ${error.message}`);
      reject(error);
    }
  });
});

ipcMain.handle('send-input', (event, { tabId, data }) => {
  const proc = processes.get(tabId);
  if (proc && !proc.killed && proc.stdin.writable) {
    proc.stdin.write(data);
    return true;
  }
  return false;
});

ipcMain.handle('kill-shell', (event, tabId) => {
  const proc = processes.get(tabId);
  if (proc && !proc.killed) {
    proc.kill();
    processes.delete(tabId);
    console.log(`[CmdMana] Shell killed for tab ${tabId}`);
    return true;
  }
  return false;
});

ipcMain.handle('get-platform', () => {
  return process.platform;
});

ipcMain.handle('select-directory', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory']
  });
  return result.filePaths[0] || null;
});
