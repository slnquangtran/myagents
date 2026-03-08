# MyAgents Studio – Autonomous Multi-Agent Team

An autonomous, local-first multi-agent runner designed for brainstorming and executing complex tasks using an "OpenCode-style" architecture.

## ?? Key Features
- **Collaborative Brainstorming**: A specialized team of AI agents (Alice, Bob, and Charlie) decomposes your high-level goal into actionable sub-tasks.
- **OpenCode Execution Engine**: Integrated with the `opencode_ui` runner for parallel task processing.
- **Autonomous Orchestration**: A `ManagerAgent` dynamically routes tasks to specialized `WorkerAgents`.
- **Intelligent Fallback**: Automatically detects "Out of Tokens" scenarios and generates handover files (`GEMINI_HANDOVER.md` and `PROMPT_FOR_CLAUDE.txt`) to continue the work in Gemini CLI, Cursor, or Claude.
- **Real-time Observability**: A modern, dark-mode GUI with rich emojis and status tracking.

## ??? Requirements
- Python 3.10+
- `tkinter` (usually bundled with Python)
- `opencode_ui` (must be in the same parent directory)

## ?? How to Use
1. **Launch the Studio**:
   ```bash
   # From the parent directory
   export PYTHONPATH=$PYTHONPATH:.
   python -m myagents.app
   ```
2. **Define Your Goal**: Type your prompt in the "Define Your Goal" text area (e.g., *"Build a secure file encryption tool"*).
3. **Configure the Team**: Set the number of **Specialists** (workers) you want on the job.
4. **Deploy**: Click **"Deploy Team"**.
5. **Watch the Brainstorm**: Observe Alice (Analyst), Bob (Architect), and Charlie (Coder) as they collaborate to plan your project.
6. **Execution**: The team will execute the plan in parallel. If they run out of tokens, check the directory for the generated handover files.

## ?? Project Structure
- `app.py`: The Tkinter-based GUI.
- `runner.py`: The core agent logic and execution bus.
- `results.json`: Consolidated output of all completed tasks.

---
Built for autonomous exploration and local-first development.
