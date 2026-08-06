import type { Command } from "commander";
import { loadConfig } from "../../../config/loader.js";

export function registerConfigCommand(program: Command): void {
	const validate = program
		.command("config")
		.description("Inspect qTest configuration")
		.command("validate")
		.description("Validate configuration loaded from the environment");

	validate.action(() => {
		const config = loadConfig();
		const runId = config.runId === undefined ? "" : ` runId=${config.runId}`;
		console.log(
			`Configuration is valid: baseUrl=${config.baseUrl} projectId=${config.projectId} logLevel=${config.logLevel}${runId}`,
		);
	});
}
