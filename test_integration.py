import sys
import os
import time
import json
import random

# Add the parent directory to sys.path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from myagents.runner import run_team

def test_full_workflow():
    print("--- Starting MyAgents 'Natural Token' Workflow Test ---")
    
    logs = []
    def on_log(msg):
        logs.append(msg)
        print(f"[LOG] {msg}")

    goal = "Build a real-time stock price tracker using Python and yfinance"
    # We use 5 workers to increase the chance of hitting the 10% 'out of tokens' limit
    config = {"workers": 5}

    print(f"Deploying team for goal: '{goal}'")
    team = run_team(goal=goal, config=config, on_log=on_log)

    # Wait up to 20 seconds for agents to either finish or run out of tokens
    timeout = 20
    start_time = time.time()
    while time.time() - start_time < timeout:
        # Check if handover files were created
        if os.path.exists("GEMINI_HANDOVER.md"):
            print("\n!!! SUCCESS: Token depletion detected and handover initiated !!!")
            break
        time.sleep(1)

    team.stop()

    print("\n--- Final Verification ---")
    
    # Check if results.json exists
    if os.path.exists("results.json"):
        with open("results.json", 'r') as f:
            res = json.load(f)
            print(f"Total tasks processed before stop: {len(res)}")
    
    # Check for handover files
    files = ["GEMINI_HANDOVER.md", "PROMPT_FOR_CLAUDE.txt", "results.json"]
    for f in files:
        status = "EXISTS" if os.path.exists(f) else "MISSING"
        print(f"File {f}: {status}")
        if status == "EXISTS" and f != "results.json":
             # Print a snippet of the handover
             with open(f, 'r') as content:
                 print(f"--- Snippet of {f} ---")
                 print(content.read()[:150] + "...")

    print("\n--- Test Complete ---")

if __name__ == "__main__":
    # Clean up old files first
    for f in ["GEMINI_HANDOVER.md", "PROMPT_FOR_CLAUDE.txt", "results.json"]:
        if os.path.exists(f):
            os.remove(f)
            
    test_full_workflow()
