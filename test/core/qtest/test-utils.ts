import {
	QTestClient,
	type QTestClientOptions,
} from "@src/core/qtest/client.js";

export function jsonResponse(status: number, body: unknown): Response {
	return new Response(JSON.stringify(body), {
		status,
		headers: { "Content-Type": "application/json" },
	});
}

export function makeClient(
	fetchImpl: typeof fetch,
	overrides: Partial<QTestClientOptions> = {},
): QTestClient {
	return new QTestClient({
		baseUrl: "https://qtest.example.com",
		apiToken: "secret",
		fetch: fetchImpl,
		maxRetries: 1,
		retryDelayMs: 0,
		...overrides,
	});
}
