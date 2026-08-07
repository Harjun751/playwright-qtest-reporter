import type { z } from "zod";
import { ConfigError } from "../utils/errors.js";
import { createLogger } from "../utils/logger.js";
import { DEFAULTS } from "./defaults.js";
import { type QTestConfig, QTestConfigSchema } from "./schema.js";

const ENV_MAP = {
	QTEST_BASE_URL: "baseUrl",
	QTEST_API_TOKEN: "apiToken",
	QTEST_PROJECT_ID: "projectId",
	QTEST_LOG_LEVEL: "logLevel",
	QTEST_MAX_ATTACHMENT_SIZE: "maxAttachmentSize",
} as const;

export interface LoadConfigOptions {
	overrides?: Record<string, unknown>;
	env?: NodeJS.ProcessEnv;
}

export function loadConfig(options: LoadConfigOptions = {}): QTestConfig {
	const logger = createLogger("config/loader");
	const env = options.env ?? process.env;

	const merged = {
		...DEFAULTS,
		...fromEnv(env),
		...options.overrides,
	};

	const result = QTestConfigSchema.safeParse(merged);
	if (!result.success) {
		throw new ConfigError(
			`Invalid configuration: ${formatZodIssues(result.error.issues)}`,
		);
	}

	logger.debug(
		"config loaded",
		`baseUrl=${result.data.baseUrl} projectId=${result.data.projectId}`,
	);

	return result.data;
}

function fromEnv(env: NodeJS.ProcessEnv): Record<string, unknown> {
	const config: Record<string, unknown> = {};
	for (const [key, field] of Object.entries(ENV_MAP)) {
		const value = env[key];
		if (value !== undefined && value.trim() !== "") {
			config[field] = value;
		}
	}
	return config;
}

function formatZodIssues(issues: z.ZodIssue[]): string {
	return issues
		.map((issue) => `${issue.path.join(".") || "<root>"}: ${issue.message}`)
		.join("; ");
}
