import sys
import os
import time
import json
import random

# Add the parent directory to sys.path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from myagents.runner import run_team

def test_handover_workflow():
    print("--- Starting Intensive Handover Test (High Task Count) ---")
    
    logs = []
    def on_log(msg):
        logs.append(msg)
        print(f"[LOG] {msg}")

    goal = "Intensive Task Simulation"
    # We define a large number of tasks manually in the brainstormer's logic for this test
    config = {"workers": 5}

    print("Deploying team...")
    team = run_team(goal=goal, config=config, on_log=on_log)

    # We wait until either exhausted or 30 seconds pass
    timeout = 30
    start_time = time.time()
    while time.time() - start_time < timeout:
        if os.path.exists("GEMINI_HANDOVER.md"):
            print("\n!!! SUCCESS: Token depletion detected and handover initiated !!!")
            break
        # If the queue is empty and they all finished, we need more tasks!
        # Our 10% chance should eventually hit.
        time.sleep(1)

    team.stop()

    # Check for handover files
    files = ["GEMINI_HANDOVER.md", "PROMPT_FOR_CLAUDE.txt", "results.json"]
    for f in files:
        status = "EXISTS" if os.path.exists(f) else "MISSING"
        print(f"File {f}: {status}")
        if status == "EXISTS" and f != "results.json":
             with open(f, 'r') as content:
                 print(f"--- Content of {f} ---")
                 print(content.read())

    print("\n--- Test Complete ---")

if __name__ == "__main__":
    # Clean up
    for f in ["GEMINI_HANDOVER.md", "PROMPT_FOR_CLAUDE.txt", "results.json"]:
        if os.path.exists(f): os.remove(f)
            
    test_handover_workflow()
