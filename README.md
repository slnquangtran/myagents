# CmdMana - Terminal Manager

A simple terminal manager to run multiple command-line interfaces in tabs, like a modern browser.

## Features

- **Multiple Terminal Tabs** - Create and manage multiple terminal sessions in separate tabs
- **Easy Tab Switching** - Click tabs to switch between terminals (like Chrome)
- **Run as Administrator** - One-click button to restart as admin
- **Set as Default Terminal** - Replace cmd.exe and PowerShell with CmdMana
- **npm CLI Support** - Works with global npm packages (claude, gemini, etc.)
- **Dark Theme** - Modern dark UI

## Installation

### Option 1: Install from exe
Download the installer from releases and run it.

### Option 2: Build yourself
```bash
npm install
npm run build
```

## Usage

```bash
npm run dev
```

## Controls

- **+ button** - Create new terminal tab
- **Click tab** - Switch between terminals
- **x on tab** - Close terminal
- **Enter** - Run command
- **🛡️ Admin** - Restart as Administrator
- **📌 Set as Default** - Replace cmd/powershell with CmdMana

## Build

```bash
npm run build
```

Creates:
- `dist/CmdMana-Setup.exe` - Installer
- `dist/CmdMana.exe` - Portable exe

## Tech Stack

- Electron
- JavaScript
- PowerShell

## License

MIT
