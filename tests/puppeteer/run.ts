import { runFormattingSuite } from './formatting-suite';
import { runEditingSuite } from './editing-suite';

async function main() {
  try {
    await runFormattingSuite();
    await runEditingSuite();
    console.log('🎉 Puppeteer suites completed successfully');
  } catch (error) {
    console.error('❌ Puppeteer suites failed');
    console.error(error);
    process.exitCode = 1;
  }
}

await main();
