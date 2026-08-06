import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { z } from "zod";
import { createLogger } from "../../../utils/logger.js";

const logger = createLogger("cli/discovery");

export interface SpecEntry {
	file: string;
	title: string;
}

const AnnotationSchema = z.object({
	type: z.string(),
	description: z.string().optional(),
});

type AnnotationEntry = z.output<typeof AnnotationSchema>;

export interface SpecWithAnnotations extends SpecEntry {
	annotations: AnnotationEntry[];
}

const ListReportSchema = z.object({
	suites: z
		.array(
			z.object({
				file: z.string(),
				specs: z
					.array(
						z.object({
							title: z.string(),
							file: z.string(),
							tests: z
								.array(
									z.object({
										annotations: z.array(AnnotationSchema).optional(),
									}),
								)
								.optional(),
						}),
					)
					.optional(),
			}),
		)
		.optional(),
});

export function listPlaywrightTests(): SpecWithAnnotations[] {
	const cwd = process.cwd();
	const require = createRequire(import.meta.url);
	const playwrightCli = require.resolve("@playwright/test/cli", {
		paths: [cwd],
	});
	logger.debug(`playwright CLI: ${playwrightCli}, cwd: ${cwd}`);

	const spawnResult = spawnSync(
		process.execPath,
		[playwrightCli, "test", "--list", "--reporter=json"],
		{ encoding: "utf-8", cwd },
	);

	if (spawnResult.status !== 0) {
		throw new Error(
			`playwright --list failed: ${spawnResult.stderr || spawnResult.stdout || "unknown error"}`,
		);
	}

	// stdout may contain preamble from dotenv or other tools
	const output = spawnResult.stdout;
	const lines = output.split("\n");
	const jsonStart = lines.findIndex((line) => line.trimStart().startsWith("{"));
	const jsonText = jsonStart >= 0 ? lines.slice(jsonStart).join("\n") : output;

	let json: unknown;
	try {
		json = JSON.parse(jsonText);
	} catch {
		throw new Error(
			"Failed to parse playwright --list output as JSON. Ensure @playwright/test is installed.",
		);
	}

	const result = ListReportSchema.safeParse(json);
	if (!result.success) {
		throw new Error(
			`Unexpected playwright --list output format: ${result.error.message}`,
		);
	}

	const seen = new Set<string>();
	const results: SpecWithAnnotations[] = [];

	for (const suite of result.data.suites ?? []) {
		for (const spec of suite.specs ?? []) {
			const key = `${spec.file}:${spec.title}`;
			if (seen.has(key)) {
				continue;
			}
			seen.add(key);
			results.push({
				file: spec.file,
				title: spec.title,
				annotations: spec.tests?.[0]?.annotations ?? [],
			});
		}
	}

	return results;
}
