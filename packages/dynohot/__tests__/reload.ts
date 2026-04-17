/* eslint-disable @typescript-eslint/restrict-template-expressions */
import * as assert from "node:assert/strict";
import { test } from "node:test";
import { UpdateStatus } from "dynohot/runtime/controller";
import { TestModule } from "./__fixtures__/module.js";

await test("simple test", async () => {
	const main = new TestModule(() =>
		`import { counter } from ${child};
		if (globalThis.seen) {
			assert.strictEqual(counter, 2);
			globalThis.seen2 = true;
		} else {
			assert.strictEqual(counter, 1);
			globalThis.seen = true;
		}
		import.meta.hot.accept();`);
	const child = new TestModule(() =>
		"export const counter = 1;");
	await main.dispatch();
	child.update(() =>
		"export const counter = 2;");
	const result = await main.releaseUpdate();
	assert.strictEqual(result?.type, UpdateStatus.success);
	assert.strictEqual(main.global.seen2, true);
});

await test("unaccepted should not run", async () => {
	const main = new TestModule(() =>
		`import {} from ${child};
		assert.strictEqual(globalThis.seen, undefined);
		globalThis.seen = true;`);
	const child = new TestModule(() => "");
	await main.dispatch();
	child.update(() => "");
	const result = await main.releaseUpdate();
	assert.strictEqual(result?.type, UpdateStatus.unaccepted);
});

await test("accepted with unupdated accepted", async () => {
	const main = new TestModule(() =>
		`import {} from ${updated};
		import {} from ${unupdated};
		import.meta.hot.accept([ ${updated}, ${unupdated} ]);
		assert.strictEqual(globalThis.seen, undefined);
		globalThis.seen = true;`);
	const unupdated = new TestModule(() => "");
	const updated = new TestModule(() => "");
	await main.dispatch();
	updated.update(() => "");
	const result = await main.releaseUpdate();
	assert.strictEqual(result?.type, UpdateStatus.success);
});

await test("unaccepted dynamic should not run", async () => {
	const main = new TestModule(() =>
		`await import(${child});
		assert.strictEqual(globalThis.seen, undefined);
		globalThis.seen = true;`);
	const child = new TestModule(() => "");
	await main.dispatch();
	child.update(() => "");
	const result = await main.releaseUpdate();
	assert.strictEqual(result?.type, UpdateStatus.unaccepted);
});

await test("accepted dynamic", async () => {
	const main = new TestModule(() =>
		`const { counter } = await import(${child});
		assert.strictEqual(counter, 1);
		assert.strictEqual(globalThis.seen, undefined);
		globalThis.seen = true;
		import.meta.hot.accept(${child}, async () => {
			const { counter } = await import(${child});
			assert.strictEqual(counter, 2);
			globalThis.seen2 = true;
		});`);
	const child = new TestModule(() => "export const counter = 1;");
	await main.dispatch();
	child.update(() => "export const counter = 2;");
	const result = await main.releaseUpdate();
	assert.strictEqual(result?.type, UpdateStatus.success);
	assert.strictEqual(main.global.seen2, true);
});

await test("unchanged declined import", async () => {
	const main = new TestModule(() =>
		`import {} from ${accepted};
		import {} from ${declined};
		import.meta.hot.accept(${accepted});`);
	const accepted = new TestModule(() => "");
	const declined = new TestModule(() =>
		"import.meta.hot.decline();");
	await main.dispatch();
	accepted.update(() => "");
	const result = await main.releaseUpdate();
	assert.strictEqual(result?.type, UpdateStatus.success);
});

await test("declined with accept import", async () => {
	const main = new TestModule(() =>
		`import {} from ${declined};`);
	const accepted = new TestModule(() => "");
	const declined = new TestModule(() =>
		`import {} from ${accepted};
		import.meta.hot.accept(${accepted});
		import.meta.hot.decline();`);
	await main.dispatch();
	accepted.update(() => "");
	const result = await main.releaseUpdate();
	assert.strictEqual(result?.type, UpdateStatus.success);
});

await test("errors are recoverable", async () => {
	const main = new TestModule(() =>
		`import { counter } from ${accepted};
		import.meta.hot.accept(${accepted}, () => {
			assert.strictEqual(globalThis.seen, undefined);
			globalThis.seen = true;
		});`);
	const accepted = new TestModule(() =>
		"export const counter = 1;");
	await main.dispatch();
	accepted.update(() =>
		`export const counter = 2;
			throw new Error();`);
	const result = await main.releaseUpdate();
	assert.strictEqual(result?.type, UpdateStatus.evaluationFailure);
	accepted.update(() =>
		"export const counter = 3;");
	const result2 = await main.releaseUpdate();
	assert.strictEqual(result2?.type, UpdateStatus.success);
	assert.strictEqual(main.global.seen, true);
});

await test("errors persist", async () => {
	const main = new TestModule(() =>
		`import {} from ${error};
		import.meta.hot.accept();`);
	const error = new TestModule(() => "");
	await main.dispatch();
	error.update(() =>
		"throw new Error();");
	const result = await main.releaseUpdate();
	assert.strictEqual(result?.type, UpdateStatus.evaluationFailure);
	main.update();
	const result2 = await main.releaseUpdate();
	assert.strictEqual(result2?.type, UpdateStatus.evaluationFailure);
	error.update(() => "");
	const result3 = await main.releaseUpdate();
	assert.strictEqual(result3?.type, UpdateStatus.success);
});

// Caused due to issue in `traverseDepthFirst` result collection
await test("common dependency", async () => {
	const main = new TestModule(() =>
		`import {} from ${left};
		import {} from ${right};
		import.meta.hot.accept(${left});`);
	const left = new TestModule(() =>
		`import {} from ${child}`);
	const right = new TestModule(() =>
		`import {} from ${child}`);
	const child = new TestModule(() => "");
	await main.dispatch();
	child.update(() => "");
	const result = await main.releaseUpdate();
	assert.strictEqual(result?.type, UpdateStatus.unaccepted);
});

// Caused by assumptions that `node.current` would be defined during the update process.
await test("new module node should work", async () => {
	const main = new TestModule(() =>
		`import {} from ${child};
		import.meta.hot.accept(${child});`);
	const child = new TestModule(() => "");
	await main.dispatch();
	child.update(() =>
		`import {} from ${newChild}`);
	const newChild = new TestModule(() => "");
	const result = await main.releaseUpdate();
	assert.strictEqual(result?.type, UpdateStatus.success);
});

// Caused by dangling rejection in the sync case
await test("dangling rejection in sync case", async () => {
	const main = new TestModule(() =>
		`import {} from ${left};
		import {} from ${right};`);
	const left = new TestModule(() =>
		`await undefined;
		throw new Error("async");`);
	const right = new TestModule(() =>
		'throw new Error("sync");');
	await assert.rejects(main.dispatch(), { message: "sync" });
});
