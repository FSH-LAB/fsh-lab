import { z } from "zod";

/**
 * Regex patterns adhering to Google Cloud Run resource allocation standards
 * and FSH-LAB monorepo architecture rules.
 */
export const CPU_REGEX = /^(\d+(\.\d+)?|\d+m)$/;
export const MEMORY_REGEX = /^\d+(Mi|Gi)$/;
export const DURATION_REGEX = /^\d+s$/;
export const APP_SLUG_REGEX = /^[a-z][a-z0-9-]{1,20}[a-z0-9]$/;
export const SECRET_NAME_REGEX = /^[A-Z][A-Z0-9_]*$/;

const envMapSchema = z.record(z.string(), z.string());

const environmentOverrideSchema = z.object({
  env: envMapSchema.optional(),
});

/**
 * Zod schema defining the contract for apps/<app>/infra.json files.
 * Auto-discovered by Terraform in infra/main.tf.
 */
export const infraSchema = z
  .object({
    displayName: z.string().min(1, "displayName cannot be empty"),
    public: z.boolean().default(true).optional(),
    cpu: z
      .string()
      .regex(
        CPU_REGEX,
        "cpu must be a valid Cloud Run CPU unit (e.g., '1000m', '2000m', '1', '2', '0.5')",
      )
      .optional(),
    memory: z
      .string()
      .regex(
        MEMORY_REGEX,
        "memory must be a valid Cloud Run memory unit (e.g., '256Mi', '512Mi', '1Gi', '2Gi')",
      )
      .optional(),
    minInstances: z
      .number()
      .int("minInstances must be an integer")
      .min(0, "minInstances cannot be negative")
      .optional(),
    maxInstances: z
      .number()
      .int("maxInstances must be an integer")
      .min(1, "maxInstances must be at least 1")
      .optional(),
    env: envMapSchema.optional(),
    environments: z
      .object({
        dev: environmentOverrideSchema.optional(),
        production: environmentOverrideSchema.optional(),
      })
      .optional(),
    secrets: z
      .array(
        z
          .string()
          .regex(
            SECRET_NAME_REGEX,
            "secret names must be uppercase environment variable identifiers (e.g., 'API_KEY')",
          ),
      )
      .optional(),
    uptimeCheck: z.boolean().optional(),
    healthPath: z
      .string()
      .startsWith("/", "healthPath must start with leading slash '/'")
      .optional(),
    uptimePeriod: z
      .string()
      .regex(
        DURATION_REGEX,
        "uptimePeriod must be a duration string like '60s'",
      )
      .optional(),
    uptimeTimeout: z
      .string()
      .regex(
        DURATION_REGEX,
        "uptimeTimeout must be a duration string like '10s'",
      )
      .optional(),
  })
  .refine(
    (data) => {
      if (data.minInstances !== undefined && data.maxInstances !== undefined) {
        return data.minInstances <= data.maxInstances;
      }
      return true;
    },
    {
      message: "minInstances must be less than or equal to maxInstances",
      path: ["minInstances"],
    },
  );

export type InfraConfig = z.infer<typeof infraSchema>;

/**
 * Validates a parsed JSON manifest against the infra schema.
 */
export function validateInfraManifest(data: unknown): InfraConfig {
  return infraSchema.parse(data);
}
