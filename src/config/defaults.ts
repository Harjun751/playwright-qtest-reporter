export const DEFAULT_MAX_ATTACHMENT_SIZE = 10 * 1024 * 1024;

export const DEFAULTS = {
	baseUrl: "https://qtest.tricentis.com",
	logLevel: "info",
	maxAttachmentSize: DEFAULT_MAX_ATTACHMENT_SIZE,
} as const;
