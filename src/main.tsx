import { render } from 'solid-js/web';
import App from './App';
import './styles/global.css';
import { restoreBrowserVaultSession } from './platform/browser-vault-session';

async function bootstrap(): Promise<void> {
  const root = document.getElementById('root');
  if (!root) {
    throw new Error('Failed to find root element');
  }

  const params = new URLSearchParams(window.location.search);
  const skip = ['e', 'empty', 'default'].some((key) => params.has(key));

  try {
    if (import.meta.env.DEV) {
      await import('./devtools/browser-vault-debug');
    }
    await restoreBrowserVaultSession({ skip });
  } catch (error) {
    console.error('Failed to restore browser vault session', error);
  }

  render(() => <App />, root);
}

void bootstrap();
