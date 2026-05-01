import { BrowserWindow, shell } from 'electron';
import * as pty from 'node-pty';
import * as path from 'path';
import * as fs from 'fs';
import { execFile, execFileSync } from 'child_process';
import log from 'electron-log';
import type { ShellType, AppState, InteractivePaneType } from '../../renderer/types/index';

interface PtyRef {
  pty: pty.IPty;
  paneId: string;
  pendingOutput: string;
  output: string;
  cwd?: string;
  suppressExitEvent: boolean;
  sessionId?: string;
}

interface FileWatcherRef {
  watcher: fs.FSWatcher;
  paneId: string;
}

export class PaneManager {
  private ptyProcesses: Map<string, PtyRef> = new Map();
  private fileWatchers: Map<string, FileWatcherRef> = new Map();
  private paneSessionIds: Map<string, string> = new Map();
  private mainWindow: BrowserWindow | null = null;
  private refreshedWindowsEnv: Record<string, string> | null = null;
  private refreshedWindowsEnvAt = 0;
  private windowsEnvRefreshPromise: Promise<void> | null = null;
  private static readonly cwdSequencePrefix = '\u001b]633;P;Cwd=';
  private static readonly cwdSequencePattern = /\u001b\]633;P;Cwd=([^\u0007\u001b]*)(?:\u0007|\u001b\\)/g;
  private static readonly windowsEnvCacheTtlMs = 5000;

  setMainWindow(win: BrowserWindow): void {
    this.mainWindow = win;
    this.refreshWindowsEnvInBackground();
  }

  private getShellPath(shell: ShellType, loadProfile = true): { command: string; args: string[] } {
    switch (shell) {
      case 'cmd':
        return { command: 'cmd.exe', args: [] };
      case 'wsl':
        return { command: 'wsl.exe', args: [] };
      case 'powershell':
      default:
        return {
          command: 'powershell.exe',
          args: loadProfile ? ['-NoLogo'] : ['-NoLogo', '-NoProfile']
        };
    }
  }

  private buildPowerShellArgs(command?: string, loadProfile = true): string[] {
    const bootstrapScript = [
      '$global:__mxOriginalPrompt = $function:prompt',
      'function global:prompt {',
      '  $cwd = (Get-Location).ProviderPath',
      '  [Console]::Out.Write(([char]27) + "]633;P;Cwd=" + $cwd + ([char]7))',
      '  if ($global:__mxOriginalPrompt) {',
      '    & $global:__mxOriginalPrompt',
      '  } else {',
      '    "PS $cwd> "',
      '  }',
      '}'
    ].join('; ');

    const baseArgs = loadProfile ? ['-NoLogo'] : ['-NoLogo', '-NoProfile'];

    if (command && command.trim()) {
      return [...baseArgs, '-NoExit', '-Command', `${bootstrapScript}; ${command}`];
    }

    return [...baseArgs, '-NoExit', '-Command', bootstrapScript];
  }

  private sanitizePtyOutput(ref: PtyRef, chunk: string): { output: string; cwd?: string } {
    const combined = `${ref.pendingOutput}${chunk}`;
    const lastMarkerIndex = combined.lastIndexOf(PaneManager.cwdSequencePrefix);
    let pendingOutput = '';
    let processable = combined;

    if (lastMarkerIndex >= 0) {
      const bellIndex = combined.indexOf('\u0007', lastMarkerIndex + PaneManager.cwdSequencePrefix.length);
      const stIndex = combined.indexOf('\u001b\\', lastMarkerIndex + PaneManager.cwdSequencePrefix.length);
      const terminatorIndex =
        bellIndex === -1
          ? stIndex
          : stIndex === -1
            ? bellIndex
            : Math.min(bellIndex, stIndex);

      if (terminatorIndex === -1) {
        pendingOutput = combined.slice(lastMarkerIndex);
        processable = combined.slice(0, lastMarkerIndex);
      }
    }

    let nextCwd: string | undefined;
    const output = processable.replace(PaneManager.cwdSequencePattern, (_, cwd: string) => {
      const normalizedCwd = cwd.trim();
      if (normalizedCwd) {
        nextCwd = normalizedCwd;
      }
      return '';
    });

    ref.pendingOutput = pendingOutput;
    return { output, cwd: nextCwd };
  }

  private buildWindowsEnvRefreshCommand(): string {
    return [
      '$machine = [Environment]::GetEnvironmentVariables(',
      "'Machine'",
      ');',
      '$user = [Environment]::GetEnvironmentVariables(',
      "'User'",
      ');',
      '$merged = @{};',
      'foreach ($key in $machine.Keys) { $merged[[string]$key] = [string]$machine[$key] }',
      'foreach ($key in $user.Keys) { $merged[[string]$key] = [string]$user[$key] }',
      '$machinePath = [string][Environment]::GetEnvironmentVariable(',
      "'Path'",
      ', ',
      "'Machine'",
      ');',
      '$userPath = [string][Environment]::GetEnvironmentVariable(',
      "'Path'",
      ', ',
      "'User'",
      ');',
      "if ($machinePath -and $userPath) { $merged['Path'] = $machinePath + ';' + $userPath }",
      "elseif ($machinePath) { $merged['Path'] = $machinePath }",
      "elseif ($userPath) { $merged['Path'] = $userPath }",
      "$volatilePath = 'HKCU:\\Volatile Environment';",
      'if (Test-Path $volatilePath) {',
      '  $volatile = Get-ItemProperty -Path $volatilePath;',
      '  foreach ($property in $volatile.PSObject.Properties) {',
      "    if ($property.Name -notmatch '^PS') {",
      '      $merged[[string]$property.Name] = [string]$property.Value',
      '    }',
      '  }',
      '}',
      '$merged | ConvertTo-Json -Compress'
    ].join(' ');
  }

  private readFreshWindowsEnvSync(): Record<string, string> {
    const rawOutput = execFileSync(
      'powershell.exe',
      ['-NoLogo', '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', this.buildWindowsEnvRefreshCommand()],
      {
        encoding: 'utf8',
        windowsHide: true
      }
    ).trim();

    const systemEnv = rawOutput ? JSON.parse(rawOutput) as Record<string, string> : {};
    return {
      ...process.env,
      ...systemEnv
    } as Record<string, string>;
  }

  private refreshWindowsEnvInBackground(): void {
    if (process.platform !== 'win32') {
      return;
    }

    const now = Date.now();
    if (
      this.windowsEnvRefreshPromise ||
      (this.refreshedWindowsEnv && now - this.refreshedWindowsEnvAt < PaneManager.windowsEnvCacheTtlMs)
    ) {
      return;
    }

    const command = this.buildWindowsEnvRefreshCommand();
    this.windowsEnvRefreshPromise = new Promise<void>((resolve) => {
      execFile(
        'powershell.exe',
        ['-NoLogo', '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', command],
        {
          encoding: 'utf8',
          windowsHide: true
        },
        (error, stdout) => {
          if (error) {
            log.warn('Failed to refresh Windows environment, continuing with cached env', error);
            resolve();
            return;
          }

          try {
            const rawOutput = typeof stdout === 'string' ? stdout.trim() : '';
            const systemEnv = rawOutput ? JSON.parse(rawOutput) as Record<string, string> : {};
            this.refreshedWindowsEnv = {
              ...process.env,
              ...systemEnv
            } as Record<string, string>;
            this.refreshedWindowsEnvAt = Date.now();
          } catch (parseError) {
            log.warn('Failed to parse refreshed Windows environment payload', parseError);
          }

          resolve();
        }
      );
    }).finally(() => {
      this.windowsEnvRefreshPromise = null;
    });
  }

  private getFreshSpawnEnv(): Record<string, string> {
    if (process.platform !== 'win32') {
      return { ...process.env } as Record<string, string>;
    }

    const now = Date.now();
    const hasFreshCachedEnv = Boolean(
      this.refreshedWindowsEnv &&
      now - this.refreshedWindowsEnvAt < PaneManager.windowsEnvCacheTtlMs
    );

    if (!hasFreshCachedEnv) {
      try {
        this.refreshedWindowsEnv = this.readFreshWindowsEnvSync();
        this.refreshedWindowsEnvAt = now;
      } catch (error) {
        log.warn('Failed to synchronously refresh Windows environment, falling back to cached env', error);
        this.refreshWindowsEnvInBackground();
      }
    }

    if (this.refreshedWindowsEnv) {
      return { ...this.refreshedWindowsEnv };
    }

    return { ...process.env } as Record<string, string>;
  }

  private getResolvedCwd(cwd: string | undefined): string {
    const requestedCwd = cwd?.trim();
    const fallbackCwd = process.env.USERPROFILE || process.env.HOME || 'C:\\';
    return requestedCwd && fs.existsSync(requestedCwd)
      ? requestedCwd
      : fallbackCwd;
  }

  spawnPty(
    paneId: string,
    command: string | undefined,
    cwd: string,
    shell: ShellType,
    cols: number = 80,
    rows: number = 24,
    presetId?: string,
    paneType: InteractivePaneType = 'terminal'
  ): void {
    try {
      const shouldLoadProfile = shell === 'powershell';
      const { command: shellCmd, args: shellArgs } = this.getShellPath(shell, shouldLoadProfile);

      const requestedCwd = cwd?.trim();
      const resolvedCwd = this.getResolvedCwd(cwd);

      if (requestedCwd && requestedCwd !== resolvedCwd) {
        log.warn(`Requested PTY cwd does not exist, falling back to ${resolvedCwd}`, {
          paneId,
          requestedCwd
        });
      }

      log.info(`Spawning PTY: ${shellCmd} in ${resolvedCwd} (pane: ${paneId})`);

      let spawnCmd = shellCmd;
      let spawnArgs = [...shellArgs];

      // If a command is specified (agent preset), pass it to the shell
      if (shell === 'powershell') {
        spawnArgs = this.buildPowerShellArgs(command, shouldLoadProfile);
      } else if (command && command.trim()) {
        if (shell === 'cmd') {
          spawnArgs = ['/K', command];
        } else {
          spawnArgs = ['--', command];
        }
      }

      const ptyProcess = pty.spawn(spawnCmd, spawnArgs, {
        name: 'xterm-256color',
        cols,
        rows,
        cwd: resolvedCwd,
        env: this.getFreshSpawnEnv(),
        useConpty: true
      });

      const ref: PtyRef = {
        pty: ptyProcess,
        paneId,
        pendingOutput: '',
        output: '',
        cwd: resolvedCwd,
        suppressExitEvent: false
      };

      this.ptyProcesses.set(paneId, ref);

      ptyProcess.onData((data: string) => {
        const ref = this.ptyProcesses.get(paneId);
        if (!ref) {
          return;
        }

        const { output, cwd: nextCwd } = this.sanitizePtyOutput(ref, data);

        if (output) {
          ref.output += output;
        }

        if (this.mainWindow && !this.mainWindow.isDestroyed()) {
          if (nextCwd && nextCwd !== ref.cwd) {
            ref.cwd = nextCwd;
            this.mainWindow.webContents.send('pty:cwd', { paneId, cwd: nextCwd });
          }

          if (output) {
            this.mainWindow.webContents.send('pty:data', { paneId, data: output });
          }
        }
      });

      ptyProcess.onExit(({ exitCode }) => {
        log.info(`PTY exited: ${paneId}, code: ${exitCode}`);
        const currentRef = this.ptyProcesses.get(paneId);
        const isActiveRef = currentRef === ref;

        if (isActiveRef) {
          this.ptyProcesses.delete(paneId);
        }

        if (!ref.suppressExitEvent && isActiveRef && this.mainWindow && !this.mainWindow.isDestroyed()) {
          this.mainWindow.webContents.send('pty:exit', { paneId, exitCode: exitCode || 0 });
        }
      });

      log.info(`PTY spawned successfully: ${paneId}, PID: ${ptyProcess.pid}`);
    } catch (error) {
      log.error(`Failed to spawn PTY: ${error}`);
      if (this.mainWindow && !this.mainWindow.isDestroyed()) {
        this.mainWindow.webContents.send('pty:exit', { paneId, exitCode: 1 });
      }
    }
  }

  writePty(paneId: string, data: string): void {
    const ref = this.ptyProcesses.get(paneId);
    if (ref) {
      ref.pty.write(data);
    }
  }

  private escapeForShell(text: string): string {
    return text;
  }

  resizePty(paneId: string, cols: number, rows: number): void {
    const ref = this.ptyProcesses.get(paneId);
    if (ref) {
      try {
        ref.pty.resize(Math.max(1, cols), Math.max(1, rows));
      } catch (e) {
        log.warn(`Failed to resize PTY ${paneId}:`, e);
      }
    }
  }

  killPty(paneId: string): void {
    const ref = this.ptyProcesses.get(paneId);
    if (ref) {
      try {
        ref.suppressExitEvent = true;
        ref.pty.kill();
      } catch (e) {
        log.error(`Failed to kill PTY ${paneId}:`, e);
      }
      this.ptyProcesses.delete(paneId);
    }
    const watcher = this.fileWatchers.get(paneId);
    if (watcher) {
      watcher.watcher.close();
      this.fileWatchers.delete(paneId);
    }
  }

  startFileWatcher(paneId: string, projectPath: string): void {
    if (this.fileWatchers.has(paneId)) {
      return;
    }

    const ignoredDirs = ['node_modules', '.git', 'dist', 'build', '.next', 'coverage', '.cache'];

    let debounceTimeout: NodeJS.Timeout | null = null;

    function shouldIgnore(filePath: string): boolean {
      return ignoredDirs.some(dir => filePath.includes(dir));
    }

    try {
      const watcher = fs.watch(projectPath, { recursive: true }, (eventType, filename) => {
        if (filename && shouldIgnore(filename)) {
          return;
        }
        if (debounceTimeout) {
          clearTimeout(debounceTimeout);
        }
        debounceTimeout = setTimeout(() => {
          if (this.mainWindow && !this.mainWindow.isDestroyed()) {
            this.mainWindow.webContents.send('file-changed', { paneId });
          }
        }, 500);
      });

      this.fileWatchers.set(paneId, { watcher, paneId });
      log.info(`File watcher started for pane ${paneId} at ${projectPath}`);
    } catch (error) {
      log.error(`Failed to start file watcher for pane ${paneId}:`, error);
    }
  }

  stopFileWatcher(paneId: string): void {
    const ref = this.fileWatchers.get(paneId);
    if (ref) {
      ref.watcher.close();
      this.fileWatchers.delete(paneId);
      log.info(`File watcher stopped for pane ${paneId}`);
    }
  }

  openExternal(url: string): void {
    shell.openExternal(url);
  }

  openInExplorer(path: string): void {
    if (process.platform === 'win32') {
      const { spawn } = require('child_process');
      spawn('explorer', [path]);
    }
  }

  closeAll(): void {
    log.info('Closing all PTY processes...');
    for (const [paneId] of this.ptyProcesses) {
      this.killPty(paneId);
    }
  }

  savePaneState(_state: AppState): void {
    // Placeholder for future implementation
  }

  getPaneIds(): string[] {
    return [...this.ptyProcesses.keys()];
  }

  hasPty(paneId: string): boolean {
    return this.ptyProcesses.has(paneId);
  }

  getPaneOutput(paneId: string): string {
    const ref = this.ptyProcesses.get(paneId);
    return ref?.output || '';
  }
}
