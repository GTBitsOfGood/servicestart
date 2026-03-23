"use client";

import { useState, useCallback, useMemo } from "react";
import {
  DragDropProvider,
  DragOverlay,
  useDraggable,
  useDroppable,
} from "@dnd-kit/react";
import BogIcon from "@/components/bog/BogIcon/BogIcon";
import type {
  DashboardLayout,
  DashboardWidget,
  WidgetId,
} from "@/lib/dashboard/schema";

interface WidgetOption {
  id: WidgetId;
  label: string;
}

interface DashboardLayoutBuilderProps {
  availableWidgets: WidgetOption[];
  initialLayout: DashboardLayout;
  onSave: (layout: DashboardLayout) => Promise<void>;
}

interface ColumnState {
  col1: WidgetId[];
  col2: WidgetId[];
}

const MAX_WIDGETS = 4;

function colSize(len: number): "tall" | "small" {
  return len === 1 ? "tall" : "small";
}

function columnsToWidgets({ col1, col2 }: ColumnState): DashboardWidget[] {
  const s1 = colSize(col1.length);
  const s2 = colSize(col2.length);
  return [
    ...col1.map((id) => ({ id, size: s1 })),
    ...col2.map((id) => ({ id, size: s2 })),
  ];
}

function splitInitialLayout(widgets: DashboardWidget[]): ColumnState {
  const col1: WidgetId[] = [];
  const col2: WidgetId[] = [];
  let w1 = 0;
  let w2 = 0;
  for (const w of widgets) {
    const weight = w.size === "tall" ? 2 : 1;
    if (w1 <= w2) {
      col1.push(w.id);
      w1 += weight;
    } else {
      col2.push(w.id);
      w2 += weight;
    }
  }
  return { col1, col2 };
}

function rebalance({ col1, col2 }: ColumnState): ColumnState {
  if (col1.length === 0 && col2.length > 0) {
    return { col1: [col2[0]], col2: col2.slice(1) };
  }
  if (col2.length === 0 && col1.length > 1) {
    return { col1: col1.slice(0, -1), col2: [col1[col1.length - 1]] };
  }
  return { col1, col2 };
}

