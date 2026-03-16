# AI Agent CLI Manager - Specification Document

## 1. Project Overview

**Project Name:** CmdMana - AI Agent CLI Manager  
**Type:** Desktop Application (Electron)  
**Core Feature:** A tabbed terminal manager that allows users to run multiple AI agent CLI tools simultaneously in separate tabs, with easy management capabilities.  
**Target Users:** Developers and power users who work with multiple AI CLI agents (like OpenAI CLI, Anthropic CLI, Ollama, etc.)

## 2. UI/UX Specification

### Layout Structure

**Main Window:**
- Single window application with native window controls
- Dimensions: 1200x800 (default), minimum 800x600
- Resizable, maximizable, minimizable

**Layout Areas:**
```
┌─────────────────────────────────────────────────────────────┐
│  [Title Bar - Native Window Controls]                       │
├─────────────────────────────────────────────────────────────┤
│  [Toolbar] Add Agent | Settings | Theme Toggle              │
├─────────────────────────────────────────────────────────────┤
│  [Tab Bar]                                                  │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌───┐                │
│  │ Claude  │ │ GPT-4   │ │ Ollama  │ │ + │                │
│  └─────────┘ └─────────┘ └─────────┘ └───┘                │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  [Terminal/Output Panel]                                    │
│  - Command input                                            │
│  - Output display                                           │
│  - Scrollable history                                       │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│  [Status Bar] Agent Status | Running Time | Memory Usage    │
└─────────────────────────────────────────────────────────────┘
```

### Visual Design

**Color Palette:**
- Primary Background: #1E1E2E (dark charcoal)
- Secondary Background: #2A2A3E (lighter charcoal)
- Accent Color: #7C3AED (vibrant purple)
- Success: #10B981 (emerald green)
- Error: #EF4444 (red)
- Warning: #F59E0B (amber)
- Text Primary: #E2E8F0 (light gray)
- Text Secondary: #94A3B8 (muted gray)
- Border: #3F3F5A (subtle border)

**Typography:**
- UI Font: 'Segoe UI', system-ui, sans-serif
- Terminal Font: 'Cascadia Code', 'Fira Code', 'Consolas', monospace
- Font Sizes:
  - Tab labels: 13px
  - Terminal text: 14px
  - Status bar: 12px

**Spacing System:**
- Base unit: 4px
- Component padding: 8px / 12px / 16px
- Tab gap: 4px
- Terminal padding: 16px

**Visual Effects:**
- Tab hover: brightness(1.1) with 150ms transition
- Active tab: bottom border 2px accent color
- Button hover: scale(1.02) with shadow
- Terminal scroll: smooth scroll
- Focus ring: 2px accent color outline

### Components

**Tab Component:**
- States: default, hover, active, running (with pulsing indicator)
- Close button (×) on hover
- Agent icon/favicon
- Status indicator dot (green=running, gray=stopped, red=error)

**Toolbar Buttons:**
- Icon + text label
- Hover: background lighten
- Active: pressed state

**Terminal Panel:**
- Monospace font
- Syntax-highlighted output
- Command history (up/down arrows)
- Auto-scroll with toggle
- Clear button

**Add Agent Dialog:**
- Agent name input
- Command to run (path to CLI)
- Working directory selector
- Environment variables (key-value pairs)
- Save/Cancel buttons

## 3. Functional Specification

### Core Features

1. **Multi-Tab Management**
   - Create new tabs for different AI agents
   - Each tab runs independently
   - Close tabs with confirmation if process running
   - Reorder tabs via drag-and-drop (optional)

2. **Agent Configuration**
   - Store agent configurations (name, command, args, env, cwd)
   - Predefined templates for common AI CLIs (OpenAI, Anthropic, Ollama, etc.)
   - Import/export configurations
   - Edit existing configurations

3. **Terminal/Command Execution**
   - Execute CLI commands in each tab
   - Real-time output streaming
   - Command history per tab
   - Kill/terminate running process
   - Auto-restart option

