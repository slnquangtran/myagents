const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  getAgents: () => ipcRenderer.invoke('get-agents'),
  saveAgent: (agent) => ipcRenderer.invoke('save-agent', agent),
  deleteAgent: (agentId) => ipcRenderer.invoke('delete-agent', agentId),
  
  getSettings: () => ipcRenderer.invoke('get-settings'),
  saveSettings: (settings) => ipcRenderer.invoke('save-settings', settings),
  
  spawnProcess: (config) => ipcRenderer.invoke('spawn-process', config),
  killProcess: (tabId) => ipcRenderer.invoke('kill-process', tabId),
  sendInput: (data) => ipcRenderer.invoke('send-input', data),
  isProcessRunning: (tabId) => ipcRenderer.invoke('is-process-running', tabId),
  
  selectDirectory: () => ipcRenderer.invoke('select-directory'),
  getPlatform: () => ipcRenderer.invoke('get-platform'),
  
  onProcessOutput: (callback) => {
    ipcRenderer.on('process-output', (event, data) => callback(data));
  },
  onProcessExit: (callback) => {
    ipcRenderer.on('process-exit', (event, data) => callback(data));
  },
  onProcessError: (callback) => {
    ipcRenderer.on('process-error', (event, data) => callback(data));
  },
  
  removeAllListeners: (channel) => {
    ipcRenderer.removeAllListeners(channel);
  }
});
