export declare global {
  namespace NodeJS {
    interface ProcessEnv {
      DB_URL: string;
      BETTER_AUTH_SECRET: string;
      BETTER_AUTH_URL: string | undefined;
      NEXT_PUBLIC_BRANCH_NAME: string | undefined;
      NEXT_PUBLIC_BASE_URL: string | undefined;
      NEXT_PUBLIC_PROD_URL: string | undefined;
      NEXT_PUBLIC_ORG_CONFIG_CACHE_DISABLED: string | undefined;
      FILE_STORAGE_DIR: string | undefined;
      FILE_SERVICE_IMPLEMENTATION: string | undefined;
      /** Required when a Juno service is used. */
      JUNO_API_KEY: string | undefined;
      /** Required for local setup; runtime may use the SDK default. */
      JUNO_BASE_URL: string | undefined;
      /** Required when setting up or sending email. */
      EMAIL_SENDER_DOMAIN: string | undefined;
      JUNO_PROJECT_ID: string | undefined;
      JUNO_FILE_BUCKET_PREFIX: string | undefined;
      FILE_PROVIDER_NAME: string | undefined;
      AZURE_STORAGE_ACCOUNT_NAME: string | undefined;
      AZURE_STORAGE_ACCOUNT_KEY: string | undefined;
      SETUP_ORGANIZATION_ID: string | undefined;
      /** Required for email provisioning only. */
      SENDGRID_KEY: string | undefined;
      ALLOWED_DEV_ORIGINS: string | undefined;
      BASE_URL: string | undefined;
      E2E_TENANT_DOMAIN: string | undefined;
    }
  }
}
