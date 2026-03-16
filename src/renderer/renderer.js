const { api } = window;

class CmdManaApp {
  constructor() {
    this.tabs = [];
    this.activeTabId = null;
    this.agents = [];
    this.settings = { theme: 'dark', defaultShell: 'cmd' };
    this.commandHistory = [];
    this.historyIndex = -1;
    this.editingAgentId = null;
    this.confirmCallback = null;
    
    this.init();
  }

  async init() {
    this.bindElements();
    this.bindEvents();
    this.setupIpcListeners();
    await this.loadSettings();
    await this.loadAgents();
    this.renderAgentList();
    
    if (this.agents.length > 0) {
      this.createTab(this.agents[0]);
    } else {
      this.showEmptyState();
    }
  }

  bindElements() {
    this.elements = {
      tabBar: document.getElementById('tabsContainer'),
      newTabBtn: document.getElementById('newTabBtn'),
      terminalOutput: document.getElementById('terminalOutput'),
      terminalInput: document.getElementById('terminalInput'),
      runBtn: document.getElementById('runBtn'),
      stopBtn: document.getElementById('stopBtn'),
      clearBtn: document.getElementById('clearBtn'),
      statusText: document.getElementById('statusText'),
      tabCount: document.getElementById('tabCount'),
      addAgentBtn: document.getElementById('addAgentBtn'),
      manageAgentsBtn: document.getElementById('manageAgentsBtn'),
      themeToggleBtn: document.getElementById('themeToggleBtn'),
      agentModal: document.getElementById('agentModal'),
      modalTitle: document.getElementById('modalTitle'),
      agentName: document.getElementById('agentName'),
      agentCommand: document.getElementById('agentCommand'),
      agentArgs: document.getElementById('agentArgs'),
      agentCwd: document.getElementById('agentCwd'),
      agentEnv: document.getElementById('agentEnv'),
      browseCwd: document.getElementById('browseCwd'),
      saveAgent: document.getElementById('saveAgent'),
      cancelModal: document.getElementById('cancelModal'),
      closeModal: document.getElementById('closeModal'),
      manageModal: document.getElementById('manageModal'),
      closeManageModal: document.getElementById('closeManageModal'),
      closeManageBtn: document.getElementById('closeManageBtn'),
      agentList: document.getElementById('agentList'),
      confirmModal: document.getElementById('confirmModal'),
      confirmMessage: document.getElementById('confirmMessage'),
      confirmCancel: document.getElementById('confirmCancel'),
      confirmOk: document.getElementById('confirmOk'),
      closeConfirmModal: document.getElementById('closeConfirmModal')
    };
  }

