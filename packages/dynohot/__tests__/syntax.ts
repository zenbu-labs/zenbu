import { test } from "node:test";
import { SourceTextModule } from "node:vm";
import { transformModuleSource } from "#dynohot/loader/transform";

function transform(source: string) {
	return transformModuleSource("test.js", null, {}, source, null);
}

function parses(source: string) {
	const transformed = transform(source);
	// eslint-disable-next-line no-new
	new SourceTextModule(transformed);
}

await test("supports `using`", () => {
	transform("using foo = {}");
});

await test("supports export { value as 'string literal' }", () => {
	parses("const value = 0; export { value as 'string literal' };");
});

// Caused by broken specifier-to-identifier expression
await test("string literal imports don't collide", () => {
	parses(
		`import dash1 from '-';
		import dash2 from '-';
		import bang from '!';`);
});
