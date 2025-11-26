import { Component, Show, createMemo, createEffect, onMount, onCleanup, createSignal } from 'solid-js';
import Header from './components/Header';
import Sidebar from './components/Sidebar';
import EditorPane from './components/EditorPane';
import ToastTray from './components/ToastTray';
import OutlinePanel from './components/OutlinePanel';
import FrontmatterPanel from './components/FrontmatterPanel';
import { editorStore } from './state/editor';
import { isVaultMode, workspaceStore, type WorkspaceMode } from './state/workspace';
import {
  isOutlineVisible,
  isHeaderCollapsed,
  setHeaderCollapsed,
  isSidebarCollapsed,
  setSidebarCollapsed,
  sidebarWidthPercent,
  outlineWidthPercent,
  setSidebarWidthPercent,
  setOutlineWidthPercent,
  resetSidebarWidthPercent,
  resetOutlineWidthPercent,
  isFrontmatterPanelVisible,
  setFrontmatterPanelVisible,
  setOutlineVisible,
} from './state/ui';
import { grammarChecksStore } from './state/grammarChecks';
import { getShortcutLabel, subscribeToShortcutChanges } from './lib/shortcuts';
import { DEFAULT_EDITOR_FONT_SCALE, setEditorFontScale } from './state/ui';
import { registerExternalFileBridge } from './platform/external-file';

