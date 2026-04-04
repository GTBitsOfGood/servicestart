export declare global {
  namespace NodeJS {
    interface ProcessEnv {
      DB_URL: string;
      BETTER_AUTH_SECRET: string;
      BETTER_AUTH_URL: string;
      NEXT_PUBLIC_BRANCH_NAME: string | undefined;
      NEXT_PUBLIC_BASE_URL: string | undefined;
      NEXT_PUBLIC_PROD_URL: string | undefined;
      FILE_STORAGE_DIR: string | undefined;
      FILE_SERVICE_IMPLEMENTATION: string | undefined;
      JUNO_API_KEY: string;
      JUNO_BASE_URL: string;
      JUNO_PROJECT_ID: string | undefined;
      JUNO_FILE_CONFIG_ID: string | undefined;
      JUNO_FILE_BUCKET_PREFIX: string | undefined;
      FILE_PROVIDER_NAME: string | undefined;
      AZURE_STORAGE_ACCOUNT_NAME: string | undefined;
      AZURE_STORAGE_ACCOUNT_KEY: string | undefined;
      SETUP_ORGANIZATION_ID: string | undefined;
      SENDGRID_KEY: string;
    }
  }
}
