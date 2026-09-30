/** The Worker's settings and bindings. Secrets come from `wrangler secret put`. */
export interface Env {
  /** An OpenRouter key with a monthly credit limit (D13). Without it, the model is off. */
  OPENROUTER_API_KEY?: string
  /** The model chosen in D17, such as "openai/gpt-5.4-nano". Without it, the model is off. */
  MODEL_ID?: string
  /** Comma-separated emails that may use the model. Empty means nobody (D13). */
  MODEL_ALLOWED_EMAILS?: string
  /** Workers rate limit: 20 model calls a minute per user (D13). Optional. */
  MODEL_LIMITER?: { limit(options: { key: string }): Promise<{ success: boolean }> }
}

export interface User {
  sub: string
  email: string
  name: string
}
