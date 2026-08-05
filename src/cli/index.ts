import { createRequire } from "node:module";
import { Command, CommanderError } from "commander";
import { QTestError } from "../utils/errors.js";
import { createLogger } from "../utils/logger.js";
import { registerConfigCommand } from "./commands/config.js";
import { registerSyncCommand } from "./commands/sync.js";
import { registerUploadCommand } from "./commands/upload.js";

const logger = createLogger("cli");

const require = createRequire(import.meta.url);
const { version } = require("../../package.json") as { version: string };

export function buildProgram(): Command {
	const program = new Command();
	program
		.name("qtest-playwright")
		.description("Upload Playwright test results to qTest")
		.version(version);
	registerConfigCommand(program);
	registerSyncCommand(program);
	registerUploadCommand(program);
	return program;
}

export async function runCli(argv?: string[]): Promise<number> {
	const program = buildProgram().exitOverride();
	const from = argv === undefined ? "node" : "user";
	try {
		await program.parseAsync(argv ?? process.argv, { from });
		return 0;
	} catch (error) {
		if (error instanceof CommanderError) {
			return error.exitCode;
		}
		if (error instanceof QTestError) {
			logger.error(error.message);
			console.error(error.message);
		} else if (error instanceof Error) {
			logger.error(`unexpected error: ${error.message}`);
			console.error(`Unexpected error: ${error.message}`);
		} else {
			logger.error(`unexpected error: ${String(error)}`);
			console.error(`Unexpected error: ${String(error)}`);
		}
		return 1;
	}
}