4. **Session Management**
   - Save and restore workspace (open tabs, running agents)
   - Quick launch presets
   - Persistence of agent configurations

5. **Settings**
   - Theme toggle (dark/light)
   - Default shell selection
   - Startup behavior
   - Notification preferences

### User Interactions

- **Add Agent:** Click "+" button → Modal dialog → Configure → Save
- **Switch Tab:** Click tab or Ctrl+Tab / Ctrl+1-9
- **Run Command:** Type in input → Enter to execute
- **Stop Process:** Click stop button or Ctrl+C
- **Clear Output:** Click clear button or Ctrl+L
- **Close Tab:** Click × or Ctrl+W (with confirmation if running)

### Data Flow & Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      Main Process                           │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐          │
│  │ WindowMgr   │  │ ProcessMgr  │  │ ConfigStore │          │
│  │ - create    │  │ - spawn     │  │ - load/save │          │
│  │ - manage    │  │ - kill      │  │ - agents    │          │
│  └─────────────┘  └─────────────┘  └─────────────┘          │
│         │                │                │                │
│         └────────────────┼────────────────┘                │
│                          │ IPC                              │
├──────────────────────────┼──────────────────────────────────┤
│                          │                                   │
│                   Renderer Process                           │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐          │
│  │ TabManager  │  │ Terminal    │  │ Settings    │          │
│  │ - state     │  │ - xterm.js │  │ - UI prefs  │          │
│  └─────────────┘  └─────────────┘  └─────────────┘          │
└─────────────────────────────────────────────────────────────┘
```

**Key Modules:**

1. **ProcessManager** (main process)
   - `spawnAgent(config)`: Start a new agent process
   - `killAgent(tabId)`: Terminate a process
   - `sendInput(tabId, data)`: Send input to process
   - `getProcessList()`: List all running processes

2. **ConfigStore** (main process)
   - `loadAgents()`: Load saved agent configs
   - `saveAgent(config)`: Persist agent config
   - `deleteAgent(id)`: Remove agent config
   - `exportConfig()`: Export to JSON
   - `importConfig()`: Import from JSON

3. **TabManager** (renderer)
   - `createTab(agentConfig)`: Add new tab
   - `closeTab(tabId)`: Remove tab
   - `switchTab(tabId)`: Activate tab
   - `getTabState(tabId)`: Get tab data

4. **Terminal** (renderer - xterm.js)
   - `write(data)`: Output to terminal
   - `onData(callback)`: Handle user input
   - `clear()`: Clear terminal
   - `resize(cols, rows)`: Handle resize

### Edge Cases

- Handle process crash with error notification
- Handle very long output (virtual scrolling)
- Handle rapid command input
- Handle tab close during active process (confirm dialog)
- Handle invalid agent configuration
- Handle missing CLI tools
- Handle system shutdown with running processes

## 4. Acceptance Criteria

### Success Conditions

1. **Application Launch**
   - App starts without errors
   - Window displays correctly with all UI elements
   - Default dark theme applied

2. **Tab Management**
   - Can create new tab with custom agent
   - Can switch between tabs
   - Can close tabs (with confirmation if process running)
   - Tab state persists correctly

3. **Command Execution**
   - Can run CLI commands in any tab
   - Output displays in real-time
   - Can send input to running process
   - Can terminate running process

4. **Agent Configuration**
   - Can add new agent with custom configuration
   - Can edit existing agent config
   - Can delete agent config
   - Configurations persist after restart

5. **Persistence**
   - Running agents restore on app restart
   - Tab order preserved
   - Settings preserved

### Visual Checkpoints

- [ ] Dark theme with purple accent visible
- [ ] Tabs display with status indicators
- [ ] Terminal renders with monospace font
- [ ] Toolbar buttons have hover effects
- [ ] Modal dialogs centered and styled
- [ ] Status bar shows agent info
- [ ] Smooth tab switching animation
