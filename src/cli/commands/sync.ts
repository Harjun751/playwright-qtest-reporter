import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import type { Command } from "commander";
import { z } from "zod";
import { loadConfig } from "../../config/loader.js";
import { QTestClient } from "../../core/qtest/client.js";
import {
	createTestCase,
	type ListTestCasesOptions,
	listTestCases,
} from "../../core/qtest/endpoints/cases.js";
import type { TestCase } from "../../core/qtest/types.js";
import { createLogger } from "../../utils/logger.js";

const logger = createLogger("cli/sync");

interface SyncCommandOptions {
	parentModule: number;
	dryRun?: boolean;
}

interface SpecEntry {
	file: string;
	title: string;
}

interface TestEntry {
	file: string;
	name: string;
	pid?: string;
	status: "existing" | "new";
}

export function registerSyncCommand(program: Command): void {
	program
		.command("sync")
		.description("Sync Playwright test cases to qTest Test Design")
		.requiredOption(
			"--parent-module <id>",
			"qTest module ID to create test cases under",
			integerOption,
		)
		.option("--dry-run", "Preview changes without creating test cases")
		.action(async (options: SyncCommandOptions) => {
			await executeSync(options);
		});
}

async function executeSync(options: SyncCommandOptions): Promise<void> {
	const config = loadConfig();
	const specs = listPlaywrightTests();
	if (specs.length === 0) {
		console.log("No tests found. Run npx playwright test --list to verify.");
		return;
	}
	logger.debug(`discovered ${specs.length} unique spec(s)`);

	const { entries } = classifySpecs(specs);
	const unlinked = entries.filter((e) => e.status === "new");
	logger.debug(
		`classified: ${entries.length - unlinked.length} linked, ${unlinked.length} unlinked`,
	);

	if (unlinked.length > 0) {
		const client = new QTestClient({
			baseUrl: config.baseUrl,
			apiToken: config.apiToken,
		});
		await syncUnlinked(client, unlinked, config.projectId, options);
	}

	printTable(entries);

	const linked = entries.filter((e) => e.status === "existing").length;
	const created = entries.filter((e) => e.status === "new").length;
	const prefix = options.dryRun ? "[dry-run] " : "";
	console.log(
		`${prefix}Test Design synchronized: ${linked} linked, ${created} ${options.dryRun ? "to create" : "created"}.`,
	);
}

function classifySpecs(specs: SpecWithAnnotations[]): { entries: TestEntry[] } {
	const entries: TestEntry[] = [];

	for (const spec of specs) {
		const entry: TestEntry = {
			file: spec.file,
			name: spec.title,
			status: "new",
		};
		const qtestAnn = spec.annotations.find((a) => a.type === "qtest");
		if (qtestAnn?.description !== undefined) {
			entry.status = "existing";
			entry.pid = qtestAnn.description;
		}
		entries.push(entry);
	}

	return { entries };
}

async function syncUnlinked(
	client: QTestClient,
	unlinked: TestEntry[],
	projectId: number,
	options: SyncCommandOptions,
): Promise<void> {
	const existing = await fetchAllTestCases(
		client,
		projectId,
		options.parentModule,
	);
	logger.debug(
		`existing test cases under module ${options.parentModule}: ${existing.length}`,
	);

	const existingByName = new Map<string, TestCase>();
	for (const tc of existing) {
		existingByName.set(tc.name, tc);
	}

	for (const entry of unlinked) {
		const match = existingByName.get(entry.name);
		if (match !== undefined) {
			entry.status = "existing";
			const pid = extractPid(match);
			if (pid !== undefined) {
				entry.pid = pid;
			}
			logger.debug(`matched "${entry.name}" to ${entry.pid ?? "unknown"}`);
		} else if (!options.dryRun) {
			const created = await createTestCase(client, projectId, {
				name: entry.name,
				parent_id: options.parentModule,
			});
			const pid = extractPid(created);
			if (pid !== undefined) {
				entry.pid = pid;
			}
			logger.debug(`created "${entry.name}" → ${pid ?? "unknown"}`);
		}
	}
}

function extractPid(tc: { pid?: string; id?: number }): string | undefined {
	return tc.pid ?? (tc.id !== undefined ? String(tc.id) : undefined);
}

// ── Playwright test discovery ────────────────────────────────────────────────

type AnnotationEntry = z.output<typeof AnnotationSchema>;

interface SpecWithAnnotations extends SpecEntry {
	annotations: AnnotationEntry[];
}

const AnnotationSchema = z.object({
	type: z.string(),
	description: z.string().optional(),
});

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

function listPlaywrightTests(): SpecWithAnnotations[] {
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

// ── Output ───────────────────────────────────────────────────────────────────

function printTable(entries: TestEntry[]): void {
	for (const entry of entries) {
		console.log(
			`${entry.file}: ${entry.name} → ${entry.pid ?? "-"} (${entry.status})`,
		);
	}
}

// ── qTest API helpers ────────────────────────────────────────────────────────

async function fetchAllTestCases(
	client: QTestClient,
	projectId: number,
	parentId: number,
): Promise<TestCase[]> {
	const all: TestCase[] = [];
	let page = 1;
	const size = 100;
	while (true) {
		const options: ListTestCasesOptions = { parentId, page, size };
		const pageResult = await listTestCases(client, projectId, options);
		const items = Array.isArray(pageResult) ? pageResult : pageResult.items;
		all.push(...items);
		if (Array.isArray(pageResult) || items.length < size) {
			break;
		}
		page++;
	}
	return all;
}

// ── CLI helpers ──────────────────────────────────────────────────────────────

function integerOption(value: string): number {
	const parsed = Number(value);
	if (!Number.isInteger(parsed)) {
		throw new Error(`expected an integer, got "${value}"`);
	}
	return parsed;
}
