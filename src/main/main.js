const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const Store = require('electron-store');
const AnsiToHtml = require('ansi-to-html');

const ansiConverter = new AnsiToHtml({
  fg: '#cccccc',
  bg: '#1e1e2e',
  newline: true,
  escapeXML: true
});

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

function runAsAdmin() {
  const { exec } = require('child_process');
  const exePath = process.execPath;
  
  exec(`powershell -Command "Start-Process '${exePath}' -Verb RunAs"`, (error) => {
    if (!error) {
      app.quit();
    }
  });
}

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

ipcMain.handle('spawn-shell', async (event, { tabId, cwd, shellType }) => {
  return new Promise((resolve, reject) => {
    try {
      const currentDir = cwd || process.cwd();
      const homeDir = process.env.USERPROFILE || process.env.HOME || '';
      
      const env = { ...process.env };
      const systemPath = env.PATH || '';
      const npmPaths = [];
      
      // Find npm global path
      const npmGlobalPaths = [
        path.join(homeDir, 'AppData', 'Roaming', 'npm'),
        path.join(homeDir, 'AppData', 'Roaming', 'npm', 'bin'),
        path.join(homeDir, '.npm-global', 'bin'),
        path.join(homeDir, '.local', 'bin'),
        path.join(currentDir, 'node_modules', '.bin')
      ];
      
      npmGlobalPaths.forEach(p => {
        if (fs.existsSync(p) && !systemPath.includes(p)) {
          npmPaths.push(p);
        }
      });
      
      // Prepend npm paths to existing PATH
      const extraPath = npmPaths.join(path.delimiter);
      env.PATH = extraPath ? extraPath + path.delimiter + systemPath : systemPath;
      
      // Also set npm prefix
      env.npm_config_prefix = path.join(homeDir, 'AppData', 'Roaming', 'npm');
      
      // Choose shell - use full path
      let shell, shellArgs;
      if (shellType === 'cmd') {
        shell = process.env.COMSPEC || 'cmd.exe';
        shellArgs = ['/K'];
      } else {
        shell = process.env.WINDIR ? path.join(process.env.WINDIR, 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe') : 'powershell.exe';
        shellArgs = ['-NoExit'];
      }
      
      const proc = spawn(shell, shellArgs, {
        cwd: currentDir,
        env: env,
        windowsHide: false,
        stdio: 'pipe',
        shell: false
      });

      processes.set(tabId, proc);

      proc.stdout.on('data', (data) => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          const str = data.toString();
          mainWindow.webContents.send('shell-output', { tabId, data: str, html: ansiConverter.toHtml(str) });
        }
      });

      proc.stderr.on('data', (data) => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          const str = data.toString();
          mainWindow.webContents.send('shell-output', { tabId, data: str, html: ansiConverter.toHtml(str) });
        }
      });

      proc.on('close', (code) => {
        processes.delete(tabId);
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('shell-exit', { tabId, code });
        }
      });

      proc.on('error', (err) => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('shell-error', { tabId, error: err.message });
        }
      });

      resolve({ pid: proc.pid });
    } catch (error) {
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

ipcMain.handle('run-as-admin', () => {
  runAsAdmin();
});

ipcMain.handle('set-as-default', async () => {
  const { exec } = require('child_process');
  const fs = require('fs');
  const exePath = process.execPath;
  const appDataPath = process.env.APPDATA;
  const scriptPath = path.join(appDataPath, 'CmdMana', 'set-default.ps1');
  
  // PowerShell script to set as default with admin rights
  const psScript = `
$exePath = "${exePath.replace(/\\/g, '\\\\')}"
$regCmds = @(
    "reg add 'HKLM\\SOFTWARE\\Classes\\cmdfile\\shell\\open\\command' /ve /d \"\\\"$exePath\\\" \\\"%1\\\"\" /f",
    "reg add 'HKLM\\SOFTWARE\\Classes\\batfile\\shell\\open\\command' /ve /d \"\\\"$exePath\\\" \\\"%1\\\"\" /f", 
    "reg add 'HKLM\\SOFTWARE\\Classes\\Application\\cmd.exe\\shell\\open\\command' /ve /d \"\\\"$exePath\\\" \\\"%1\\\"\" /f"
)
foreach ($cmd in $regCmds) {
    Start-Process powershell -ArgumentList "-Command","$cmd" -Verb RunAs -Wait
}
Write-Output "Done"
`;
  
  return new Promise((resolve) => {
    // Write PowerShell script
    const dir = path.dirname(scriptPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(scriptPath, psScript);
    
    // Execute with elevation
    exec(`powershell -ExecutionPolicy Bypass -File "${scriptPath}"`, (error) => {
      // Also set user-level defaults as backup
      const exePath2 = process.execPath;
      const launcherPath = path.join(appDataPath, 'CmdMana', 'launcher.bat');
      const batchContent = `@echo off\n"${exePath2}" %*\n`;
      fs.writeFileSync(launcherPath, batchContent);
      
      const userCmds = [
        `reg add "HKCU\\Software\\Classes\\cmd.exe\\shell\\open\\command" /ve /d "\\"${launcherPath}\\"" /f`,
        `reg add "HKCU\\Software\\Classes\\batfile\\shell\\open\\command" /ve /d "\\"${launcherPath}\\"" /f`,
        `reg add "HKCU\\Software\\Classes\\cmdfile\\shell\\open\\command" /ve /d "\\"${launcherPath}\\"" /f`
      ];
      
      let completed = 0;
      userCmds.forEach(cmd => {
        exec(cmd, () => {
          completed++;
          if (completed === userCmds.length) {
            resolve(true);
          }
        });
      });
    });
  });
});

ipcMain.handle('remove-as-default', async () => {
  const { exec } = require('child_process');
  
  return new Promise((resolve) => {
    const commands = [
      `reg delete "HKCU\\Software\\Classes\\cmd.exe\\shell\\open\\command" /f`,
      `reg delete "HKCU\\Software\\Classes\\batfile\\shell\\open\\command" /f`,
      `reg delete "HKCU\\Software\\Classes\\cmdfile\\shell\\open\\command" /f`
    ];
    
    let completed = 0;
    commands.forEach(cmd => {
      exec(cmd, () => {
        completed++;
        if (completed === commands.length) {
          resolve(true);
        }
      });
    });
  });
});
