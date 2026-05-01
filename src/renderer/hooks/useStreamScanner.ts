import { useEffect, useRef } from 'react';
import { useAppStore } from '../stores/useAppStore';
import { pushGlobalNotificationWithNativeFallback } from '../utils/notifications';
import type { AgentPane, AgentPreset, Pane, PaneStatus, TerminalPane } from '../types';

const STREAM_SCANNER_DEBUG = true;
const STREAM_BUFFER_LIMIT = 5000;
const TERMINAL_INPUT_IDLE_MS = 1500;
const AGENT_TURN_IDLE_MS = 1000; // Fast checks 1s after PTY output stops
const MIN_ELAPSED_FOR_COMPLETION_MS = 2500;
const MIN_AGENT_PROMPT_COMPLETION_MS = 800;
const INPUT_NOTIFICATION_COOLDOWN_MS = 60000; // Increased to 60s per user request
const GLOBAL_INPUT_NOTIFICATION_COOLDOWN_MS = 2000;
const RESUME_RESYNC_DEBOUNCE_MS = 900;

const DIRECT_INPUT_PATTERNS = [
  /\([yY]\/[nN]\)\s*[:?]?\s*$/,
  /\[[yY]\/[nN]\]\s*[:?]?\s*$/,
  /\byes\/no\b\s*[:?]?\s*$/i,
  /^\s*(?:[>?\[\]()*.-]\s*)?(?:please\s+)?continue\?\s*$/i,
  /^\s*(?:[>?\[\]()*.-]\s*)?(?:please\s+)?proceed\?\s*$/i,
  /^\s*(?:[>?\[\]()*.-]\s*)?(?:please\s+)?confirm\?\s*$/i,
  /^\s*(?:[>?\[\]()*.-]\s*)?(?:please\s+)?(?:answer|response)\s*:\s*$/i,
  /^\s*(?:[>?\[\]()*.-]\s*)?(?:please\s+)?(?:enter|type) (?:your |a )?(?:choice|answer|value|name|password)\s*[:?]?\s*$/i,
  /\bpress (?:enter|any key|space) to (?:continue|select|confirm)\b/i
];

const MENU_HEADER_PATTERNS = [
  /\bquestionnaire\b/i,
  /\bselect an option\b/i,
  /\bchoose (?:one|an option|items?)\b/i,
  /\bwhich .* do you prefer\b/i
];

const MENU_HINT_PATTERNS = [
  /\buse (?:the )?arrow keys\b/i,
  /\bspace to (?:select|toggle)\b/i,
  /\benter to (?:submit|confirm)\b/i,
  /\btype to filter\b/i,
  /↑↓\s*select/i,
  /[←→\u2190\u2192]\s*(?:toggle|select|choose|answers?)/i,
  /\b(?:left|right)\s*arrow/i,
  /\benter\s*submit\b/i,
  /\besc\s*dismiss\b/i,
  /\bspace\s*select/i,
  /↔\s*tabs/i,
  /↕\s*options/i,
  /Space\s*select\/edit/i,
  /\br\s+review\b/i
];

const MENU_OPTION_LINE_PATTERNS = [
  /^\s*(?:>|\u203a|\u276f|\u25b8)\s+\S.*$/,
  /^\s*\[[ xX]?\]\s+\S.*$/,
  /^\s*(?:\d+|[a-zA-Z])[\]\)\.]\s+\S.*$/
];

const AGENT_PROMPT_PATTERNS = [
  /^\s*(?:>|>>|>>>|\$)\s*$/,
  /^\s*(?:\u203a|\u276f|\u00bb|\u25b8|\u25b9)\s*$/,
  /^\s*[a-z][\w-]{0,24}>\s*$/i
];

