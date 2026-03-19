const electronAPI = window.api || {};

console.log('xterm loaded:', typeof Terminal);

class CmdManaApp {
  constructor() {
    this.tabs = [];
    this.activeTabId = null;
    this.tabCounter = 0;
    this.terminals = new Map();
    this.commandHistory = [];
    this.historyIndex = -1;
    this.api = electronAPI;
    
    this.init();
  }

  async init() {
    this.bindElements();
    this.bindEvents();
    this.setupIpcListeners();
    await this.loadSettings();
    this.createTab();
  }

  bindElements() {
    this.elements = {
      tabsContainer: document.getElementById('tabsContainer'),
      newTabBtn: document.getElementById('newTabBtn'),
      newTabBtn2: document.getElementById('newTabBtn2'),
      adminBtn: document.getElementById('adminBtn'),
      defaultBtn: document.getElementById('defaultBtn'),
      shellType: document.getElementById('shellType'),
      terminalOutput: document.getElementById('terminalOutput'),
      terminalInput: document.getElementById('terminalInput'),
      statusText: document.getElementById('statusText'),
      tabCount: document.getElementById('tabCount')
    };
  }

  bindEvents() {
    this.elements.newTabBtn.addEventListener('click', () => this.createTab());
    this.elements.newTabBtn2.addEventListener('click', () => this.createTab());
    this.elements.adminBtn.addEventListener('click', () => this.runAsAdmin());
    this.elements.defaultBtn.addEventListener('click', () => this.setAsDefault());
    
    this.elements.terminalInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        this.sendCommand();
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        this.historyUp();
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        this.historyDown();
      }
    });
  }

  setupIpcListeners() {
    this.api.onShellOutput(({ tabId, data }) => {
      const termData = this.terminals.get(tabId);
      if (termData) {
        termData.term.write(data);
      }
    });
    
    this.api.onShellExit(({ tabId, code }) => {
      const termData = this.terminals.get(tabId);
      if (termData) {
        termData.term.write(`\r\n[Process exited with code ${code}]\r\n`);
      }
      const tab = this.tabs.find(t => t.id === tabId);
      if (tab) {
        tab.active = false;
        this.updateTabStatus(tabId);
      }
      this.setStatus('Process exited');
    });
    
    this.api.onShellError(({ tabId, error }) => {
      const termData = this.terminals.get(tabId);
      if (termData) {
        termData.term.write(`\r\n[Error: ${error}]\r\n`);
      }
      const tab = this.tabs.find(t => t.id === tabId);
      if (tab) {
        tab.active = false;
        this.updateTabStatus(tabId);
      }
      this.setStatus(`Error: ${error}`);
    });
  }

  async loadSettings() {
    this.settings = await this.api.getSettings();
  }

  createTerminal(tabId) {
    if (typeof Terminal === 'undefined') {
      console.error('Terminal not loaded!');
      return null;
    }
    
    const term = new Terminal({
      cursorBlink: true,
      fontSize: 14,
      fontFamily: 'Consolas, "Courier New", monospace',
      theme: {
        background: '#1a1a2e',
        foreground: '#f8f8f2',
        cursor: '#f8f8f2',
        selection: '#44475a'
      }
    });

    term.open(this.elements.terminalOutput);
    this.terminals.set(tabId, { term });
    
    return term;
  }

  async createTab() {
    this.tabCounter++;
    const tabId = 'tab-' + this.tabCounter;
    const shellType = this.elements.shellType.value;
    const tab = {
      id: tabId,
      name: `${shellType === 'cmd' ? 'CMD' : 'PowerShell'} ${this.tabCounter}`,
      shellType: shellType,
      active: false,
      pid: null
    };
    
    this.tabs.push(tab);
    this.renderTabs();
    
    this.createTerminal(tabId);
    await this.spawnShell(tabId, shellType);
    this.switchTab(tabId);
    this.updateTabCount();
    this.setStatus('Ready');
  }

  async spawnShell(tabId, shellType) {
    const tab = this.tabs.find(t => t.id === tabId);
    if (!tab) return;
    
    try {
      const result = await this.api.spawnShell({ tabId, shellType });
      tab.pid = result.pid;
      tab.active = true;
      this.updateTabStatus(tabId);
      this.setStatus(`PID: ${result.pid}`);
      this.elements.terminalInput.focus();
    } catch (error) {
      const termData = this.terminals.get(tabId);
      if (termData) {
        termData.term.write(`\r\n[Failed to start shell: ${error.message}]\r\n`);
      }
      this.setStatus(`Error: ${error.message}`);
    }
  }

  renderTabs() {
    this.elements.tabsContainer.innerHTML = '';
    
    this.tabs.forEach(tab => {
      const tabEl = document.createElement('div');
      tabEl.className = `tab ${tab.id === this.activeTabId ? 'active' : ''}`;
      tabEl.dataset.tabId = tab.id;
      
      tabEl.innerHTML = `
        <span class="tab-status ${tab.active ? 'running' : ''}"></span>
        <span class="tab-name">${tab.name}</span>
        <button class="tab-close" title="Close tab">&times;</button>
      `;
      
      tabEl.addEventListener('click', (e) => {
        if (!e.target.classList.contains('tab-close')) {
          this.switchTab(tab.id);
        }
      });
      
      tabEl.addEventListener('dblclick', (e) => {
        if (!e.target.classList.contains('tab-close')) {
          this.renameTab(tab.id);
        }
      });
      
      tabEl.draggable = true;
      tabEl.addEventListener('dragstart', (e) => {
        e.dataTransfer.setData('text/plain', tab.id);
        tabEl.classList.add('dragging');
      });
      
      tabEl.addEventListener('dragend', () => {
        tabEl.classList.remove('dragging');
      });
      
      tabEl.addEventListener('dragover', (e) => {
        e.preventDefault();
      });
      
      tabEl.addEventListener('drop', (e) => {
        e.preventDefault();
        const draggedId = e.dataTransfer.getData('text/plain');
        if (draggedId && draggedId !== tab.id) {
          this.reorderTabs(draggedId, tab.id);
        }
      });
      
      tabEl.querySelector('.tab-close').addEventListener('click', (e) => {
        e.stopPropagation();
        this.closeTab(tab.id);
      });
      
      this.elements.tabsContainer.appendChild(tabEl);
    });
  }

  switchTab(tabId) {
    this.activeTabId = tabId;
    this.renderTabs();
    
    this.elements.terminalOutput.innerHTML = '';
    
    const termData = this.terminals.get(tabId);
    if (termData) {
      termData.term.open(this.elements.terminalOutput);
    }
    
    this.elements.terminalInput.value = '';
    this.elements.terminalInput.focus();
    
    const tab = this.tabs.find(t => t.id === tabId);
    if (tab) {
      this.setStatus(tab.active ? `PID: ${tab.pid}` : 'Ready');
    }
  }

  async sendCommand() {
    const command = this.elements.terminalInput.value;
    
    if (!command.trim()) {
      return;
    }
    
    const tab = this.tabs.find(t => t.id === this.activeTabId);
    if (!tab || !tab.active) {
      return;
    }
    
    this.commandHistory.push(command);
    this.historyIndex = this.commandHistory.length;
    
    await this.api.sendInput({
      tabId: this.activeTabId,
      data: command + '\r\n'
    });
    
    this.elements.terminalInput.value = '';
  }

  historyUp() {
    if (this.commandHistory.length === 0) return;
    
    if (this.historyIndex > 0) {
      this.historyIndex--;
      this.elements.terminalInput.value = this.commandHistory[this.historyIndex];
    }
  }

  historyDown() {
    if (this.historyIndex < this.commandHistory.length - 1) {
      this.historyIndex++;
      this.elements.terminalInput.value = this.commandHistory[this.historyIndex];
    } else {
      this.historyIndex = this.commandHistory.length;
      this.elements.terminalInput.value = '';
    }
  }

  async closeTab(tabId) {
    const tab = this.tabs.find(t => t.id === tabId);
    if (!tab) return;
    
    if (tab.active) {
      await this.api.killShell(tabId);
    }
    
    const termData = this.terminals.get(tabId);
    if (termData) {
      termData.term.dispose();
      this.terminals.delete(tabId);
    }
    
    this.removeTab(tabId);
  }

  removeTab(tabId) {
    const index = this.tabs.findIndex(t => t.id === tabId);
    if (index === -1) return;
    
    this.tabs.splice(index, 1);
    
    if (this.activeTabId === tabId) {
      if (this.tabs.length > 0) {
        const newIndex = Math.min(index, this.tabs.length - 1);
        this.switchTab(this.tabs[newIndex].id);
      } else {
        this.activeTabId = null;
        this.elements.terminalOutput.innerHTML = '<div class="empty-state"><p>Click + to create a new terminal</p></div>';
      }
    }
    
    this.renderTabs();
    this.updateTabCount();
    this.setStatus('Tab closed');
  }

  updateTabStatus(tabId) {
    const tabEl = document.querySelector(`[data-tab-id="${tabId}"]`);
    if (tabEl) {
      const statusEl = tabEl.querySelector('.tab-status');
      const tab = this.tabs.find(t => t.id === tabId);
      statusEl.className = `tab-status ${tab.active ? 'running' : ''}`;
    }
  }

  updateTabCount() {
    this.elements.tabCount.textContent = `${this.tabs.length} tab${this.tabs.length !== 1 ? 's' : ''}`;
  }

  async runAsAdmin() {
    if (confirm('This will restart the app as Administrator. Continue?')) {
      await this.api.runAsAdmin();
    }
  }

  async setAsDefault() {
    const confirmed = confirm('Set CmdMana as default terminal?\n\nYou will be asked to allow admin access to modify system settings.\n\nThis will replace cmd.exe, .bat and .cmd files to open with CmdMana.');
    if (confirmed) {
      this.setStatus('Setting as default... please accept admin prompt');
      const success = await this.api.setAsDefault();
      if (success) {
        this.elements.defaultBtn.textContent = '✓ Default';
        this.setStatus('Set as default terminal');
        alert('CmdMana is now your default terminal!');
      } else {
        alert('Failed to set as default. Please try running the app as Administrator first.');
      }
    }
  }

  renameTab(tabId) {
    const tab = this.tabs.find(t => t.id === tabId);
    if (!tab) return;
    
    const newName = prompt('Enter new name for this tab:', tab.name);
    if (newName && newName.trim()) {
      tab.name = newName.trim();
      this.renderTabs();
    }
  }

  reorderTabs(draggedId, targetId) {
    const draggedIndex = this.tabs.findIndex(t => t.id === draggedId);
    const targetIndex = this.tabs.findIndex(t => t.id === targetId);
    
    if (draggedIndex === -1 || targetIndex === -1) return;
    
    const [draggedTab] = this.tabs.splice(draggedIndex, 1);
    this.tabs.splice(targetIndex, 0, draggedTab);
    this.renderTabs();
  }

  setStatus(text) {
    this.elements.statusText.textContent = text;
  }
}

window.app = new CmdManaApp();
