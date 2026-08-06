import { InvalidArgumentError } from "commander";

export function integerOption(value: string): number {
	const parsed = Number(value);
	if (!Number.isInteger(parsed)) {
		throw new InvalidArgumentError(`expected an integer, got "${value}"`);
	}
	return parsed;
}
