/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string
  readonly VITE_SUPABASE_ANON_KEY: string
  /** числовой id бота — часть токена до двоеточия (публичная) */
  readonly VITE_TELEGRAM_BOT_ID?: string
  /** имя бота без @, например me_wish_bot */
  readonly VITE_TELEGRAM_BOT_NAME?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

declare const __BUILD_TIME__: string
