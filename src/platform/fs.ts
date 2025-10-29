export type VaultHandle = {
  directoryHandle: FileSystemDirectoryHandle;
};

export type NoteHandle = {
  fileHandle: FileSystemFileHandle;
  path: string;
};

export type OpenVaultResult =
  | { status: 'success'; handle: VaultHandle }
  | { status: 'unsupported' }
  | { status: 'cancelled' };

export async function requestVault(): Promise<OpenVaultResult> {
  if (!('showDirectoryPicker' in window)) {
    return { status: 'unsupported' };
  }

  type DirectoryPickerOptions = {
    mode?: 'read' | 'readwrite';
    id?: string;
    startIn?: FileSystemHandle | 'desktop' | 'documents' | 'downloads' | 'music' | 'pictures' | 'videos';
  } & Record<string, unknown>;

  type DirectoryPicker = (options?: DirectoryPickerOptions) => Promise<FileSystemDirectoryHandle>;

  try {
    const directoryHandle = await (window as typeof window & {
      showDirectoryPicker?: DirectoryPicker;
    }).showDirectoryPicker?.({ mode: 'readwrite' });

    if (!directoryHandle) {
      return { status: 'cancelled' };
    }

    return { status: 'success', handle: { directoryHandle } };
  } catch (error) {
    if ((error as DOMException).name === 'AbortError') {
      return { status: 'cancelled' };
    }

    console.error('Failed to open directory', error);
    return { status: 'cancelled' };
  }
}

export async function enumerateMarkdownFiles(
  handle: VaultHandle,
): Promise<Array<{ path: string; fileHandle: FileSystemFileHandle }>> {
  const results: Array<{ path: string; fileHandle: FileSystemFileHandle }> = [];

  async function walkDirectory(
    dirHandle: FileSystemDirectoryHandle,
    currentPath: string[],
  ): Promise<void> {
    const iterator = ((dirHandle as unknown as { entries?: () => AsyncIterableIterator<[string, FileSystemHandle]> })
      .entries?.() || [][Symbol.iterator]());

    for await (const [name, entry] of iterator) {
      if (entry.kind === 'file' && name.toLowerCase().endsWith('.md')) {
        const fileEntry = entry as FileSystemFileHandle;
        const path = [...currentPath, name].join('/');
        results.push({ path, fileHandle: fileEntry });
        continue;
      }

      if (entry.kind === 'directory') {
        await walkDirectory(entry as FileSystemDirectoryHandle, [...currentPath, name]);
      }
    }
  }

  await walkDirectory(handle.directoryHandle, []);
  return results.sort((a, b) => a.path.localeCompare(b.path));
}

export function supportsFileSystemAccess(): boolean {
  return 'showDirectoryPicker' in window;
}
