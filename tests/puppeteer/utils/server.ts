import { createServer, mergeConfig, type InlineConfig, type ViteDevServer } from 'vite';
import baseConfig from '../../../vite.config';

let server: ViteDevServer | undefined;
let origin: string | undefined;

export async function startTestServer(): Promise<{ origin: string }> {
  if (server && origin) {
    return { origin };
  }

  const inlineConfig: InlineConfig = mergeConfig(baseConfig, {
    server: {
      host: '127.0.0.1',
      port: 0,
    },
    logLevel: 'error',
  });

  server = await createServer(inlineConfig);
  await server.listen();

  const resolved = server.resolvedUrls?.local?.[0];
  if (!resolved) {
    throw new Error('Failed to resolve Vite dev server URL');
  }
  origin = resolved;
  return { origin };
}

export async function stopTestServer(): Promise<void> {
  if (!server) return;
  await server.close();
  server = undefined;
  origin = undefined;
}
