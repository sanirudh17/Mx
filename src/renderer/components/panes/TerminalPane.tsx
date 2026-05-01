import { useEffect, useRef, useCallback, useState } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import { ChevronDown, ChevronUp, Search, X } from 'lucide-react';
import type { Pane, PaneStatus } from '../../types';
import { useAppStore } from '../../stores/useAppStore';

interface Props {
  pane: Pane;
  workspaceId: string;
}

type SearchMatch = {
  row: number;
  column: number;
  length: number;
};

function hasTerminalContent(terminal: Terminal): boolean {
  const buffer = terminal.buffer.active;
  const visibleRows = Math.max(terminal.rows, 1);
  const start = Math.max(buffer.length - visibleRows - 2, 0);

  for (let row = start; row < buffer.length; row += 1) {
    const text = buffer.getLine(row)?.translateToString(true) ?? '';
    if (text.trim().length > 0) {
      return true;
    }
  }

  return false;
}

function isPrintableInput(character: string): boolean {
  return character >= ' ' && character !== '\x7f';
}

export default function TerminalPane({ pane, workspaceId }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const terminalRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const resizeObserverRef = useRef<ResizeObserver | null>(null);
  const intersectionObserverRef = useRef<IntersectionObserver | null>(null);
  const contextMenuRef = useRef<HTMLDivElement>(null);
  const findInputRef = useRef<HTMLInputElement>(null);
  const statusRef = useRef<PaneStatus>(pane.status);
  const activityBufferRef = useRef('');
  const commandBufferRef = useRef('');
  const lastRecordedCommandRef = useRef('');
  const findOpenRef = useRef(false);
  const findMatchIndexRef = useRef(-1);
  const lastEscapeRef = useRef<number>(0);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
  const [findOpen, setFindOpen] = useState(false);
  const [findQuery, setFindQuery] = useState('');
  const [findMatches, setFindMatches] = useState<SearchMatch[]>([]);
  const [findMatchIndex, setFindMatchIndex] = useState(-1);
  const [bufferVersion, setBufferVersion] = useState(0);
  const settings = useAppStore(state => state.settings);
  const updatePaneStatus = useAppStore(state => state.updatePaneStatus);
  const recordCommandHistory = useAppStore(state => state.recordCommandHistory);

  const fitTerminal = useCallback((forceRefresh = false) => {
    const terminal = terminalRef.current;
    const fitAddon = fitAddonRef.current;
    const container = containerRef.current;

    if (!terminal || !fitAddon || !container) {
      return false;
    }

    const { width, height } = container.getBoundingClientRect();
    if (width <= 0 || height <= 0 || container.offsetParent === null) {
      return false;
    }

    try {
      const dims = fitAddon.proposeDimensions();
      if (!dims || !dims.cols || !dims.rows || Number.isNaN(dims.cols) || Number.isNaN(dims.rows)) {
        return false;
      }

      // Hard minimum bounds to prevent CLI applications with complex TUI (e.g. inquirer, OpenCode, htop)
      // from encountering negative rendering bounds or crashing due to layout transitioning near 0.
      const safeCols = Math.max(30, dims.cols);
      const safeRows = Math.max(5, dims.rows);

      terminal.resize(safeCols, safeRows);

      if (forceRefresh || terminal.rows > 0) {
        terminal.refresh(0, Math.max(terminal.rows - 1, 0));
      }

      window.electron.pty.resize({ paneId: pane.id, cols: safeCols, rows: safeRows });

      return true;
    } catch {
      return false;
    }
  }, [pane.id]);

  useEffect(() => {
    findOpenRef.current = findOpen;
  }, [findOpen]);

  useEffect(() => {
    findMatchIndexRef.current = findMatchIndex;
  }, [findMatchIndex]);

  const setPaneStatus = useCallback((nextStatus: PaneStatus) => {
    if (statusRef.current === nextStatus) return;
    statusRef.current = nextStatus;
    updatePaneStatus(workspaceId, pane.id, nextStatus);
  }, [pane.id, updatePaneStatus, workspaceId]);

  useEffect(() => {
    statusRef.current = pane.status;
  }, [pane.status]);

  const sendCommand = useCallback((data: string) => {
    window.electron.pty.write({ paneId: pane.id, data });
  }, [pane.id]);

  const sendAgentSoftLineBreak = useCallback(() => {
    commandBufferRef.current += '\n';
    sendCommand('\n');
  }, [sendCommand]);

  const submitBufferedCommand = useCallback((command: string) => {
    const normalizedCommand = command.trim();
    if (!normalizedCommand || normalizedCommand === lastRecordedCommandRef.current) {
      return;
    }

    lastRecordedCommandRef.current = normalizedCommand;
    void recordCommandHistory({
      command: normalizedCommand,
      paneId: pane.id,
      workspaceId
    });
  }, [pane.id, recordCommandHistory, workspaceId]);

  const captureCommandInput = useCallback((data: string) => {
    const normalizedData = data
      .replace(/\x1b\[[0-9;?]*[ -/]*[@-~]/g, '')
      .replace(/\x1bO./g, '');

    for (const character of normalizedData) {
      if (character === '\u0003') {
        commandBufferRef.current = '';
        continue;
      }

      if (character === '\u0015') {
        commandBufferRef.current = '';
        continue;
      }

      if (character === '\b' || character === '\x7f') {
        commandBufferRef.current = commandBufferRef.current.slice(0, -1);
        continue;
      }

      if (character === '\r' || character === '\n') {
        submitBufferedCommand(commandBufferRef.current);
        commandBufferRef.current = '';
        continue;
      }

      if (character === '\u001b') {
        continue;
      }

      if (isPrintableInput(character)) {
        commandBufferRef.current += character;
      }
    }
  }, [submitBufferedCommand]);

  const updateStatusFromOutput = useCallback((data: string) => {
    const normalized = data
      .replace(/\x1b\][^\x07\x1b]*(?:\x07|\x1b\\)/g, '')
      .replace(/\x1b\[[0-9;?]*[ -/]*[@-~]/g, '')
      .replace(/[\x00-\x08\x0b-\x1f\x7f]/g, '')
      .replace(/\r/g, '');

    if (!normalized) return;

    activityBufferRef.current = (activityBufferRef.current + normalized).slice(-320);
    const tail = activityBufferRef.current;
    const promptPatterns = [
      /(?:^|\n)PS [^\n>]*> ?$/,
      /(?:^|\n)(?:[A-Za-z]:\\[^\n>]*)> ?$/,
      /(?:^|\n)[^\s@\n]+@[^\s:\n]+:[^\n$#]*[$#] ?$/
    ];

    if (promptPatterns.some((pattern) => pattern.test(tail))) {
      setPaneStatus('idle');
    }
  }, [setPaneStatus]);

  const scheduleInputNotificationCheck = useCallback(() => {
    // StreamScanner owns prompt notifications globally.
  }, []);

  const focusFindInput = useCallback(() => {
    // Let the search bar render first
    window.setTimeout(() => {
      findInputRef.current?.focus();
      findInputRef.current?.select();
    }, 50);
  }, []);

  useEffect(() => {
    if (findOpen) {
      focusFindInput();
    }
  }, [findOpen, focusFindInput]);

  const refreshFindResults = useCallback((query: string, preferredIndex = 0) => {
    const terminal = terminalRef.current;
    const trimmedQuery = query.trim();

    if (!terminal || !trimmedQuery) {
      terminal?.clearSelection();
      setFindMatches([]);
      setFindMatchIndex(-1);
      return;
    }

    const normalizedQuery = trimmedQuery.toLowerCase();
    const matches: SearchMatch[] = [];
    const buffer = terminal.buffer.active;

    for (let row = 0; row < buffer.length; row += 1) {
      const line = buffer.getLine(row);
      const text = line?.translateToString(true) || '';
      if (!text) {
        continue;
      }

      const normalizedText = text.toLowerCase();
      let startIndex = 0;

      while (startIndex < normalizedText.length) {
        const foundIndex = normalizedText.indexOf(normalizedQuery, startIndex);
        if (foundIndex === -1) {
          break;
        }

        matches.push({
          row,
          column: foundIndex,
          length: trimmedQuery.length
        });

        startIndex = foundIndex + Math.max(trimmedQuery.length, 1);

        if (matches.length >= 2000) {
          break;
        }
      }

      if (matches.length >= 2000) {
        break;
      }
    }

    if (matches.length === 0) {
      terminal.clearSelection();
      setFindMatches([]);
      setFindMatchIndex(-1);
      return;
    }

    const nextIndex = Math.min(Math.max(preferredIndex, 0), matches.length - 1);
    const activeMatch = matches[nextIndex];
    terminal.select(activeMatch.column, activeMatch.row, activeMatch.length);
    terminal.scrollToLine(Math.max(activeMatch.row - 2, 0));
    setFindMatches(matches);
    setFindMatchIndex(nextIndex);
  }, []);

  const openFind = useCallback(() => {
    setFindOpen(true);
    const selection = terminalRef.current?.getSelection()?.trim();
    if (selection && !findQuery.trim()) {
      setFindQuery(selection);
    }
    focusFindInput();
  }, [findQuery, focusFindInput]);

  const closeFind = useCallback(() => {
    setFindOpen(false);
    setFindQuery('');
    setFindMatches([]);
    setFindMatchIndex(-1);
    terminalRef.current?.clearSelection();
  }, []);

  const moveToFindMatch = useCallback((direction: 'next' | 'previous') => {
    if (!findOpenRef.current) {
      openFind();
      return;
    }

    if (!findQuery.trim()) {
      focusFindInput();
      return;
    }

    if (findMatches.length === 0) {
      refreshFindResults(findQuery, 0);
      return;
    }

    const nextIndex =
      direction === 'next'
        ? (findMatchIndexRef.current + 1 + findMatches.length) % findMatches.length
        : (findMatchIndexRef.current - 1 + findMatches.length) % findMatches.length;

    refreshFindResults(findQuery, nextIndex);
  }, [findMatches.length, findQuery, focusFindInput, openFind, refreshFindResults]);

  useEffect(() => {
    if (!findOpen) {
      return;
    }

    refreshFindResults(findQuery, findMatchIndexRef.current >= 0 ? findMatchIndexRef.current : 0);
  }, [bufferVersion, findOpen, findQuery, refreshFindResults]);

  useEffect(() => {
    if (!containerRef.current || terminalRef.current) return;

    const terminal = new Terminal({
      fontFamily: settings?.terminalFontFamily || 'Cascadia Code, Consolas, monospace',
      fontSize: settings?.terminalFontSize || 14,
      cursorBlink: true,
      cursorStyle: 'block',
      theme: {
        background: '#05080f',
        foreground: '#c9d1d9',
        cursor: '#8b9fc6',
        cursorAccent: '#05080f',
        selectionBackground: '#2b3648',
        black: '#484f58',
        red: '#f85149',
        green: '#3fb950',
        yellow: '#d29922',
        blue: '#8b9fc6',
        magenta: '#a371f7',
        cyan: '#39c5cf',
        white: '#b1bac4',
        brightBlack: '#6e7681',
        brightRed: '#ffa198',
        brightGreen: '#56d364',
        brightYellow: '#e3b341',
        brightBlue: '#a6b8db',
        brightMagenta: '#d2a8ff',
        brightCyan: '#56d4dd',
        brightWhite: '#f0f6fc'
      },
      scrollback: 10000,
      allowTransparency: false
    });

    const fitAddon = new FitAddon();
    terminal.loadAddon(fitAddon);

    const webLinksAddon = new WebLinksAddon((event, uri) => {
      try {
        const { activeWorkspaceId, createPane } = useAppStore.getState();
        if (activeWorkspaceId) {
          createPane(activeWorkspaceId, 'browser', { url: uri });
        } else {
          window.electron.browser.openExternal({ url: uri });
        }
      } catch {
        window.electron.browser.openExternal({ url: uri });
      }
    });
    terminal.loadAddon(webLinksAddon);

    terminal.open(containerRef.current);

    terminalRef.current = terminal;
    fitAddonRef.current = fitAddon;

    terminal.onData((data) => {
      setContextMenu((current) => (current ? null : current));
      const submittedCommand =
        data.includes('\r') || data.includes('\n')
          ? commandBufferRef.current.trim()
          : '';
      captureCommandInput(data);
      if (data.includes('\r') || data.includes('\n')) {
        activityBufferRef.current = '';
        setPaneStatus('running');

        if (data.includes('\r')) {
          window.dispatchEvent(new CustomEvent('pane-submitted', {
            detail: {
              paneId: pane.id,
              timestamp: Date.now(),
              command: submittedCommand || undefined
            }
          }));
          useAppStore.getState().dismissActionNotificationsByPane(pane.id);
        }

        setTimeout(() => {
          scheduleInputNotificationCheck();
        }, 100);
      }
      sendCommand(data);
    });

    terminal.onSelectionChange(() => {
      setContextMenu((current) => (current ? null : current));
    });

    terminal.attachCustomKeyEventHandler((e: KeyboardEvent) => {
      if (e.type === 'keydown') {
        const lowerKey = e.key.toLowerCase();

        if ((pane.type === 'agent' || pane.type === 'terminal') && e.key === 'Enter' && e.shiftKey && !e.ctrlKey && !e.altKey && !e.metaKey) {
          e.preventDefault();
          sendAgentSoftLineBreak();
          return false;
        }

        if (e.ctrlKey && !e.altKey && !e.shiftKey && lowerKey === 'f') {
          return false;
        }

        if (e.key === 'F3' || (e.shiftKey && e.key === 'F3')) {
          return false;
        }

        if (findOpenRef.current && e.key === 'Escape') {
          return false;
        }

        if (e.key === 'Escape') {
          const now = Date.now();
          if (now - lastEscapeRef.current < 500) {
            window.dispatchEvent(new CustomEvent('pane-aborted', { detail: { paneId: pane.id } }));
          }
          lastEscapeRef.current = now;
        }

        if (e.ctrlKey && !e.altKey && !e.shiftKey && (e.key === '=' || e.key === '+' || e.key === '-' || e.key === '_')) {
          return false;
        }

        if (e.ctrlKey && !e.altKey && !e.shiftKey && (e.key === 'PageUp' || e.key === 'PageDown')) {
          return false;
        }

        if (e.ctrlKey && e.altKey && (e.key === 'ArrowLeft' || e.key === 'ArrowRight' || e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
          return false;
        }

        if (e.ctrlKey && e.shiftKey && lowerKey === 'x') {
          window.dispatchEvent(new CustomEvent('app:toggleNotifications'));
          return false;
        }

        if (e.ctrlKey && e.shiftKey) {
          const key = e.key.toUpperCase();
          if ('TABHVNSPM'.includes(key)) {
            return false;
          }
        }

        if (e.ctrlKey && !e.shiftKey && !e.altKey && (lowerKey === 'w' || e.code === 'KeyW')) {
          return false;
        }

        if (e.ctrlKey && !e.shiftKey && !e.altKey && (lowerKey === 'v' || e.code === 'KeyV')) {
          return false;
        }

        if (e.ctrlKey && !e.shiftKey && !e.altKey && (lowerKey === 'c' || e.code === 'KeyC')) {
          const selection = terminal.getSelection();
          if (selection) {
            navigator.clipboard.writeText(selection);
            terminal.clearSelection();
            return false;
          }
          return true;
        }
      }
      return true;
    });

    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
      const selection = terminal.getSelection();
      if (selection) {
        setContextMenu({ x: e.clientX, y: e.clientY });
      }
    };

    containerRef.current.addEventListener('contextmenu', handleContextMenu);

    const handlePtyData = (e: Event) => {
      const { paneId, data } = (e as CustomEvent).detail;
      if (paneId === pane.id && terminalRef.current) {
        updateStatusFromOutput(data);
        terminalRef.current.write(data);
        scheduleInputNotificationCheck();
        if (findOpenRef.current) {
          setBufferVersion((value) => value + 1);
        }
      }
    };

    const handleTerminalReset = () => {
      commandBufferRef.current = '';
      if (terminalRef.current) {
        terminalRef.current.clear();
        terminalRef.current.reset();
      }
      if (findOpenRef.current) {
        setBufferVersion((value) => value + 1);
      }
    };

    const handleFindOpen = () => openFind();
    const handleFindNext = () => moveToFindMatch('next');
    const handleFindPrevious = () => moveToFindMatch('previous');
    const handleFindClose = () => closeFind();

    window.addEventListener('pty-data', handlePtyData);
    window.addEventListener(`terminal-find-open-${pane.id}`, handleFindOpen);
    window.addEventListener(`terminal-find-next-${pane.id}`, handleFindNext);
    window.addEventListener(`terminal-find-previous-${pane.id}`, handleFindPrevious);
    window.addEventListener(`terminal-find-close-${pane.id}`, handleFindClose);

    let isDisposed = false;
    void window.electron.pty.getOutput({ paneId: pane.id }).then((output) => {
      const activeTerminal = terminalRef.current;
      if (isDisposed || !activeTerminal || !output || hasTerminalContent(activeTerminal)) {
        return;
      }

      updateStatusFromOutput(output);
      activeTerminal.write(output);
      scheduleInputNotificationCheck();
      if (findOpenRef.current) {
        setBufferVersion((value) => value + 1);
      }
    }).catch(() => {
      // The pane may have been closed before the initial output snapshot resolved.
    });

    let resizeTimeoutId: number | null = null;
    const scheduledFitTimeoutIds: number[] = [];
    let scheduledFitAnimationFrameId: number | null = null;

    const clearScheduledFits = () => {
      while (scheduledFitTimeoutIds.length > 0) {
        window.clearTimeout(scheduledFitTimeoutIds.pop()!);
      }

      if (scheduledFitAnimationFrameId !== null) {
        cancelAnimationFrame(scheduledFitAnimationFrameId);
        scheduledFitAnimationFrameId = null;
      }
    };

    const scheduleFit = (forceRefresh = false) => {
      fitTerminal(forceRefresh);
      clearScheduledFits();

      scheduledFitAnimationFrameId = window.requestAnimationFrame(() => {
        fitTerminal(true);
        scheduledFitAnimationFrameId = null;
      });

      scheduledFitTimeoutIds.push(window.setTimeout(() => {
        fitTerminal(true);
      }, 80));
      scheduledFitTimeoutIds.push(window.setTimeout(() => {
        fitTerminal(true);
      }, 220));
    };

    const handleTerminalRefit = () => {
      scheduleFit(true);
    };

    const resetAndRefitTerminal = () => {
      handleTerminalReset();
      scheduleFit();
    };

    window.addEventListener(`terminal-reset-${pane.id}`, resetAndRefitTerminal);
    window.addEventListener(`terminal-refit-${pane.id}`, handleTerminalRefit);

    resizeObserverRef.current = new ResizeObserver((entries) => {
      if (!entries.length) return;
      const { width, height } = entries[0].contentRect;
      if (width === 0 || height === 0) return;

      if (resizeTimeoutId !== null) {
        window.clearTimeout(resizeTimeoutId);
      }
      resizeTimeoutId = window.setTimeout(() => {
        fitTerminal(true);
      }, 50);
    });
    resizeObserverRef.current.observe(containerRef.current);

    intersectionObserverRef.current = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        scheduleFit(true);
      }
    }, { threshold: 0.05 });
    intersectionObserverRef.current.observe(containerRef.current);

    if ('fonts' in document) {
      void (document as Document & { fonts: FontFaceSet }).fonts.ready.then(() => {
        scheduleFit(true);
      });
    }

    scheduleFit(true);

    return () => {
      isDisposed = true;
      window.removeEventListener('pty-data', handlePtyData);
      window.removeEventListener(`terminal-find-open-${pane.id}`, handleFindOpen);
      window.removeEventListener(`terminal-find-next-${pane.id}`, handleFindNext);
      window.removeEventListener(`terminal-find-previous-${pane.id}`, handleFindPrevious);
      window.removeEventListener(`terminal-find-close-${pane.id}`, handleFindClose);
      window.removeEventListener(`terminal-reset-${pane.id}`, resetAndRefitTerminal);
      window.removeEventListener(`terminal-refit-${pane.id}`, handleTerminalRefit);
      if (resizeTimeoutId !== null) {
        window.clearTimeout(resizeTimeoutId);
      }
      clearScheduledFits();
      resizeObserverRef.current?.disconnect();
      intersectionObserverRef.current?.disconnect();
      terminalRef.current?.dispose();
      terminalRef.current = null;
      fitAddonRef.current = null;
      containerRef.current?.removeEventListener('contextmenu', handleContextMenu);
    };
  }, [captureCommandInput, closeFind, moveToFindMatch, openFind, pane.id, pane.type, scheduleInputNotificationCheck, sendAgentSoftLineBreak, sendCommand, setPaneStatus, updateStatusFromOutput]);

  useEffect(() => {
    if (terminalRef.current && fitAddonRef.current) {
      terminalRef.current.options.fontFamily = settings?.terminalFontFamily || 'Cascadia Code, Consolas, monospace';
      terminalRef.current.options.fontSize = settings?.terminalFontSize || 14;
      fitTerminal(true);
    }
  }, [fitTerminal, settings?.terminalFontFamily, settings?.terminalFontSize]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (contextMenuRef.current && !contextMenuRef.current.contains(e.target as Node)) {
        setContextMenu(null);
      }
    };
    if (contextMenu) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [contextMenu]);

  const handleCopy = useCallback(() => {
    if (terminalRef.current) {
      const selection = terminalRef.current.getSelection();
      if (selection) {
        navigator.clipboard.writeText(selection);
        terminalRef.current.clearSelection();
      }
    }
    setContextMenu(null);
  }, []);

  const handleCopyAndInterrupt = useCallback(() => {
    if (terminalRef.current) {
      const selection = terminalRef.current.getSelection();
      if (selection) {
        navigator.clipboard.writeText(selection);
        terminalRef.current.clearSelection();
        window.electron.pty.write({ paneId: pane.id, data: '\x03' });
      }
    }
    commandBufferRef.current = '';
    setContextMenu(null);
  }, [pane.id]);

  return (
    <div className="relative h-full w-full min-h-0 min-w-0 overflow-hidden bg-[#05080f]">
      {findOpen && (
        <div className="absolute right-4 top-4 z-30 flex items-center gap-2 rounded-md border border-border-default/70 bg-bg-secondary/95 px-3 py-2 backdrop-blur-sm">
          <Search size={14} className="text-gray-500" />
          <input
            ref={findInputRef}
            className="w-44 bg-transparent text-[12px] text-gray-100 placeholder-gray-500 outline-none"
            placeholder="Find in scrollback"
            value={findQuery}
            onChange={(event) => {
              setFindMatchIndex(0);
              setFindQuery(event.target.value);
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                moveToFindMatch(event.shiftKey ? 'previous' : 'next');
              } else if (event.key === 'Escape') {
                event.preventDefault();
                closeFind();
              }
            }}
          />
          <span className="min-w-[52px] text-right text-[11px] text-gray-500">
            {findMatches.length > 0 ? `${findMatchIndex + 1}/${findMatches.length}` : '0/0'}
          </span>
          <button
            className="flex h-6 w-6 items-center justify-center rounded text-gray-400 transition-colors hover:bg-white/5 hover:text-white"
            onClick={() => moveToFindMatch('previous')}
            title="Previous match"
          >
            <ChevronUp size={14} />
          </button>
          <button
            className="flex h-6 w-6 items-center justify-center rounded text-gray-400 transition-colors hover:bg-white/5 hover:text-white"
            onClick={() => moveToFindMatch('next')}
            title="Next match"
          >
            <ChevronDown size={14} />
          </button>
          <button
            className="flex h-6 w-6 items-center justify-center rounded text-gray-400 transition-colors hover:bg-white/5 hover:text-white"
            onClick={closeFind}
            title="Close find"
          >
            <X size={14} />
          </button>
        </div>
      )}
      <div className="flex bg-[#05080f] h-full w-full min-h-0 min-w-0 flex-col">
        <div className="relative flex-1 min-h-0 min-w-0">
          <div ref={containerRef} className="h-full w-full" />
        </div>
      </div>
      {contextMenu && (
        <div
          ref={contextMenuRef}
          className="fixed z-50 min-w-[120px] rounded-md border border-border-default bg-bg-elevated py-1"
          style={{ left: contextMenu.x, top: contextMenu.y }}
        >
          <button
            onClick={handleCopy}
            className="w-full px-3 py-1.5 text-left text-sm text-gray-300 hover:bg-bg-tertiary hover:text-white"
          >
            Copy
          </button>
          <button
            onClick={handleCopyAndInterrupt}
            className="w-full px-3 py-1.5 text-left text-sm text-gray-300 hover:bg-bg-tertiary hover:text-white"
          >
            Copy + Ctrl+C
          </button>
        </div>
      )}
    </div>
  );
}
