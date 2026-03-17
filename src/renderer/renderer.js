const electronAPI = window.api || {};

class CmdManaApp {
  constructor() {
    this.tabs = [];
    this.activeTabId = null;
    this.tabCounter = 0;
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
    
    const inputEl = this.elements.terminalInput;
    if (inputEl) {
      inputEl.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          this.sendCommand();
        }
      });
    }
  }

  setupIpcListeners() {
    this.api.onShellOutput(({ tabId, data }) => {
      const tab = this.tabs.find(t => t.id === tabId);
      if (tab) {
        tab.output += data;
        if (tabId === this.activeTabId) {
          this.renderOutput();
        }
      }
    });
    
    this.api.onShellExit(({ tabId, code }) => {
      const tab = this.tabs.find(t => t.id === tabId);
      if (tab) {
        tab.active = false;
        tab.output += `\n[Process exited with code ${code}]\n`;
        
        if (tabId === this.activeTabId) {
          this.renderOutput();
          this.setStatus('Process exited');
        }
        this.updateTabStatus(tabId);
      }
    });
    
    this.api.onShellError(({ tabId, error }) => {
      const tab = this.tabs.find(t => t.id === tabId);
      if (tab) {
        tab.active = false;
        tab.output += `\n[Error: ${error}]\n`;
        
        if (tabId === this.activeTabId) {
          this.renderOutput();
          this.setStatus(`Error: ${error}`);
        }
        this.updateTabStatus(tabId);
      }
    });
  }

  async loadSettings() {
    this.settings = await this.api.getSettings();
  }

  async createTab() {
    this.tabCounter++;
    const tabId = 'tab-' + this.tabCounter;
    const tab = {
      id: tabId,
      name: `Terminal ${this.tabCounter}`,
      output: '',
      active: false,
      pid: null
    };
    
    this.tabs.push(tab);
    this.renderTabs();
    await this.spawnShell(tabId);
    this.switchTab(tabId);
    this.updateTabCount();
    this.setStatus('Ready');
  }

  async spawnShell(tabId) {
    const tab = this.tabs.find(t => t.id === tabId);
    if (!tab) return;
    
    try {
      const result = await this.api.spawnShell({ tabId });
      tab.pid = result.pid;
      tab.active = true;
      this.updateTabStatus(tabId);
      this.setStatus(`PID: ${result.pid}`);
    } catch (error) {
      tab.output += `[Failed to start shell: ${error.message}]\n`;
      this.renderOutput();
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
    this.renderOutput();
    this.elements.terminalInput.focus();
    
    const tab = this.tabs.find(t => t.id === tabId);
    if (tab) {
      this.setStatus(tab.active ? `PID: ${tab.pid}` : 'Ready');
    }
  }

  renderOutput() {
    const tab = this.tabs.find(t => t.id === this.activeTabId);
    if (!tab) {
      this.elements.terminalOutput.innerHTML = '<div class="empty-state"><p>No tab selected</p></div>';
      return;
    }
    
    this.elements.terminalOutput.innerHTML = this.escapeHtml(tab.output);
    this.scrollToBottom();
  }

  scrollToBottom() {
    this.elements.terminalOutput.scrollTop = this.elements.terminalOutput.scrollHeight;
  }

  async sendCommand() {
    const inputEl = this.elements.terminalInput;
    const command = inputEl.value;
    
    if (!command.trim()) {
      inputEl.value = '';
      return;
    }
    
    const tab = this.tabs.find(t => t.id === this.activeTabId);
    if (!tab || !tab.active) {
      inputEl.value = '';
      return;
    }
    
    this.commandHistory.push(command);
    this.historyIndex = this.commandHistory.length;
    
    await this.api.sendInput({
      tabId: this.activeTabId,
      data: command + '\n'
    });
    
    inputEl.value = '';
  }

  async sendCtrlC() {
    const tab = this.tabs.find(t => t.id === this.activeTabId);
    if (!tab || !tab.active) return;
    
    await this.api.sendInput({
      tabId: this.activeTabId,
      data: '\x03'
    });
  }

  async closeTab(tabId) {
    const tab = this.tabs.find(t => t.id === tabId);
    if (!tab) return;
    
    if (tab.active) {
      await this.api.killShell(tabId);
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
    const confirmed = confirm('Set CmdMana as default terminal?\n\nThis will replace cmd.exe and PowerShell to open with CmdMana.\n\nYou can undo this anytime by clicking "Remove Default".');
    if (confirmed) {
      const success = await this.api.setAsDefault();
      if (success) {
        this.elements.defaultBtn.textContent = '✓ Default';
        this.setStatus('Set as default terminal');
        alert('CmdMana is now your default terminal!');
      } else {
        alert('Failed to set as default. Try running as Administrator.');
      }
    }
  }

  setStatus(text) {
    this.elements.statusText.textContent = text;
  }

  escapeHtml(text) {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }
}

window.app = new CmdManaApp();
