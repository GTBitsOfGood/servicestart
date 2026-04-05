export declare global {
  namespace NodeJS {
    interface ProcessEnv {
      DB_URL: string;
      BETTER_AUTH_SECRET: string;
      BETTER_AUTH_URL: string;
      NEXT_PUBLIC_BRANCH_NAME: string | undefined;
      NEXT_PUBLIC_BASE_URL: string | undefined;
      NEXT_PUBLIC_PROD_URL: string | undefined;
      NEXT_PUBLIC_ORG_CONFIG_CACHE_DISABLED: string | undefined;
      FILE_STORAGE_DIR: string | undefined;
      FILE_SERVICE_IMPLEMENTATION: string | undefined;
      JUNO_API_KEY: string;
      JUNO_BASE_URL: string;
      SENDGRID_KEY: string;
    }
  }
}
