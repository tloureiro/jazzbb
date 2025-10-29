import { Component, For, Show } from 'solid-js';
import { dismissToast, toasts } from '../state/ui';

const toneClass: Record<string, string> = {
  info: 'toast-info',
  success: 'toast-success',
  error: 'toast-error',
};

const ToastTray: Component = () => (
  <div class="toast-tray" aria-live="polite" aria-atomic="true">
    <For each={toasts()}>
      {(toast) => (
        <div class={`toast ${toneClass[toast.tone] ?? toneClass.info}`} role="status">
          <span>{toast.message}</span>
          <Show when={toast.tone !== 'info'}>
            <span class="toast-indicator" aria-hidden="true" />
          </Show>
          <button type="button" class="toast-dismiss" aria-label="Dismiss notification" onClick={() => dismissToast(toast.id)}>
            ×
          </button>
        </div>
      )}
    </For>
  </div>
);

export default ToastTray;
