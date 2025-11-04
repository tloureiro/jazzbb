import { Component, Show, onMount, onCleanup } from 'solid-js';
import Header from './components/Header';
import Sidebar from './components/Sidebar';
import EditorPane from './components/EditorPane';
import InspectorPane from './components/InspectorPane';
import ToastTray from './components/ToastTray';
import OutlinePanel from './components/OutlinePanel';
import { isVaultMode } from './state/workspace';
import {
  isInspectorVisible,
  isOutlineVisible,
  isHeaderCollapsed,
  setHeaderCollapsed,
  isSidebarCollapsed,
  setSidebarCollapsed,
} from './state/ui';

const App: Component = () => {
  const vaultActive = () => isVaultMode();
  const sidebarCollapsed = isSidebarCollapsed;
  const sidebarVisible = () => vaultActive() && !sidebarCollapsed();
  const inspectorVisible = isInspectorVisible;
  const outlineVisible = isOutlineVisible;
  const headerCollapsed = isHeaderCollapsed;

  onMount(() => {
    if (typeof window !== 'undefined') {
      const runtime = window as typeof window & { __setSidebarCollapsed?: (value: boolean) => void };
      runtime.__setSidebarCollapsed = setSidebarCollapsed;
      onCleanup(() => {
        delete runtime.__setSidebarCollapsed;
      });
    }
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
          title="Expand top bar (Cmd/Ctrl + Shift + H)"
        >
          ▼
        </button>
      </Show>
      <section
        class="app-body"
        data-sidebar={sidebarVisible() ? 'true' : 'false'}
        data-inspector={inspectorVisible() ? 'true' : 'false'}
        data-outline={outlineVisible() ? 'true' : 'false'}
      >
        <Show when={sidebarVisible()}>
          <Sidebar />
        </Show>
        <EditorPane />
        <Show when={inspectorVisible()}>
          <InspectorPane />
        </Show>
        <Show when={outlineVisible()}>
          <OutlinePanel />
        </Show>
      </section>
      <Show when={vaultActive() && sidebarCollapsed()}>
        <button
          type="button"
          class="sidebar-expand-handle"
          onClick={() => setSidebarCollapsed(false)}
          aria-label="Expand vault sidebar"
          title="Expand vault sidebar (Cmd/Ctrl + Shift + B)"
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
