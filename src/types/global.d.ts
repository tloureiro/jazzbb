type ExternalFileBridgeResponse = {
  ok: boolean;
  content?: string;
  lastModified?: number;
  error?: string;
};

type ExternalFileWriteResponse = {
  ok: boolean;
  lastModified?: number;
  error?: string;
};

type ExternalFilePayload = {
  path: string;
  content: string;
  lastModified: number;
  exists: boolean;
};

interface JazzbbWrapperBridge {
  getInitialState?: () => Promise<unknown>;
  onPayload?: (callback: (payload: unknown) => void) => () => void;
  readFile?: (payload: { path: string }) => Promise<ExternalFileBridgeResponse>;
  writeFile?: (payload: { path: string; content: string }) => Promise<ExternalFileWriteResponse>;
}

declare global {
  interface Window {
    jazzbbWrapper?: JazzbbWrapperBridge;
    __jazzbbPendingFiles?: ExternalFilePayload[];
  }
}

export {};
