import { useState, useEffect, useCallback, useMemo, useRef, memo, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import {
  CheckIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  MessageSquarePlusIcon,
  PencilIcon,
  Trash2Icon,
  XIcon,
} from "lucide-react";
import {
  computeDiff,
  type DiffLine,
  type DiffResult,
  type IntraLineSpan,
} from "@zenbu/diffs/react";
import { langFromPath, tokenizeLines, type SyntaxToken } from "@zenbu/diffs";
import { Button } from "../../../components/ui/button";
import { useRpc } from "../../../lib/providers";
import { cn } from "../../../lib/utils";

export type ReviewFileEntry = {
  path: string;
  oldPath: string | null;
  label: string;
};

type FileDiffResult =
  | { kind: "ok"; oldText: string; newText: string; binary: boolean }
  | { kind: "error"; message: string };

type FolderNode = { kind: "folder"; name: string; path: string; children: TreeNode[] };
type FileNode = { kind: "file"; name: string; path: string; entry: ReviewFileEntry };
type TreeNode = FolderNode | FileNode;

type LineComment = { id: string; text: string; editing: boolean; draft: string };
type FileCommentState = {
  lines: Record<string, LineComment>;
  general: string;
};
type DiffStats = { additions: number; deletions: number; binary: boolean };

const DRAG: CSSProperties = { WebkitAppRegion: "drag" } as CSSProperties;
const NO_DRAG: CSSProperties = { WebkitAppRegion: "no-drag" } as CSSProperties;

export function ReviewMode({
  entries,
  onClose,
}: {
  entries: ReviewFileEntry[];
  onClose: () => void;
}) {
  const rpc = useRpc();
  const [diffs, setDiffs] = useState<Map<string, FileDiffResult>>(new Map());
  const [stats, setStats] = useState<Record<string, DiffStats>>({});
  const [fileState, setFileState] = useState<Record<string, FileCommentState>>({});
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [activePath, setActivePath] = useState<string | null>(
    entries[0]?.path ?? null,
  );
  const [copyState, setCopyState] = useState<"idle" | "copied">("idle");
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const programmaticScrollRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const pairs = await Promise.all(
        entries.map(async (e) => {
          try {
            const result: FileDiffResult = await (rpc  ).gitUpdates.getFileDiff({
              path: e.path,
              oldPath: e.oldPath,
            });
            return [e.path, result] as const;
          } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            return [e.path, { kind: "error", message } satisfies FileDiffResult] as const;
          }
        }),
      );
      if (cancelled) return;
      setDiffs(new Map(pairs));
    })();
    return () => {
      cancelled = true;
    };
  }, [entries, rpc]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const result: Record<string, DiffStats> = await (rpc  ).gitUpdates.getDiffSummary({
          paths: entries.map((e) => e.path),
        });
        if (cancelled) return;
        setStats(result ?? {});
      } catch {
        if (!cancelled) setStats({});
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [entries, rpc]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      const target = e.target as HTMLElement | null;
      if (target && target.tagName === "TEXTAREA") return;
      e.stopPropagation();
      onClose();
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [onClose]);

  useEffect(() => {
    const container = scrollRef.current;
    if (!container) return;
    const observer = new IntersectionObserver(
      (observed) => {
        if (programmaticScrollRef.current) return;
        const visible = observed
          .filter((o) => o.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible.length === 0) return;
        const path = (visible[0].target as HTMLElement).dataset.path;
        if (path) setActivePath(path);
      },
      { root: container, rootMargin: "-10% 0px -70% 0px", threshold: 0 },
    );
    for (const el of fileRefs.current.values()) observer.observe(el);
    return () => observer.disconnect();
  }, [entries]);

  const scrollTo = useCallback((path: string) => {
    const el = fileRefs.current.get(path);
    if (!el) return;
    programmaticScrollRef.current = true;
    el.scrollIntoView({ behavior: "instant" as ScrollBehavior, block: "start" });
    setActivePath(path);
    window.setTimeout(() => {
      programmaticScrollRef.current = false;
    }, 120);
  }, []);

  const tree = useMemo(() => buildTree(entries), [entries]);

  const fileHasAnyComments = useCallback(
    (path: string) => {
      const s = fileState[path];
      if (!s) return false;
      if (s.general.trim().length > 0) return true;
      for (const c of Object.values(s.lines)) {
        if (c.text.trim().length > 0 || c.draft.trim().length > 0) return true;
      }
      return false;
    },
    [fileState],
  );

  const totalComments = useMemo(() => {
    let n = 0;
    for (const [, s] of Object.entries(fileState)) {
      if (s.general.trim()) n++;
      for (const c of Object.values(s.lines)) if (c.text.trim()) n++;
    }
    return n;
  }, [fileState]);

  const hasAny = totalComments > 0;

  const updateFile = useCallback(
    (path: string, updater: (s: FileCommentState) => FileCommentState) => {
      setFileState((cur) => ({ ...cur, [path]: updater(cur[path] ?? { lines: {}, general: "" }) }));
    },
    [],
  );

  const lineHandlers = useMemo(
    () => ({
      start: (path: string, key: string) => {
        updateFile(path, (s) => ({
          ...s,
          lines: {
            ...s.lines,
            [key]: {
              id: s.lines[key]?.id ?? randomId(),
              text: s.lines[key]?.text ?? "",
              draft: s.lines[key]?.text ?? "",
              editing: true,
            },
          },
        }));
      },
      change: (path: string, key: string, draft: string) => {
        updateFile(path, (s) => {
          const cur = s.lines[key];
          if (!cur) return s;
          return { ...s, lines: { ...s.lines, [key]: { ...cur, draft } } };
        });
      },
      save: (path: string, key: string) => {
        updateFile(path, (s) => {
          const cur = s.lines[key];
          if (!cur) return s;
          const text = cur.draft.trim();
          if (!text) {
            const { [key]: _, ...rest } = s.lines;
            return { ...s, lines: rest };
          }
          return { ...s, lines: { ...s.lines, [key]: { ...cur, text, editing: false } } };
        });
      },
      cancel: (path: string, key: string) => {
        updateFile(path, (s) => {
          const cur = s.lines[key];
          if (!cur) return s;
          if (!cur.text) {
            const { [key]: _, ...rest } = s.lines;
            return { ...s, lines: rest };
          }
          return { ...s, lines: { ...s.lines, [key]: { ...cur, draft: cur.text, editing: false } } };
        });
      },
      remove: (path: string, key: string) => {
        updateFile(path, (s) => {
          const { [key]: _, ...rest } = s.lines;
          return { ...s, lines: rest };
        });
      },
    }),
    [updateFile],
  );

  const handleDone = useCallback(async () => {
    const text = serializeComments(entries, fileState, diffs);
    if (!text) {
      onClose();
      return;
    }
    try {
      await navigator.clipboard.writeText(text);
      setCopyState("copied");
      window.setTimeout(() => onClose(), 600);
    } catch {
      onClose();
    }
  }, [entries, fileState, diffs, onClose]);

  return createPortal(
    <div className="fixed inset-0 z-[100] flex bg-black/25 p-2">
      <div className="relative flex flex-1 flex-col overflow-hidden rounded-xl border border-neutral-300 bg-white text-neutral-900 shadow-2xl">
      <div
        className="flex h-10 shrink-0 items-center gap-3 border-b border-neutral-200 bg-neutral-50 pl-[80px] pr-2"
        style={DRAG}
      >
        <div className="flex items-center gap-3" style={NO_DRAG}>
          <div className="text-sm font-semibold">Review changes</div>
          <div className="text-xs text-neutral-500">
            {entries.length} file{entries.length === 1 ? "" : "s"}
            {totalComments > 0 ? (
              <>
                {" · "}
                {totalComments} comment{totalComments === 1 ? "" : "s"}
              </>
            ) : null}
          </div>
        </div>
        <div className="flex-1" />
        <div className="flex items-center gap-2" style={NO_DRAG}>
          <Button
            size="sm"
            onClick={handleDone}
            disabled={!hasAny && copyState === "idle"}
            className="h-7 text-xs gap-1.5"
          >
            {copyState === "copied" ? (
              <>
                <CheckIcon className="size-3" /> Copied
              </>
            ) : (
              "Copy comments & close"
            )}
          </Button>
          <button
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded text-neutral-500 hover:bg-neutral-200 hover:text-neutral-700"
            title="Close (Esc)"
          >
            <XIcon size={14} />
          </button>
        </div>
      </div>

      <div className="flex min-h-0 flex-1">
        <div className="flex w-[260px] shrink-0 flex-col border-r border-neutral-200 bg-neutral-50">
          <div className="shrink-0 px-3 pt-2 pb-1 text-[10px] uppercase tracking-wide text-neutral-500">
            Files
          </div>
          <div className="flex-1 overflow-y-auto pb-2 text-xs">
            <TreeRenderer
              nodes={tree}
              depth={0}
              activePath={activePath}
              hasCommentsMap={{ get: fileHasAnyComments }}
              stats={stats}
              onSelect={scrollTo}
            />
          </div>
        </div>

        <div ref={scrollRef} className="flex-1 overflow-y-auto bg-white">
          {entries.map((entry) => (
            <FileBlock
              key={entry.path}
              entry={entry}
              diff={diffs.get(entry.path)}
              state={fileState[entry.path]}
              collapsed={!!collapsed[entry.path]}
              onToggleCollapse={() =>
                setCollapsed((cur) => ({ ...cur, [entry.path]: !cur[entry.path] }))
              }
              onGeneralChange={(v) =>
                updateFile(entry.path, (s) => ({ ...s, general: v }))
              }
              line={lineHandlers}
              scrollRoot={scrollRef}
              refFn={(el) => {
                if (el) fileRefs.current.set(entry.path, el);
                else fileRefs.current.delete(entry.path);
              }}
            />
          ))}
          <div className="h-[40vh]" aria-hidden />
        </div>
      </div>
      </div>
    </div>,
    document.body,
  );
}

