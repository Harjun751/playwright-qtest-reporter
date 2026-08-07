import { z } from "zod";
import { DEFAULTS } from "./defaults.js";

const TEST_SUITE_ID = z
	.union([z.coerce.number().int().positive(), z.string().regex(/^TS-\d+$/i)])
	.optional();
const PARENT_MODULE_ID = z
	.union([z.coerce.number().int().positive(), z.string().regex(/^MD-\d+$/i)])
	.optional();

export const QTestReporterOptionsSchema = z.object({
	testSuiteId: TEST_SUITE_ID,
	parentModuleId: PARENT_MODULE_ID,
	wait: z.boolean().optional(),
	skipAutomationModule: z.boolean().optional(),
});

export type QTestReporterOptions = z.infer<typeof QTestReporterOptionsSchema>;

export const QTestConfigSchema = z
	.object({
		baseUrl: z.url().default(DEFAULTS.baseUrl),
		apiToken: z.string().min(1),
		projectId: z.coerce.number().int().positive(),
		logLevel: z
			.enum(["trace", "debug", "info", "warn", "error", "silent"])
			.default(DEFAULTS.logLevel),
		maxAttachmentSize: z.coerce
			.number()
			.int()
			.positive()
			.default(DEFAULTS.maxAttachmentSize),
	})
	.merge(QTestReporterOptionsSchema);

export type QTestConfig = z.infer<typeof QTestConfigSchema>;
