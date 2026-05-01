import { useEffect, useRef, useState, useCallback } from 'react';
import type { BrowserPane as BPane } from '../../types';
import { useAppStore } from '../../stores/useAppStore';
import { RefreshCw, Eye, EyeOff, ArrowLeft, ArrowRight, RotateCw } from 'lucide-react';
import { TAKE_PANE_SCREENSHOT_EVENT } from '../../utils/paneScreenshot';

function fixUrlOrSearch(input: string): string {
  const text = input.trim();
  if (!text) return 'https://google.com';
  
  if (/^https?:\/\//i.test(text) || text.startsWith('file://') || text.startsWith('about:') || text.startsWith('chrome:')) {
    return text;
  }
  
  const isDomainBased = /^(localhost|\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}|[a-zA-Z0-9-]+\.[a-zA-Z]{2,})(\/|:|$)/i.test(text);
  
  if (isDomainBased) {
    if (text.startsWith('localhost') || /^127\./.test(text)) {
      if (!text.includes(':')) return `http://${text}:5173`; // common fallback for dev server
      return `http://${text}`;
    }
    return `https://${text}`;
  }
  
  return `https://www.google.com/search?q=${encodeURIComponent(text)}`;
}

interface Props {
  pane: BPane;
  workspaceId: string;
}