function FileBlock({
  entry,
  diff,
  state,
  collapsed,
  onToggleCollapse,
  onGeneralChange,
  line,
  scrollRoot,
  refFn,
}: {
  entry: ReviewFileEntry;
  diff: FileDiffResult | undefined;
  state: FileCommentState | undefined;
  collapsed: boolean;
  onToggleCollapse: () => void;
  onGeneralChange: (v: string) => void;
  line: LineHandlers;
  scrollRoot: React.RefObject<HTMLDivElement | null>;
  refFn: (el: HTMLDivElement | null) => void;
}) {
  const lineComments = state?.lines ?? {};
  const general = state?.general ?? "";
  const lineCount = Object.values(lineComments).filter(
    (c) => c.text.trim() || c.draft.trim(),
  ).length;

  const [bodyMounted, setBodyMounted] = useState(false);
  const bodyAnchorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (bodyMounted || collapsed) return;
    const anchor = bodyAnchorRef.current;
    const root = scrollRoot.current;
    if (!anchor) return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setBodyMounted(true);
        }
      },
      { root, rootMargin: "800px 0px", threshold: 0 },
    );
    obs.observe(anchor);
    return () => obs.disconnect();
  }, [bodyMounted, collapsed, scrollRoot]);

  return (
    <div
      ref={refFn}
      data-path={entry.path}
      className="border-b border-neutral-200"
    >
      <div
        role="button"
        tabIndex={0}
        onClick={onToggleCollapse}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onToggleCollapse();
          }
        }}
        className="sticky top-0 z-10 flex cursor-pointer select-none items-center gap-2 border-b border-neutral-200 bg-neutral-100 px-2 py-1.5 hover:bg-neutral-200/70"
        title={collapsed ? "Expand" : "Collapse"}
      >
        <span className="flex size-4 shrink-0 items-center justify-center text-neutral-500">
          {collapsed ? (
            <ChevronRightIcon className="size-3" />
          ) : (
            <ChevronDownIcon className="size-3" />
          )}
        </span>
        <span className="font-mono text-xs break-all">{entry.path}</span>
        <span className="shrink-0 text-[10px] text-neutral-500">{entry.label}</span>
        {lineCount > 0 && (
          <span className="ml-auto shrink-0 rounded bg-blue-50 px-1.5 py-0.5 text-[10px] text-blue-600">
            {lineCount} comment{lineCount === 1 ? "" : "s"}
          </span>
        )}
      </div>

      {!collapsed && (
        <div
          ref={bodyAnchorRef}
          style={{
            minHeight: bodyMounted ? undefined : 600,
            contentVisibility: "auto",
            containIntrinsicSize: "auto 600px",
          } as CSSProperties}
        >
          {bodyMounted && (
            <>
              <DiffBlock
                path={entry.path}
                diff={diff}
                comments={lineComments}
                line={line}
              />
              <div className="border-t border-neutral-200 bg-neutral-50 px-3 py-2">
                <textarea
                  value={general}
                  onChange={(e) => onGeneralChange(e.target.value)}
                  placeholder="Leave a comment on this file…"
                  rows={2}
                  className="w-full rounded-md border border-neutral-200 bg-white px-3 py-2 font-mono text-xs resize-y focus:outline-none focus:ring-1 focus:ring-neutral-400"
                />
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

type LineHandlers = {
  start: (path: string, key: string) => void;
  change: (path: string, key: string, draft: string) => void;
  save: (path: string, key: string) => void;
  cancel: (path: string, key: string) => void;
  remove: (path: string, key: string) => void;
};

function DiffBlock({
  path,
  diff,
  comments,
  line,
}: {
  path: string;
  diff: FileDiffResult | undefined;
  comments: Record<string, LineComment>;
  line: LineHandlers;
}) {
  if (!diff) {
    return <p className="px-3 py-2 text-[11px] text-neutral-500">Loading diff…</p>;
  }
  if (diff.kind === "error") {
    return <p className="px-3 py-2 text-[11px] text-red-500">{diff.message}</p>;
  }
  if (diff.binary) {
    return (
      <p className="px-3 py-2 text-[11px] text-neutral-500">
        Binary file — no preview.
      </p>
    );
  }
  if (diff.oldText === diff.newText) {
    return (
      <p className="px-3 py-2 text-[11px] text-neutral-500">No textual changes.</p>
    );
  }
  return (
    <InlineDiff
      oldText={diff.oldText}
      newText={diff.newText}
      path={path}
      comments={comments}
      line={line}
    />
  );
}

const HIGHLIGHT_LINE_LIMIT = 1500;
const HUNK_CONTEXT = 3;

type Hunk = { start: number; end: number };

function buildHunks(lines: DiffLine[], commentKeys: Set<string>, context: number): Hunk[] {
  const anchors: number[] = [];
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    if (l.type !== "context") {
      anchors.push(i);
      continue;
    }
    if (commentKeys.has(lineKey(l))) anchors.push(i);
  }
  if (anchors.length === 0) return [];
  const ranges: Array<[number, number]> = [];
  for (const idx of anchors) {
    const s = Math.max(0, idx - context);
    const e = Math.min(lines.length, idx + 1 + context);
    if (ranges.length === 0 || s > ranges[ranges.length - 1][1]) {
      ranges.push([s, e]);
    } else {
      ranges[ranges.length - 1][1] = Math.max(ranges[ranges.length - 1][1], e);
    }
  }
  return ranges.map(([start, end]) => ({ start, end }));
}

function lineKey(line: DiffLine): string {
  if (line.type === "addition") return `+${line.newNum ?? "?"}`;
  if (line.type === "deletion") return `-${line.oldNum ?? "?"}`;
  return `c${line.newNum ?? line.oldNum ?? "?"}`;
}

function InlineDiff({
  oldText,
  newText,
  path,
  comments,
  line,
}: {
  oldText: string;
  newText: string;
  path: string;
  comments: Record<string, LineComment>;
  line: LineHandlers;
}) {
  const diff = useMemo(() => computeDiff(oldText, newText), [oldText, newText]);
  const shouldHighlight = diff.lines.length <= HIGHLIGHT_LINE_LIMIT;
  const highlighted = useHighlightedDiff(
    diff,
    shouldHighlight ? langFromPath(path) : "text",
  );
  const active = shouldHighlight && highlighted ? highlighted : diff;

  const commentKeys = useMemo(() => new Set(Object.keys(comments)), [comments]);
  const hunks = useMemo(
    () => buildHunks(active.lines, commentKeys, HUNK_CONTEXT),
    [active, commentKeys],
  );

  return (
    <div
      role="table"
      aria-label="Diff"
      className="font-mono text-[12px] leading-[18px]"
      style={{ tabSize: 2 }}
    >
      {hunks.map((hunk, hi) => (
        <HunkBlock
          key={hi}
          lines={active.lines}
          hunk={hunk}
          prevEnd={hi > 0 ? hunks[hi - 1].end : 0}
          totalLines={active.lines.length}
          path={path}
          comments={comments}
          handlers={line}
          isLast={hi === hunks.length - 1}
        />
      ))}
    </div>
  );
}

function HunkBlock({
  lines,
  hunk,
  prevEnd,
  totalLines,
  path,
  comments,
  handlers,
  isLast,
}: {
  lines: DiffLine[];
  hunk: Hunk;
  prevEnd: number;
  totalLines: number;
  path: string;
  comments: Record<string, LineComment>;
  handlers: LineHandlers;
  isLast: boolean;
}) {
  const gap = hunk.start - prevEnd;
  const oldStart = firstNumber(lines, hunk, "old") ?? 0;
  const newStart = firstNumber(lines, hunk, "new") ?? 0;
  let oldCount = 0;
  let newCount = 0;
  for (let i = hunk.start; i < hunk.end; i++) {
    if (lines[i].oldNum != null) oldCount++;
    if (lines[i].newNum != null) newCount++;
  }
  const trailingGap = isLast ? totalLines - hunk.end : 0;
  return (
    <>
      <HunkHeader
        label={`@@ -${oldStart},${oldCount} +${newStart},${newCount} @@`}
        hiddenAbove={gap > 0 ? gap : undefined}
      />
      {Array.from({ length: hunk.end - hunk.start }, (_, i) => {
        const idx = hunk.start + i;
        const l = lines[idx];
        const k = lineKey(l);
        return (
          <DiffLineRow
            key={k + ":" + idx}
            line={l}
            lineKey={k}
            path={path}
            comment={comments[k]}
            handlers={handlers}
          />
        );
      })}
      {trailingGap > 0 && <HunkHeader label={`… ${trailingGap} unchanged line${trailingGap === 1 ? "" : "s"} below`} />}
    </>
  );
}

function HunkHeader({ label, hiddenAbove }: { label: string; hiddenAbove?: number }) {
  const text = hiddenAbove != null
    ? `${label}  · ${hiddenAbove} unchanged line${hiddenAbove === 1 ? "" : "s"} hidden`
    : label;
  return (
    <div
      role="row"
      className="flex items-center gap-2 border-y border-neutral-200 bg-neutral-50 px-3 py-0.5 text-[10px] text-neutral-500 select-none"
    >
      <span className="font-mono">{text}</span>
    </div>
  );
}

function firstNumber(lines: DiffLine[], hunk: Hunk, which: "old" | "new"): number | null {
  for (let i = hunk.start; i < hunk.end; i++) {
    const n = which === "old" ? lines[i].oldNum : lines[i].newNum;
    if (n != null) return n;
  }
  return null;
}

const DiffLineRow = memo(function DiffLineRow({
  line,
  lineKey: keyStr,
  path,
  comment,
  handlers,
}: {
  line: DiffLine;
  lineKey: string;
  path: string;
  comment: LineComment | undefined;
  handlers: LineHandlers;
}) {
  const hasComment = !!comment;
  const rowBg =
    line.type === "addition"
      ? "bg-[rgba(46,160,67,0.08)]"
      : line.type === "deletion"
        ? "bg-[rgba(248,81,73,0.08)]"
        : "";
  const barColor =
    line.type === "addition"
      ? "bg-[rgba(63,185,80,0.7)]"
      : line.type === "deletion"
        ? "bg-[rgba(248,81,73,0.7)]"
        : "bg-transparent";

  return (
    <>
      <div
        role="row"
        className={cn("group relative flex items-stretch", rowBg)}
      >
        <div className="flex shrink-0 select-none text-right text-[10px] text-neutral-400">
          <span className="w-10 px-1.5 py-px">
            {line.oldNum ?? ""}
          </span>
          <span className="w-10 px-1.5 py-px">
            {line.newNum ?? ""}
          </span>
        </div>
        <div className="relative w-6 shrink-0">
          <span className={cn("absolute left-0 top-0 bottom-0 w-[3px]", barColor)} />
          {!hasComment && (
            <button
              type="button"
              onClick={() => handlers.start(path, keyStr)}
              className="absolute left-[4px] top-1/2 -translate-y-1/2 hidden size-[18px] items-center justify-center rounded bg-blue-500 text-white shadow-sm group-hover:flex hover:bg-blue-600"
              title="Add comment"
            >
              <MessageSquarePlusIcon className="size-[11px]" />
            </button>
          )}
        </div>
        <div className="flex-1 whitespace-pre pr-3" role="cell">
          <LineContent spans={line.spans} type={line.type} />
        </div>
      </div>
      {comment && (
        <CommentThread
          comment={comment}
          onEdit={() => handlers.start(path, keyStr)}
          onDelete={() => handlers.remove(path, keyStr)}
          onChange={(v) => handlers.change(path, keyStr, v)}
          onSave={() => handlers.save(path, keyStr)}
          onCancel={() => handlers.cancel(path, keyStr)}
        />
      )}
    </>
  );
});

function LineContent({ spans, type }: { spans: IntraLineSpan[]; type: string }) {
  if (spans.length === 1 && !spans[0].highlighted && !spans[0].color) {
    return <>{spans[0].text || " "}</>;
  }
  return (
    <>
      {spans.map((span, i) => {
        if (!span.highlighted && !span.color) {
          return <span key={i}>{span.text}</span>;
        }
        const style: CSSProperties = {};
        if (span.color) style.color = span.color;
        if (span.highlighted) {
          style.background =
            type === "deletion" ? "rgba(248, 81, 73, 0.25)" : "rgba(46, 160, 67, 0.25)";
          style.borderRadius = "2px";
        }
        return (
          <span key={i} style={style}>
            {span.text}
          </span>
        );
      })}
    </>
  );
}

function CommentThread({
  comment,
  onEdit,
  onDelete,
  onChange,
  onSave,
  onCancel,
}: {
  comment: LineComment;
  onEdit: () => void;
  onDelete: () => void;
  onChange: (v: string) => void;
  onSave: () => void;
  onCancel: () => void;
}) {
  if (comment.editing) {
    return (
      <div className="border-y border-blue-100 bg-blue-50/40 px-3 py-2">
        <textarea
          autoFocus
          value={comment.draft}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
              e.preventDefault();
              onSave();
            }
          }}
          placeholder="Leave a comment on this line…"
          rows={3}
          className="w-full rounded-md border border-neutral-200 bg-white px-3 py-2 font-sans text-xs resize-y focus:outline-none focus:ring-1 focus:ring-blue-400"
        />
        <div className="mt-2 flex items-center justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={onCancel} className="h-6 text-xs">
            Cancel
          </Button>
          <Button size="sm" onClick={onSave} className="h-6 text-xs">
            Comment
          </Button>
        </div>
      </div>
    );
  }
  return (
    <div className="group/thread flex items-start gap-2 border-y border-blue-100 bg-blue-50/40 px-3 py-2 text-xs">
      <div className="flex-1 whitespace-pre-wrap font-sans text-neutral-800">
        {comment.text}
      </div>
      <div className="flex shrink-0 items-center gap-1 opacity-0 group-hover/thread:opacity-100">
        <button
          type="button"
          onClick={onEdit}
          className="flex size-5 items-center justify-center rounded text-neutral-500 hover:bg-neutral-200"
          title="Edit"
        >
          <PencilIcon className="size-3" />
        </button>
        <button
          type="button"
          onClick={onDelete}
          className="flex size-5 items-center justify-center rounded text-neutral-500 hover:bg-neutral-200 hover:text-red-500"
          title="Delete"
        >
          <Trash2Icon className="size-3" />
        </button>
      </div>
    </div>
  );
}

