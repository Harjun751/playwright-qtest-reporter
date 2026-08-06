import { select } from "@inquirer/prompts";
import type { QTestClient } from "../core/qtest/client.js";
import { listModules } from "../core/qtest/endpoints/modules.js";
import type { Module } from "../core/qtest/types.js";
import { createLogger } from "../utils/logger.js";

const logger = createLogger("cli/prompt");

export async function promptForModule(
	client: QTestClient,
	projectId: number,
): Promise<number> {
	const modules = await listModules(client, projectId);
	logger.debug(`fetched ${modules.length} module(s)`);
	return promptForSelection(
		modules,
		"Select a qTest module to sync into:",
		"No modules found in the project",
	);
}

function promptForSelection(
	items: Module[],
	message: string,
	emptyMessage: string,
): Promise<number> {
	if (items.length === 0) {
		throw new Error(emptyMessage);
	}

	return select({
		message,
		choices: items.map((item) => ({
			name: item.pid !== undefined ? `${item.name} (${item.pid})` : item.name,
			value: item.id,
		})),
	});
}
