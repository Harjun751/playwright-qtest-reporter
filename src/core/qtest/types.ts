export type TestLogStatus =
	| "PASS"
	| "FAIL"
	| "INCOMPLETE"
	| "BLOCKED"
	| "SKIPPED";

export interface FieldValue {
	field_id: number;
	field_value: string | number;
}

export interface AutoTestLogAttachment {
	name: string;
	content_type: string;
	data?: string;
	web_url?: string;
}

export interface AutoTestLog {
	name: string;
	status: TestLogStatus;
	exe_start_date: string;
	exe_end_date: string;
	automation_content: string;
	note?: string;
	test_case_version_id?: number;
	module_names?: string[];
	attachments?: AutoTestLogAttachment[];
	properties?: FieldValue[];
}

export interface TestStep {
	description: string;
	expected: string;
	order: number;
}

export interface TestCase {
	name: string;
	pid?: number;
	description?: string;
	precondition?: string;
	automation_content?: string;
	order?: number;
	properties?: FieldValue[];
	test_steps?: TestStep[];
}
