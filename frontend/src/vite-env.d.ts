/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_USE_MOCK_BRAIN?: string;
  readonly VITE_WS_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