function useHighlightedDiff(diff: DiffResult, lang: string): DiffResult | null {
  const [result, setResult] = useState<DiffResult | null>(null);
  const versionRef = useRef(0);
  useEffect(() => {
    if (lang === "text" || !diff.hasChanges) return;
    const version = ++versionRef.current;
    const oldLines: string[] = [];
    const newLines: string[] = [];
    for (const l of diff.lines) {
      const text = l.spans.map((s) => s.text).join("");
      if (l.type === "deletion") oldLines.push(text);
      else if (l.type === "addition") newLines.push(text);
      else {
        oldLines.push(text);
        newLines.push(text);
      }
    }
    Promise.all([
      oldLines.length > 0 ? tokenizeLines(oldLines, lang) : Promise.resolve([]),
      newLines.length > 0 ? tokenizeLines(newLines, lang) : Promise.resolve([]),
    ])
      .then(([oldTokens, newTokens]) => {
        if (version !== versionRef.current) return;
        let oi = 0;
        let ni = 0;
        const highlighted: DiffLine[] = diff.lines.map((line) => {
          let tokens: SyntaxToken[];
          if (line.type === "deletion") tokens = oldTokens[oi++] ?? [];
          else if (line.type === "addition") tokens = newTokens[ni++] ?? [];
          else {
            tokens = oldTokens[oi++] ?? [];
            ni++;
          }
          return { ...line, spans: mergeSpans(line.spans, tokens) };
        });
        setResult({ ...diff, lines: highlighted });
      })
      .catch(() => {});
    return () => {
      versionRef.current++;
    };
  }, [diff, lang]);
  return result;
}

