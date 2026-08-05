import { readFileSync } from "node:fs";
import { type Command, InvalidArgumentError } from "commander";
import { loadConfig } from "../../config/loader.js";
import { QTestClient } from "../../core/qtest/client.js";
import { submitTestLogs, waitForJob } from "../../core/qtest/endpoints/runs.js";
import { mapReport } from "../../mapper/index.js";
import { parseJUnit } from "../../parser/junit.js";
import { createLogger } from "../../utils/logger.js";

const logger = createLogger("cli/upload");

interface UploadCommandOptions {
	testSuite?: number;
	parentModule?: number;
	wait?: boolean;
}

export function registerUploadCommand(program: Command): void {
	program
		.command("upload")
		.description("Upload a Playwright JUnit XML report to qTest")
		.argument("<file>", "Path to the JUnit XML report")
		.option(
			"--test-suite <id>",
			"qTest test suite ID to attach results to",
			integerOption,
		)
		.option(
			"--parent-module <id>",
			"qTest parent module ID to attach results to",
			integerOption,
		)
		.option("--no-wait", "Exit after submitting without polling for completion")
		.action(async (file: string, options: UploadCommandOptions) => {
			await executeUpload(file, options);
		});
}

async function executeUpload(
	file: string,
	options: UploadCommandOptions,
): Promise<void> {
	const config = loadConfig();

	let xml: string;
	try {
		logger.debug(`reading report: ${file}`);
		xml = readFileSync(file, "utf-8");
	} catch (error) {
		throw new Error(
			`Failed to read report file "${file}": ${(error as Error).message}`,
		);
	}

	const report = parseJUnit(xml);
	console.log(
		`Parsed ${report.tests} tests (${report.failures} failed, ${report.skipped} skipped) from ${report.suites.length} suite(s).`,
	);

	const request = mapReport(report);
	if (options.testSuite !== undefined) {
		request.test_suite = options.testSuite;
	}
	if (options.parentModule !== undefined) {
		request.parent_module = options.parentModule;
	}

	const client = new QTestClient({
		baseUrl: config.baseUrl,
		apiToken: config.apiToken,
	});

	console.log(`Submitting to qTest project ${config.projectId}...`);
	const { id, state } = await submitTestLogs(client, config.projectId, request);
	console.log(`Job queued: #${id} (state: ${state})`);

	if (options.wait === false) {
		console.log("Skipping wait (--no-wait requested).");
		return;
	}

	console.log(`Waiting for job #${id}...`);
	const result = await waitForJob(client, id);
	console.log(`Job #${id} completed: ${result.state}.`);
}

function integerOption(value: string): number {
	const parsed = Number(value);
	if (!Number.isInteger(parsed)) {
		throw new InvalidArgumentError(`expected an integer, got "${value}"`);
	}
	return parsed;
}
