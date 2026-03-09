# MyAgents Studio – Autonomous Multi-Agent Team

An autonomous, local-first multi-agent runner designed for brainstorming and executing complex tasks using an "OpenCode-style" architecture.

## Key Features
- **Collaborative Brainstorming**: A specialized team of AI agents (Alice, Bob, and Charlie) decomposes your high-level goal into actionable sub-tasks.
- **OpenCode Execution Engine**: Integrated with the `opencode_ui` runner for parallel task processing.
- **Autonomous Orchestration**: A `ManagerAgent` dynamically routes tasks to specialized `WorkerAgents`.
- **Intelligent Fallback**: Automatically detects "Out of Tokens" scenarios and generates handover files (`GEMINI_HANDOVER.md` and `PROMPT_FOR_CLAUDE.txt`).
- **Real-time Observability**: A modern, dark-mode GUI with rich emojis and status tracking.

## Requirements
- Python 3.10+
- `tkinter` (usually bundled with Python)
- `opencode_ui` (must be in the same parent directory)

## How to Run (Windows)

### **Option 1: PowerShell (Recommended)**
```powershell
$env:PYTHONPATH = ".";
python -m myagents.app
```

### **Option 2: Command Prompt (CMD)**
```cmd
set PYTHONPATH=. &&
python -m myagents.app
```

## Project Structure
- `app.py`: The Tkinter-based GUI.
- `runner.py`: The core agent logic and execution bus.
- `results.json`: Consolidated output of all completed tasks.

---
Built for autonomous exploration and local-first development.
