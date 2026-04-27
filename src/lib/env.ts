const required = [
  "DATABASE_URL",
  "NEXTAUTH_SECRET",
  "OPENROUTER_ENCRYPTION_KEY",
] as const;

type EnvKey = (typeof required)[number];

function validateEnv(): void {
  const missing = required.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(", ")}\n` +
        "Copy .env.example to .env.local and fill in all required values."
    );
  }
}

// Run at import time so the app fails fast on boot rather than at first use.
validateEnv();

export const env = {
  DATABASE_URL: process.env.DATABASE_URL as string,
  NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET as string,
  NEXTAUTH_URL: process.env.NEXTAUTH_URL ?? "http://localhost:3000",
  OPENROUTER_ENCRYPTION_KEY: process.env.OPENROUTER_ENCRYPTION_KEY as string,
} satisfies Record<EnvKey, string> & { NEXTAUTH_URL: string };
