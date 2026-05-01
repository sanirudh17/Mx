import React, { useCallback, useRef, useEffect } from 'react';
import { Allotment } from 'allotment';
import 'allotment/dist/style.css';
import type { Workspace, LayoutNode } from '../../types';
import { useAppStore } from '../../stores/useAppStore';
import PaneContainer from '../panes/PaneContainer';
import EmptyPaneChooser from '../panes/EmptyPaneChooser';

interface AllotmentNodeProps {
  node: LayoutNode;
  vertical: boolean;
  getDefaultSizes: (node: LayoutNode) => number[];
  handleSizeCommit: (nodeId: string, sizes: number[]) => void;
  renderPaneContent: (child: string) => React.ReactNode;
  renderLayoutRecursive: (child: LayoutNode) => React.ReactNode;
}

function AllotmentNode({
  node,
  vertical,
  getDefaultSizes,
  handleSizeCommit,
  renderPaneContent,
  renderLayoutRecursive
}: AllotmentNodeProps) {
  const ref = useRef<any>(null);
  const lastChildCount = useRef(node.children.length);

  useEffect(() => {
    const previousCount = lastChildCount.current;
    const currentCount = node.children.length;

    if (previousCount !== currentCount) {
      lastChildCount.current = currentCount;

      if (currentCount > 0) {
        // Automatically allocate equal space when panes are added or removed.
        // react-allotment's reset() recalculates equal pixel sizes correctly.
        // (Avoiding resize([33, 33]) which creates 33px wide panes, crashing terminals)
        requestAnimationFrame(() => {
          ref.current?.reset();
        });
      }
    }
  }, [node.children.length]);

  return (
    <Allotment
      ref={ref}
      key={node.id}
      className="w-full h-full min-w-0 min-h-0"
      vertical={vertical}
      proportionalLayout
      onDragEnd={(sizes) => handleSizeCommit(node.id, sizes)}
      defaultSizes={getDefaultSizes(node)}
    >
      {node.children.map((child) => {
        if (typeof child === 'string') {
          return (
            <Allotment.Pane key={child} minSize={80}>
              {renderPaneContent(child)}
            </Allotment.Pane>
          );
        }
        return (
          <Allotment.Pane key={child.id} minSize={80}>
            {renderLayoutRecursive(child)}
          </Allotment.Pane>
        );
      })}
    </Allotment>
  );
}

interface Props {
  workspace: Workspace;
}

export default function AllotmentLayout({ workspace }: Props) {
  const updatePaneSize = useAppStore(state => state.updatePaneSize);
  const saveSession = useAppStore(state => state.saveSession);

  const getPaneById = useCallback((paneId: string) => {
    return workspace.panes.find(p => p.id === paneId);
  }, [workspace.panes]);



  const handleSizeCommit = useCallback(async (nodeId: string, sizes: number[]) => {
    updatePaneSize(workspace.id, nodeId, sizes);
    await saveSession();
  }, [saveSession, updatePaneSize, workspace.id]);

  const getDefaultSizes = useCallback((node: LayoutNode) => {
    return node.sizes.length > 0
      ? node.sizes
      : node.children.map(() => 100 / node.children.length);
  }, []);

  const renderPaneContent = (paneId: string) => {
    const pane = getPaneById(paneId);
    if (!pane) return null;

    if (pane.type === 'empty') {
      return (
        <div className="w-full h-full min-w-0 min-h-0 bg-bg-primary">
          <EmptyPaneChooser workspaceId={workspace.id} paneId={paneId} />
        </div>
      );
    }

    return (
      <PaneContainer
        pane={pane}
        workspaceId={workspace.id}
        style={{ width: '100%', height: '100%' }}
      />
    );
  };

  const zoomedPaneId = workspace.zoomedPaneId;
  const zoomedPane = zoomedPaneId ? getPaneById(zoomedPaneId) : undefined;



// Inside AllotmentLayout
  const renderLayoutRecursive = (node: LayoutNode): React.ReactNode => {
    if (!node.children || node.children.length === 0) {
      return (
        <div className="w-full h-full min-w-0 min-h-0 flex items-center justify-center bg-bg-primary text-gray-500 text-sm">
          No panes. Use the toolbar above to add one.
        </div>
      );
    }

    const isVertical = node.direction === 'vertical';

    return (
      <AllotmentNode
        node={node}
        vertical={isVertical}
        getDefaultSizes={getDefaultSizes}
        handleSizeCommit={handleSizeCommit}
        renderPaneContent={renderPaneContent}
        renderLayoutRecursive={renderLayoutRecursive}
      />
    );
  };

  if (workspace.layout.children.length === 0) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-bg-primary text-gray-500 text-sm">
        No panes. Use the toolbar above to add one.
      </div>
    );
  }

  if (zoomedPaneId && zoomedPane) {
    return (
      <div className="w-full h-full min-w-0 min-h-0 overflow-hidden bg-bg-primary">
        {renderPaneContent(zoomedPaneId)}
      </div>
    );
  }

  return (
    <div className="w-full h-full min-w-0 min-h-0 overflow-hidden bg-bg-primary">
      {renderLayoutRecursive(workspace.layout)}
    </div>
  );
}
