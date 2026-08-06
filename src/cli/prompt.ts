import { select } from "@inquirer/prompts";
import type { QTestClient } from "../core/qtest/client.js";
import { listModules } from "../core/qtest/endpoints/modules.js";
import { createLogger } from "../utils/logger.js";

const logger = createLogger("cli/prompt");

export async function promptForModule(
	client: QTestClient,
	projectId: number,
): Promise<number> {
	const modules = await listModules(client, projectId);
	logger.debug(`fetched ${modules.length} module(s)`);

	if (modules.length === 0) {
		throw new Error("No modules found in the project");
	}

	const selected = await select({
		message: "Select a qTest module to sync into:",
		choices: modules.map((module) => ({
			name:
				module.pid !== undefined
					? `${module.name} (${module.pid})`
					: module.name,
			value: module.id,
		})),
	});
	return selected;
}