function mergeSpans(diffSpans: IntraLineSpan[], syntaxTokens: SyntaxToken[]): IntraLineSpan[] {
  if (syntaxTokens.length === 0) return diffSpans;
  const out: IntraLineSpan[] = [];
  let si = 0;
  let so = 0;
  for (const span of diffSpans) {
    let remaining = span.text.length;
    if (remaining === 0) continue;
    while (remaining > 0 && si < syntaxTokens.length) {
      const t = syntaxTokens[si];
      const tRemaining = t.text.length - so;
      const take = Math.min(remaining, tRemaining);
      out.push({
        text: span.text.slice(span.text.length - remaining, span.text.length - remaining + take),
        highlighted: span.highlighted,
        color: t.color,
      });
      remaining -= take;
      so += take;
      if (so >= t.text.length) {
        si++;
        so = 0;
      }
    }
    if (remaining > 0) {
      out.push({
        text: span.text.slice(span.text.length - remaining),
        highlighted: span.highlighted,
      });
    }
  }
  return out;
}

function TreeRenderer({
  nodes,
  depth,
  activePath,
  hasCommentsMap,
  stats,
  onSelect,
}: {
  nodes: TreeNode[];
  depth: number;
  activePath: string | null;
  hasCommentsMap: { get: (path: string) => boolean };
  stats: Record<string, DiffStats>;
  onSelect: (path: string) => void;
}) {
  return (
    <div>
      {nodes.map((node) =>
        node.kind === "file" ? (
          <FileRow
            key={node.path}
            node={node}
            depth={depth}
            active={activePath === node.path}
            hasComment={hasCommentsMap.get(node.path)}
            stats={stats[node.path]}
            onSelect={onSelect}
          />
        ) : (
          <FolderRow
            key={node.path}
            node={node}
            depth={depth}
            activePath={activePath}
            hasCommentsMap={hasCommentsMap}
            stats={stats}
            onSelect={onSelect}
          />
        ),
      )}
    </div>
  );
}

