/* eslint-disable @typescript-eslint/restrict-template-expressions */
import * as assert from "node:assert/strict";
import { test } from "node:test";
import { UpdateStatus } from "dynohot/runtime/controller";
import { TestModule } from "./__fixtures__/module.js";

await test("accept handlers should run top down", async () => {
	const main = new TestModule(() =>
		`import {} from ${child};
		let seen = false;
		import.meta.hot.accept(${child}, () => {
			seen = true;
		});
		import.meta.hot.accept(${child}, () => {
			assert.strictEqual(seen, true);
		});`);
	const child = new TestModule(() => "");
	await main.dispatch();
	child.update(() => "");
	const result = await main.releaseUpdate();
	assert.strictEqual(result?.type, UpdateStatus.success);
});

await test("only run affected handlers", async () => {
	const main = new TestModule(() =>
		`import {} from ${left};
		import {} from ${right};
		import.meta.hot.accept(${left}, () => {
			globalThis.leftSeen = true;
		});
		import.meta.hot.accept(${right}, () => {
			globalThis.rightSeen = true;
		});`);
	const left: TestModule = new TestModule(() => "");
	const right = new TestModule(() => "");
	await main.dispatch();
	left.update(() => "");
	const result = await main.releaseUpdate();
	assert.strictEqual(result?.type, UpdateStatus.success);
	assert.strictEqual(main.global.leftSeen, true);
	assert.strictEqual(main.global.rightSeen, undefined);
});

await test("should be able to accept a cycle root", async () => {
	const main = new TestModule(() =>
		`import {} from ${left};
		import.meta.hot.accept(${left});`);
	const left: TestModule = new TestModule(() =>
		`import {} from ${right};`);
	const right = new TestModule(() =>
		`import {} from ${left};`);
	await main.dispatch();
	right.update(() => "");
	const result = await main.releaseUpdate();
	assert.strictEqual(result?.type, UpdateStatus.success);
});

await test("catch error from accept", async () => {
	const main = new TestModule(() =>
		`import ${child};
		import.meta.hot.accept(${child}, () => {
			globalThis.seen2 = true;
		});`);
	const child = new TestModule(() =>
		`import ${child2};
		import.meta.hot.accept(${child2}, () => {
			globalThis.seen1 = true;
			throw new Error("uh oh");
		})`);
	const child2 = new TestModule(() => "");
	await main.dispatch();
	child2.update(() => "");
	const result = await main.releaseUpdate();
	assert.strictEqual(result?.type, UpdateStatus.success);
	assert.strictEqual(main.global.seen1, true);
	assert.strictEqual(main.global.seen2, true);
});

await test("catch error from self-accept", async () => {
	const main = new TestModule(() =>
		`import ${child};
		import.meta.hot.accept(${child});`);
	const child = new TestModule(() =>
		`import.meta.hot.accept(() => {
			throw new Error("uh oh");
		})`);
	await main.dispatch();
	child.update(() => "");
	const result = await main.releaseUpdate();
	assert.strictEqual(result?.type, UpdateStatus.success);
});
