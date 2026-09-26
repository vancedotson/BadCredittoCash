export {};

declare global {
  namespace NodeJS {
    interface ProcessEnv {
      /** Comma-separated exact HTTPS attendee origins for Stream live inputs. */
      CLOUDFLARE_STREAM_ALLOWED_ORIGINS?: string;
    }
  }
}
