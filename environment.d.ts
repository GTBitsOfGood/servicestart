export declare global {
  namespace NodeJS {
    interface ProcessEnv {
      DB_URL: string;
      BETTER_AUTH_SECRET: string;
      BETTER_AUTH_URL: string;
    }
  }
}