export default function DashboardLayoutBuilder({
  availableWidgets,
  initialLayout,
  onSave,
}: DashboardLayoutBuilderProps) {
  const [columns, setColumns] = useState<ColumnState>(() =>
    splitInitialLayout(initialLayout.widgets),
  );
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(() => {
    const reconstructed = columnsToWidgets(
      splitInitialLayout(initialLayout.widgets),
    );
    const saved = initialLayout.widgets;
    return (
      reconstructed.length !== saved.length ||
      reconstructed.some(
        (w, i) => w.id !== saved[i].id || w.size !== saved[i].size,
      )
    );
  });
  const [activeId, setActiveId] = useState<WidgetId | null>(null);

  const { col1, col2 } = columns;
  const total = col1.length + col2.length;

  const selectedIds = useMemo(
    () => new Set<WidgetId>([...col1, ...col2]),
    [col1, col2],
  );

  const previewKey = [...col1, "|", ...col2].join(",");

  const toggleWidget = useCallback((widgetId: WidgetId) => {
    setColumns((prev) => {
      const { col1, col2 } = prev;

      if (col1.includes(widgetId) || col2.includes(widgetId)) {
        return rebalance({
          col1: col1.filter((id) => id !== widgetId),
          col2: col2.filter((id) => id !== widgetId),
        });
      }

      if (col1.length + col2.length >= MAX_WIDGETS) return prev;

      // First widget goes to col1; after that, tiebreak favors col2
      // so the natural progression is: 1→col1, 2→col2, 3→col2, 4→col1
      if (col1.length + col2.length === 0) {
        return { col1: [widgetId], col2 };
      }
      if (col1.length < col2.length) {
        return { col1: [...col1, widgetId], col2 };
      }
      return { col1, col2: [...col2, widgetId] };
    });
    setHasChanges(true);
  }, []);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleDragStart = useCallback((event: any) => {
    const id = event?.operation?.source?.id;
    if (id) setActiveId(String(id) as WidgetId);
  }, []);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleDragEnd = useCallback((event: any) => {
    setActiveId(null);

    const operation = event?.operation;
    if (!operation?.source || !operation?.target) return;

    const sourceId = String(operation.source.id) as WidgetId;
    const targetId = String(operation.target.id) as WidgetId;
    if (sourceId === targetId) return;

    setColumns((prev) => {
      const { col1, col2 } = prev;

      const srcInCol1 = col1.includes(sourceId);
      const tgtInCol1 = col1.includes(targetId);

      if (srcInCol1 === tgtInCol1) {
        const col = srcInCol1 ? [...col1] : [...col2];
        const si = col.indexOf(sourceId);
        const ti = col.indexOf(targetId);
        if (si < 0 || ti < 0) return prev;
        col[si] = targetId;
        col[ti] = sourceId;
        return srcInCol1 ? { col1: col, col2 } : { col1, col2: col };
      }

      // Cross-column: move when valid (2→1), swap otherwise
      const srcCol = srcInCol1 ? col1 : col2;
      const tgtCol = srcInCol1 ? col2 : col1;

      if (srcCol.length === 2 && tgtCol.length === 1) {
        const newSrc = srcCol.filter((id) => id !== sourceId);
        const newTgt = [...tgtCol, sourceId];
        return srcInCol1
          ? { col1: newSrc, col2: newTgt }
          : { col1: newTgt, col2: newSrc };
      }

      const newSrcCol = srcCol.map((id) => (id === sourceId ? targetId : id));
      const newTgtCol = tgtCol.map((id) => (id === targetId ? sourceId : id));
      return srcInCol1
        ? { col1: newSrcCol, col2: newTgtCol }
        : { col1: newTgtCol, col2: newSrcCol };
    });

    setHasChanges(true);
  }, []);

  const handleSave = useCallback(async () => {
    setIsSaving(true);
    try {
      await onSave({
        layout: "horizontal",
        widgets: columnsToWidgets(columns),
      });
      setHasChanges(false);
    } finally {
      setIsSaving(false);
    }
  }, [columns, onSave]);

  const widgetLabels = useMemo(
    () => Object.fromEntries(availableWidgets.map((w) => [w.id, w.label])),
    [availableWidgets],
  );

  return (
    <div className="-mx-6 -my-4 flex min-h-[calc(100vh-48px)]">
      {/* ── Left panel ───────────────────────────────────────────── */}
      <div className="flex w-[500px] shrink-0 flex-col px-20 py-[100px]">
        <div className="flex items-center gap-1.5">
          <BogIcon
            name="gear"
            size={36}
            color="var(--color-grey-text-strong)"
          />
          <h1 className="font-normal text-heading-2 text-grey-text-strong">
            Customize Dashboard
          </h1>
        </div>
        <p className="mt-2.5 max-w-[380px] text-paragraph-2 text-grey-text-weak">
          Select up to {MAX_WIDGETS} widgets for your dashboard and drag them to
          reorder.
        </p>

        <div className="mt-9 grid grid-cols-2 gap-6">
          {availableWidgets.map((widget) => (
            <WidgetCard
              key={widget.id}
              widget={widget}
              isSelected={selectedIds.has(widget.id)}
              isDisabled={!selectedIds.has(widget.id) && total >= MAX_WIDGETS}
              onToggle={toggleWidget}
            />
          ))}
        </div>

        {hasChanges && (
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="mt-8 rounded-lg bg-brand-text px-6 py-3 text-paragraph-1 font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
            type="button"
          >
            {isSaving ? "Saving..." : "Save Layout"}
          </button>
        )}
      </div>

      {/* ── Right panel: preview ─────────────────────────────────── */}
      <div className="flex flex-1 flex-col bg-[#F2F2F2] px-12 py-[100px]">
        <p className="font-normal text-heading-2 text-black/40">
          Dashboard preview
        </p>
        <div className="mt-9">
          <DragDropProvider
            key={previewKey}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
          >
            <PreviewGrid
              col1={col1}
              col2={col2}
              widgetLabels={widgetLabels}
              activeId={activeId}
            />
            <DragOverlay>
              {activeId ? (
                <OverlayCard
                  label={widgetLabels[activeId] ?? activeId}
                  isTall={
                    col1.includes(activeId)
                      ? colSize(col1.length) === "tall"
                      : colSize(col2.length) === "tall"
                  }
                />
              ) : null}
            </DragOverlay>
          </DragDropProvider>
        </div>
      </div>
    </div>
  );
}

