import type { Command } from "commander";
import { loadConfig } from "../../../config/loader.js";
import { QTestClient } from "../../../core/qtest/client.js";
import { QTEST_ANNOTATION_TYPE } from "../../../core/qtest/constants.js";
import {
	createTestCase,
	listAllTestCases,
} from "../../../core/qtest/endpoints/cases.js";
import type { TestCase } from "../../../core/qtest/types.js";
import { createLogger } from "../../../utils/logger.js";
import { integerOption } from "../../helpers.js";
import { listPlaywrightTests, type SpecWithAnnotations } from "./discovery.js";

const logger = createLogger("cli/sync");

interface SyncCommandOptions {
	parentModule: number;
	dryRun?: boolean;
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
		const qtestAnn = spec.annotations.find(
			(a) => a.type === QTEST_ANNOTATION_TYPE,
		);
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
	const existing = await listAllTestCases(
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

// ── Output ───────────────────────────────────────────────────────────────────

function printTable(entries: TestEntry[]): void {
	for (const entry of entries) {
		console.log(
			`${entry.file}: ${entry.name} → ${entry.pid ?? "-"} (${entry.status})`,
		);
	}
}
