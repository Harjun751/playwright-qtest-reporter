import type { z } from "zod";
import { readEnvBool, readEnvId } from "../utils/env.js";
import { ConfigError } from "../utils/errors.js";
import { createLogger } from "../utils/logger.js";
import { DEFAULTS } from "./defaults.js";
import {
	type QTestConfig,
	QTestConfigSchema,
	type QTestReporterOptions,
	QTestReporterOptionsSchema,
} from "./schema.js";

const ENV_MAP = {
	QTEST_BASE_URL: "baseUrl",
	QTEST_API_TOKEN: "apiToken",
	QTEST_PROJECT_ID: "projectId",
	QTEST_LOG_LEVEL: "logLevel",
	QTEST_MAX_ATTACHMENT_SIZE: "maxAttachmentSize",
	QTEST_TEST_SUITE_ID: "testSuiteId",
	QTEST_PARENT_MODULE_ID: "parentModuleId",
	QTEST_WAIT: "wait",
	QTEST_SKIP_AUTOMATION_MODULE: "skipAutomationModule",
} as const;

const BOOLEAN_OPTION_FIELDS = new Set<string>(["wait", "skipAutomationModule"]);

export function loadConfig(): QTestConfig {
	const logger = createLogger("config/loader");

	const merged = {
		...DEFAULTS,
		...fromEnv(process.env),
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

export function loadReporterOptionsFromEnvironment(): QTestReporterOptions {
	const result = QTestReporterOptionsSchema.safeParse(fromEnv(process.env));
	if (!result.success) {
		throw new ConfigError(
			`Invalid reporter options: ${formatZodIssues(result.error.issues)}`,
		);
	}
	return result.data;
}

function fromEnv(env: NodeJS.ProcessEnv): Record<string, unknown> {
	const config: Record<string, unknown> = {};
	for (const [key, field] of Object.entries(ENV_MAP)) {
		const raw = env[key];
		if (raw === undefined || raw.trim() === "") {
			continue;
		}
		const value = parseValue(field, env, key);
		if (value !== undefined) {
			config[field] = value;
		}
	}
	return config;
}

function parseValue(
	field: string,
	env: NodeJS.ProcessEnv,
	key: string,
): unknown {
	if (BOOLEAN_OPTION_FIELDS.has(field)) {
		return readEnvBool(env, key);
	}
	if (field === "testSuiteId") {
		return readEnvId(env, key, "TS");
	}
	if (field === "parentModuleId") {
		return readEnvId(env, key, "MD");
	}
	return env[key];
}

function formatZodIssues(issues: z.ZodIssue[]): string {
	return issues
		.map((issue) => `${issue.path.join(".") || "<root>"}: ${issue.message}`)
		.join("; ");
}
