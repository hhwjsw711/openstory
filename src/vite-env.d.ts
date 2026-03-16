/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_APP_NAME: string;
  readonly VITE_APP_URL: string;
  readonly VITE_R2_PUBLIC_ASSETS_DOMAIN: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
