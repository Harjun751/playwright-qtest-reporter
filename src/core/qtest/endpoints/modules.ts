import type { QTestClient } from "../client.js";
import type { Module } from "../types.js";

export interface ListModulesOptions {
	parentId?: number;
}

export async function listModules(
	client: QTestClient,
	projectId: number,
	options: ListModulesOptions = {},
): Promise<Module[]> {
	return client.get<Module[]>(`projects/${projectId}/modules`, {
		query: options,
	});
}
