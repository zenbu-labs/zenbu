import type { DbSections } from "#registry/db-sections";

type Assert<T extends true> = T;
type IsEqual<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;
type Has<T, K extends string> = K extends keyof T ? true : false;

type KernelSection = DbSections["kernel"];

type _KernelHasAgents = Assert<Has<KernelSection, "agents">>;
type _KernelHasSidebarOpen = Assert<Has<KernelSection, "sidebarOpen">>;
type _KernelHasTabSidebarOpen = Assert<Has<KernelSection, "tabSidebarOpen">>;
type _KernelHasViewRegistry = Assert<Has<KernelSection, "viewRegistry">>;

type _SidebarOpenIsBoolean = Assert<IsEqual<KernelSection["sidebarOpen"], boolean>>;
type _TabSidebarOpenIsBoolean = Assert<IsEqual<KernelSection["tabSidebarOpen"], boolean>>;
type _SelectedAgentIsString = Assert<IsEqual<KernelSection["selectedAgentId"], string>>;