export default function BrowserPane({ pane, workspaceId }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const webviewRef = useRef<any>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const paneRef = useRef(pane);
  const lastKnownUrlRef = useRef(fixUrlOrSearch(pane.url));
  const lastRecordedUrlRef = useRef('');
  const [url, setUrl] = useState(pane.url);
  const [urlInput, setUrlInput] = useState(pane.url);
  const [isLoading, setIsLoading] = useState(false);
  const [isDomReady, setIsDomReady] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [isWatching, setIsWatching] = useState(false);
  const [screenshotNotice, setScreenshotNotice] = useState<{
    message: string;
    tone: 'success' | 'error';
    visible: boolean;
  } | null>(null);
  const { updatePane, workspaces, setFocusedPane, recordUrlHistory } = useAppStore();

  const workspace = workspaces.find(w => w.id === workspaceId);
  const projectPath = workspace?.cwd || '';
  const focusPane = useCallback(() => {
    setFocusedPane(pane.id);
  }, [pane.id, setFocusedPane]);

  const showScreenshotNotice = useCallback((message: string, tone: 'success' | 'error' = 'success') => {
    setScreenshotNotice({ message, tone, visible: true });
  }, []);

  useEffect(() => {
    paneRef.current = pane;
    setUrl(pane.url);
    if (document.activeElement !== inputRef.current) {
      setUrlInput(pane.url);
    }
  }, [pane]);

  useEffect(() => {
    if (!screenshotNotice?.visible) {
      return;
    }

    const hideTimeout = window.setTimeout(() => {
      setScreenshotNotice((current) => (current ? { ...current, visible: false } : null));
    }, 2000);

    return () => window.clearTimeout(hideTimeout);
  }, [screenshotNotice]);

  useEffect(() => {
    if (!screenshotNotice || screenshotNotice.visible) {
      return;
    }

    const cleanupTimeout = window.setTimeout(() => {
      setScreenshotNotice(null);
    }, 220);

    return () => window.clearTimeout(cleanupTimeout);
  }, [screenshotNotice]);

  useEffect(() => {
    const webview = webviewRef.current;
    if (!webview) return;

    const handleDomReady = () => {
      setIsDomReady(true);
    };
    const handleDidStartLoading = () => setIsLoading(true);
    const handleDidStopLoading = () => setIsLoading(false);
    const handleDidFailLoad = () => setIsLoading(false);
    const handleFocus = () => focusPane();

    const handleDidNavigate = (e: any) => {
      const currentPane = paneRef.current;
      const nextUrl = fixUrlOrSearch(e.url);
      const history = Array.isArray(currentPane.history) && currentPane.history.length > 0
        ? currentPane.history
        : [nextUrl];
      const historyIndex = Number.isInteger(currentPane.historyIndex)
        ? Math.min(Math.max(currentPane.historyIndex, 0), history.length - 1)
        : history.length - 1;

      lastKnownUrlRef.current = nextUrl;
      setUrl(e.url);
      if (document.activeElement !== inputRef.current) {
        setUrlInput(e.url);
      }

      if (history[historyIndex] !== e.url) {
        updatePane(workspaceId, currentPane.id, {
          url: e.url,
          history: [...history.slice(0, historyIndex + 1), e.url],
          historyIndex: historyIndex + 1
        } as Partial<BPane>);
      }

      if (nextUrl !== lastRecordedUrlRef.current) {
        lastRecordedUrlRef.current = nextUrl;
        void recordUrlHistory({
          url: nextUrl,
          title: currentPane.label
        });
      }
    };

    const handleDidNavigateInPage = (e: any) => {
      if (e.isMainFrame) {
        const nextUrl = fixUrlOrSearch(e.url);
        lastKnownUrlRef.current = nextUrl;
        setUrl(e.url);
        if (document.activeElement !== inputRef.current) {
          setUrlInput(e.url);
        }

        if (nextUrl !== lastRecordedUrlRef.current) {
          lastRecordedUrlRef.current = nextUrl;
          void recordUrlHistory({
            url: nextUrl,
            title: paneRef.current.label
          });
        }
      }
    };

    const handlePageTitleUpdated = (e: any) => {
      if (e.title) {
        updatePane(workspaceId, paneRef.current.id, { label: e.title });
        const currentUrl = lastKnownUrlRef.current;
        if (currentUrl && currentUrl !== 'about:blank') {
          void recordUrlHistory({
            url: currentUrl,
            title: e.title
          });
        }
      }
    };

    webview.addEventListener('dom-ready', handleDomReady);
    webview.addEventListener('did-start-loading', handleDidStartLoading);
    webview.addEventListener('did-stop-loading', handleDidStopLoading);
    webview.addEventListener('did-fail-load', handleDidFailLoad);
    webview.addEventListener('did-navigate', handleDidNavigate);
    webview.addEventListener('did-navigate-in-page', handleDidNavigateInPage);
    webview.addEventListener('page-title-updated', handlePageTitleUpdated);
    webview.addEventListener('focus', handleFocus);

    return () => {
      webview.removeEventListener('dom-ready', handleDomReady);
      webview.removeEventListener('did-start-loading', handleDidStartLoading);
      webview.removeEventListener('did-stop-loading', handleDidStopLoading);
      webview.removeEventListener('did-fail-load', handleDidFailLoad);
      webview.removeEventListener('did-navigate', handleDidNavigate);
      webview.removeEventListener('did-navigate-in-page', handleDidNavigateInPage);
      webview.removeEventListener('page-title-updated', handlePageTitleUpdated);
      webview.removeEventListener('focus', handleFocus);
    };
  }, [focusPane, recordUrlHistory, updatePane, workspaceId]);

  useEffect(() => {
    const webview = webviewRef.current;
    if (!webview) return;

    const targetUrl = fixUrlOrSearch(pane.url);

    if (targetUrl === lastKnownUrlRef.current) {
      return;
    }

    if (!isDomReady) {
      if (webview.getAttribute('src') !== targetUrl) {
        webview.setAttribute('src', targetUrl);
      }
      return;
    }

    try {
      webview.loadURL(targetUrl);
    } catch {
      webview.setAttribute('src', targetUrl);
    }
  }, [isDomReady, pane.url]);

  useEffect(() => {
    if (!containerRef.current || !webviewRef.current) return;

    const resizeObserver = new ResizeObserver(() => {});
    resizeObserver.observe(containerRef.current);

    const handleDevTools = (e: any) => {
      if (e.detail?.paneId === pane.id && webviewRef.current) {
        webviewRef.current.openDevTools();
      }
    };
    window.addEventListener('webview:devtools', handleDevTools);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener('webview:devtools', handleDevTools);
    };
  }, [pane.id]);

  useEffect(() => {
    if (!projectPath || !autoRefresh) {
      if (isWatching) {
        window.electron.watcher.stop({ paneId: pane.id });
        setIsWatching(false);
      }
      return;
    }

    const handleFileChanged = () => {
      if (webviewRef.current) {
        webviewRef.current.reload();
      }
    };

    const unsub = window.electron.watcher.onFileChanged((_, { paneId }) => {
      if (paneId === pane.id) {
        handleFileChanged();
      }
    });

    window.electron.watcher.start({ paneId: pane.id, projectPath });
    setIsWatching(true);

    return () => {
      unsub();
      window.electron.watcher.stop({ paneId: pane.id });
      setIsWatching(false);
    };
  }, [projectPath, autoRefresh, pane.id]);

  const handleNavigate = useCallback(() => {
    const targetUrl = fixUrlOrSearch(urlInput);
    setUrlInput(targetUrl);
    lastKnownUrlRef.current = targetUrl;

    if (webviewRef.current) {
      if (isDomReady) {
        webviewRef.current.loadURL(targetUrl);
      } else {
        webviewRef.current.setAttribute('src', targetUrl);
      }
    }
  }, [isDomReady, urlInput]);

  const handleBack = () => {
    if (isDomReady && webviewRef.current && webviewRef.current.canGoBack()) {
      webviewRef.current.goBack();
    }
  };

  const handleForward = () => {
    if (isDomReady && webviewRef.current && webviewRef.current.canGoForward()) {
      webviewRef.current.goForward();
    }
  };

  const handleReload = () => {
    if (isDomReady && webviewRef.current) {
      webviewRef.current.reload();
    }
  };

  const handleTakeScreenshot = useCallback(async () => {
    focusPane();

    const webview = webviewRef.current;
    const webContentsId =
      webview && typeof webview.getWebContentsId === 'function'
        ? webview.getWebContentsId()
        : null;

    if (!webContentsId) {
      showScreenshotNotice('Screenshot failed', 'error');
      return;
    }

    try {
      const result = await window.electron.browser.captureScreenshot({
        paneId: pane.id,
        webContentsId,
        projectDirectory: projectPath || undefined
      });

      showScreenshotNotice(
        result.savedToPath ? 'Screenshot copied and saved' : 'Screenshot copied to clipboard'
      );
    } catch (error) {
      console.error('Failed to capture screenshot', error);
      showScreenshotNotice('Screenshot failed', 'error');
    }
  }, [focusPane, pane.id, projectPath, showScreenshotNotice]);

  const toggleAutoRefresh = () => {
    setAutoRefresh(prev => !prev);
  };

  useEffect(() => {
    const handleScreenshotRequest = (event: Event) => {
      const detail = (event as CustomEvent<{ paneId?: string }>).detail;

      if (detail?.paneId !== pane.id) {
        return;
      }

      void handleTakeScreenshot();
    };

    window.addEventListener(TAKE_PANE_SCREENSHOT_EVENT, handleScreenshotRequest as EventListener);

    return () => {
      window.removeEventListener(TAKE_PANE_SCREENSHOT_EVENT, handleScreenshotRequest as EventListener);
    };
  }, [handleTakeScreenshot, pane.id]);

  return (
    <div className="w-full h-full flex flex-col bg-bg-primary" onMouseDownCapture={focusPane}>
      <div className="flex items-center gap-2 px-3 py-2 bg-bg-secondary border-b border-border-default/60">
        <div className="flex items-center gap-0.5">
          <button
            className="w-7 h-7 flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/5 disabled:opacity-30 disabled:hover:bg-transparent rounded-md transition-colors"
            onClick={() => {
              focusPane();
              handleBack();
            }}
            title="Back"
          >
            <ArrowLeft size={16} />
          </button>
          <button
            className="w-7 h-7 flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/5 disabled:opacity-30 disabled:hover:bg-transparent rounded-md transition-colors"
            onClick={() => {
              focusPane();
              handleForward();
            }}
            title="Forward"
          >
            <ArrowRight size={16} />
          </button>
          <button
            className="w-7 h-7 flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/5 rounded-md transition-colors"
            onClick={() => {
              focusPane();
              handleReload();
            }}
            title="Reload"
          >
            <RotateCw size={14} />
          </button>
        </div>
        
        <div className="flex-1 flex" style={{ margin: '0 4px' }}>
          <input
            ref={inputRef}
            className="flex-1 bg-bg-primary/90 border border-border-default rounded-l-md px-3 py-1.5 text-[13px] text-gray-200 placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-accent-blue/50 focus:border-accent-blue shadow-none transition-all"
            value={urlInput}
            onChange={e => {
              focusPane();
              setUrlInput(e.target.value);
            }}
            onKeyDown={e => {
              if (e.key === 'Enter') handleNavigate();
            }}
            onFocus={focusPane}
            placeholder="Search or enter web address"
            style={{ minWidth: 0 }}
          />
          <button
            className="px-4 py-1.5 text-[13px] font-medium bg-accent-obsidian text-white rounded-r-md hover:bg-accent-obsidian-hover active:bg-accent-obsidian-active transition-colors shadow-none"
            onClick={() => {
              focusPane();
              handleNavigate();
            }}
          >
            Go
          </button>
        </div>

        {projectPath && (
          <button
            className={`w-7 h-7 flex items-center justify-center rounded-md transition-colors ${
              autoRefresh
                ? 'bg-green-600/20 text-green-500 hover:bg-green-600/30'
                : 'text-gray-400 hover:text-white hover:bg-white/5'
            }`}
            onClick={() => {
              focusPane();
              toggleAutoRefresh();
            }}
            title={autoRefresh ? 'Auto-refresh: ON' : 'Auto-refresh: OFF'}
          >
            {autoRefresh ? <Eye size={14} /> : <EyeOff size={14} />}
          </button>
        )}
      </div>

      <div className="flex-1 relative overflow-hidden bg-white" ref={containerRef}>
        {isLoading && (
          <div className="absolute top-0 left-0 right-0 h-1 bg-bg-secondary z-20">
            <div className="h-full bg-accent-blue relative w-1/3 animate-pulse" style={{ animationDuration: '1s' }} />
          </div>
        )}
        {screenshotNotice && (
          <div
            className={`absolute top-3 left-1/2 z-30 -translate-x-1/2 pointer-events-none transition-all duration-200 ${
              screenshotNotice.visible ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-1'
            }`}
          >
            <div
              className={`rounded-full border px-3 py-1.5 text-[11px] font-medium shadow-[0_10px_28px_rgba(0,0,0,0.24)] backdrop-blur-sm ${
                screenshotNotice.tone === 'error'
                  ? 'border-red-400/30 bg-red-500/90 text-white'
                  : 'border-black/10 bg-black/72 text-white'
              }`}
            >
              {screenshotNotice.message}
            </div>
          </div>
        )}
        {isWatching && autoRefresh && (
          <div className="absolute top-1 right-1 z-30 px-1.5 py-0.5 bg-green-600 text-white text-[10px] rounded flex items-center gap-1">
            <RefreshCw size={10} className="animate-spin" />
            Watching
          </div>
        )}
        <webview
          ref={webviewRef}
          className="w-full h-full border-0 absolute inset-0 z-10"
          src={fixUrlOrSearch(pane.url)}
          allowpopups={"true" as any}
          partition={`persist:${pane.id}`}
        />
      </div>
    </div>
  );
}
