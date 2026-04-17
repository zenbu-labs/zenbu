import { webContents, app } from "electron";
import { execSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { Service, runtime } from "../runtime";
import { ViewRegistryService } from "./view-registry";
import { CoreRendererService } from "./core-renderer";
import { DbService } from "./db";

interface OutputLine {
  text: string;
  style?: "error" | "success" | "info" | "dim" | "warn" | "header";
}

interface CommandResult {
  lines: OutputLine[];
  exitCode: number;
}

type CommandHandler = (
  args: string[],
  stdin: string | null,
) => Promise<CommandResult> | CommandResult;

function ln(text: string, style?: OutputLine["style"]): OutputLine {
  return style ? { text, style } : { text };
}

function ok(lines: OutputLine[]): CommandResult {
  return { lines, exitCode: 0 };
}

function fail(msg: string): CommandResult {
  return { lines: [ln(msg, "error")], exitCode: 1 };
}

function pad(s: string, n: number): string {
  return s.length >= n ? s : s + " ".repeat(n - s.length);
}

const TIPS = [
  "ps | grep agent      — find agent services",
  "eval document.title  — execute JS in the page",
  "console -n 50        — last 50 console messages",
  "db views             — peek at open tabs",
  "cat package.json | head -n 5",
  "cdp Runtime.evaluate — raw Chrome DevTools Protocol",
];

export class ShellService extends Service {
  static key = "view-shell";
  static deps = {
    viewRegistry: ViewRegistryService,
    coreRenderer: CoreRendererService,
    db: DbService,
  };
  declare ctx: {
    viewRegistry: ViewRegistryService;
    coreRenderer: CoreRendererService;
    db: DbService;
  };

  private bootTime = Date.now();
  private targetWcId: number | null = null;
  private consoleBuf: Array<{
    ts: number;
    level: number;
    msg: string;
    src: string;
  }> = [];
  private cmds = new Map<string, { handler: CommandHandler; desc: string }>();

  async exec(input: string): Promise<CommandResult> {
    const pipeline = input
      .split("|")
      .map((s) => s.trim())
      .filter(Boolean);
    if (pipeline.length === 0) return ok([]);

    let stdin: string | null = null;
    let result: CommandResult = ok([]);

    for (const segment of pipeline) {
      const tokens = tokenize(segment);
      if (tokens.length === 0) continue;
      const name = tokens[0]!;
      const args = tokens.slice(1);

      const cmd = this.cmds.get(name);
      if (!cmd) return fail(`zsh: command not found: ${name}`);

      try {
        result = await cmd.handler(args, stdin);
      } catch (e: any) {
        return fail(`${name}: ${e.message ?? String(e)}`);
      }

      stdin = result.lines.map((l) => l.text).join("\n");
      if (result.exitCode !== 0) break;
    }

    return result;
  }

  banner(): { lines: OutputLine[] } {
    return {
      lines: [
        ln(""),
        ln(" ┌─────────────────────────────────────────┐", "dim"),
        ln(
          ` │   platform: ${pad(process.platform + " " + process.arch, 26)}│`,
          "dim",
        ),
        ln(" │                                         │", "dim"),
        ln(" │   type `help` for commands              │", "info"),
        ln(" │                                         │", "dim"),
        ln(" └─────────────────────────────────────────┘", "dim"),
        ln(""),
        ln(""),
      ],
    };
  }

  htopData() {
    const slots = this.getSlots();
    const defs = this.getDefs();
    const mem = process.memoryUsage();

    const cpuPct = getTreeCpuPct(process.pid);

    let ready = 0,
      failed = 0,
      blocked = 0;
    const services: Array<{
      pid: number;
      key: string;
      status: string;
      deps: string;
      methodCount: number;
    }> = [];
    let pid = 1;
    for (const [key, slot] of slots) {
      const def = defs.get(key);
      const deps = def ? this.resolveDeps(def).join(", ") : "-";
      const methods = this.rpcMethods(slot.instance);
      if (slot.status === "ready") ready++;
      else if (slot.status === "failed") failed++;
      else blocked++;
      services.push({
        pid: pid++,
        key,
        status: slot.status,
        deps: deps || "-",
        methodCount: methods.length,
      });
    }

    return {
      uptime: formatUptime(Date.now() - this.bootTime),
      memory: {
        heapUsed: mem.heapUsed,
        heapTotal: mem.heapTotal,
        rss: mem.rss,
      },
      cpuPct: Math.round(cpuPct * 10) / 10,
      services,
      counts: { ready, failed, blocked, total: slots.size },
      webContentsCount: webContents.getAllWebContents().length,
      consoleCount: this.consoleBuf.length,
    };
  }

  async htopDag() {
    const cmd = this.cmds.get("dag");
    if (!cmd) return { lines: [] };
    const result = await cmd.handler([], null);
    return { lines: result.lines };
  }

  evaluate() {
    this.ctx.viewRegistry.registerAlias("shell", "core", "/views/shell");
    this.bootTime ??= Date.now();
    this.registerCommands();
    this.captureConsole();
  }

  // ── runtime introspection ──

  private getSlots(): Map<string, any> {
    const rt = (globalThis as any).__zenbu_service_runtime__;
    return rt ? (rt as any).slots : new Map();
  }

  private getDefs(): Map<string, typeof Service> {
    const rt = (globalThis as any).__zenbu_service_runtime__;
    return rt ? (rt as any).definitions : new Map();
  }

  private resolveDeps(Cls: any): string[] {
    const deps: Record<string, any> = Cls?.deps ?? {};
    return Object.values(deps).map((e: any) => {
      if (typeof e === "string") return e;
      if (e?.__optional) {
        const r = e.ref;
        return (typeof r === "string" ? r : r?.key ?? "?") + "?";
      }
      return e?.key ?? "?";
    });
  }

  private rpcMethods(instance: any): string[] {
    if (!instance) return [];
    const proto = Object.getPrototypeOf(instance);
    const skip = new Set([
      "evaluate",
      "constructor",
      "effect",
      "__cleanupAllEffects",
    ]);
    const out: string[] = [];
    for (const name of Object.getOwnPropertyNames(proto)) {
      if (skip.has(name) || name.startsWith("_")) continue;
      const d = Object.getOwnPropertyDescriptor(proto, name);
      if (d && typeof d.value === "function") out.push(name);
    }
    return out;
  }

  // ── webContents helpers ──

  private getTargetWc(): Electron.WebContents | null {
    const all = webContents.getAllWebContents();
    if (this.targetWcId !== null) {
      return all.find((wc) => wc.id === this.targetWcId) ?? null;
    }
    return (
      all.find((wc) => {
        const url = wc.getURL();
        return url.includes("/views/") && !url.includes("/views/shell");
      }) ??
      all[0] ??
      null
    );
  }

  // ── command registration ──

  private registerCommands() {
    const c = this.cmds;
    c.clear();

    c.set("help", {
      desc: "List available commands",
      handler: () => {
        const groups: Record<string, string[]> = {
          "Process Management": ["ps", "inspect", "uptime", "dag", "htop"],
          System: ["uname", "env", "whoami", "pwd", "db"],
          "Page / CDP": ["pages", "target", "console", "eval", "dom", "cdp"],
          "Text Processing": [
            "echo",
            "cat",
            "ls",
            "head",
            "tail",
            "grep",
            "wc",
            "sort",
            "uniq",
          ],
          Shell: ["help", "clear"],
        };
        const out: OutputLine[] = [ln(""), ln("Commands:", "header"), ln("")];
        for (const [group, names] of Object.entries(groups)) {
          out.push(ln(`  ${group}`, "info"));
          for (const name of names) {
            const entry = c.get(name);
            out.push(ln(`    ${pad(name, 14)} ${entry?.desc ?? ""}`));
          }
          out.push(ln(""));
        }
        out.push(ln("  Pipe with |  e.g.  ps | grep ready", "dim"));
        out.push(ln(""));
        return ok(out);
      },
    });

    c.set("ps", {
      desc: "List all services (processes)",
      handler: () => {
        const slots = this.getSlots();
        const defs = this.getDefs();
        const out: OutputLine[] = [
          ln(
            `  ${pad("PID", 5)}${pad("SERVICE", 22)}${pad("STATUS", 12)}DEPS`,
            "header",
          ),
        ];
        let pid = 1;
        for (const [key, slot] of slots) {
          const def = defs.get(key);
          const deps = def ? this.resolveDeps(def).join(", ") : "-";
          out.push(
            ln(
              `  ${pad(String(pid), 5)}${pad(key, 22)}${pad(slot.status, 12)}${
                deps || "-"
              }`,
            ),
          );
          pid++;
        }
        out.push(ln(""));
        out.push(ln(`  ${slots.size} processes`, "dim"));
        return ok(out);
      },
    });

    c.set("inspect", {
      desc: "Detailed info on a service",
      handler: (args) => {
        const key = args[0];
        if (!key) return fail("usage: inspect <service-key>");
        const slots = this.getSlots();
        const slot = slots.get(key);
        if (!slot) return fail(`no such service: ${key}`);

        const def = this.getDefs().get(key);
        const deps = (def as any)?.deps ?? {};
        const depLines = Object.entries(deps).map(
          ([name, entry]: [string, any]) => {
            const dk =
              typeof entry === "string"
                ? entry
                : entry?.__optional
                ? entry.ref?.key ?? entry.ref
                : entry?.key ?? "?";
            const ds = slots.get(dk);
            return `${name} → ${dk} (${ds?.status ?? "unknown"})`;
          },
        );

        const methods = this.rpcMethods(slot.instance);

        const out: OutputLine[] = [
          ln(""),
          ln(`  Service: ${key}`, "header"),
          ln(
            `  Status:  ${slot.status}`,
            slot.status === "ready"
              ? "success"
              : slot.status === "failed"
              ? "error"
              : "warn",
          ),
        ];
        if (slot.error)
          out.push(ln(`  Error:   ${String(slot.error)}`, "error"));
        out.push(
          ln(
            `  Deps:    ${depLines.length > 0 ? depLines.join(", ") : "none"}`,
          ),
        );
        out.push(
          ln(`  RPC:     ${methods.length > 0 ? methods.join(", ") : "none"}`),
        );
        out.push(ln(""));
        return ok(out);
      },
    });

    c.set("uptime", {
      desc: "Runtime uptime and service counts",
      handler: () => {
        const ms = Date.now() - this.bootTime;
        const slots = this.getSlots();
        let ready = 0,
          failed = 0,
          blocked = 0;
        for (const s of slots.values()) {
          if (s.status === "ready") ready++;
          else if (s.status === "failed") failed++;
          else blocked++;
        }
        return ok([
          ln(`  up ${formatUptime(ms)}`),
          ln(
            `  services: ${ready} ready, ${failed} failed, ${blocked} blocked`,
          ),
        ]);
      },
    });

    c.set("dag", {
      desc: "Show service dependency graph",
      handler: () => {
        const slots = this.getSlots();
        const defs = this.getDefs();

        const depMap = new Map<string, string[]>();
        const allKeys = new Set<string>();
        for (const [key, def] of defs) {
          allKeys.add(key);
          depMap.set(key, this.resolveDeps(def).map((d) => d.replace(/\?$/, "")));
        }

        const roots: string[] = [];
        const children = new Map<string, string[]>();
        for (const key of allKeys) children.set(key, []);
        for (const [key, deps] of depMap) {
          if (deps.length === 0 || deps.every((d) => !allKeys.has(d))) {
            roots.push(key);
          }
          for (const d of deps) {
            if (allKeys.has(d)) {
              children.get(d)!.push(key);
            }
          }
        }

        const out: OutputLine[] = [ln(""), ln("  Service DAG", "header"), ln("")];

        const printed = new Set<string>();
        const render = (key: string, prefix: string, isLast: boolean, isRoot: boolean) => {
          if (printed.has(key)) {
            out.push(ln(`${prefix}${isRoot ? "" : isLast ? "└─ " : "├─ "}${key} (↑ see above)`, "dim"));
            return;
          }
          printed.add(key);

          const slot = slots.get(key);
          const status = slot?.status ?? "?";
          const dot =
            status === "ready" ? "●" : status === "failed" ? "✕" : "○";
          const style: OutputLine["style"] =
            status === "ready" ? "success" : status === "failed" ? "error" : "warn";

          const connector = isRoot ? "" : isLast ? "└─ " : "├─ ";
          out.push(ln(`${prefix}${connector}${dot} ${key}`, style));

          const kids = (children.get(key) ?? []).sort();
          const childPrefix = prefix + (isRoot ? "" : isLast ? "   " : "│  ");
          for (let i = 0; i < kids.length; i++) {
            render(kids[i]!, childPrefix, i === kids.length - 1, false);
          }
        };

        roots.sort();
        for (let i = 0; i < roots.length; i++) {
          render(roots[i]!, "  ", true, true);
          if (i < roots.length - 1) out.push(ln(""));
        }

        const orphans = [...allKeys].filter((k) => !printed.has(k));
        if (orphans.length > 0) {
          out.push(ln(""));
          out.push(ln("  (circular or unresolved)", "dim"));
          for (const k of orphans) {
            out.push(ln(`  ○ ${k}`, "warn"));
          }
        }

        out.push(ln(""));
        return ok(out);
      },
    });

    c.set("uname", {
      desc: "System information",
      handler: () =>
        ok([
          ln(`  zenbu (${process.platform} ${os.release()} ${process.arch})`),
          ln(
            `  Electron ${process.versions.electron ?? "?"} | Node ${
              process.version
            } | Chromium ${process.versions.chrome ?? "?"}`,
          ),
          ln("  TypeScript HMR runtime with live-reloadable services", "dim"),
        ]),
    });

    c.set("env", {
      desc: "Environment info",
      handler: () =>
        ok([
          ln(`  CWD=${process.cwd()}`),
          ln(`  PLATFORM=${process.platform}`),
          ln(`  ARCH=${process.arch}`),
          ln(`  NODE_ENV=${process.env.NODE_ENV ?? "undefined"}`),
          ln(`  PID=${process.pid}`),
          ln(
            `  MEMORY=${Math.round(
              process.memoryUsage().heapUsed / 1024 / 1024,
            )}MB heap`,
          ),
        ]),
    });

    c.set("whoami", {
      desc: "Current user",
      handler: () => ok([ln(`  ${os.userInfo().username} @ zenbu`)]),
    });

    c.set("pwd", {
      desc: "Print working directory",
      handler: () => ok([ln(`  ${process.cwd()}`)]),
    });

    c.set("db", {
      desc: "Query Kyju database",
      handler: (args) => {
        try {
          const root = this.ctx.db.client.readRoot();
          const kernel = (root as any).plugin?.kernel;
          if (!kernel) return fail("no kernel data in db");

          if (args.length === 0) {
            const keys = Object.keys(kernel);
            return ok([
              ln("  Kyju database keys:", "header"),
              ...keys.map((k) => {
                const val = kernel[k];
                const preview = Array.isArray(val)
                  ? `[${val.length} items]`
                  : typeof val;
                return ln(`    ${pad(k, 24)} ${preview}`);
              }),
              ln(""),
              ln("  usage: db <key> [subkey...]", "dim"),
            ]);
          }

          let value: any = kernel;
          for (const key of args) {
            if (value == null) return fail(`path not found: ${args.join(".")}`);
            value = value[key];
          }

          const text = JSON.stringify(value, null, 2);
          return ok(text.split("\n").map((l) => ln(l)));
        } catch (e: any) {
          return fail(`db: ${e.message}`);
        }
      },
    });

    // ── page / CDP ──

    c.set("pages", {
      desc: "List webContents (browsing contexts)",
      handler: () => {
        const all = webContents.getAllWebContents();
        const target = this.getTargetWc();
        const out: OutputLine[] = [
          ln(`  ${pad("ID", 6)}${pad("", 4)}URL`, "header"),
        ];
        for (const wc of all) {
          const url = wc.getURL();
          const short = url.length > 70 ? "..." + url.slice(-67) : url;
          const marker = target && wc.id === target.id ? "→" : " ";
          out.push(ln(`  ${pad(String(wc.id), 6)}${pad(marker, 4)}${short}`));
        }
        return ok(out);
      },
    });

    c.set("target", {
      desc: "Set target webContents by ID",
      handler: (args) => {
        if (!args[0]) {
          this.targetWcId = null;
          return ok([ln("  target reset to auto", "info")]);
        }
        const id = parseInt(args[0], 10);
        if (!webContents.getAllWebContents().find((wc) => wc.id === id))
          return fail(`no webContents with id ${id}`);
        this.targetWcId = id;
        return ok([ln(`  target → ${id}`, "success")]);
      },
    });

    c.set("console", {
      desc: "Show captured console messages",
      handler: (args) => {
        let n = 20;
        if (args[0] === "-n" && args[1]) n = parseInt(args[1], 10) || 20;
        const msgs = this.consoleBuf.slice(-n);
        if (msgs.length === 0)
          return ok([ln("  (no console messages captured)", "dim")]);

        const names = ["verbose", "info", "warn", "error"];
        const styles: (OutputLine["style"] | undefined)[] = [
          "dim",
          "info",
          "warn",
          "error",
        ];
        return ok(
          msgs.map((m) => {
            const t = new Date(m.ts).toLocaleTimeString();
            const lvl = names[m.level] ?? "log";
            return ln(`  [${t}] [${lvl}] ${m.msg}`, styles[m.level]);
          }),
        );
      },
    });

    c.set("eval", {
      desc: "Execute JS in page context",
      handler: async (args) => {
        const expr = args.join(" ");
        if (!expr) return fail("usage: eval <expression>");
        const wc = this.getTargetWc();
        if (!wc) return fail("no target webContents");

        try {
          const result = await wc.executeJavaScript(expr);
          const text =
            typeof result === "string"
              ? result
              : JSON.stringify(result, null, 2);
          return ok(
            (text ?? "undefined").split("\n").map((l: string) => ln(l)),
          );
        } catch (e: any) {
          return fail(e.message);
        }
      },
    });

    c.set("dom", {
      desc: "Query DOM elements by CSS selector",
      handler: async (args) => {
        const sel = args.join(" ");
        if (!sel) return fail("usage: dom <selector>");
        const wc = this.getTargetWc();
        if (!wc) return fail("no target webContents");

        try {
          const result = await wc.executeJavaScript(`
            (() => {
              const els = document.querySelectorAll(${JSON.stringify(sel)});
              return Array.from(els).slice(0, 25).map(el => {
                const tag = el.tagName.toLowerCase();
                const id = el.id ? '#' + el.id : '';
                const cls = el.className && typeof el.className === 'string'
                  ? '.' + el.className.trim().split(/\\s+/).slice(0, 3).join('.')
                  : '';
                const text = (el.textContent || '').trim().slice(0, 50);
                return { tag, id, cls, text, total: els.length };
              });
            })()
          `);
          if (!result || result.length === 0)
            return ok([ln(`  no elements matching "${sel}"`, "dim")]);
          const total = result[0]?.total ?? result.length;
          const out: OutputLine[] = [
            ln(`  ${total} element(s) matching "${sel}"`, "header"),
          ];
          for (const el of result) {
            const preview = el.text
              ? ` "${el.text.slice(0, 40)}${el.text.length > 40 ? "…" : ""}"`
              : "";
            out.push(ln(`    <${el.tag}${el.id}${el.cls}>${preview}`));
          }
          if (total > 25) out.push(ln(`    … and ${total - 25} more`, "dim"));
          return ok(out);
        } catch (e: any) {
          return fail(e.message);
        }
      },
    });

    c.set("cdp", {
      desc: "Raw Chrome DevTools Protocol command",
      handler: async (args) => {
        const method = args[0];
        if (!method) return fail("usage: cdp <Domain.method> [params-json]");
        const paramStr = args.slice(1).join(" ");
        let params: any;
        if (paramStr) {
          try {
            params = JSON.parse(paramStr);
          } catch {
            return fail("invalid JSON params");
          }
        }

        const wc = this.getTargetWc();
        if (!wc) return fail("no target webContents");

        let shouldDetach = false;
        try {
          if (!wc.debugger.isAttached()) {
            wc.debugger.attach("1.3");
            shouldDetach = true;
          }
          const result = await wc.debugger.sendCommand(method, params);
          return ok(
            JSON.stringify(result, null, 2)
              .split("\n")
              .map((l) => ln(l)),
          );
        } catch (e: any) {
          return fail(`cdp: ${e.message}`);
        } finally {
          if (shouldDetach) {
            try {
              wc.debugger.detach();
            } catch {}
          }
        }
      },
    });

    // ── text / fs ──

    c.set("echo", {
      desc: "Print text",
      handler: (args) => ok([ln(args.join(" "))]),
    });

    c.set("cat", {
      desc: "Read file or pass stdin through",
      handler: async (args, stdin) => {
        if (args.length === 0 && stdin)
          return ok(stdin.split("\n").map((l) => ln(l)));
        if (!args[0]) return fail("usage: cat <file>");
        try {
          const p = path.resolve(process.cwd(), args[0]);
          const text = await fs.promises.readFile(p, "utf-8");
          return ok(text.split("\n").map((l) => ln(l)));
        } catch (e: any) {
          return fail(`cat: ${e.message}`);
        }
      },
    });

    c.set("ls", {
      desc: "List directory contents",
      handler: async (args) => {
        const dir = args[0]
          ? path.resolve(process.cwd(), args[0])
          : process.cwd();
        try {
          const entries = await fs.promises.readdir(dir, {
            withFileTypes: true,
          });
          return ok(
            entries.map((e) =>
              ln(`  ${e.isDirectory() ? e.name + "/" : e.name}`),
            ),
          );
        } catch (e: any) {
          return fail(`ls: ${e.message}`);
        }
      },
    });

    c.set("head", {
      desc: "First N lines (default 10)",
      handler: (args, stdin) => {
        if (!stdin) return fail("head: no input (pipe something into it)");
        let n = 10;
        if (args[0] === "-n" && args[1]) n = parseInt(args[1], 10) || 10;
        return ok(
          stdin
            .split("\n")
            .slice(0, n)
            .map((l) => ln(l)),
        );
      },
    });

    c.set("tail", {
      desc: "Last N lines (default 10)",
      handler: (args, stdin) => {
        if (!stdin) return fail("tail: no input (pipe something into it)");
        let n = 10;
        if (args[0] === "-n" && args[1]) n = parseInt(args[1], 10) || 10;
        return ok(
          stdin
            .split("\n")
            .slice(-n)
            .map((l) => ln(l)),
        );
      },
    });

    c.set("grep", {
      desc: "Filter lines matching pattern",
      handler: (args, stdin) => {
        if (!args[0]) return fail("usage: grep <pattern>");
        if (!stdin) return fail("grep: no input (pipe something into it)");
        const flags = args.includes("-i") ? "i" : "";
        const pattern = new RegExp(args.filter((a) => a !== "-i")[0]!, flags);
        const matches = stdin.split("\n").filter((l) => pattern.test(l));
        if (matches.length === 0) return { lines: [], exitCode: 1 };
        return ok(matches.map((l) => ln(l)));
      },
    });

    c.set("wc", {
      desc: "Count lines, words, chars",
      handler: (args, stdin) => {
        if (!stdin) return fail("wc: no input (pipe something into it)");
        const lines = stdin.split("\n");
        const words = stdin.split(/\s+/).filter(Boolean);
        if (args.includes("-l")) return ok([ln(`  ${lines.length}`)]);
        if (args.includes("-w")) return ok([ln(`  ${words.length}`)]);
        if (args.includes("-c")) return ok([ln(`  ${stdin.length}`)]);
        return ok([
          ln(
            `  ${lines.length} lines, ${words.length} words, ${stdin.length} chars`,
          ),
        ]);
      },
    });

    c.set("sort", {
      desc: "Sort lines alphabetically",
      handler: (args, stdin) => {
        if (!stdin) return fail("sort: no input");
        const sorted = stdin.split("\n").sort();
        if (args.includes("-r")) sorted.reverse();
        return ok(sorted.map((l) => ln(l)));
      },
    });

    c.set("uniq", {
      desc: "Remove consecutive duplicate lines",
      handler: (_, stdin) => {
        if (!stdin) return fail("uniq: no input");
        return ok(
          stdin
            .split("\n")
            .filter((l, i, a) => i === 0 || l !== a[i - 1])
            .map((l) => ln(l)),
        );
      },
    });

    c.set("htop", {
      desc: "Live runtime monitor (client-side)",
      handler: () => ok([]),
    });

    c.set("clear", {
      desc: "Clear the terminal (client-side)",
      handler: () => ok([]),
    });
  }

  private captureConsole() {
    this.effect("console-capture", () => {
      const onMsg = (
        _: Electron.Event,
        level: number,
        msg: string,
        _line: number,
        src: string,
      ) => {
        this.consoleBuf.push({ ts: Date.now(), level, msg, src });
        if (this.consoleBuf.length > 500) this.consoleBuf.shift();
      };

      for (const wc of webContents.getAllWebContents()) {
        wc.on("console-message", onMsg);
      }

      const onCreated = (_: Electron.Event, wc: Electron.WebContents) => {
        wc.on("console-message", onMsg);
      };
      app.on("web-contents-created", onCreated);

      return () => {
        app.off("web-contents-created", onCreated);
        for (const wc of webContents.getAllWebContents()) {
          wc.off("console-message", onMsg);
        }
      };
    });
  }
}

runtime.register(ShellService, (import.meta as any).hot);

// ── helpers ──

function tokenize(input: string): string[] {
  const tokens: string[] = [];
  let cur = "";
  let quote: string | null = null;

  for (const ch of input) {
    if (quote) {
      if (ch === quote) quote = null;
      else cur += ch;
    } else if (ch === '"' || ch === "'") {
      quote = ch;
    } else if (ch === " " || ch === "\t") {
      if (cur) {
        tokens.push(cur);
        cur = "";
      }
    } else {
      cur += ch;
    }
  }
  if (cur) tokens.push(cur);
  return tokens;
}

function formatUptime(ms: number): string {
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}h ${m}m ${sec}s`;
  if (m > 0) return `${m}m ${sec}s`;
  return `${sec}s`;
}

function getTreeCpuPct(rootPid: number): number {
  try {
    if (process.platform === "darwin" || process.platform === "linux") {
      const raw = execSync(
        `ps -A -o pid=,ppid=,%cpu= 2>/dev/null`,
        { encoding: "utf-8", timeout: 2000 },
      );
      const rows = raw
        .trim()
        .split("\n")
        .map((line) => {
          const parts = line.trim().split(/\s+/);
          return {
            pid: parseInt(parts[0]!, 10),
            ppid: parseInt(parts[1]!, 10),
            cpu: parseFloat(parts[2]!),
          };
        })
        .filter((r) => !isNaN(r.pid));

      const childrenOf = new Map<number, number[]>();
      const cpuOf = new Map<number, number>();
      for (const r of rows) {
        cpuOf.set(r.pid, r.cpu);
        const list = childrenOf.get(r.ppid);
        if (list) list.push(r.pid);
        else childrenOf.set(r.ppid, [r.pid]);
      }

      let total = 0;
      const visit = (pid: number) => {
        total += cpuOf.get(pid) ?? 0;
        for (const child of childrenOf.get(pid) ?? []) visit(child);
      };
      visit(rootPid);
      return Math.round(total * 10) / 10;
    }
    return 0;
  } catch {
    return 0;
  }
}
