import { ApiError, AuthError, QTestError } from "../../utils/errors.js";
import { createLogger } from "../../utils/logger.js";

const API_BASE = "/api";

const RETRYABLE_STATUSES = new Set([429, 500, 502, 503, 504]);

export interface QTestClientOptions {
	baseUrl: string;
	apiToken: string;
	fetch?: typeof fetch;
	maxRetries?: number;
	retryDelayMs?: number;
}

export interface RequestOptions {
	method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
	version?: "v3" | "v3.1";
	body?: unknown;
	bodyType?: "json" | "form";
	query?: object;
	headers?: Record<string, string>;
}

export class QTestClient {
	private readonly logger = createLogger("qtest/client");
	private readonly baseUrl: string;
	private readonly apiToken: string;
	private readonly fetchImpl: typeof fetch;
	private readonly maxRetries: number;
	private readonly retryDelayMs: number;

	constructor(options: QTestClientOptions) {
		this.baseUrl = options.baseUrl.replace(/\/+$/, "");
		this.apiToken = options.apiToken;
		this.fetchImpl = options.fetch ?? globalThis.fetch;
		this.maxRetries = options.maxRetries ?? 3;
		this.retryDelayMs = options.retryDelayMs ?? 500;
	}

	async request<T>(path: string, options: RequestOptions = {}): Promise<T> {
		const url = this.buildUrl(path, options);
		const headers = this.buildHeaders(options);
		const method = options.method ?? "GET";
		const body = this.buildBody(options);
		const init: RequestInit = { method, headers };
		if (body !== undefined) {
			init.body = body;
		}

		this.logger.debug(`>> ${method} ${url}${body ? " (body)" : ""}`);

		let lastError: unknown;
		for (let attempt = 0; attempt < this.maxRetries; attempt++) {
			const isLastAttempt = attempt === this.maxRetries - 1;
			try {
				const response = await this.fetchImpl(url, init);
				const parsed = await this.parseBody(response);
				if (response.ok) {
					this.logger.debug(`${method} ${url} -> ${response.status}`);
					return parsed as T;
				}
				if (response.status === 401) {
					throw new AuthError(
						`qTest API rejected the bearer token (401 for ${url})`,
					);
				}
				this.logger.debug(`<< ${response.status}`, parsed);
				const apiError = new ApiError(
					`qTest API request failed (${response.status}) for ${url}`,
					response.status,
					parsed,
				);
				if (!isLastAttempt && RETRYABLE_STATUSES.has(response.status)) {
					lastError = apiError;
					await this.backoff(attempt);
					continue;
				}
				throw apiError;
			} catch (error) {
				if (error instanceof AuthError || error instanceof ApiError) {
					throw error;
				}
				lastError = error;
				if (!isLastAttempt) {
					await this.backoff(attempt);
					continue;
				}
				throw new QTestError(
					"NETWORK_ERROR",
					`Request to qTest failed: ${(error as Error).message}`,
				);
			}
		}
		throw lastError;
	}

	get<T>(
		path: string,
		options: Omit<RequestOptions, "method"> = {},
	): Promise<T> {
		return this.request<T>(path, { ...options, method: "GET" });
	}

	post<T>(
		path: string,
		options: Omit<RequestOptions, "method"> = {},
	): Promise<T> {
		return this.request<T>(path, { ...options, method: "POST" });
	}

	put<T>(
		path: string,
		options: Omit<RequestOptions, "method"> = {},
	): Promise<T> {
		return this.request<T>(path, { ...options, method: "PUT" });
	}

	delete<T>(
		path: string,
		options: Omit<RequestOptions, "method"> = {},
	): Promise<T> {
		return this.request<T>(path, { ...options, method: "DELETE" });
	}

	private buildUrl(path: string, options: RequestOptions): string {
		const version = options.version ?? "v3";
		const url = new URL(`${this.baseUrl}${API_BASE}/${version}/${path}`);
		if (options.query) {
			for (const [key, value] of Object.entries(options.query)) {
				if (value !== undefined) {
					url.searchParams.set(key, String(value));
				}
			}
		}
		return url.toString();
	}

	private buildHeaders(options: RequestOptions): Record<string, string> {
		const headers: Record<string, string> = {
			Authorization: `bearer ${this.apiToken}`,
			...options.headers,
		};
		if (options.body !== undefined && options.bodyType !== "form") {
			headers["Content-Type"] = "application/json";
		}
		return headers;
	}

	private buildBody(options: RequestOptions): string | FormData | undefined {
		if (options.body === undefined) {
			return undefined;
		}
		if (options.bodyType === "form") {
			return options.body as FormData;
		}
		return JSON.stringify(options.body);
	}

	private async parseBody(response: Response): Promise<unknown> {
		const text = await response.text();
		if (text === "") {
			return undefined;
		}
		try {
			return JSON.parse(text);
		} catch {
			return text;
		}
	}

	private async backoff(attempt: number): Promise<void> {
		const delay = this.retryDelayMs * 2 ** attempt;
		this.logger.warn(`retrying request after ${delay}ms`);
		await new Promise((resolve) => setTimeout(resolve, delay));
	}
}
