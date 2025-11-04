import { runFormattingSuite } from './formatting-suite';
import { runEditingSuite } from './editing-suite';
import { runBrowserVaultSuite } from './browser-vault-suite';

async function main() {
  try {
    await runFormattingSuite();
    await runEditingSuite();
    await runBrowserVaultSuite();
    console.log('🎉 Puppeteer suites completed successfully');
  } catch (error) {
    console.error('❌ Puppeteer suites failed');
    console.error(error);
    process.exitCode = 1;
  }
}

await main();