const STATUS_BADGE: Record<string, { letter: string; className: string }> = {
  added: { letter: "A", className: "bg-green-100 text-green-700" },
  new: { letter: "A", className: "bg-green-100 text-green-700" },
  modified: { letter: "M", className: "bg-amber-100 text-amber-700" },
  deleted: { letter: "D", className: "bg-red-100 text-red-700" },
  renamed: { letter: "R", className: "bg-purple-100 text-purple-700" },
  copied: { letter: "C", className: "bg-blue-100 text-blue-700" },
  conflicted: { letter: "!", className: "bg-red-100 text-red-700" },
  "type changed": { letter: "T", className: "bg-neutral-200 text-neutral-700" },
  changed: { letter: "·", className: "bg-neutral-100 text-neutral-600" },
};

function FileRow({
  node,
  depth,
  active,
  hasComment,
  stats,
  onSelect,
}: {
  node: FileNode;
  depth: number;
  active: boolean;
  hasComment: boolean;
  stats: DiffStats | undefined;
  onSelect: (path: string) => void;
}) {
  const badge = STATUS_BADGE[node.entry.label] ?? STATUS_BADGE.changed;
  return (
    <button
      type="button"
      onClick={() => onSelect(node.path)}
      className={cn(
        "flex w-full items-center gap-1.5 px-2 py-[3px] text-left hover:bg-neutral-100",
        active && "bg-neutral-200 hover:bg-neutral-200",
      )}
      style={{ paddingLeft: `${8 + depth * 12}px` }}
      title={node.path}
    >
      <span
        className={cn(
          "flex size-4 shrink-0 items-center justify-center rounded-sm text-[9px] font-semibold",
          badge.className,
        )}
      >
        {badge.letter}
      </span>
      <span className="truncate">{node.name}</span>
      {hasComment && (
        <span className="size-1.5 shrink-0 rounded-full bg-blue-500" />
      )}
      <span className="ml-auto shrink-0 flex items-center gap-1 text-[10px] tabular-nums">
        {stats?.binary ? (
          <span className="text-neutral-400">bin</span>
        ) : stats ? (
          <>
            {stats.additions > 0 && (
              <span className="text-green-600">+{stats.additions}</span>
            )}
            {stats.deletions > 0 && (
              <span className="text-red-500">−{stats.deletions}</span>
            )}
          </>
        ) : null}
      </span>
    </button>
  );
}

