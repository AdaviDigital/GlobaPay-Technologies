/**
 * Validates required environment variables at boot. Throws immediately if
 * anything security-critical is missing or too weak — the app should refuse
 * to start rather than silently run with a guessable secret. This function
 * is called from main.ts before Nest's app context is even created.
 */
export function validateEnv(env: NodeJS.ProcessEnv): void {
  const errors: string[] = [];

  const requireSecret = (key: string, minLength = 32) => {
    const value = env[key];
    if (!value) {
      errors.push(`${key} is not set. Generate one with: openssl rand -hex 32`);
      return;
    }
    if (value.length < minLength) {
      errors.push(`${key} is only ${value.length} characters — use at least ${minLength}`);
    }
  };

  requireSecret('JWT_ACCESS_SECRET');
  requireSecret('JWT_REFRESH_SECRET');

  if (env.JWT_ACCESS_SECRET && env.JWT_ACCESS_SECRET === env.JWT_REFRESH_SECRET) {
    errors.push('JWT_ACCESS_SECRET and JWT_REFRESH_SECRET must not be the same value');
  }

  if (env.NODE_ENV === 'production' && (!env.DATABASE_URL || env.DATABASE_URL.includes('globapay:globapay@localhost'))) {
    errors.push('DATABASE_URL is missing or still points at the local dev default — set a real production database URL');
  }

  if (errors.length > 0) {
    // eslint-disable-next-line no-console
    console.error('\n✖ Refusing to start — invalid configuration:\n' + errors.map((e) => `  - ${e}`).join('\n') + '\n');
    process.exit(1);
  }
}
