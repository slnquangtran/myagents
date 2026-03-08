import tkinter as tk
from tkinter import scrolledtext
from myagents.runner import run_team

def main():
    root = tk.Tk()
    root.title("MyAgents Studio")
    root.geometry("600x420")

    log = scrolledtext.ScrolledText(root, height=20)
    log.pack(fill='both', expand=True, padx=8, pady=8)
    def on_log(msg):
        log.configure(state='normal')
        log.insert(tk.END, msg + "\n")
        log.configure(state='disabled')
        log.yview(tk.END)
    team = None
    def start_team():
        nonlocal team
        cfg = {"seed": 5, "workers": 2, "delay": 0.0}
        team = run_team(config=cfg, on_log=on_log)
        start_btn.config(state='disabled')
        stop_btn.config(state='normal')
    def stop_team():
        nonlocal team
        if team:
            team.stop()
            team = None
        start_btn.config(state='normal')
        stop_btn.config(state='disabled')
    btn_frame = tk.Frame(root)
    btn_frame.pack(fill='x', padx=8, pady=4)
    start_btn = tk.Button(btn_frame, text='Start Team', command=start_team)
    start_btn.pack(side='left', padx=4)
    stop_btn = tk.Button(btn_frame, text='Stop Team', command=stop_team, state='disabled')
    stop_btn.pack(side='left', padx=4)
    root.mainloop()

if __name__ == '__main__':
    main()
