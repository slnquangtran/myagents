# MyAgents: OpenCode Multi-Agent UI

A tiny UI to manage and observe an OpenCode-style multi-agent team, built for CLI-friendly development and local exploration.

## Features

- **Dynamic Configuration**: Adjust seed count, worker count, and delay directly from the GUI.
- **Agent Orchestration**: 
  - `StarterAgent`: Generates raw seeds.
  - `ManagerAgent`: Curates and assigns specialized tasks (Analyze, Generate, Review).
  - `WorkerAgent`: Processes tasks with a simulated "thinking" delay.
  - `ResultAgent`: Persists all completed tasks to `results.json`.
- **Real-time Logging**: Observe agent interactions and status updates in the UI.

## Running the App

Run the application using the module execution:

```bash
python -m app
```

*(or directly via the script)*

```bash
python app.py
```
