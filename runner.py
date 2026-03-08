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
    """Simulates a collaborative session between specialized personas."""
    def __init__(self, bus: Bus):
        super().__init__(daemon=True)
        self.bus = bus
        self.personas = [
            {"name": "Alice (Analyst)", "focus": "Requirements & User Intent"},
            {"name": "Bob (Architect)", "focus": "System Design & Safety"},
            {"name": "Charlie (Coder)", "focus": "Implementation & Logic"}
        ]

    def run(self):
        while not self.bus.stop_event.is_set():
            try:
                goal = self.bus.goal_queue.get(timeout=0.2)
            except queue.Empty:
                continue
            
            self.bus.log_queue.put(f"?? [BRAINSTORM] Goal received: '{goal}'")
            time.sleep(1.0)

            # Stage 1: Alice Analyzes
            self.bus.log_queue.put(f"?? {self.personas[0]['name']} is analyzing the scope...")
            time.sleep(1.5)
            analysis_task = {"type": "analyze", "desc": f"Define core requirements for {goal}", "contributed_by": self.personas[0]['name']}
            
            # Stage 2: Bob Suggests Architecture
            self.bus.log_queue.put(f"?? {self.personas[1]['name']} is suggesting a system structure...")
            time.sleep(1.5)
            arch_task = {"type": "review", "desc": f"Design modular architecture for {goal}", "contributed_by": self.personas[1]['name']}

            # Stage 3: Charlie Plans Implementation
            self.bus.log_queue.put(f"?? {self.personas[2]['name']} is mapping out the code modules...")
            time.sleep(1.5)
            code_task = {"type": "generate", "desc": f"Implement main logic for {goal}", "contributed_by": self.personas[2]['name']}

            # Stage 4: Collective Refinement
            self.bus.log_queue.put("?? [TEAM] Finalizing the task roadmap...")
            time.sleep(1.0)
            
            for i, st in enumerate([analysis_task, arch_task, code_task]):
                task = {
                    "raw_id": f"sub-{i}", 
                    "payload": st['desc'], 
                    "type": st['type'],
                    "contributed_by": st['contributed_by']
                }
                self.bus.raw_queue.put(task)
                self.bus.log_queue.put(f"? Created Task: {st['type'].upper()} (Idea by {st['contributed_by']})")
            
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
                "contributed_by": raw_item['contributed_by'],
                "status": "pending"
            }
            self.bus.log_queue.put(f"?? [MANAGER] Routing '{task['task_id']}' to specialized Worker...")
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
            contributor = task.get('contributed_by')
            
            self.bus.log_queue.put(f"?? [WORKER-{self.worker_id}] Executing {contributor}'s idea: {task_id}")
            time.sleep(random.uniform(2.0, 4.0))

            if random.random() < 0.10:
                self.bus.exhausted = True
                self.bus.log_queue.put(f"?? [WORKER-{self.worker_id}] API ERROR: 'Out of tokens for this session.'")
                self.bus.task_queue.task_done()
                continue

            result = f"Result of {task['type'].upper()}: Successfully executed the proposal from {contributor}."
            task['result'] = result
            task['status'] = 'completed'
            
            self.bus.result_queue.put(task)
            self.bus.task_queue.task_done()
            self.bus.log_queue.put(f"? [WORKER-{self.worker_id}] {task_id} COMPLETED.")

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
        with open("GEMINI_HANDOVER.md", 'w') as f:
            f.write("# AGENT HANDOVER: TOKEN DEPLETION\n")
            f.write("Progress was halted. Here is the contribution log:\n\n")
            for res in results:
                f.write(f"- {res['contributed_by']}: {res['task_id']} (DONE)\n")
        
        with open("PROMPT_FOR_CLAUDE.txt", 'w') as f:
            f.write("Handover from MyAgents Studio.\n")
            f.write(f"Completed contributions from Alice, Bob, and Charlie: {len(results)}\n")
        
        self.bus.log_queue.put("?? [SYSTEM] Handover files generated. Switching to external agents...")

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