function FolderRow({
  node,
  depth,
  activePath,
  hasCommentsMap,
  stats,
  onSelect,
}: {
  node: FolderNode;
  depth: number;
  activePath: string | null;
  hasCommentsMap: { get: (path: string) => boolean };
  stats: Record<string, DiffStats>;
  onSelect: (path: string) => void;
}) {
  const [expanded, setExpanded] = useState(true);
  return (
    <>
      <button
        type="button"
        onClick={() => setExpanded((e) => !e)}
        className="flex w-full items-center gap-1 px-2 py-[3px] text-left text-neutral-600 hover:bg-neutral-100"
        style={{ paddingLeft: `${8 + depth * 12}px` }}
      >
        {expanded ? (
          <ChevronDownIcon className="size-3 shrink-0 text-neutral-500" />
        ) : (
          <ChevronRightIcon className="size-3 shrink-0 text-neutral-500" />
        )}
        <span className="truncate">{node.name}</span>
      </button>
      {expanded && (
        <TreeRenderer
          nodes={node.children}
          depth={depth + 1}
          activePath={activePath}
          hasCommentsMap={hasCommentsMap}
          stats={stats}
          onSelect={onSelect}
        />
      )}
    </>
  );
}

function buildTree(entries: ReviewFileEntry[]): TreeNode[] {
  const root: FolderNode = { kind: "folder", name: "", path: "", children: [] };
  for (const entry of entries) {
    const parts = entry.path.split("/").filter(Boolean);
    let node: FolderNode = root;
    for (let i = 0; i < parts.length - 1; i++) {
      const name = parts[i];
      const folderPath = parts.slice(0, i + 1).join("/");
      let child = node.children.find(
        (n): n is FolderNode => n.kind === "folder" && n.name === name,
      );
      if (!child) {
        child = { kind: "folder", name, path: folderPath, children: [] };
        node.children.push(child);
      }
      node = child;
    }
    node.children.push({
      kind: "file",
      name: parts[parts.length - 1],
      path: entry.path,
      entry,
    });
  }
  sortTree(root.children);
  return collapseSingletons(root.children);
}

