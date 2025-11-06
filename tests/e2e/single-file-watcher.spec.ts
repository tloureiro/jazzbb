import { test, expect } from '@playwright/test';

const INITIAL_NOTE = '# Sample Title\n\nInitial draft body.';
const UPDATED_NOTE = '# Sample Title\n\nUpdated content from disk.';

test.describe('Single file watcher', () => {
  test('reloads editor when the underlying file changes', async ({ page }) => {
    await page.addInitScript(({ initialContent }) => {
      const fileState = {
        content: initialContent,
        lastModified: Date.now(),
      };

      const mockHandle = {
        name: 'watcher-note.md',
        async getFile() {
          return {
            async text() {
              return fileState.content;
            },
            get lastModified() {
              return fileState.lastModified;
            },
          };
        },
      };

      const globalWindow = window as typeof window & {
        __mockFileState?: typeof fileState;
        showOpenFilePicker?: () => Promise<typeof mockHandle[]>;
      };

      globalWindow.__mockFileState = fileState;
      globalWindow.showOpenFilePicker = async () => [mockHandle];
    }, { initialContent: INITIAL_NOTE });

    await page.goto('/?empty');
    await page.getByRole('button', { name: 'Open file' }).click();

    const editor = page.locator('.tiptap-editor');
    await expect(editor).toContainText('Initial draft body.');

    await page.evaluate(({ nextContent }) => {
      const globalWindow = window as typeof window & {
        __mockFileState?: { content: string; lastModified: number };
      };
      const state = globalWindow.__mockFileState;
      if (!state) {
        throw new Error('Mock file state missing');
      }
      state.content = nextContent;
      state.lastModified = Date.now() + 10_000;
    }, { nextContent: UPDATED_NOTE });

    await page.waitForTimeout(2200);

    await expect(editor).toContainText('Updated content from disk.');
    await expect(editor).not.toContainText('Initial draft body.');
    await expect(
      page.locator('.toast-tray .toast span', { hasText: 'Reloaded latest file changes' }),
    ).toBeVisible();
  });
});
