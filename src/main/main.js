const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const Store = require('electron-store');

const store = new Store({
  name: 'cmdmana-config',
  defaults: {
    agents: [],
    settings: {
      theme: 'dark',
      defaultShell: 'cmd'
    },
    windowState: {
      width: 1200,
      height: 800
    }
  }
});

let mainWindow = null;
const processes = new Map();
let processIdCounter = 0;

function createWindow() {
  const windowState = store.get('windowState');
  
  mainWindow = new BrowserWindow({
    width: windowState.width || 1200,
    height: windowState.height || 800,
    minWidth: 800,
    minHeight: 600,
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
    console.log('[CmdMana] Application started successfully');
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

ipcMain.handle('get-agents', () => {
  return store.get('agents', []);
});

ipcMain.handle('save-agent', (event, agent) => {
  const agents = store.get('agents', []);
  const existingIndex = agents.findIndex(a => a.id === agent.id);
  
  if (existingIndex >= 0) {
    agents[existingIndex] = agent;
  } else {
    agent.id = Date.now().toString();
    agents.push(agent);
  }
  
  store.set('agents', agents);
  return agents;
});

ipcMain.handle('delete-agent', (event, agentId) => {
  const agents = store.get('agents', []);
  const filtered = agents.filter(a => a.id !== agentId);
  store.set('agents', filtered);
  return filtered;
});

ipcMain.handle('get-settings', () => {
  return store.get('settings', { theme: 'dark', defaultShell: 'cmd' });
});

ipcMain.handle('save-settings', (event, settings) => {
  store.set('settings', settings);
  return settings;
});

ipcMain.handle('spawn-process', async (event, { tabId, command, args, cwd, env }) => {
  return new Promise((resolve, reject) => {
    try {
      const shell = process.platform === 'win32' ? 'cmd.exe' : '/bin/sh';
      const shellArgs = process.platform === 'win32' ? ['/c', command, ...args] : ['-c', command, ...args];
      
      const proc = spawn(shell, shellArgs, {
        cwd: cwd || process.cwd(),
        env: { ...process.env, ...env },
        windowsHide: false
      });

      const procId = ++processIdCounter;
      processes.set(tabId, proc);

      proc.stdout.on('data', (data) => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('process-output', { tabId, data: data.toString(), type: 'stdout' });
        }
      });

      proc.stderr.on('data', (data) => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('process-output', { tabId, data: data.toString(), type: 'stderr' });
        }
      });

      proc.on('close', (code) => {
        processes.delete(tabId);
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('process-exit', { tabId, code });
        }
      });

      proc.on('error', (err) => {
        processes.delete(tabId);
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('process-error', { tabId, error: err.message });
        }
      });

      console.log(`[CmdMana] Process spawned for tab ${tabId}: ${command}`);
      resolve({ procId, pid: proc.pid });
    } catch (error) {
      console.error(`[CmdMana] Failed to spawn process: ${error.message}`);
      reject(error);
    }
  });
});

ipcMain.handle('kill-process', (event, tabId) => {
  const proc = processes.get(tabId);
  if (proc && !proc.killed) {
    proc.kill();
    processes.delete(tabId);
    console.log(`[CmdMana] Process killed for tab ${tabId}`);
    return true;
  }
  return false;
});

ipcMain.handle('send-input', (event, { tabId, data }) => {
  const proc = processes.get(tabId);
  if (proc && !proc.killed && proc.stdin.writable) {
    proc.stdin.write(data);
    return true;
  }
  return false;
});

ipcMain.handle('is-process-running', (event, tabId) => {
  const proc = processes.get(tabId);
  return proc && !proc.killed;
});

ipcMain.handle('select-directory', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory']
  });
  return result.filePaths[0] || null;
});

ipcMain.handle('get-platform', () => {
  return process.platform;
});
