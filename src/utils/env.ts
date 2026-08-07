export function readEnvNumber(
	env: NodeJS.ProcessEnv,
	key: string,
): number | undefined {
	const raw = env[key];
	if (raw === undefined || raw.trim() === "") {
		return undefined;
	}
	const parsed = Number(raw);
	if (!Number.isInteger(parsed) || parsed <= 0) {
		return undefined;
	}
	return parsed;
}

export function readEnvId(
	env: NodeJS.ProcessEnv,
	key: string,
	prefix?: string,
): number | string | undefined {
	const raw = env[key]?.trim();
	if (raw === undefined || raw === "") {
		return undefined;
	}

	const parsed = Number(raw);
	if (Number.isInteger(parsed) && parsed > 0) {
		return parsed;
	}

	if (prefix !== undefined && raw.toUpperCase().startsWith(`${prefix}-`)) {
		const suffix = raw.slice(prefix.length + 1);
		if (Number.isInteger(Number(suffix)) && Number(suffix) > 0) {
			return raw;
		}
	}

	return undefined;
}

export function readEnvBool(
	env: NodeJS.ProcessEnv,
	key: string,
): boolean | undefined {
	const raw = env[key]?.trim().toLowerCase();
	if (raw === undefined || raw === "") {
		return undefined;
	}
	if (raw === "true" || raw === "1") {
		return true;
	}
	if (raw === "false" || raw === "0") {
		return false;
	}
	return undefined;
}
