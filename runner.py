import threading
import queue
import time
from typing import Optional, Dict, Any, Callable


class Bus:
    def __init__(self):
        self.task_queue = queue.Queue()
        self.log_queue = queue.Queue()
        self.stop_event = threading.Event()


class StarterAgent(threading.Thread):
    def __init__(self, bus: Bus, seed_count: int = 5, delay: float = 0.0):
        super().__init__(daemon=True)
        self.bus = bus
        self.seed_count = seed_count
        self.delay = delay
        self.seeded = 0
    def run(self):
        while not self.bus.stop_event.is_set():
            if self.seeded < self.seed_count:
                task = {"task_id": f"seed-{self.seeded}", "payload": self.seeded}
                self.bus.task_queue.put(task)
                self.bus.log_queue.put(f"Starter seeded {task}")
                self.seeded += 1
                time.sleep(self.delay)
            else:
                time.sleep(0.5)


class WorkerAgent(threading.Thread):
    def __init__(self, bus: Bus, worker_id: int = 0):
        super().__init__(daemon=True)
        self.bus = bus
        self.worker_id = worker_id
    def run(self):
        while not self.bus.stop_event.is_set():
            try:
                task = self.bus.task_queue.get(timeout=0.2)
            except queue.Empty:
                continue
            payload = task.get('payload')
            if isinstance(payload, int):
                result = payload * 2
            else:
                try:
                    result = int(payload)
                except Exception:
                    result = str(payload)
            self.bus.log_queue.put(f"Worker-{self.worker_id} processed {task.get('task_id')} -> {result}")
            self.bus.task_queue.task_done()
        self.bus.log_queue.put(f"Worker-{self.worker_id} stopping")


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
                try:
                    self.on_log(msg)
                except Exception:
                    pass
            else:
                print(msg)
            self.bus.log_queue.task_done()


class Team:
    def __init__(self, threads: list, bus: Bus):
        self.threads = threads
        self.bus = bus
    def stop(self):
        self.bus.stop_event.set()
        for t in self.threads:
            t.join(timeout=1)


def run_team(config: Optional[Dict[str, Any]] = None, on_log: Optional[Callable[[str], None]] = None) -> Team:
    if config is None:
        config = {"seed": 5, "workers": 2, "delay": 0.0}
    bus = Bus()
    starter = StarterAgent(bus, seed_count=int(config.get("seed", 5)), delay=float(config.get("delay", 0.0)))
    workers = [WorkerAgent(bus, worker_id=i) for i in range(int(config.get("workers", 2)))]
    logger = LoggerAgent(bus, on_log=on_log)
    threads = [starter, logger] + workers
    for t in threads:
        t.start()
    return Team(threads=threads, bus=bus)
