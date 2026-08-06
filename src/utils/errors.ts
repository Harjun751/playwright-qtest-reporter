export class QTestError extends Error {
	constructor(
		public readonly code: string,
		message: string,
		options?: ErrorOptions,
	) {
		super(message, options);
		this.name = "QTestError";
	}
}

export class AuthError extends QTestError {
	constructor(message: string, options?: ErrorOptions) {
		super("AUTH_ERROR", message, options);
		this.name = "AuthError";
	}
}

export class ApiError extends QTestError {
	constructor(
		message: string,
		public readonly statusCode: number,
		public readonly responseBody?: unknown,
		options?: ErrorOptions,
	) {
		super("API_ERROR", message, options);
		this.name = "ApiError";
	}
}

export class ConfigError extends QTestError {
	constructor(message: string, options?: ErrorOptions) {
		super("CONFIG_ERROR", message, options);
		this.name = "ConfigError";
	}
}
