import { z } from 'zod';

const envSchema = z.object({
  // Server
  PORT: z.coerce.number().default(3000),
  PUBLIC_URL: z.string().url().default('https://doc3steps.example.ru'),
  DATA_DIR: z.string().default('./data'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
  DEBUG_COMMANDS: z.coerce.boolean().default(false),

  // AI
  AI_PROVIDER: z.enum(['openai-compat', 'mock']).default('openai-compat'),
  AI_BASE_URL: z.string().url().default('http://localhost:11434/v1'),
  AI_API_KEY: z.string().default(''),
  AI_MODEL: z.string().default('qwen2.5:7b-instruct'),
  AI_TEMPERATURE: z.coerce.number().min(0).max(2).default(0.1),
  AI_TIMEOUT_MS: z.coerce.number().positive().default(90000),
  AI_FAULT: z.enum(['off', 'always']).default('off'),

  // MAX bot
  MAX_ENABLED: z.coerce.boolean().default(false),
  MAX_TOKEN: z.string().optional(),
  MAX_API_URL: z.string().url().default('https://platform-api2.max.ru'),
  MAX_MODE: z.enum(['webhook', 'polling']).default('webhook'),
  MAX_WEBHOOK_SECRET: z.string().optional(),

  // VK bot
  VK_ENABLED: z.coerce.boolean().default(false),
  VK_GROUP_ID: z.string().optional(),
  VK_TOKEN: z.string().optional(),
  VK_API_VERSION: z.string().default('5.199'),
  VK_MODE: z.enum(['callback', 'longpoll']).default('callback'),
  VK_CALLBACK_SECRET: z.string().optional(),
  VK_CONFIRMATION_CODE: z.string().optional(),

  // Cleanup
  CLEANUP_ENABLED: z.coerce.boolean().default(true),
  CLEANUP_FILE_MAX_AGE_HOURS: z.coerce.number().positive().default(24),
  CLEANUP_LOG_MAX_AGE_DAYS: z.coerce.number().positive().default(30),
});

function loadEnv() {
  const parsed = envSchema.safeParse(process.env);

  if (!parsed.success) {
    const issues = parsed.error.issues
      .map(i => `  ${i.path.join('.')}: ${i.message}`)
      .join('\n');
    throw new Error(`Invalid environment variables:\n${issues}`);
  }

  const env = parsed.data;

  // Cross-field validation: MAX_ENABLED requires MAX_TOKEN
  if (env.MAX_ENABLED && !env.MAX_TOKEN) {
    throw new Error(
      'MAX_ENABLED=1 but MAX_TOKEN is not set. ' +
      'Provide MAX_TOKEN with a valid API token to enable MAX bot integration.'
    );
  }

  // Cross-field validation: VK_ENABLED requires VK_TOKEN
  if (env.VK_ENABLED && !env.VK_TOKEN) {
    throw new Error(
      'VK_ENABLED=1 but VK_TOKEN is not set. ' +
      'Provide VK_TOKEN with a valid API token to enable VK bot integration.'
    );
  }

  return env;
}

export const env = loadEnv();
