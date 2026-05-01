import { app } from 'electron';
import { join } from 'path';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import type { AppState, Workspace } from '../../renderer/types/index';
import log from 'electron-log';

export class WorkspaceStore {
  private statePath: string;
  private state: AppState;

  constructor() {
    const userDataPath = app.getPath('userData');
    this.statePath = join(userDataPath, 'workspaces.json');
    this.state = this.load();
    log.info('WorkspaceStore initialized', { statePath: this.statePath });
  }

  private getDefaultState(): AppState {
    return {
      version: 1,
      activeWorkspaceId: null,
      workspaces: [],
      recentCommands: [],
      recentUrls: []
    };
  }

  private load(): AppState {
    try {
      if (existsSync(this.statePath)) {
        const data = JSON.parse(readFileSync(this.statePath, 'utf-8'));
        return { ...this.getDefaultState(), ...data };
      }
    } catch (e) {
      log.error('Failed to load workspace state:', e);
    }
    return this.getDefaultState();
  }

  private persist(): void {
    try {
      const dir = join(app.getPath('userData'));
      if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
      writeFileSync(this.statePath, JSON.stringify(this.state, null, 2));
    } catch (e) {
      log.error('Failed to save workspace state:', e);
    }
  }

  getAppState(): AppState {
    return { ...this.state };
  }

  saveAppState(state: AppState): void {
    this.state = { ...state };
    this.persist();
  }

  clearAppState(): void {
    this.state = this.getDefaultState();
    this.persist();
  }

  getActiveWorkspace(): Workspace | null {
    if (!this.state.activeWorkspaceId) return null;
    return this.state.workspaces.find(w => w.id === this.state.activeWorkspaceId) || null;
  }

  updateWorkspace(workspace: Workspace): void {
    const idx = this.state.workspaces.findIndex(w => w.id === workspace.id);
    if (idx >= 0) {
      this.state.workspaces[idx] = { ...workspace, updatedAt: new Date().toISOString() };
    }
    this.persist();
  }

  addWorkspace(workspace: Workspace): void {
    this.state.workspaces.push(workspace);
    this.state.activeWorkspaceId = workspace.id;
    this.persist();
  }

  deleteWorkspace(id: string): void {
    this.state.workspaces = this.state.workspaces.filter(w => w.id !== id);
    if (this.state.activeWorkspaceId === id) {
      this.state.activeWorkspaceId = this.state.workspaces[0]?.id || null;
    }
    this.persist();
  }

  setActiveWorkspace(id: string): void {
    this.state.activeWorkspaceId = id;
    this.persist();
  }
}
