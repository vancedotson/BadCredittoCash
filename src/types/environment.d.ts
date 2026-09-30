export {};

declare global {
  namespace NodeJS {
    interface ProcessEnv {
      /** Comma-separated exact HTTPS attendee origins for Stream live inputs. */
      CLOUDFLARE_STREAM_ALLOWED_ORIGINS?: string;
      /** "true" enables CRM payment requests; any other value keeps them inert. */
      PAYMENTS_ENABLED?: string;
      /** "sandbox" or "production"; anything else disables payments. */
      AUTHNET_ENV?: string;
      /** Worker secret. */
      AUTHNET_API_LOGIN_ID?: string;
      /** Worker secret. */
      AUTHNET_TRANSACTION_KEY?: string;
      /** Worker secret used to verify webhook signatures. */
      AUTHNET_SIGNATURE_KEY?: string;
      /** Worker secret: Accept.js public client key used by the AcceptUI lightbox. */
      AUTHNET_PUBLIC_CLIENT_KEY?: string;
    }
  }
}
