#!/usr/bin/env python3
"""
AI Sales Platform - Swarm Orchestrator
Multi-agent task dispatcher with real-time log streaming

Workers:
- Worker 1 (164.92.118.130): Build/Error Resolution
- Worker 2 (147.182.243.137): UX/UI and Website Builder
- Worker 3 (161.35.239.20): Infrastructure/Database
"""

import subprocess
import sys
import threading
import time
from pathlib import Path
from typing import List, Optional, Dict
from enum import Enum
import io

# Fix Windows Unicode encoding issues
if sys.platform == "win32":
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace')

class WorkerRole(Enum):
    BUILD = "Build/Error Resolution"
    UI = "UX/UI and Website Builder"
    INFRA = "Infrastructure/Database"

class Worker:
    def __init__(self, id: int, ip: str, role: WorkerRole, worktree: str = "worktree-1"):
        self.id = id
        self.ip = ip
        self.role = role
        self.worktree = worktree
        self.ssh_key = Path.home() / ".ssh" / "ai_swarm_key"
        
    def __str__(self):
        return f"Worker {self.id} ({self.ip}) - {self.role.value}"

# Swarm Configuration
SWARM = {
    1: Worker(1, "164.92.118.130", WorkerRole.BUILD),
    2: Worker(2, "147.182.243.137", WorkerRole.UI),
    3: Worker(3, "161.35.239.20", WorkerRole.INFRA),
}

def execute_on_worker(worker: Worker, command: str, stream_output: bool = True) -> tuple[int, str]:
    """
    Execute command on remote worker via SSH
    
    Args:
        worker: Worker instance
        command: Command to execute
        stream_output: Whether to stream output in real-time
        
    Returns:
        (exit_code, output)
    """
    ssh_cmd = [
        "ssh",
        "-i", str(worker.ssh_key),
        "-o", "StrictHostKeyChecking=no",
        f"root@{worker.ip}",
        f"cd ~/{worker.worktree} && {command}"
    ]
    
    print(f"\n{'='*80}")
    print(f"🎯 {worker}")
    print(f"📋 Command: {command}")
    print(f"{'='*80}\n")
    
    if stream_output:
        # Stream output in real-time
        process = subprocess.Popen(
            ssh_cmd,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            encoding='utf-8',
            errors='replace',
            bufsize=1
        )
        
        output_lines = []
        for line in process.stdout:
            print(f"[Worker {worker.id}] {line}", end='')
            output_lines.append(line)
        
        process.wait()
        return process.returncode, ''.join(output_lines)
    else:
        # Capture output silently
        result = subprocess.run(ssh_cmd, capture_output=True, text=True)
        return result.returncode, result.stdout + result.stderr

def execute_parallel(workers: List[Worker], command: str) -> Dict[int, tuple[int, str]]:
    """
    Execute command on multiple workers in parallel
    
    Args:
        workers: List of workers
        command: Command to execute
        
    Returns:
        Dictionary mapping worker_id to (exit_code, output)
    """
    results = {}
    threads = []
    
    def worker_task(worker: Worker):
        results[worker.id] = execute_on_worker(worker, command, stream_output=True)
    
    print(f"\n🚀 Dispatching to {len(workers)} workers in parallel...\n")
    
    for worker in workers:
        thread = threading.Thread(target=worker_task, args=(worker,))
        thread.start()
        threads.append(thread)
    
    for thread in threads:
        thread.join()
    
    return results

def sync_all():
    """Pull latest code on all workers"""
    print("\n📥 Syncing all workers with dev branch...")
    return execute_parallel(list(SWARM.values()), "git pull origin dev")

def build_on_worker(worker_id: int):
    """Run build on specific worker"""
    worker = SWARM[worker_id]
    return execute_on_worker(worker, "npm run build")

def lint_on_worker(worker_id: int):
    """Run lint on specific worker"""
    worker = SWARM[worker_id]
    return execute_on_worker(worker, "npm run lint")

def test_on_worker(worker_id: int):
    """Run tests on specific worker"""
    worker = SWARM[worker_id]
    return execute_on_worker(worker, "npm test")

def status_check():
    """Check status of all workers"""
    print("\n🔍 Checking swarm status...\n")
    results = execute_parallel(
        list(SWARM.values()),
        "git status && echo '---' && git branch"
    )
    return results

def custom_command(worker_id: Optional[int], command: str):
    """Execute custom command on worker(s)"""
    if worker_id:
        worker = SWARM[worker_id]
        return execute_on_worker(worker, command)
    else:
        # Execute on all workers
        return execute_parallel(list(SWARM.values()), command)

def show_menu():
    """Interactive menu for swarm orchestration"""
    print("\n" + "="*80)
    print("🌐 AI SALES PLATFORM - SWARM ORCHESTRATOR")
    print("="*80)
    print("\nWorker Configuration:")
    for worker in SWARM.values():
        print(f"  {worker}")
    print("\n" + "-"*80)
    print("\nCommands:")
    print("  1. Sync All Workers (git pull)")
    print("  2. Status Check (all workers)")
    print("  3. Build on Worker 1")
    print("  4. Lint on Worker (choose)")
    print("  5. Test on Worker (choose)")
    print("  6. Custom Command on Worker")
    print("  7. Custom Command on All Workers")
    print("  q. Quit")
    print("-"*80)

def main():
    """Main orchestration loop"""
    if len(sys.argv) > 1:
        # CLI mode
        command = sys.argv[1]
        
        if command == "sync":
            sync_all()
        elif command == "status":
            status_check()
        elif command == "build":
            worker_id = int(sys.argv[2]) if len(sys.argv) > 2 else 1
            build_on_worker(worker_id)
        elif command == "lint":
            worker_id = int(sys.argv[2]) if len(sys.argv) > 2 else 1
            lint_on_worker(worker_id)
        elif command == "test":
            worker_id = int(sys.argv[2]) if len(sys.argv) > 2 else 1
            test_on_worker(worker_id)
        elif command == "exec":
            worker_id = int(sys.argv[2]) if sys.argv[2].isdigit() else None
            cmd = " ".join(sys.argv[3:]) if worker_id else " ".join(sys.argv[2:])
            custom_command(worker_id, cmd)
        else:
            print(f"Unknown command: {command}")
            print("\nUsage:")
            print("  python orchestrate.py sync")
            print("  python orchestrate.py status")
            print("  python orchestrate.py build [worker_id]")
            print("  python orchestrate.py lint [worker_id]")
            print("  python orchestrate.py test [worker_id]")
            print("  python orchestrate.py exec [worker_id] <command>")
            print("  python orchestrate.py  (interactive mode)")
    else:
        # Interactive mode
        while True:
            show_menu()
            choice = input("\n👉 Enter command: ").strip()
            
            if choice == 'q':
                print("\n👋 Exiting swarm orchestrator...")
                break
            elif choice == '1':
                sync_all()
            elif choice == '2':
                status_check()
            elif choice == '3':
                build_on_worker(1)
            elif choice == '4':
                worker_id = int(input("Worker ID (1-3): "))
                lint_on_worker(worker_id)
            elif choice == '5':
                worker_id = int(input("Worker ID (1-3): "))
                test_on_worker(worker_id)
            elif choice == '6':
                worker_id = int(input("Worker ID (1-3): "))
                command = input("Command: ")
                custom_command(worker_id, command)
            elif choice == '7':
                command = input("Command: ")
                custom_command(None, command)
            else:
                print("❌ Invalid choice")
            
            input("\nPress Enter to continue...")

if __name__ == "__main__":
    main()
