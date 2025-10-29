import { Component, Show } from 'solid-js';
import Header from './components/Header';
import Sidebar from './components/Sidebar';
import EditorPane from './components/EditorPane';
import InspectorPane from './components/InspectorPane';
import ToastTray from './components/ToastTray';
import OutlinePanel from './components/OutlinePanel';
import { workspaceStore } from './state/workspace';
import { isInspectorVisible, isOutlineVisible, isHeaderCollapsed, setHeaderCollapsed } from './state/ui';

const App: Component = () => {
  const sidebarVisible = () => workspaceStore.mode() === 'vault';
  const inspectorVisible = isInspectorVisible;
  const outlineVisible = isOutlineVisible;
  const headerCollapsed = isHeaderCollapsed;

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
      <ToastTray />
    </main>
  );
};

export default App;
