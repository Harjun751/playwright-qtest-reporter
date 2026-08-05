import log from "loglevel";

export function createLogger(module: string) {
	const logger = log.getLogger(module);

	return {
		setLevel: (level: string) => logger.setLevel(level as log.LogLevelDesc),
		getLevel: () => logger.getLevel(),
		debug: (...args: unknown[]) => logger.debug(`[${module}]`, ...args),
		info: (...args: unknown[]) => logger.info(`[${module}]`, ...args),
		warn: (...args: unknown[]) => logger.warn(`[${module}]`, ...args),
		error: (...args: unknown[]) => logger.error(`[${module}]`, ...args),
	};
}

export type Logger = ReturnType<typeof createLogger>;
