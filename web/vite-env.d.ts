/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_LOGROCKET_APP_ID?: string;
  readonly VITE_APP_VERSION?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}