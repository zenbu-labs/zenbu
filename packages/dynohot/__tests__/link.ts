/* eslint-disable @typescript-eslint/restrict-template-expressions */
import * as assert from "node:assert/strict";
import { test } from "node:test";
import { UpdateStatus } from "dynohot/runtime/controller";
import { TestAdapterModule, TestModule } from "./__fixtures__/module.js";

await test("as default", async () => {
	const main = new TestModule(() =>
		`import name from ${child};
		assert.strictEqual(name, "child");`);
	const child = new TestModule(() =>
		`const name = "child";
		export { name as default };`);
	await main.dispatch();
});

// Caused by a misreading of "16.2.1.5.3.1 InnerModuleEvaluation -> 16.b.i"
await test("circular evaluation order", async () => {
	const main: TestModule = new TestModule(() =>
		`import {} from ${first};
		import {} from ${second};
		globalThis.order += ";main";`);
	const first = new TestModule(() =>
		`import {} from ${main};
		globalThis.order += ";first";`);
	const second = new TestModule(() =>
		`import {} from ${first};
		globalThis.order += ";second";`);
	await main.dispatch();
	assert.strictEqual(main.global.order, "undefined;first;second;main");
});

// Caused due to invalid `relink` testing in the evaluation phase. We were relinking the module's
// previous body to try `accept` handlers which would cause a link error.
await test("link error is recoverable from parent", async () => {
	const main = new TestModule(() =>
		`import { symbol } from ${child};
		import.meta.hot.accept();`);
	const child = new TestModule(() =>
		"export const symbol = null;");
	await main.dispatch();
	child.update(() => "");
	const result = await main.releaseUpdate();
	assert.strictEqual(result?.type, UpdateStatus.linkError);
	main.update(() => `import {} from ${child};`);
	const result2 = await main.releaseUpdate();
	assert.strictEqual(result2?.type, UpdateStatus.success);
});

// I never got around to implementing the cyclic aggregate prevention clauses of the specification.
await test("infinite re-export", async () => {
	const main = new TestModule(() =>
		`import { symbol } from ${child};
		import.meta.hot.accept();`);
	const child: TestModule = new TestModule(() =>
		`export * from ${child};`);
	await assert.rejects(main.dispatch(), SyntaxError);
});

await test("circular indirect export", async () => {
	const main = new TestModule(() =>
		`import { name, indirect } from ${circular};`);
	const circular: TestModule = new TestModule(() =>
		`export { name as indirect } from ${circular};
		export const name = null;`);
	await main.dispatch();
});

// Babel checks this for us
await test("duplicate named export", async () => {
	const main = new TestModule(() =>
		`export const name = 1;
		export const name = 2`);
	await assert.rejects(main.dispatch(), SyntaxError);
});

// Caused by combining the link + evaluation phases into a single yield
await test("hoisted functions run correctly", async () => {
	const main: TestModule = new TestModule(() =>
		`import { value } from ${child};
		export function hoisted() { value; }`);
	const child = new TestModule(() =>
		`import { hoisted } from ${main};
		export const value = 1;
		hoisted();`);
	await main.dispatch();
});

await test("concurrent cyclic top-level await", async () => {
	const main = new TestModule(() =>
		`import {} from ${left};
		import {} from ${right};
		import.meta.hot.accept();`);
	const left: TestModule = new TestModule(() =>
		`import { async } from ${async};
		import {} from ${right};
		await async();`);
	const right = new TestModule(() =>
		`import { async } from ${async};
		import {} from ${left};
		await async();`);
	const async = new TestModule(() =>
		`let resolve;
		let ii = 0;
		const promise = new Promise(fulfill => resolve = fulfill);
		export function async() {
			if (++ii === 2) {
				resolve();
			}
			return promise;
		}`);
	await main.dispatch();
	async.update();
	const result = await main.releaseUpdate();
	assert.strictEqual(result?.type, UpdateStatus.success);
});

// Caused by incorrect optimization of `resolveSet`
await test("exported named module namespace", async () => {
	const main = new TestModule(() =>
		`import { ns } from ${nsExport};`);
	const nsExport = new TestModule(() =>
		`export * as ns from ${indirectExport}`);
	const indirectExport = new TestModule(() =>
		`export { name } from ${child}`);
	const child = new TestModule(() =>
		"export const name = null;");
	await main.dispatch();
});

// `ReloadableModuleController.dispatch` did not await existing capability if already running
await test("the halting problem", async () => {
	const main: TestModule = new TestModule(() => `await import(${main});`);
	const execution = Promise.race([
		main.dispatch(),
		new Promise(resolve => {
			setTimeout(() => resolve(123), 0);
		}),
	]);
	const result = await execution;
	assert.strictEqual(result, 123);
});

// `ReloadableModuleController.dispatch` did not await existing capability if already running
await test("hoisted function with dynamic import", async () => {
	const main: TestModule = new TestModule(() =>
		`import {} from ${first};
		export function fn() {
			import(${extra});
		}`);
	const first = new TestModule(() =>
		`import { fn } from ${main};
		await fn();`);
	const extra = new TestModule(() => "");
	await main.dispatch();
});

await test("re-export from adapter module", async () => {
	const adapter = new TestAdapterModule({
		default: "default",
		identifier: "hello world",
	});
	const utility = new TestModule(() =>
		`export * from ${adapter}`);
	const main = new TestModule(() =>
		`import * as utility from ${utility};
		assert.strictEqual(utility.default, undefined);
		assert.strictEqual(utility.identifier, "hello world");`);
	await main.dispatch();
});

await test("explicit shadowed export", async () => {
	const one = new TestModule(() =>
		"export const id = 1;");
	const two = new TestModule(() =>
		`export * from ${one};
		export const id = 2;`);
	const main = new TestModule(() =>
		`import * as utility from ${two};
		assert.strictEqual(utility.id, 2);`);
	await main.dispatch();
});

await test("duplicate re-export", async () => {
	const dep = new TestModule(() =>
		"export const id = 1;");
	const barrel = new TestModule(() =>
		`export { id, id } from ${dep};`);
	await assert.rejects(() => barrel.dispatch());
});

await test("named export of module namespace", async () => {
	const one = new TestModule(() =>
		"export const id = 1;");
	const two = new TestModule(() =>
		`import * as ns from ${one};
		export { ns };`);
	const main = new TestModule(() =>
		`import * as two from ${two};
		assert.strictEqual(two.ns.id, 1);`);
	await main.dispatch();
});
