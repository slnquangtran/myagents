import tkinter as tk
from tkinter import scrolledtext, messagebox
import json
import os
import datetime
from myagents.runner import run_team

CONFIG_FILE = "config.json"

def load_config():
    if os.path.exists(CONFIG_FILE):
        try:
            with open(CONFIG_FILE, 'r') as f:
                return json.load(f)
        except Exception:
            pass
    return {"workers": 3}

def main():
    root = tk.Tk()
    root.title("MyAgents Studio - Auto Team")
    root.geometry("700x650")

    config = load_config()

    # Prompt Area
    prompt_frame = tk.LabelFrame(root, text="Step 1: Define Your Goal / Prompt", padx=10, pady=10)
    prompt_frame.pack(fill='x', padx=10, pady=5)
    
    prompt_text = tk.Text(prompt_frame, height=5, font=("Segoe UI", 10))
    prompt_text.pack(fill='x')
    prompt_text.insert("1.0", "Write a Python script that scrapes weather data and sends an email alert if it rains.")

    # Configuration Frame
    cfg_frame = tk.LabelFrame(root, text="Step 2: Team Configuration", padx=10, pady=5)
    cfg_frame.pack(fill='x', padx=10, pady=5)

    tk.Label(cfg_frame, text="Specialists:").grid(row=0, column=0, sticky='w')
    workers_entry = tk.Entry(cfg_frame, width=8)
    workers_entry.insert(0, str(config.get("workers", 3)))
    workers_entry.grid(row=0, column=1, padx=5, pady=2)

    # Log Area
    log_frame = tk.LabelFrame(root, text="Agent Brainstorming & Execution Log", padx=10, pady=5)
    log_frame.pack(fill='both', expand=True, padx=10, pady=5)
    
    log = scrolledtext.ScrolledText(log_frame, height=15, bg="#1e1e1e", fg="#d4d4d4", font=("Consolas", 9))
    log.pack(fill='both', expand=True)
    log.configure(state='disabled')

    def on_log(msg):
        log.configure(state='normal')
        timestamp = datetime.datetime.now().strftime('%H:%M:%S')
        log.insert(tk.END, f"[{timestamp}] {msg}\n")
        log.configure(state='disabled')
        log.yview(tk.END)

    team = None

    def start_team():
        nonlocal team
        prompt = prompt_text.get("1.0", tk.END).strip()
        if not prompt:
            messagebox.showwarning("Warning", "Please enter a prompt for the team.")
            return

        try:
            cfg = {
                "workers": int(workers_entry.get())
            }
        except ValueError:
            messagebox.showerror("Error", "Please enter valid numbers.")
            return

        # Save config
        try:
            with open(CONFIG_FILE, 'w') as f:
                json.dump(cfg, f, indent=2)
        except Exception:
            pass

        log.configure(state='normal')
        log.delete('1.0', tk.END)
        log.configure(state='disabled')
        
        on_log(f"SYSTEM: Deploying team for goal: {prompt[:40]}...")
        team = run_team(goal=prompt, config=cfg, on_log=on_log)
        
        start_btn.config(state='disabled')
        stop_btn.config(state='normal')
        status_label.config(text=f"Status: Team is active ({cfg['workers']} workers brainstorming...)")

    def stop_team():
        nonlocal team
        if team:
            on_log("SYSTEM: Shutting down agent team.")
            team.stop()
            team = None
        start_btn.config(state='normal')
        stop_btn.config(state='disabled')
        status_label.config(text="Status: Team Idle")

    btn_frame = tk.Frame(root)
    btn_frame.pack(fill='x', padx=10, pady=5)
    
    start_btn = tk.Button(btn_frame, text='Deploy Team', command=start_team, bg='#4caf50', fg='white', font=("Segoe UI", 10, "bold"), padx=10)
    start_btn.pack(side='left', padx=4)
    
    stop_btn = tk.Button(btn_frame, text='Recall Team', command=stop_team, state='disabled', bg='#f44336', fg='white', font=("Segoe UI", 10, "bold"), padx=10)
    stop_btn.pack(side='left', padx=4)

    status_label = tk.Label(root, text="Status: Team Idle", bd=1, relief=tk.SUNKEN, anchor=tk.W)
    status_label.pack(side=tk.BOTTOM, fill=tk.X)

    root.mainloop()

if __name__ == '__main__':
    main()