const AGENT_PROFILES = {
  claude: {
    displayName: 'Claude Code',
    identityPatterns: [/\bclaude(?:\s+code)?\b/i],
    completionPatterns: [
      /\btotal cost\b/i,
      /\binput tokens?\b/i,
      /\boutput tokens?\b/i,
      // Claude Code CLI shows "Cogitated for 1m 10s" after completing a response
      /\bCogitated\s+for\s+\d+m?\s*\d*s\b/i,
      // Claude may show thinking/processing time
      /\bThinking\s+for\s+\d+m?\s*\d*s\b/i,
      /\bProcessed\s+for\s+\d+m?\s*\d*s\b/i
    ]
  },
  codex: {
    displayName: 'Codex CLI',
    identityPatterns: [/\bcodex\b/i],
    completionPatterns: [
      /\btokens used\b/i, /\binput tokens?\b/i, /\boutput tokens?\b/i, /\btotal cost\b/i,
      /\bcodex\s*>\s*$/im
    ]
  },
  opencode: {
    displayName: 'OpenCode',
    identityPatterns: [/\bopencode\b/i, /\bopen\s*code\b/i, /\bOpenCode\b/i],
    completionPatterns: [
      /Build\s*[·•\-\u00b7\u2022\u2027\u22c5]\s*.+?\s*[·•\-\u00b7\u2022\u2027\u22c5]\s*(?:\d+m\s*)?\d+(?:\.\d+)?s/i,
      /\btoken usage\b/i,
      /\btotal tokens?\b/i,
      /\besc\s+interrupt[\s\S]*?ctrl\+p\s+commands\b/i,
      /Build\s*[·•\-\u00b7\u2022\u2027\u22c5]\s*.+?\s+(?:OpenCode|Zen|Free|Pro)\b/i
    ]
  },
  gemini: {
    displayName: 'Gemini CLI',
    identityPatterns: [/\bgemini\b/i],
    completionPatterns: [
      /\binput tokens?\b/i, /\boutput tokens?\b/i, /\btotal tokens?\b/i,
      /\bgemini\s*>\s*$/im,
      /\b\d+\s*tokens?\s*[\(\|·•]/i,
      /\$\s*\d+\.\d+\s*(?:cost|total)?/i
    ]
  },
  aider: {
    displayName: 'Aider',
    identityPatterns: [/\baider\b/i],
    completionPatterns: [/\bTokens:\b/i, /\bCost:\b/i, /\bModel:\b/i, /\bcommit [0-9a-f]{6,}\b/i]
  },
  pi: {
    displayName: 'Pi',
    identityPatterns: [/\bpi\b/i],
    completionPatterns: [
      /Build[\s\S]*?\d+\.\d+s/i,
      /\btotal cost\b/i,
      /\bTask completed\b/i,
      /\bCommand exited with code\b/i,
      /\bTook \d+\.?\d*s\b/i
    ]
  }
} as const;

type AgentKey = keyof typeof AGENT_PROFILES;

type PaneContext = {
  pane: Pane | null;
  workspaceId: string | null;
  workspaceName: string | null;
  preset: AgentPreset | null;
};

type PaneRuntimeState = {
  buffer: string;
  timerId?: number;
  submissionSeq: number;
  activeAgentKey?: AgentKey;
  activeAgentDisplayName?: string;
  lastCompletedSubmissionSeq?: number;
  lastCompletionSignature?: string;
  lastInputSignature?: string;
  lastInputAt?: number;
  abortedAt?: number;
  submittedAt?: number;
  lastCheckedBuffer?: string;
  stableCheckCount?: number;
  firstTurnCheckAt?: number;
  delayCheckCount?: number;
  hasExplicitSubmission?: boolean;
  lastPtyDataAt?: number;
  isSlashSession?: boolean;
  lastCompletionFiredAt?: number;
};

function logStreamScanner(message: string, payload?: Record<string, unknown>) {
  if (!STREAM_SCANNER_DEBUG) {
    return;
  }

  if (payload) {
    console.log(`[StreamScanner] ${message}`, payload);
    return;
  }

  console.log(`[StreamScanner] ${message}`);
}

function stripAnsi(text: string): string {
  return text
    .replace(/\x1b\][^\x07\x1b]*(?:\x07|\x1b\\)/g, '')
    .replace(/\x1b\[[0-9;?]*[ -/]*[@-~]/g, '')
    .replace(/\x1bO./g, '')
    .replace(/[\x00-\x08\x0b-\x1f\x7f]/g, '');
}

function normalizeChunk(text: string): string {
  return stripAnsi(text)
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n');
}

function visualizeText(text: string): string {
  return text.replace(/\n/g, '\\n').replace(/\t/g, '\\t');
}

function getPaneContext(paneId: string): PaneContext {
  const state = useAppStore.getState();

  for (const workspace of state.workspaces) {
    const pane = workspace.panes.find((candidate) => candidate.id === paneId) ?? null;
    if (!pane) {
      continue;
    }

    const preset =
      pane.type === 'agent' && (pane as AgentPane).presetId
        ? state.presets.find((candidate) => candidate.id === (pane as AgentPane).presetId) ?? null
        : null;

    return {
      pane,
      workspaceId: workspace.id,
      workspaceName: workspace.name,
      preset
    };
  }

  return {
    pane: null,
    workspaceId: null,
    workspaceName: null,
    preset: null
  };
}

function getOrCreatePaneState(store: Map<string, PaneRuntimeState>, paneId: string): PaneRuntimeState {
  const existing = store.get(paneId);
  if (existing) {
    return existing;
  }

  const created: PaneRuntimeState = {
    buffer: '',
    submissionSeq: 0
  };
  store.set(paneId, created);
  return created;
}

function clearPaneTimer(state: PaneRuntimeState) {
  if (typeof state.timerId === 'number') {
    window.clearTimeout(state.timerId);
    state.timerId = undefined;
  }
}

function getTailLines(text: string, count = 8): string[] {
  return text
    .split('\n')
    .map((line) => line.trimEnd())
    .filter((line) => line.trim().length > 0)
    .slice(-count);
}

function getLastNonEmptyLine(text: string): string {
  const lines = text
    .split('\n')
    .map((line) => line.trimEnd())
    .filter((line) => line.trim().length > 0);

  return lines[lines.length - 1] ?? '';
}

function isAgentPromptLine(line: string): boolean {
  const trimmed = line.trim();
  return AGENT_PROMPT_PATTERNS.some((pattern) => pattern.test(trimmed));
}

function hasAgentPromptInTail(buffer: string, lineCount = 6): boolean {
  const lines = getTailLines(buffer, lineCount);
  return lines.some((line) => isAgentPromptLine(line));
}

function hasMeaningfulTurnOutput(buffer: string): boolean {
  const lines = getTailLines(buffer, 14);

  return lines.some((line) => {
    const trimmed = line.trim();
    if (!trimmed || isAgentPromptLine(trimmed)) {
      return false;
    }

    return /[A-Za-z0-9]/.test(trimmed);
  });
}

const STRUCTURED_COMPLETION_PATTERNS = [
  /(?:^|\n)[^\S\n]*(?:\S\s*)?Build\s*[·•\-\u00b7\u2022\u2027\u22c5]\s*.+?\s*[·•\-\u00b7\u2022\u2027\u22c5]\s*(?:\d+m\s*)?\d+(?:\.\d+)?s\s*$/im,
  // OpenCode command hint bar at end of output
  /(?:^|\n)[^\S\n]*.*\besc\s+interrupt[\s\S]*?ctrl\+p\s+commands\s*$/im
];

function detectAwaitingInput(buffer: string): { matched: boolean; signature: string } {
  const tailLines = getTailLines(buffer, 12);
  const lastLine = tailLines[tailLines.length - 1] ?? '';
  const lastTwoLines = tailLines.slice(-2).join('\n');

  if (DIRECT_INPUT_PATTERNS.some((pattern) => pattern.test(lastLine) || pattern.test(lastTwoLines))) {
    return {
      matched: true,
      signature: lastTwoLines || lastLine
    };
  }

  const hasStrongMenuHint = tailLines.some((line) =>
    /↑↓\s*select/i.test(line) ||
    /[\u2191\u2193]\s*select/i.test(line) ||
    /[\u2195]\s*select/i.test(line) ||
    /[←→\u2190\u2192]\s*(?:toggle|select|choose|answers?|options?|move|switch)/i.test(line) ||
    /\[\s*[←◄❮‹]\s*\/\s*[→►❯›]\s*\]/i.test(line) ||
    /\b(?:left|right)\s*arrow/i.test(line) ||
    /\besc\s*dismiss\b/i.test(line) ||
    /\besc\s*cancel\b/i.test(line) ||
    /\benter\s*submit\b/i.test(line) ||
    /\benter\s*confirm\b/i.test(line) ||
    /\bspace\s*select/i.test(line) ||
    /\b(?:Allow once|Allow always)\b/i.test(line) ||
    /^\s*(?:>|\?|\u203a|\u276f|\u25b8|❮|‹|◄|←|\||│|◇|◆|■|□|○|●)\s*(?:Allow|Reject|Yes|No|Cancel|Approve|Deny)\b/i.test(line) ||
    /\bPermission required\b/i.test(line)
  );

  if (hasStrongMenuHint) {
    return {
      matched: true,
      signature: [...tailLines].slice(-8).join('\n')
    };
  }

  const hasMenuHeader = tailLines.some((line) => MENU_HEADER_PATTERNS.some((pattern) => pattern.test(line)));
  const hasMenuHint = tailLines.some((line) => MENU_HINT_PATTERNS.some((pattern) => pattern.test(line)));
  const optionLines = tailLines.filter((line) =>
    MENU_OPTION_LINE_PATTERNS.some((pattern) => pattern.test(line))
  );

  if ((hasMenuHeader || hasMenuHint) && optionLines.length >= 2) {
    return {
      matched: true,
      signature: [...tailLines.filter((line) =>
        MENU_HEADER_PATTERNS.some((pattern) => pattern.test(line)) ||
        MENU_HINT_PATTERNS.some((pattern) => pattern.test(line)) ||
        MENU_OPTION_LINE_PATTERNS.some((pattern) => pattern.test(line))
      )].slice(-8).join('\n')
    };
  }

  const hasQuestionnairePrompt =
    tailLines.some((line) => /\bquestion\s+\d+\b/i.test(line)) &&
    tailLines.some((line) => /\b(answer|response)\s*:?\s*$/i.test(line));

  if (hasQuestionnairePrompt) {
    return {
      matched: true,
      signature: tailLines.slice(-6).join('\n')
    };
  }

  return {
    matched: false,
    signature: ''
  };
}

function detectAgentKey(text: string): AgentKey | null {
  for (const [key, profile] of Object.entries(AGENT_PROFILES) as [AgentKey, (typeof AGENT_PROFILES)[AgentKey]][]) {
    if (profile.identityPatterns.some((pattern) => pattern.test(text))) {
      return key;
    }
  }

  return null;
}

function resolveAgentDetails(
  pane: AgentPane,
  preset: AgentPreset | null,
  buffer: string,
  activeAgentKey?: AgentKey,
  activeAgentDisplayName?: string
): { agentKey: AgentKey | null; agentDisplayName: string } {
  const detectionText = [preset?.name, preset?.command, pane.label, pane.command, buffer.slice(-500)]
    .filter(Boolean)
    .join('\n');
  const agentKey = detectAgentKey(detectionText);

  if (preset?.name?.trim()) {
    return {
      agentKey: agentKey ?? activeAgentKey ?? null,
      agentDisplayName: preset.name.trim()
    };
  }

  if (activeAgentKey) {
    return {
      agentKey: activeAgentKey,
      agentDisplayName: activeAgentDisplayName || AGENT_PROFILES[activeAgentKey].displayName
    };
  }

  if (agentKey) {
    return {
      agentKey,
      agentDisplayName: AGENT_PROFILES[agentKey].displayName
    };
  }

  return {
    agentKey: null,
    agentDisplayName: (pane as AgentPane).label || 'Coding Agent'
  };
}

const getTreatAsAgent = (pane: Pane | null, activeAgentKey?: AgentKey): boolean => {
  return pane?.type === 'agent' || Boolean(activeAgentKey);
};

function detectAgentCompletion(
  buffer: string,
  agentKey: AgentKey | null,
  treatAsAgent: boolean,
  elapsedMs: number
): { matched: boolean; needsDelay?: boolean; signature: string } {
  const trimmed = buffer.trim();
  if (!trimmed) {
    return { matched: false, signature: '' };
  }

  const tailLines = getTailLines(buffer, 20);
  const tailText = tailLines.join('\n');
  const lastNonEmptyLine = getLastNonEmptyLine(buffer);
  const recentText = buffer.slice(-2500);

  if (agentKey) {
    const profile = AGENT_PROFILES[agentKey];
    const matchedPattern = profile.completionPatterns.find((pattern) =>
      pattern.test(tailText)
    );
    if (matchedPattern) {
      return {
        matched: true,
        signature: `${agentKey}:${matchedPattern.toString()}::${tailText}`
      };
    }

    // Fallback: for longer responses the Build line may scroll beyond the last 10 lines.
    // Check against the wider recentText buffer (last 2500 chars) as well.
    const matchedRecentPattern = profile.completionPatterns.find((pattern) =>
      pattern.test(recentText)
    );
    if (matchedRecentPattern) {
      return {
        matched: true,
        signature: `${agentKey}:recent:${matchedRecentPattern.toString()}::${recentText.slice(-600)}`
      };
    }
  }

  const matchedStructuredCompletion = STRUCTURED_COMPLETION_PATTERNS.find((pattern) =>
    pattern.test(recentText)
  );
  if (matchedStructuredCompletion && elapsedMs >= MIN_AGENT_PROMPT_COMPLETION_MS) {
    return {
      matched: true,
      signature: `structured:${matchedStructuredCompletion.toString()}::${recentText.slice(-600)}`
    };
  }

  if (
    treatAsAgent &&
    elapsedMs >= MIN_AGENT_PROMPT_COMPLETION_MS &&
    hasAgentPromptInTail(buffer, 6) &&
    hasMeaningfulTurnOutput(buffer)
  ) {
    return {
      matched: true,
      signature: `agent_prompt:${lastNonEmptyLine}::${tailText}`
    };
  }

  // Only apply the 4-second artificial minimum delay to GENERIC fallback.
  // Explicit agents (OpenCode, Aider) should trigger instantly via their tailored regexes.
  if (elapsedMs < MIN_ELAPSED_FOR_COMPLETION_MS) {
    return { matched: false, needsDelay: true, signature: '' };
  }

  // Generic fallback for unknown CLIs and all long-running standard terminal commands.
  // We detect if the buffer ends with a standard shell prompt or a generic REPL prompt.
  // Since 'detectAgentCompletion' only fires when MIN_ELAPSED_FOR_COMPLETION_MS (e.g. 4s)
  // has passed since submission, this safely catches any CLI task completion without spamming on fast commands.
  const GENERIC_COMPLETION_PATTERNS = [
    // Windows PowerShell
    /(?:^|\n)PS [^\n>]*> ?$/,
    // Windows CMD
    /(?:^|\n)(?:[a-zA-Z]:\\[^\n>]*)> ?$/,
    // Unix Bash/Zsh user/root prompts
    /(?:^|\n)[^\s@\n]+@[^\s:\n]+:[^\n$#]*[$#] ?$/,
    // Generic REPLs (e.g. `aider> `, `my-cli>`, `>>> `, `$ `)
    /(?:^|\n)(?:[a-zA-Z_-]+[>\]~]|>>>|\$)\s*$/,
    // Short single-symbol prompts used by several coding agent CLIs.
    /(?:^|\n)\s*(?:>|>>|\u203a|\u276f|\u00bb|\u25b8|\u25b9)\s*$/
  ];

  const matchedGeneric = GENERIC_COMPLETION_PATTERNS.find((pattern) => pattern.test(tailText));
  if (matchedGeneric && hasMeaningfulTurnOutput(buffer)) {
    return {
      matched: true,
      signature: `generic_prompt:${matchedGeneric.toString()}::${tailText}`
    };
  }

  return {
    matched: false,
    signature: ''
  };
}

function detectTaskFailure(buffer: string): boolean {
  const tailLines = getTailLines(buffer, 16);
  const tailText = tailLines.join('\n');

  const explicitFailurePatterns = [
    /(?:^|\n)\s*(?:error|exception|fatal)(?::|\b)/i,
    /(?:^|\n)\s*(?:task failed|request failed|operation failed|build failed|command failed)\b/i,
    /(?:^|\n)\s*(?:aborted|cancelled)\b(?::|\b)/i,
    /\bnpm ERR!/i,
    /\bTraceback \(most recent call last\):/i,
    /\b(?:exit status|exit code|status code)\s*[:=]?\s*(?:[1-9]\d*)\b/i,
    /\b(?:returned|exited?)\s+with\s+code\s+(?:[1-9]\d*)\b/i
  ];

  return explicitFailurePatterns.some((pattern) => pattern.test(tailText));
}

export function useStreamScanner() {
  const paneStateRef = useRef<Map<string, PaneRuntimeState>>(new Map());
  const lastGlobalInputNotificationAtRef = useRef(0);
  const lastResyncAtRef = useRef(0);

  useEffect(() => {
    const scheduleAgentTurnCheck = (paneId: string, state: PaneRuntimeState, submissionSeq: number) => {
      clearPaneTimer(state);

      // HARD GUARD: If this submission was already completed, do NOT schedule any check.
      // This is the single point that prevents all notification spam.
      if (state.lastCompletedSubmissionSeq === submissionSeq) {
        return;
      }

      // If this is a slash command session, suppress all checks.
      if (state.isSlashSession) {
        return;
      }

      state.timerId = window.setTimeout(() => {
        const context = getPaneContext(paneId);
        if (!context.pane || (context.pane.type !== 'agent' && context.pane.type !== 'terminal')) {
          clearPaneTimer(state);
          return;
        }

        if (state.submissionSeq !== submissionSeq) {
          clearPaneTimer(state);
          return;
        }

        const agentPane = context.pane as AgentPane;
        const { agentKey, agentDisplayName } = resolveAgentDetails(
          agentPane,
          context.preset,
          state.buffer,
          state.activeAgentKey,
          state.activeAgentDisplayName
        );

        // Update active agent key if we detect one from the buffer but don't have one cached
        if (agentKey && !state.activeAgentKey) {
          state.activeAgentKey = agentKey;
          state.activeAgentDisplayName = AGENT_PROFILES[agentKey].displayName;
        }

        const elapsedSinceSubmission = state.submittedAt ? Date.now() - state.submittedAt : Infinity;

        // Catch manual terminal keyboard aborts (Ctrl+C prints ^C) and Escape dismissals
        if (/\^C/.test(state.buffer.slice(-200)) || /\x1b/.test(state.buffer.slice(-50))) {
          // Only set abortedAt for Ctrl+C, not all escape sequences
          if (/\^C/.test(state.buffer.slice(-200))) {
            state.abortedAt = Date.now();
          }
        }

        // If this is a slash command session, suppress all notifications entirely
        if (state.isSlashSession) {
          logStreamScanner('Notifications suppressed for slash command session', { paneId });
          clearPaneTimer(state);
          return;
        }

        const treatAsAgent = getTreatAsAgent(context.pane, state.activeAgentKey) || agentKey !== null;

        const completion = detectAgentCompletion(
          state.buffer,
          agentKey,
          treatAsAgent,
          elapsedSinceSubmission
        );

        const dispatchCompletionNotification = () => {
          // Agent panes always count as explicit submissions since they're launched from presets
          const isExplicit = state.hasExplicitSubmission || context.pane?.type === 'agent';
          if (
            !completion.matched ||
            state.lastCompletedSubmissionSeq === submissionSeq ||
            !isExplicit
          ) {
            return;
          }

          const now = Date.now();
          if (state.abortedAt && now - state.abortedAt < 10000) {
            logStreamScanner('Agent completion suppressed due to manual abort', { paneId });
            state.abortedAt = undefined;
            return;
          }

          const hasError = detectTaskFailure(state.buffer);

          void pushGlobalNotificationWithNativeFallback({
            title: hasError ? 'Task failed' : 'Task completed',
            body: context.workspaceName
              ? `${agentDisplayName} in "${context.workspaceName}" has ${hasError ? 'failed' : 'finished'} its task`
              : `${agentDisplayName} has ${hasError ? 'failed' : 'finished'} its task`,
            kind: hasError ? 'error' : 'success',
            sourcePaneId: paneId,
            sourceWorkspaceId: context.workspaceId ?? undefined,
            autoExpireMs: 12000
          }, true);

          logStreamScanner('Agent completion notification dispatched', {
            paneId,
            signature: completion.signature,
            wasError: hasError
          });

          state.lastCompletedSubmissionSeq = submissionSeq;
          state.lastCompletionSignature = completion.signature;
          state.lastCompletionFiredAt = Date.now();
        };

        const inputDetection = detectAwaitingInput(state.buffer);
        // Suppress input notifications if:
        // 1) No explicit submission was made (slash commands, REPL launch without a task)
        // 2) A completion notification just fired within the last 5 seconds (prevents the
        //    false "Input requested" that appears when the agent returns to its idle prompt)
        // 3) The completion for this submission was already recorded
        const recentlyCompleted = state.lastCompletionFiredAt && (Date.now() - state.lastCompletionFiredAt < 5000);
        const alreadyCompletedThisSub = state.lastCompletedSubmissionSeq === submissionSeq;
        if (inputDetection.matched && state.hasExplicitSubmission && !recentlyCompleted && !alreadyCompletedThisSub) {
          const now = Date.now();
          if (
            (!state.lastInputAt || now - state.lastInputAt >= INPUT_NOTIFICATION_COOLDOWN_MS) &&
            now - lastGlobalInputNotificationAtRef.current >= GLOBAL_INPUT_NOTIFICATION_COOLDOWN_MS
          ) {
            state.lastInputSignature = inputDetection.signature;
            state.lastInputAt = now;
            lastGlobalInputNotificationAtRef.current = now;

            void pushGlobalNotificationWithNativeFallback({
              title: 'Input requested',
              body: `${context.pane.label || 'Coding Agent'} in "${context.workspaceName || 'Unknown workspace'}" is waiting for your input`,
              kind: 'action',
              sourcePaneId: paneId,
              sourceWorkspaceId: context.workspaceId ?? undefined,
              autoExpireMs: undefined
            }, true);

            logStreamScanner('Agent input notification dispatched', {
              paneId,
              signature: inputDetection.signature
            });
            clearPaneTimer(state);
            return;
          } else if (state.lastInputAt && now - state.lastInputAt < INPUT_NOTIFICATION_COOLDOWN_MS) {
            clearPaneTimer(state);
            state.timerId = window.setTimeout(() => {
              scheduleAgentTurnCheck(paneId, state, submissionSeq);
            }, INPUT_NOTIFICATION_COOLDOWN_MS - (now - state.lastInputAt) + 100);
            return;
          }
          clearPaneTimer(state);
          state.timerId = window.setTimeout(() => {
            scheduleAgentTurnCheck(paneId, state, submissionSeq);
          }, Math.max(GLOBAL_INPUT_NOTIFICATION_COOLDOWN_MS - (now - lastGlobalInputNotificationAtRef.current) + 50, 150));
          return;
        }

        // Track buffer stability across consecutive checks
        const currentBufferSnapshot = state.buffer.slice(-500);
        const isBufferStable = state.lastCheckedBuffer === currentBufferSnapshot;
        state.lastCheckedBuffer = currentBufferSnapshot;
        if (isBufferStable) {
          state.stableCheckCount = (state.stableCheckCount || 0) + 1;
        } else {
          state.stableCheckCount = 0;
        }
        if (!state.firstTurnCheckAt) {
          state.firstTurnCheckAt = Date.now();
        }

        if (completion.needsDelay) {
          // Re-schedule with exponential backoff — generic prompt completion needs more minimum elapsed time (4s)
          state.delayCheckCount = (state.delayCheckCount || 0) + 1;
          const backoffMultiplier = Math.min(state.delayCheckCount, 5);
          const delayMs = AGENT_TURN_IDLE_MS * backoffMultiplier;
          clearPaneTimer(state);
          state.timerId = window.setTimeout(() => {
            scheduleAgentTurnCheck(paneId, state, submissionSeq);
          }, delayMs);
          return;
        }

        // Stable output fallback for agents: if buffer hasn't changed for 2+ consecutive checks
        // and there's meaningful output and no input prompt detected, treat as completion.
        // Only apply after an explicit user submission to avoid startup false-positives.
        const hasStableOutput = isBufferStable && (state.stableCheckCount || 0) >= 2;
        const hasEnoughElapsedTime = elapsedSinceSubmission >= MIN_AGENT_PROMPT_COMPLETION_MS;
        const isExplicitOrAgent = state.hasExplicitSubmission || context.pane?.type === 'agent';
        if (
          isExplicitOrAgent &&
          hasStableOutput &&
          hasEnoughElapsedTime &&
          treatAsAgent &&
          !completion.matched &&
          hasMeaningfulTurnOutput(state.buffer) &&
          !detectAwaitingInput(state.buffer).matched
        ) {
          if (state.lastCompletedSubmissionSeq !== submissionSeq) {
            const hasError = detectTaskFailure(state.buffer);

            void pushGlobalNotificationWithNativeFallback({
              title: hasError ? 'Task failed' : 'Task completed',
              body: context.workspaceName
                ? `${agentDisplayName} in "${context.workspaceName}" has ${hasError ? 'failed' : 'finished'} its task`
                : `${agentDisplayName} has ${hasError ? 'failed' : 'finished'} its task`,
              kind: hasError ? 'error' : 'success',
              sourcePaneId: paneId,
              sourceWorkspaceId: context.workspaceId ?? undefined,
              autoExpireMs: 12000
            }, true);

            logStreamScanner('Agent completion notification dispatched (stable output)', {
              paneId,
              stableCheckCount: state.stableCheckCount
            });

            state.lastCompletedSubmissionSeq = submissionSeq;
            state.lastCompletionSignature = 'stable_output';
            state.lastCompletionFiredAt = Date.now();
          }
          clearPaneTimer(state);
          return;
        }

        if (completion.matched) {
          dispatchCompletionNotification();
          clearPaneTimer(state);
          return;
        }

        if (state.hasExplicitSubmission && state.lastCompletedSubmissionSeq !== submissionSeq && treatAsAgent) {
          clearPaneTimer(state);
          state.timerId = window.setTimeout(() => {
            scheduleAgentTurnCheck(paneId, state, submissionSeq);
          }, AGENT_TURN_IDLE_MS);
          return;
        }

        clearPaneTimer(state);
      }, AGENT_TURN_IDLE_MS);
    };

    const syncRunningPaneOutput = async (pane: TerminalPane | AgentPane, reason: string) => {
      try {
        const output = await window.electron.pty.getOutput({ paneId: pane.id });
        const normalizedOutput = normalizeChunk(output).slice(-STREAM_BUFFER_LIMIT);
        if (!normalizedOutput) {
          return;
        }

        const state = getOrCreatePaneState(paneStateRef.current, pane.id);
        if (state.buffer === normalizedOutput) {
          return;
        }

        state.buffer = normalizedOutput;
        if (state.submissionSeq === 0) {
          state.submissionSeq = 1;
        }

        // Agent panes auto-start their commands, so always treat as explicit submission
        if (pane.type === 'agent' && !state.hasExplicitSubmission) {
          state.hasExplicitSubmission = true;
          state.submittedAt = state.submittedAt || Date.now();
        }

        if (!state.activeAgentKey && pane.type === 'agent') {
          const context = getPaneContext(pane.id);
          if (context.preset) {
            const presetAgentKey = detectAgentKey([context.preset.name, context.preset.command].filter(Boolean).join('\n'));
            if (presetAgentKey) {
              state.activeAgentKey = presetAgentKey;
              state.activeAgentDisplayName = AGENT_PROFILES[presetAgentKey].displayName;
            }
          }
        }

        logStreamScanner('Resynced PTY buffer after lifecycle change', {
          paneId: pane.id,
          reason,
          bufferTail: visualizeText(normalizedOutput.slice(-240))
        });

        // If buffer is stable and no recent PTY data, run check immediately (catches completions
        // that happened while app was in background or computer was asleep).
        const now = Date.now();
        const timeSinceLastData = state.lastPtyDataAt ? now - state.lastPtyDataAt : Infinity;
        const isBufferUnchanged = state.lastCheckedBuffer === normalizedOutput.slice(-500);
        if (isBufferUnchanged && timeSinceLastData > 5000) {
          scheduleAgentTurnCheck(pane.id, state, Math.max(1, state.submissionSeq));
        } else {
          scheduleAgentTurnCheck(pane.id, state, Math.max(1, state.submissionSeq));
        }
      } catch (error) {
        logStreamScanner('Failed to resync PTY buffer', {
          paneId: pane.id,
          reason,
          error: error instanceof Error ? error.message : String(error)
        });
      }
    };

    const resyncVisibleRunningPanes = (reason: string) => {
      const now = Date.now();
      if (now - lastResyncAtRef.current < RESUME_RESYNC_DEBOUNCE_MS) {
        return;
      }

      if (document.visibilityState !== 'visible') {
        return;
      }

      lastResyncAtRef.current = now;
      const panes = useAppStore
        .getState()
        .workspaces.flatMap((workspace) =>
          workspace.panes.filter(
            (pane): pane is TerminalPane | AgentPane =>
              (pane.type === 'terminal' || pane.type === 'agent') && pane.status === 'running'
          )
        );

      void Promise.allSettled(
        panes.map((pane) => syncRunningPaneOutput(pane, reason))
      );
    };

    const handlePaneSubmitted = (event: Event) => {
      const detail = (event as CustomEvent<{ paneId: string; timestamp: number; command?: string }>).detail;
      if (!detail?.paneId) {
        return;
      }

      const state = getOrCreatePaneState(paneStateRef.current, detail.paneId);
      clearPaneTimer(state);
      state.buffer = '';
      state.submissionSeq += 1;
      state.submittedAt = Date.now();
      const submittedCommand = detail.command?.trim() || '';
      
      // Slash commands (e.g., /help, /settings) open separate UI interfaces.
      // Mark the entire session as a slash session so ALL notifications are suppressed
      // until the next real (non-slash) submission.
      const isSlashCommand = submittedCommand.startsWith('/');
      state.isSlashSession = isSlashCommand;
      
      const submittedAgentKey = submittedCommand ? detectAgentKey(submittedCommand) : null;

      // All non-slash submissions are treated as explicit tasks.
      // This includes REPL launches (e.g. typing 'pi') — we want completion notifications for those.
      state.hasExplicitSubmission = !isSlashCommand;
      state.lastPtyDataAt = undefined;
      
      if (submittedCommand && /^(?:exit|quit|logout|\.exit)$/i.test(submittedCommand)) {
        state.activeAgentKey = undefined;
        state.activeAgentDisplayName = undefined;
      }
      if (submittedAgentKey) {
        state.activeAgentKey = submittedAgentKey;
        state.activeAgentDisplayName = AGENT_PROFILES[submittedAgentKey].displayName;
      }
      state.lastCompletedSubmissionSeq = undefined;
      state.lastCompletionSignature = undefined;
      state.lastInputAt = undefined;
      state.lastInputSignature = undefined;
      state.lastCheckedBuffer = undefined;
      state.stableCheckCount = 0;
      state.firstTurnCheckAt = undefined;
      state.delayCheckCount = 0;
      state.lastCompletionFiredAt = undefined;
      useAppStore.getState().dismissActionNotificationsByPane(detail.paneId);

      logStreamScanner('Pane submitted', {
        paneId: detail.paneId,
        submissionSeq: state.submissionSeq
      });
    };

    const handlePaneAborted = (event: Event) => {
      const detail = (event as CustomEvent<{ paneId: string }>).detail;
      const paneId = detail?.paneId;
      if (!paneId) return;

      const state = paneStateRef.current.get(paneId);
      if (state) {
        state.abortedAt = Date.now();
        logStreamScanner('Pane manually aborted (suppressing next completion)', { paneId });
      }
    };

    const handlePtyData = (event: Event) => {
      const detail = (event as CustomEvent<{ paneId: string; data: string }>).detail;
      const paneId = detail?.paneId;
      const rawData = detail?.data;

      if (!paneId || typeof rawData !== 'string' || rawData.length === 0) {
        return;
      }

      const context = getPaneContext(paneId);
      if (!context.pane || (context.pane.type !== 'terminal' && context.pane.type !== 'agent')) {
        return;
      }

      const state = getOrCreatePaneState(paneStateRef.current, paneId);
      state.lastPtyDataAt = Date.now();
      const cleanedChunk = normalizeChunk(rawData);
      if (!cleanedChunk) {
        return;
      }

      state.buffer = `${state.buffer}${cleanedChunk}`.slice(-STREAM_BUFFER_LIMIT);

      logStreamScanner('PTY chunk received', {
        paneId,
        paneType: context.pane.type,
        cleanedChunk: visualizeText(cleanedChunk),
        bufferTail: visualizeText(state.buffer.slice(-240))
      });

      // Schedule check only for incomplete submissions.
      // The hard guard at the top of scheduleAgentTurnCheck prevents re-fires.
      if (state.submissionSeq >= 0) {
        scheduleAgentTurnCheck(paneId, state, Math.max(1, state.submissionSeq));
      }
    };

    const handleWindowFocus = () => {
      resyncVisibleRunningPanes('window-focus');
    };

    const handlePageShow = () => {
      resyncVisibleRunningPanes('pageshow');
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        resyncVisibleRunningPanes('visibilitychange');
      }
    };

    const handlePaneStatusChanged = (event: Event) => {
      const detail = (event as CustomEvent<{ paneId: string; status: PaneStatus }>).detail;
      if (!detail || detail.status !== 'idle') return;

      const paneId = detail.paneId;
      const state = paneStateRef.current.get(paneId);
      if (!state) return;
      if (state.lastCompletedSubmissionSeq === state.submissionSeq) return;
      if (!state.hasExplicitSubmission) return;
      if (state.isSlashSession) return;

      const context = getPaneContext(paneId);
      if (!context.pane || (context.pane.type !== 'agent' && context.pane.type !== 'terminal')) return;

      const agentPane = context.pane as AgentPane;
      const { agentKey, agentDisplayName } = resolveAgentDetails(
        agentPane,
        context.preset,
        state.buffer,
        state.activeAgentKey,
        state.activeAgentDisplayName
      );

      // Update active agent key if detected from buffer
      if (agentKey && !state.activeAgentKey) {
        state.activeAgentKey = agentKey;
        state.activeAgentDisplayName = AGENT_PROFILES[agentKey].displayName;
      }

      const hasError = detectTaskFailure(state.buffer);

      void pushGlobalNotificationWithNativeFallback({
        title: hasError ? 'Task failed' : 'Task completed',
        body: context.workspaceName
          ? `${agentDisplayName} in "${context.workspaceName}" has ${hasError ? 'failed' : 'finished'} its task`
          : `${agentDisplayName} has ${hasError ? 'failed' : 'finished'} its task`,
        kind: hasError ? 'error' : 'success',
        sourcePaneId: paneId,
        sourceWorkspaceId: context.workspaceId ?? undefined,
        autoExpireMs: 12000
      }, true);

      logStreamScanner('Agent completion notification dispatched (pane idle)', { paneId });

      state.lastCompletedSubmissionSeq = state.submissionSeq;
      state.lastCompletionFiredAt = Date.now();
    };

    window.addEventListener('pane-submitted', handlePaneSubmitted);
    window.addEventListener('pane-aborted', handlePaneAborted);
    window.addEventListener('pty-data', handlePtyData);
    window.addEventListener('focus', handleWindowFocus);
    window.addEventListener('pageshow', handlePageShow);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('pane-status-changed', handlePaneStatusChanged);

    return () => {
      window.removeEventListener('pane-submitted', handlePaneSubmitted);
      window.removeEventListener('pane-aborted', handlePaneAborted);
      window.removeEventListener('pty-data', handlePtyData);
      window.removeEventListener('focus', handleWindowFocus);
      window.removeEventListener('pageshow', handlePageShow);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('pane-status-changed', handlePaneStatusChanged);
      paneStateRef.current.forEach((state) => {
        clearPaneTimer(state);
      });
      paneStateRef.current.clear();
    };
  }, []);
}