function sortTree(nodes: TreeNode[]) {
  nodes.sort((a, b) => {
    if (a.kind !== b.kind) return a.kind === "folder" ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
  for (const n of nodes) {
    if (n.kind === "folder") sortTree(n.children);
  }
}

function collapseSingletons(nodes: TreeNode[]): TreeNode[] {
  return nodes.map((node) => {
    if (node.kind !== "folder") return node;
    let folder = node;
    while (folder.children.length === 1 && folder.children[0].kind === "folder") {
      const only = folder.children[0];
      folder = {
        kind: "folder",
        name: `${folder.name}/${only.name}`,
        path: only.path,
        children: only.children,
      };
    }
    return { ...folder, children: collapseSingletons(folder.children) };
  });
}

function serializeComments(
  entries: ReviewFileEntry[],
  state: Record<string, FileCommentState>,
  diffs: Map<string, FileDiffResult>,
): string {
  const out: string[] = [];
  for (const entry of entries) {
    const s = state[entry.path];
    if (!s) continue;
    const lineComments = Object.entries(s.lines)
      .map(([key, c]) => ({ key, text: c.text.trim() }))
      .filter((c) => c.text.length > 0);
    const general = s.general.trim();
    if (lineComments.length === 0 && !general) continue;

    const diff = diffs.get(entry.path);
    let byKey: Map<string, DiffLine> | null = null;
    if (diff?.kind === "ok" && !diff.binary && diff.oldText !== diff.newText) {
      byKey = new Map();
      for (const l of computeDiff(diff.oldText, diff.newText).lines) {
        byKey.set(lineKey(l), l);
      }
    }
    lineComments.sort((a, b) => keySortNum(a.key) - keySortNum(b.key));

    out.push(`### ${entry.path}`);
    out.push("");
    for (const { key, text } of lineComments) {
      const line = byKey?.get(key);
      const lineRef = line ? lineRefString(line) : key;
      const snippet = line ? truncate(line.spans.map((s) => s.text).join("")) : "";
      if (snippet) {
        out.push(`**${lineRef}** \`${snippet}\``);
      } else {
        out.push(`**${lineRef}**`);
      }
      for (const ln of text.split("\n")) out.push(`> ${ln}`);
      out.push("");
    }
    if (general) {
      out.push(general);
      out.push("");
    }
  }
  return out.join("\n").trim();
}

function keySortNum(key: string): number {
  const n = Number(key.slice(1));
  return Number.isFinite(n) ? n : 0;
}

function lineRefString(line: DiffLine): string {
  if (line.type === "addition") return `+L${line.newNum ?? "?"}`;
  if (line.type === "deletion") return `-L${line.oldNum ?? "?"}`;
  return `L${line.newNum ?? line.oldNum ?? "?"}`;
}

function truncate(s: string, n = 80): string {
  const t = s.replace(/\s+/g, " ").trim();
  return t.length > n ? t.slice(0, n - 1) + "…" : t;
}

function randomId(): string {
  return Math.random().toString(36).slice(2, 10);
}
