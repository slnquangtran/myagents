import threading
import queue
import time
import json
import random
import sys
import os
from typing import Optional, Dict, Any, Callable, List

# Add the parent directory to sys.path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

try:
    from opencode_ui.runner import run_team as run_opencode_team
except ImportError:
    run_opencode_team = None

class Bus:
    def __init__(self):
        self.goal_queue = queue.Queue()
        self.raw_queue = queue.Queue()
        self.task_queue = queue.Queue()
        self.result_queue = queue.Queue()
        self.log_queue = queue.Queue()
        self.stop_event = threading.Event()
        self.exhausted = False
        self.context = {}

class BrainstormAgent(threading.Thread):
    def __init__(self, bus: Bus):
        super().__init__(daemon=True)
        self.bus = bus
    def run(self):
        while not self.bus.stop_event.is_set():
            try:
                goal = self.bus.goal_queue.get(timeout=0.2)
            except queue.Empty:
                continue
            
            self.bus.log_queue.put(f"Brainstorming for goal: '{goal[:50]}...'")
            time.sleep(1.0)
            
            sub_tasks = [
                {"type": "analyze", "desc": "Analyze requirements for: " + goal},
                {"type": "generate", "desc": "Draft code for: " + goal},
                {"type": "review", "desc": "Review solution for: " + goal},
                {"type": "generate", "desc": "Optimize final script for: " + goal},
                {"type": "review", "desc": "Security check for: " + goal},
                {"type": "analyze", "desc": "Final analysis for: " + goal}
            ]
            
            for i, st in enumerate(sub_tasks):
                task = {"raw_id": f"sub-{i}", "payload": st['desc'], "type": st['type']}
                self.bus.raw_queue.put(task)
            
            self.bus.goal_queue.task_done()

class ManagerAgent(threading.Thread):
    def __init__(self, bus: Bus):
        super().__init__(daemon=True)
        self.bus = bus
    def run(self):
        while not self.bus.stop_event.is_set():
            try:
                raw_item = self.bus.raw_queue.get(timeout=0.2)
            except queue.Empty:
                continue
            
            task = {
                "task_id": f"task-{raw_item['raw_id']}",
                "type": raw_item['type'],
                "payload": raw_item['payload'],
                "status": "pending"
            }
            self.bus.log_queue.put(f"Manager: Assigned {task['task_id']} to OpenCode Engine")
            self.bus.task_queue.put(task)
            self.bus.raw_queue.task_done()

class WorkerAgent(threading.Thread):
    def __init__(self, bus: Bus, worker_id: int = 0):
        super().__init__(daemon=True)
        self.bus = bus
        self.worker_id = worker_id
        self.opencode_team = None

    def run(self):
        if run_opencode_team:
            self.opencode_team = run_opencode_team(config={"seed": 0, "workers": 1})
        
        while not self.bus.stop_event.is_set():
            if self.bus.exhausted:
                time.sleep(0.5)
                continue

            try:
                task = self.bus.task_queue.get(timeout=0.2)
            except queue.Empty:
                continue
            
            task_id = task.get('task_id')
            self.bus.log_queue.put(f"Worker-{self.worker_id}: Processing {task_id}...")
            time.sleep(random.uniform(0.5, 1.0))

            # Simulate a 50% chance for test purposes
            if random.random() < 0.50:
                self.bus.exhausted = True
                self.bus.log_queue.put(f"Worker-{self.worker_id}: [ERROR] Agent Reply: 'System error: Out of tokens for this session.'")
                self.bus.log_queue.put("SYSTEM: Switching to Fallback Agents (Antigravity, Gemini, Cursor, Claude)")
                self.bus.task_queue.task_done()
                continue

            result = f"Processed {task['type']} successfully via OpenCode Engine."
            task['result'] = result
            task['status'] = 'completed'
            
            self.bus.result_queue.put(task)
            self.bus.task_queue.task_done()
            self.bus.log_queue.put(f"Worker-{self.worker_id}: {task_id} finished.")

    def stop(self):
        if self.opencode_team:
            self.opencode_team.stop()

class ResultAgent(threading.Thread):
    def __init__(self, bus: Bus):
        super().__init__(daemon=True)
        self.bus = bus
    def run(self):
        results = []
        handover_written = False
        while not self.bus.stop_event.is_set() or not self.bus.result_queue.empty():
            try:
                res = self.bus.result_queue.get(timeout=0.2)
                results.append(res)
            except queue.Empty:
                if self.bus.exhausted and not handover_written:
                    self.generate_handover(results)
                    handover_written = True
                continue
            
            with open("results.json", 'w') as f:
                json.dump(results, f, indent=2)
            self.bus.result_queue.task_done()

    def generate_handover(self, results):
        # 1. Gemini CLI Handover
        with open("GEMINI_HANDOVER.md", 'w') as f:
            f.write("# AGENT HANDOVER: TOKEN DEPLETION DETECTED\n")
            f.write("The current team has exhausted its budget. Please take over the following state:\n\n")
            f.write(f"Completed Tasks: {len(results)}\n")
            f.write("Latest results are in `results.json`.\n")
            f.write("Target App: `Antigravity` at `system-prompts-and-models-of-ai-tools/Google/Antigravity`.\n")

        # 2. Claude/Cursor Prompt
        with open("PROMPT_FOR_CLAUDE.txt", 'w') as f:
            f.write("I am moving this task to you because my local agent team ran out of tokens.\n")
            f.write("Here is what we have so far:\n")
            for res in results:
                f.write(f"- {res['task_id']}: {res['result']}\n")
            f.write("\nPlease finish the implementation based on these results.")
        
        self.bus.log_queue.put("SYSTEM: [SUCCESS] Handover files generated for Gemini CLI, Claude, and Cursor.")
        self.bus.log_queue.put("SYSTEM: [ANTIGRAVITY] Initiating escape velocity protocols...")

class LoggerAgent(threading.Thread):
    def __init__(self, bus: Bus, on_log: Optional[Callable[[str], None]] = None):
        super().__init__(daemon=True)
        self.bus = bus
        self.on_log = on_log
    def run(self):
        while not self.bus.stop_event.is_set():
            try:
                msg = self.bus.log_queue.get(timeout=0.2)
            except queue.Empty:
                continue
            if self.on_log:
                self.on_log(msg)
            else:
                print(msg)

class Team:
    def __init__(self, threads: list, bus: Bus):
        self.threads = threads
        self.bus = bus
    def stop(self):
        self.bus.stop_event.set()
        for t in self.threads:
            if hasattr(t, 'stop'):
                t.stop()
            if t.is_alive():
                t.join(timeout=1)

def run_team(goal: str, config: Optional[Dict[str, Any]] = None, on_log: Optional[Callable[[str], None]] = None) -> Team:
    bus = Bus()
    bus.goal_queue.put(goal)
    
    brainstormer = BrainstormAgent(bus)
    manager = ManagerAgent(bus)
    workers = [WorkerAgent(bus, i) for i in range(int(config.get("workers", 2)) if config else 2)]
    result_saver = ResultAgent(bus)
    logger = LoggerAgent(bus, on_log=on_log)
    
    threads = [brainstormer, manager, result_saver, logger] + workers
    for t in threads:
        t.start()
    return Team(threads, bus)
