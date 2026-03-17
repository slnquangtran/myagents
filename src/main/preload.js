const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  getSettings: () => ipcRenderer.invoke('get-settings'),
  saveSettings: (settings) => ipcRenderer.invoke('save-settings', settings),
  
  spawnShell: (config) => ipcRenderer.invoke('spawn-shell', config),
  killShell: (tabId) => ipcRenderer.invoke('kill-shell', tabId),
  sendInput: (data) => ipcRenderer.invoke('send-input', data),
  
  selectDirectory: () => ipcRenderer.invoke('select-directory'),
  getPlatform: () => ipcRenderer.invoke('get-platform'),
  runAsAdmin: () => ipcRenderer.invoke('run-as-admin'),
  
  onShellOutput: (callback) => {
    ipcRenderer.on('shell-output', (event, data) => callback(data));
  },
  onShellExit: (callback) => {
    ipcRenderer.on('shell-exit', (event, data) => callback(data));
  },
  onShellError: (callback) => {
    ipcRenderer.on('shell-error', (event, data) => callback(data));
  },
  
  removeAllListeners: (channel) => {
    ipcRenderer.removeAllListeners(channel);
  }
});
