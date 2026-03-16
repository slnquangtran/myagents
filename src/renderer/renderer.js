const { api } = window;

class CmdManaApp {
  constructor() {
    this.tabs = [];
    this.activeTabId = null;
    this.tabCounter = 0;
    this.commandHistory = [];
    this.historyIndex = -1;
    
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
      terminalOutput: document.getElementById('terminalOutput'),
      terminalInput: document.getElementById('terminalInput'),
      statusText: document.getElementById('statusText'),
      tabCount: document.getElementById('tabCount')
    };
  }

  bindEvents() {
    this.elements.newTabBtn.addEventListener('click', () => this.createTab());
    
    this.elements.terminalInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        this.sendCommand();
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        this.navigateHistory(-1);
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        this.navigateHistory(1);
      } else if (e.key === 'c' && e.ctrlKey) {
        e.preventDefault();
        this.sendCtrlC();
      }
    });
    
    document.addEventListener('keydown', (e) => {
      if (e.ctrlKey && e.key === 't') {
        e.preventDefault();
        this.createTab();
      } else if (e.ctrlKey && e.key === 'w') {
        e.preventDefault();
        if (this.activeTabId) {
          this.closeTab(this.activeTabId);
        }
      } else if (e.ctrlKey && e.key === 'Tab') {
        e.preventDefault();
        this.switchToNextTab();
      }
    });
  }

  setupIpcListeners() {
    api.onShellOutput(({ tabId, data }) => {
      const tab = this.tabs.find(t => t.id === tabId);
      if (tab) {
        tab.output += data;
        if (tabId === this.activeTabId) {
          this.renderOutput();
        }
      }
    });
    
    api.onShellExit(({ tabId, code }) => {
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
    
    api.onShellError(({ tabId, error }) => {
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
    this.settings = await api.getSettings();
  }

  async createTab() {
    this.tabCounter++;
    const tabId = 'tab-' + this.tabCounter;
    const tab = {
      id: tabId,
      name: `CMD ${this.tabCounter}`,
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
      const result = await api.spawnShell({ tabId });
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

  switchToNextTab() {
    if (this.tabs.length <= 1) return;
    
    const currentIndex = this.tabs.findIndex(t => t.id === this.activeTabId);
    const nextIndex = (currentIndex + 1) % this.tabs.length;
    this.switchTab(this.tabs[nextIndex].id);
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
    const command = this.elements.terminalInput.value;
    if (!command.trim()) return;
    
    const tab = this.tabs.find(t => t.id === this.activeTabId);
    if (!tab || !tab.active) {
      this.elements.terminalInput.value = '';
      return;
    }
    
    this.commandHistory.push(command);
    this.historyIndex = this.commandHistory.length;
    
    await api.sendInput({
      tabId: this.activeTabId,
      data: command + '\r\n'
    });
    
    this.elements.terminalInput.value = '';
  }

  async sendCtrlC() {
    const tab = this.tabs.find(t => t.id === this.activeTabId);
    if (!tab || !tab.active) return;
    
    await api.sendInput({
      tabId: this.activeTabId,
      data: '\x03'
    });
  }

  async closeTab(tabId) {
    const tab = this.tabs.find(t => t.id === tabId);
    if (!tab) return;
    
    if (tab.active) {
      await api.killShell(tabId);
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
        this.elements.terminalOutput.innerHTML = '<div class="empty-state"><p>Click + to create a new CMD tab</p></div>';
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

  navigateHistory(direction) {
    if (this.commandHistory.length === 0) return;
    
    this.historyIndex += direction;
    
    if (this.historyIndex < 0) {
      this.historyIndex = 0;
    } else if (this.historyIndex >= this.commandHistory.length) {
      this.historyIndex = this.commandHistory.length;
      this.elements.terminalInput.value = '';
      return;
    }
    
    this.elements.terminalInput.value = this.commandHistory[this.historyIndex];
  }

  setStatus(text) {
    this.elements.statusText.textContent = text;
  }

  escapeHtml(text) {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
}

const app = new CmdManaApp();