  bindEvents() {
    this.elements.newTabBtn.addEventListener('click', () => this.showAddAgentModal());
    this.elements.addAgentBtn.addEventListener('click', () => this.showAddAgentModal());
    this.elements.manageAgentsBtn.addEventListener('click', () => this.showManageModal());
    this.elements.themeToggleBtn.addEventListener('click', () => this.toggleTheme());
    
    this.elements.runBtn.addEventListener('click', () => this.runCommand());
    this.elements.stopBtn.addEventListener('click', () => this.stopProcess());
    this.elements.clearBtn.addEventListener('click', () => this.clearTerminal());
    
    this.elements.terminalInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        this.runCommand();
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        this.navigateHistory(-1);
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        this.navigateHistory(1);
      }
    });
    
    this.elements.saveAgent.addEventListener('click', () => this.saveAgent());
    this.elements.cancelModal.addEventListener('click', () => this.hideAgentModal());
    this.elements.closeModal.addEventListener('click', () => this.hideAgentModal());
    
    this.elements.closeManageModal.addEventListener('click', () => this.hideManageModal());
    this.elements.closeManageBtn.addEventListener('click', () => this.hideManageModal());
    
    this.elements.confirmCancel.addEventListener('click', () => this.hideConfirmModal());
    this.elements.confirmOk.addEventListener('click', () => this.confirmAction());
    this.elements.closeConfirmModal.addEventListener('click', () => this.hideConfirmModal());
    
    this.elements.browseCwd.addEventListener('click', async () => {
      const dir = await api.selectDirectory();
      if (dir) {
        this.elements.agentCwd.value = dir;
      }
    });
  }

  setupIpcListeners() {
    api.onProcessOutput(({ tabId, data, type }) => {
      if (tabId === this.activeTabId) {
        this.appendOutput(data, type);
      }
    });
    
    api.onProcessExit(({ tabId, code }) => {
      const tab = this.tabs.find(t => t.id === tabId);
      if (tab) {
        tab.running = false;
        this.updateTabStatus(tabId);
        this.appendOutput(`\n[Process exited with code ${code}]\n`, 'system');
        
        if (tabId === this.activeTabId) {
          this.elements.stopBtn.disabled = true;
          this.setStatus(`Process exited (code: ${code})`);
        }
      }
    });
    
    api.onProcessError(({ tabId, error }) => {
      const tab = this.tabs.find(t => t.id === tabId);
      if (tab) {
        tab.running = false;
        this.updateTabStatus(tabId);
        
        if (tabId === this.activeTabId) {
          this.appendOutput(`\n[Error: ${error}]\n`, 'stderr');
          this.elements.stopBtn.disabled = true;
          this.setStatus(`Error: ${error}`);
        }
      }
    });
  }

  async loadSettings() {
    this.settings = await api.getSettings();
  }

  async loadAgents() {
    this.agents = await api.getAgents();
  }

  createTab(agent) {
    const tabId = Date.now().toString();
    const tab = {
      id: tabId,
      name: agent.name,
      agentId: agent.id,
      command: agent.command,
      args: agent.args || '',
      cwd: agent.cwd || '',
      env: agent.env || {},
      running: false,
      output: []
    };
    
    this.tabs.push(tab);
    this.renderTabs();
    this.switchTab(tabId);
    this.setStatus(`Tab created: ${agent.name}`);
    this.updateTabCount();
  }

  renderTabs() {
    this.elements.tabBar.innerHTML = '';
    
    this.tabs.forEach(tab => {
      const tabEl = document.createElement('div');
      tabEl.className = `tab ${tab.id === this.activeTabId ? 'active' : ''}`;
      tabEl.dataset.tabId = tab.id;
      
      tabEl.innerHTML = `
        <span class="tab-status ${tab.running ? 'running' : ''}"></span>
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
      
      this.elements.tabBar.appendChild(tabEl);
    });
  }

  switchTab(tabId) {
    this.activeTabId = tabId;
    this.renderTabs();
    this.renderTerminalOutput();
    
    const tab = this.tabs.find(t => t.id === tabId);
    if (tab) {
      this.elements.stopBtn.disabled = !tab.running;
      this.setStatus(tab.running ? `Running: ${tab.name}` : `Ready: ${tab.name}`);
    }
  }

  renderTerminalOutput() {
    const tab = this.tabs.find(t => t.id === this.activeTabId);
    if (!tab) {
      this.elements.terminalOutput.innerHTML = '<div class="empty-state"><p>No tab selected</p></div>';
      return;
    }
    
    this.elements.terminalOutput.innerHTML = tab.output.map(line => 
      `<div class="line ${line.type}">${this.escapeHtml(line.text)}</div>`
    ).join('');
    this.scrollToBottom();
  }

  appendOutput(text, type = 'stdout') {
    const tab = this.tabs.find(t => t.id === this.activeTabId);
    if (!tab) return;
    
    const lines = text.split('\n');
    lines.forEach(line => {
      if (line || lines.length > 1) {
        tab.output.push({ text: line || '\n', type });
      }
    });
    
    if (tab.id === this.activeTabId) {
      this.renderTerminalOutput();
    }
  }

  clearTerminal() {
    const tab = this.tabs.find(t => t.id === this.activeTabId);
    if (tab) {
      tab.output = [];
      this.renderTerminalOutput();
      this.appendOutput('[Terminal cleared]\n', 'system');
    }
  }

  scrollToBottom() {
    this.elements.terminalOutput.scrollTop = this.elements.terminalOutput.scrollHeight;
  }

  async runCommand() {
    const command = this.elements.terminalInput.value.trim();
    if (!command) return;
    
    const tab = this.tabs.find(t => t.id === this.activeTabId);
    if (!tab) return;
    
    this.commandHistory.push(command);
    this.historyIndex = this.commandHistory.length;
    this.elements.terminalInput.value = '';
    
    this.appendOutput(`$ ${command}\n`, 'command');
    
    try {
      const args = tab.args ? tab.args.split(' ').filter(a => a) : [];
      const env = this.parseEnv(tab.env);
      
      await api.spawnProcess({
        tabId: tab.id,
        command: command,
        args: args,
        cwd: tab.cwd || undefined,
        env: env
      });
      
      tab.running = true;
      this.elements.stopBtn.disabled = false;
      this.updateTabStatus(tab.id);
      this.setStatus(`Running: ${command}`);
    } catch (error) {
      this.appendOutput(`[Failed to start: ${error.message}]\n`, 'stderr');
      this.setStatus(`Error: ${error.message}`);
    }
  }

  async stopProcess() {
    if (!this.activeTabId) return;
    
    const tab = this.tabs.find(t => t.id === this.activeTabId);
    if (!tab || !tab.running) return;
    
    const killed = await api.killProcess(this.activeTabId);
    if (killed) {
      tab.running = false;
      this.elements.stopBtn.disabled = true;
      this.updateTabStatus(this.activeTabId);
      this.appendOutput('\n[Process terminated]\n', 'system');
      this.setStatus('Process terminated');
    }
  }

  parseEnv(envStr) {
    if (!envStr) return {};
    const env = {};
    envStr.split('\n').forEach(line => {
      const [key, ...valueParts] = line.split('=');
      if (key && valueParts.length > 0) {
        env[key.trim()] = valueParts.join('=').trim();
      }
    });
    return env;
  }

  updateTabStatus(tabId) {
    const tabEl = document.querySelector(`[data-tab-id="${tabId}"]`);
    if (tabEl) {
      const statusEl = tabEl.querySelector('.tab-status');
      const tab = this.tabs.find(t => t.id === tabId);
      statusEl.className = `tab-status ${tab.running ? 'running' : ''}`;
    }
  }

  closeTab(tabId) {
    const tab = this.tabs.find(t => t.id === tabId);
    if (!tab) return;
    
    if (tab.running) {
      this.showConfirm('This tab has a running process. Are you sure you want to close it?', async () => {
        await api.killProcess(tabId);
        this.removeTab(tabId);
      });
    } else {
      this.removeTab(tabId);
    }
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
        this.showEmptyState();
      }
    }
    
    this.renderTabs();
    this.updateTabCount();
    this.setStatus('Tab closed');
  }

  updateTabCount() {
    this.elements.tabCount.textContent = `${this.tabs.length} tab${this.tabs.length !== 1 ? 's' : ''}`;
  }

  showEmptyState() {
    this.elements.terminalOutput.innerHTML = `
      <div class="empty-state">
        <p>No agent configured yet</p>
        <button class="btn-primary" onclick="app.showAddAgentModal()">Add Your First Agent</button>
      </div>
    `;
    this.elements.stopBtn.disabled = true;
    this.setStatus('No agent configured');
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

  showAddAgentModal() {
    this.editingAgentId = null;
    this.elements.modalTitle.textContent = 'Add Agent';
    this.elements.agentName.value = '';
    this.elements.agentCommand.value = '';
    this.elements.agentArgs.value = '';
    this.elements.agentCwd.value = '';
    this.elements.agentEnv.value = '';
    this.elements.agentModal.classList.add('show');
    this.elements.agentName.focus();
  }

  hideAgentModal() {
    this.elements.agentModal.classList.remove('show');
    this.editingAgentId = null;
  }

  async saveAgent() {
    const name = this.elements.agentName.value.trim();
    const command = this.elements.agentCommand.value.trim();
    
    if (!name || !command) {
      alert('Please fill in agent name and command');
      return;
    }
    
    const agent = {
      id: this.editingAgentId || null,
      name: name,
      command: command,
      args: this.elements.agentArgs.value.trim(),
      cwd: this.elements.agentCwd.value.trim(),
      env: this.elements.agentEnv.value.trim()
    };
    
    await api.saveAgent(agent);
    await this.loadAgents();
    this.renderAgentList();
    this.hideAgentModal();
    
    if (!this.editingAgentId) {
      this.createTab(agent);
    } else {
      const tab = this.tabs.find(t => t.agentId === agent.id);
      if (tab) {
        tab.name = agent.name;
        tab.command = agent.command;
        tab.args = agent.args;
        tab.cwd = agent.cwd;
        tab.env = agent.env;
        this.renderTabs();
      }
    }
    
    this.setStatus(`Agent saved: ${name}`);
  }

  editAgent(agentId) {
    const agent = this.agents.find(a => a.id === agentId);
    if (!agent) return;
    
    this.editingAgentId = agentId;
    this.elements.modalTitle.textContent = 'Edit Agent';
    this.elements.agentName.value = agent.name;
    this.elements.agentCommand.value = agent.command;
    this.elements.agentArgs.value = agent.args || '';
    this.elements.agentCwd.value = agent.cwd || '';
    this.elements.agentEnv.value = agent.env || '';
    this.elements.agentModal.classList.add('show');
  }

  showManageModal() {
    this.renderAgentList();
    this.elements.manageModal.classList.add('show');
  }

  hideManageModal() {
    this.elements.manageModal.classList.remove('show');
  }

  renderAgentList() {
    if (this.agents.length === 0) {
      this.elements.agentList.innerHTML = `
        <div class="empty-state">
          <p>No agents configured</p>
          <button class="btn-primary" onclick="app.showAddAgentModal()">Add Agent</button>
        </div>
      `;
      return;
    }
    
    this.elements.agentList.innerHTML = this.agents.map(agent => `
      <div class="agent-item">
        <div class="agent-info">
          <div class="agent-name">${this.escapeHtml(agent.name)}</div>
          <div class="agent-command">${this.escapeHtml(agent.command)} ${this.escapeHtml(agent.args || '')}</div>
        </div>
        <div class="agent-actions">
          <button class="edit-btn" onclick="app.editAgent('${agent.id}')">Edit</button>
          <button class="delete-btn" onclick="app.deleteAgent('${agent.id}')">Delete</button>
        </div>
      </div>
    `).join('');
  }

  async deleteAgent(agentId) {
    this.showConfirm('Are you sure you want to delete this agent?', async () => {
      await api.deleteAgent(agentId);
      await this.loadAgents();
      this.renderAgentList();
      
      const tabsToClose = this.tabs.filter(t => t.agentId === agentId);
      tabsToClose.forEach(tab => this.removeTab(tab.id));
      
      this.setStatus('Agent deleted');
    });
  }

  showConfirm(message, callback) {
    this.elements.confirmMessage.textContent = message;
    this.confirmCallback = callback;
    this.elements.confirmModal.classList.add('show');
  }

  hideConfirmModal() {
    this.elements.confirmModal.classList.remove('show');
    this.confirmCallback = null;
  }

  confirmAction() {
    if (this.confirmCallback) {
      this.confirmCallback();
    }
    this.hideConfirmModal();
  }

  toggleTheme() {
    this.settings.theme = this.settings.theme === 'dark' ? 'light' : 'dark';
    api.saveSettings(this.settings);
    
    if (this.settings.theme === 'light') {
      document.documentElement.style.setProperty('--bg-primary', '#F8FAFC');
      document.documentElement.style.setProperty('--bg-secondary', '#E2E8F0');
      document.documentElement.style.setProperty('--bg-tertiary', '#CBD5E1');
      document.documentElement.style.setProperty('--text-primary', '#1E293B');
      document.documentElement.style.setProperty('--text-secondary', '#64748B');
      document.documentElement.style.setProperty('--border', '#CBD5E1');
      this.elements.themeToggleBtn.querySelector('.icon').textContent = '☀️';
    } else {
      document.documentElement.style.setProperty('--bg-primary', '#1E1E2E');
      document.documentElement.style.setProperty('--bg-secondary', '#2A2A3E');
      document.documentElement.style.setProperty('--bg-tertiary', '#363650');
      document.documentElement.style.setProperty('--text-primary', '#E2E8F0');
      document.documentElement.style.setProperty('--text-secondary', '#94A3B8');
      document.documentElement.style.setProperty('--border', '#3F3F5A');
      this.elements.themeToggleBtn.querySelector('.icon').textContent = '🌙';
    }
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}

const app = new CmdManaApp();
