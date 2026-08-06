import type { QTestClient } from "../client.js";
import type { PagedResource, TestCase } from "../types.js";

export async function createTestCase(
	client: QTestClient,
	projectId: number,
	testCase: TestCase,
): Promise<TestCase> {
	return client.post<TestCase>(`projects/${projectId}/test-cases`, {
		body: testCase,
	});
}

export interface GetTestCaseOptions {
	expand?: "teststep";
}

export async function getTestCase(
	client: QTestClient,
	projectId: number,
	testCaseId: number,
	options: GetTestCaseOptions = {},
): Promise<TestCase> {
	return client.get<TestCase>(
		`projects/${projectId}/test-cases/${testCaseId}`,
		{
			query: options,
		},
	);
}

export interface ListTestCasesOptions {
	parentId?: number;
	page?: number;
	size?: number;
	expandProps?: boolean;
	expandSteps?: boolean;
}

export async function listTestCases(
	client: QTestClient,
	projectId: number,
	options: ListTestCasesOptions = {},
): Promise<PagedResource<TestCase>> {
	return client.get<PagedResource<TestCase>>(
		`projects/${projectId}/test-cases`,
		{
			query: options,
		},
	);
}

export async function updateTestCase(
	client: QTestClient,
	projectId: number,
	testCaseId: number,
	testCase: TestCase,
): Promise<TestCase> {
	return client.put<TestCase>(
		`projects/${projectId}/test-cases/${testCaseId}`,
		{
			body: testCase,
		},
	);
}

export async function deleteTestCase(
	client: QTestClient,
	projectId: number,
	testCaseId: number,
): Promise<void> {
	return client.delete<void>(`projects/${projectId}/test-cases/${testCaseId}`);
}