const App: Component = () => {
  const vaultActive = () => isVaultMode();
  const sidebarCollapsed = isSidebarCollapsed;
  const sidebarVisible = () => vaultActive() && !sidebarCollapsed();
  const outlineVisible = isOutlineVisible;
  const frontmatterPanelVisible = isFrontmatterPanelVisible;
  const headerCollapsed = isHeaderCollapsed;
  const sidebarWidth = sidebarWidthPercent;
  const outlineWidth = outlineWidthPercent;
  const frontmatterPanelActive = createMemo(
    () => frontmatterPanelVisible() && Boolean(editorStore.frontmatter()),
  );
  const panelColumnVisible = createMemo(() => outlineVisible() || frontmatterPanelActive());
  createEffect(() => {
    if (!editorStore.frontmatter() && frontmatterPanelVisible()) {
      setFrontmatterPanelVisible(false);
    }
  });
  const RESIZE_HANDLE_WIDTH = '1rem';
  let layoutSectionRef: HTMLElement | undefined;
  const [shortcutsVersion, setShortcutsVersion] = createSignal(0);
  onCleanup(
    subscribeToShortcutChanges(() => {
      setShortcutsVersion((value) => value + 1);
    }),
  );

  const formatShortcutTitle = (label: string, id: Parameters<typeof getShortcutLabel>[0]) => {
    shortcutsVersion();
    const keys = getShortcutLabel(id);
    return keys ? `${label} (${keys})` : label;
  };

  const gridTemplate = createMemo(() => {
    const hasSidebar = sidebarVisible();
    const hasPanels = panelColumnVisible();
    const sidebarColumn = `${sidebarWidth()}%`;
    const outlineColumn = `${outlineWidth()}%`;
    if (hasSidebar && hasPanels) {
      return `${sidebarColumn} ${RESIZE_HANDLE_WIDTH} 1fr ${RESIZE_HANDLE_WIDTH} ${outlineColumn}`;
    }
    if (hasSidebar) {
      return `${sidebarColumn} ${RESIZE_HANDLE_WIDTH} 1fr`;
    }
    if (hasPanels) {
      return `1fr ${RESIZE_HANDLE_WIDTH} ${outlineColumn}`;
    }
    return '1fr';
  });

  const updateHeaderHeight = () => {
    if (typeof document === 'undefined') return;
    const headerElement = document.querySelector<HTMLElement>('.app-header');
    const collapsed = headerCollapsed();
    const height = !collapsed && headerElement ? headerElement.getBoundingClientRect().height : 0;
    document.documentElement.style.setProperty('--app-header-height', `${height}px`);
  };

  createEffect(() => {
    headerCollapsed();
    queueMicrotask(updateHeaderHeight);
  });

  const beginSidebarResize = (event: PointerEvent) => {
    if (event.button !== 0) return;
    const container = layoutSectionRef;
    if (!container) return;
    const totalWidth = container.getBoundingClientRect().width;
    if (totalWidth === 0) return;
    event.preventDefault();
    const pointerId = event.pointerId;
    const startX = event.clientX;
    const startPercent = sidebarWidth();
    const startPixels = (startPercent / 100) * totalWidth;
    const target = event.currentTarget as HTMLElement;
    target.setPointerCapture(pointerId);

    const handlePointerMove = (moveEvent: PointerEvent) => {
      if (moveEvent.pointerId !== pointerId) return;
      const delta = moveEvent.clientX - startX;
      const nextPixels = startPixels + delta;
      const nextPercent = (nextPixels / totalWidth) * 100;
      setSidebarWidthPercent(nextPercent);
    };

    const handlePointerEnd = (endEvent: PointerEvent) => {
      if (endEvent.pointerId !== pointerId) return;
      target.releasePointerCapture(pointerId);
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerEnd);
      window.removeEventListener('pointercancel', handlePointerEnd);
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerEnd);
    window.addEventListener('pointercancel', handlePointerEnd);
  };

  const beginOutlineResize = (event: PointerEvent) => {
    if (event.button !== 0) return;
    const container = layoutSectionRef;
    if (!container) return;
    const totalWidth = container.getBoundingClientRect().width;
    if (totalWidth === 0) return;
    event.preventDefault();
    const pointerId = event.pointerId;
    const startX = event.clientX;
    const startPercent = outlineWidth();
    const startPixels = (startPercent / 100) * totalWidth;
    const target = event.currentTarget as HTMLElement;
    target.setPointerCapture(pointerId);

    const handlePointerMove = (moveEvent: PointerEvent) => {
      if (moveEvent.pointerId !== pointerId) return;
      const delta = startX - moveEvent.clientX;
      const nextPixels = startPixels + delta;
      const nextPercent = (nextPixels / totalWidth) * 100;
      setOutlineWidthPercent(nextPercent);
    };

    const handlePointerEnd = (endEvent: PointerEvent) => {
      if (endEvent.pointerId !== pointerId) return;
      target.releasePointerCapture(pointerId);
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerEnd);
      window.removeEventListener('pointercancel', handlePointerEnd);
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerEnd);
    window.addEventListener('pointercancel', handlePointerEnd);
  };

  onMount(() => {
    const teardownExternalBridge = registerExternalFileBridge();
    if (teardownExternalBridge) {
      onCleanup(teardownExternalBridge);
    }
    setEditorFontScale(DEFAULT_EDITOR_FONT_SCALE);
    grammarChecksStore.initialize();
    updateHeaderHeight();
    const handleResize = () => updateHeaderHeight();
    window.addEventListener('resize', handleResize);
    if (typeof window !== 'undefined') {
      const runtime = window as typeof window & {
        __setSidebarCollapsed?: (value: boolean) => void;
        __setWorkspaceMode?: (mode: WorkspaceMode) => void;
        __toggleOutlinePanel?: (next?: boolean) => boolean;
      };
      runtime.__setSidebarCollapsed = setSidebarCollapsed;
      runtime.__setWorkspaceMode = workspaceStore.setMode;
      runtime.__toggleOutlinePanel = (next?: boolean) => {
        if (typeof next === 'boolean') {
          setOutlineVisible(next);
        } else {
          setOutlineVisible(!outlineVisible());
        }
        return outlineVisible();
      };
      onCleanup(() => {
        delete runtime.__setSidebarCollapsed;
        delete runtime.__setWorkspaceMode;
        delete runtime.__toggleOutlinePanel;
      });
    }
    onCleanup(() => {
      window.removeEventListener('resize', handleResize);
    });
  });

  return (
    <main
      class="app-shell"
      data-header-collapsed={headerCollapsed() ? 'true' : 'false'}
    >
      <Header />
      <Show when={headerCollapsed()}>
        <button
          type="button"
          class="header-expand-handle"
          onClick={() => setHeaderCollapsed(false)}
          aria-label="Expand top bar"
          title={formatShortcutTitle('Expand top bar', 'toggle-top-bar')}
        >
          ▼
        </button>
      </Show>
      <section
        class="app-body"
        data-sidebar={sidebarVisible() ? 'true' : 'false'}
        data-outline={panelColumnVisible() ? 'true' : 'false'}
        style={{ 'grid-template-columns': gridTemplate() }}
        ref={(node) => {
          layoutSectionRef = node ?? undefined;
        }}
      >
        <Show when={sidebarVisible()}>
          <>
            <Sidebar />
            <div
              role="separator"
              aria-orientation="vertical"
              class="resize-handle"
              data-panel="sidebar"
              onPointerDown={beginSidebarResize}
              onDblClick={resetSidebarWidthPercent}
            />
          </>
        </Show>
        <EditorPane />
        <Show when={panelColumnVisible()}>
          <>
            <div
              role="separator"
              aria-orientation="vertical"
              class="resize-handle"
              data-panel="outline"
              onPointerDown={beginOutlineResize}
              onDblClick={resetOutlineWidthPercent}
            />
            <div class="panel-stack">
              <Show when={outlineVisible()}>
                <OutlinePanel />
              </Show>
              <Show when={frontmatterPanelActive()}>
                <FrontmatterPanel />
              </Show>
            </div>
          </>
        </Show>
      </section>
      <Show when={vaultActive() && sidebarCollapsed()}>
        <button
          type="button"
          class="sidebar-expand-handle"
          onClick={() => setSidebarCollapsed(false)}
          aria-label="Expand vault sidebar"
          title={formatShortcutTitle('Expand vault sidebar', 'toggle-sidebar')}
          data-test="sidebar-expand"
        >
          ▶
        </button>
      </Show>
      <ToastTray />
    </main>
  );
};

export default App;
