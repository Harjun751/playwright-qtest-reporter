import { z } from "zod";
import { DEFAULTS } from "./defaults.js";

export const QTestConfigSchema = z.object({
	baseUrl: z.url().default(DEFAULTS.baseUrl),
	apiToken: z.string().min(1),
	projectId: z.coerce.number().int().positive(),
	logLevel: z
		.enum(["trace", "debug", "info", "warn", "error", "silent"])
		.default(DEFAULTS.logLevel),
	runId: z.coerce.number().int().positive().optional(),
});

export type QTestConfig = z.infer<typeof QTestConfigSchema>;