// ── WidgetCard ────────────────────────────────────────────────────────────────

interface WidgetCardProps {
  widget: WidgetOption;
  isSelected: boolean;
  isDisabled: boolean;
  onToggle: (id: WidgetId) => void;
}

function WidgetCard({
  widget,
  isSelected,
  isDisabled,
  onToggle,
}: WidgetCardProps) {
  return (
    <button
      onClick={() => onToggle(widget.id)}
      disabled={isDisabled}
      type="button"
      className={`flex w-[198px] cursor-pointer flex-col items-start rounded-xl p-2 transition-all ${
        isSelected
          ? "border-2 border-[rgba(252,91,67,0.8)]"
          : "border-2 border-transparent hover:border-[rgba(252,91,67,0.2)]"
      } ${isDisabled ? "cursor-not-allowed opacity-50" : ""}`}
    >
      <div className="flex w-full flex-col gap-1">
        <div className="h-[116px] w-[182px] rounded-xl bg-[#D9D9D9]" />
        <p className="text-left text-paragraph-2 text-black">{widget.label}</p>
      </div>
    </button>
  );
}

// ── PreviewGrid ───────────────────────────────────────────────────────────────

interface PreviewGridProps {
  col1: WidgetId[];
  col2: WidgetId[];
  widgetLabels: Record<string, string>;
  activeId: WidgetId | null;
}

function PreviewGrid({ col1, col2, widgetLabels, activeId }: PreviewGridProps) {
  if (col1.length === 0 && col2.length === 0) {
    return (
      <div className="flex h-[474px] items-center justify-center rounded-xl border-2 border-dashed border-grey-stroke-weak text-paragraph-1 text-grey-text-weak">
        Select widgets to preview your dashboard
      </div>
    );
  }

  const s1 = colSize(col1.length);
  const s2 = colSize(col2.length);

  return (
    <div className="grid h-[474px] grid-cols-2 gap-8">
      <div className="flex flex-col gap-8">
        {col1.map((id) => (
          <PreviewWidget
            key={id}
            id={id}
            label={widgetLabels[id] ?? id}
            isTall={s1 === "tall"}
            isDragSource={activeId === id}
          />
        ))}
      </div>
      {col2.length > 0 && (
        <div className="flex flex-col gap-8">
          {col2.map((id) => (
            <PreviewWidget
              key={id}
              id={id}
              label={widgetLabels[id] ?? id}
              isTall={s2 === "tall"}
              isDragSource={activeId === id}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ── PreviewWidget ─────────────────────────────────────────────────────────────

interface PreviewWidgetProps {
  id: WidgetId;
  label: string;
  isTall: boolean;
  isDragSource: boolean;
}

function PreviewWidget({
  id,
  label,
  isTall,
  isDragSource,
}: PreviewWidgetProps) {
  const { ref: dragRef } = useDraggable({ id });
  const { ref: dropRef } = useDroppable({ id });

  return (
    <div
      ref={(el) => {
        dragRef(el);
        dropRef(el);
      }}
      style={{ cursor: isDragSource ? "grabbing" : "grab", minHeight: 0 }}
      className={`flex items-start rounded-xl border p-6 transition-colors ${
        isTall ? "flex-1" : "h-1/2"
      } ${
        isDragSource
          ? "border-dashed border-[rgba(252,91,67,0.4)] bg-[#FCE4E1]"
          : "border-transparent bg-white"
      }`}
    >
      {isDragSource ? null : (
        <p className="text-paragraph-1 font-semibold text-black/40">
          [{label.toLowerCase()} widget here]
        </p>
      )}
    </div>
  );
}

// ── OverlayCard (follows cursor during drag) ──────────────────────────────────

function OverlayCard({ label, isTall }: { label: string; isTall: boolean }) {
  return (
    <div
      className={`flex items-start rounded-xl border border-[rgba(252,91,67,0.6)] bg-white p-6 shadow-lg ${
        isTall ? "h-[474px]" : "h-[221px]"
      }`}
      style={{ width: "100%" }}
    >
      <p className="text-paragraph-1 font-semibold text-black/40">
        [{label.toLowerCase()} widget here]
      </p>
    </div>
  );
}
