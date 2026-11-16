/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_SUPABASE_PUBLISHABLE_KEY: string;
  /** Static path of the Paged.js print script (set by vite.config.ts). */
  readonly PAGED_SCRIPT_PATH: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
