export declare global {
  namespace NodeJS {
    interface ProcessEnv {
      DB_URL: string;
      BETTER_AUTH_SECRET: string;
      BETTER_AUTH_URL: string;
      NEXT_PUBLIC_BRANCH_NAME: string | undefined;
      NEXT_PUBLIC_BASE_URL: string | undefined;
      FILE_STORAGE_DIR: string;
    }
  }
}
