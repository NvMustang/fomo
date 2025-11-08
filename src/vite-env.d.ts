/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_MAPLIBRE_ACCESS_TOKEN: string
  readonly VITE_PEXELS_API_KEY?: string
  readonly VITE_API_URL?: string
  readonly VITE_API_PORT?: string
  readonly VITE_DEPLOYMENT_ID?: string // ID de déploiement explicite (optionnel)
  readonly VITE_GIT_COMMIT_SHA?: string // Commit SHA (fourni par Vercel automatiquement)
  // more env variables...
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
