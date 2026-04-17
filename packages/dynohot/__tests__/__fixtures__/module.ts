import type { Context, SourceTextModuleOptions } from "node:vm";
import * as assert from "node:assert/strict";
import { SourceTextModule, createContext } from "node:vm";
import { transformModuleSource } from "#dynohot/loader/transform";
import * as adapter from "#dynohot/runtime/adapter";
import * as reloadable from "#dynohot/runtime/controller";
import { ReloadableModuleController } from "#dynohot/runtime/controller";

let count = 0;
const modules = new Map<string, LinkableModule>();

interface LinkableModule {
	instantiate: (environment: Environment) => SourceTextModule;
	linkAndEvaluate?: () => Promise<void>;
}

// @ts-expect-error -- This was backported some time in nodejs v18.
Symbol.dispose ??= Symbol.for("Symbol.dispose");

interface Environment {
	readonly context: Context;
	readonly pending: TestModule[];
	readonly runtime: SourceTextModule;
	readonly top: TestModule;
}

interface HotInstanceSourceModuleOptions extends SourceTextModuleOptions {
	readonly environment: Environment;
}

class HotInstanceSourceModule extends SourceTextModule {
	declare readonly namespace: {
		default: () => ReloadableModuleController;
	};

	readonly environment: Environment;
	readonly evaluated = false;

	constructor(source: string, options: HotInstanceSourceModuleOptions) {
		const { environment, ...rest } = options;
		super(source, rest);
		this.environment = environment;
	}
}

/** @internal */
export class TestModule implements LinkableModule {
	private environment: Environment | undefined;
	private vm: HotInstanceSourceModule | undefined;
	private readonly url = `test:///module${++count}`;
	private source;

	constructor(source: () => string) {
		this.source = source;
		modules.set(this.url, this);
	}

	get global() {
		assert.ok(this.environment !== undefined);
		return this.environment.context;
	}

	get namespace() {
		assert.ok(this.vm !== undefined);
		const controller = this.vm.namespace.default();
		const instance = controller.select();
		return instance.moduleNamespace()();
	}

	private static makeRuntime(environment: Environment) {
		return new SourceTextModule(
			`const [ assert, Adapter, Reloadable ] = await Promise.all([
				import("node:assert/strict"),
				import("hot:test/adapter"),
				import("hot:test/reloadable"),
			]);
			export const acquire = Reloadable.makeAcquire(
				(specifier, attributes) => import(specifier, { with: attributes }),
				{ silent: true },
				undefined);
			export function adapter(url, namespace) {
				return new Adapter.AdapterModuleController(url, namespace);
			}
			globalThis.assert = assert;\n`, {
				context: environment.context,
				// @ts-expect-error -- Types incorrect, since `importModuleDynamically` can accept
				// an exotic namespace object in the runtime
				importModuleDynamically: TestModule.dynamicImport.bind(undefined, environment),
			});
	}

	private static link(environment: Environment, specifier: string) {
		switch (specifier) {
			case "hot:runtime": return environment.runtime;
			default: {
				const module = modules.get(specifier);
				assert.ok(module !== undefined);
				return module.instantiate(environment);
			}
		}
	}

	private static async dynamicImport(this: void, environment: Environment, specifier: string) {
		switch (specifier) {
			case "node:assert/strict": return assert;
			case "hot:test/adapter": return adapter;
			case "hot:test/reloadable": return reloadable;
			default: {
				const module = modules.get(specifier);
				assert.ok(module !== undefined);
				const vm = module.instantiate(environment);
				await module.linkAndEvaluate?.();
				return vm;
			}
		}
	}

	async dispatch() {
		assert.equal(this.environment, undefined);
		const context = createContext();
		context.console = console;
		const environment: Partial<Environment> = {
			context,
			pending: [],
			top: this,
		};
		// @ts-expect-error -- readonly override
		environment.runtime = TestModule.makeRuntime(environment as Environment);
		const vm = this.instantiate(environment as Environment);
		await this.linkAndEvaluate();
		await vm.namespace.default().main();
	}

	async releaseUpdate() {
		assert.ok(this.vm !== undefined);
		assert.ok(this.environment !== undefined);
		const updates = this.environment.pending.splice(0);
		for (const update of updates) {
			assert.ok(update.vm !== undefined);
			update.vm = undefined;
			update.instantiate(this.environment);
			await update.linkAndEvaluate();
		}
		return this.vm.namespace.default().application.requestUpdateResult();
	}

	instantiate(environment: Environment) {
		if (this.vm === undefined) {
			assert.ok(this.environment === undefined || this.environment === environment);
			this.environment = environment;
			const source =
				transformModuleSource(this.url, null, {}, this.source(), undefined) +
				'import { acquire } from "hot:runtime";' +
				`export default function module() { return acquire(${JSON.stringify(this.url)}); }\n`;
			return this.vm = new HotInstanceSourceModule(source, {
				context: environment.context,
				environment,
				identifier: this.url,
				// @ts-expect-error -- Types incorrect, since `importModuleDynamically` can accept
				// an exotic namespace object in the runtime
				importModuleDynamically: TestModule.dynamicImport.bind(undefined, environment),
				initializeImportMeta: meta => {
					meta.url = this.url;
				},
			});
		} else {
			assert.ok(this.environment === environment);
			return this.vm;
		}
	}

	async linkAndEvaluate() {
		const { environment, vm } = this;
		assert.ok(environment !== undefined);
		assert.ok(vm !== undefined);
		if (vm.status === "unlinked") {
			await vm.link(specifier => TestModule.link(environment, specifier));
			await vm.evaluate();
		}
	}

	toString() {
		return JSON.stringify(this.url);
	}

	update(source?: () => string) {
		assert.ok(this.environment !== undefined);
		if (source) {
			this.source = source;
		}
		this.environment.pending.push(this);
	}
}

/** @internal */
export class TestAdapterModule implements LinkableModule {
	private readonly namespace;
	private readonly url = `test:///module${++count}`;

	constructor(namespace: Record<string, unknown>) {
		this.namespace = namespace;
		modules.set(this.url, this);
	}

	instantiate(environment: Environment) {
		const global = environment.runtime.context;
		global[this.url] = this.namespace;
		const source =
			`const namespace = globalThis[${JSON.stringify(this.url)}];
			import { adapter } from "hot:runtime";
			const module = adapter(${JSON.stringify(this.url)}, namespace);
			export default function() { return module; };\n`;
		return new SourceTextModule(source, {
			context: environment.context,
			identifier: this.url,
		});
	}

	toString() {
		return JSON.stringify(this.url);
	}
}
