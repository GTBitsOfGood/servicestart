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
  const [saveError, setSaveError] = useState<string | null>(null);
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
    const rawTargetId = String(operation.target.id);
    const targetId = rawTargetId.replace(
      /__(?:top|mid|bottom)$/,
      "",
    ) as WidgetId;
    if (sourceId === targetId) return;

    const isSwapZone = rawTargetId.endsWith("__mid");

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

      // Cross-column: move (top/bottom zones) or swap (mid zone)
      const srcCol = srcInCol1 ? col1 : col2;
      const tgtCol = srcInCol1 ? col2 : col1;

      if (!isSwapZone && srcCol.length === 2 && tgtCol.length === 1) {
        const newSrc = srcCol.filter((id) => id !== sourceId);
        const droppedOnTop = rawTargetId.endsWith("__top");
        const newTgt = droppedOnTop
          ? [sourceId, ...tgtCol]
          : [...tgtCol, sourceId];
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
    setSaveError(null);
    try {
      await onSave({
        layout: "horizontal",
        widgets: columnsToWidgets(columns),
      });
      setHasChanges(false);
    } catch (err) {
      setSaveError(
        err instanceof Error ? err.message : "Failed to save layout",
      );
    } finally {
      setIsSaving(false);
    }
  }, [columns, onSave]);

  const handleDiscard = useCallback(() => {
    setColumns(splitInitialLayout(initialLayout.widgets));
    setHasChanges(false);
    setSaveError(null);
  }, [initialLayout.widgets]);

  const widgetLabels = useMemo(
    () => Object.fromEntries(availableWidgets.map((w) => [w.id, w.label])),
    [availableWidgets],
  );

  return (
    <div className="-mx-6 -my-4 flex min-h-[calc(100vh-48px)]">
      {/* ── Left panel ───────────────────────────────────────────── */}
      <div className="flex w-200 shrink-0 flex-col px-20 py-40">
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
        <p className="mt-2.5 max-w-152 text-paragraph-2 text-grey-text-weak">
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

        <div className="mt-8 flex flex-col items-end gap-2">
          <div className="flex items-center gap-3">
            <button
              onClick={handleDiscard}
              disabled={!hasChanges}
              type="button"
              className={`flex items-center gap-1 rounded px-2 py-2 text-paragraph-2 font-semibold transition-colors ${
                hasChanges
                  ? "text-brand-text hover:opacity-80"
                  : "text-grey-off-state"
              }`}
            >
              <BogIcon
                name="arrow-counter-clockwise"
                size={20}
                color={
                  hasChanges
                    ? "var(--color-brand-text)"
                    : "var(--color-grey-off-state)"
                }
              />
              Discard Changes
            </button>
            <button
              onClick={handleSave}
              disabled={!hasChanges || isSaving}
              type="button"
              className={`rounded px-3 py-2 text-paragraph-2 font-semibold text-white transition-colors ${
                hasChanges
                  ? "bg-brand-text hover:opacity-90"
                  : "bg-grey-fill-weak"
              }`}
            >
              {isSaving ? "Saving..." : "Save Layout"}
            </button>
          </div>
          {saveError && (
            <p className="text-paragraph-2 text-status-red-text">{saveError}</p>
          )}
        </div>
      </div>

      {/* ── Right panel: preview ─────────────────────────────────── */}
      <div className="flex flex-1 flex-col bg-media-page-bg px-12 py-40">
        <p className="font-normal text-heading-2 text-black/40">
          Dashboard preview
        </p>
        <div className="mt-9">
          <DragDropProvider
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
      className={`flex w-full cursor-pointer flex-col items-start rounded-xl p-2 transition-all ${
        isSelected
          ? "border-2 border-brand-stroke-strong"
          : "border-2 border-transparent hover:border-brand-stroke-weak"
      } ${isDisabled ? "cursor-not-allowed opacity-50" : ""}`}
    >
      <div className="flex w-full flex-col gap-1">
        <div className="aspect-[8/5] w-full rounded-xl bg-media-divider" />
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

  const srcInCol1 = activeId !== null && col1.includes(activeId);
  const srcCol = srcInCol1 ? col1 : col2;
  const tgtCol = srcInCol1 ? col2 : col1;
  const isMoveCase =
    activeId !== null && srcCol.length === 2 && tgtCol.length === 1;
  const tgtIsCol1 = isMoveCase && !srcInCol1;
  const tgtIsCol2 = isMoveCase && srcInCol1;

  return (
    <div className="grid h-[474px] grid-cols-2 gap-8">
      {tgtIsCol1 ? (
        <MoveTargetColumn
          widgetId={col1[0]}
          label={widgetLabels[col1[0]] ?? col1[0]}
        />
      ) : (
        <div className="flex flex-col gap-8">
          {col1.map((id) => (
            <PreviewWidget
              key={id}
              id={id}
              label={widgetLabels[id] ?? id}
              isTall={s1 === "tall"}
              isDragSource={activeId === id}
              disableDrop={isMoveCase && activeId !== id}
            />
          ))}
        </div>
      )}
      {col2.length > 0 &&
        (tgtIsCol2 ? (
          <MoveTargetColumn
            widgetId={col2[0]}
            label={widgetLabels[col2[0]] ?? col2[0]}
          />
        ) : (
          <div className="flex flex-col gap-8">
            {col2.map((id) => (
              <PreviewWidget
                key={id}
                id={id}
                label={widgetLabels[id] ?? id}
                isTall={s2 === "tall"}
                isDragSource={activeId === id}
                disableDrop={isMoveCase && activeId !== id}
              />
            ))}
          </div>
        ))}
    </div>
  );
}

// ── MoveTargetColumn ─────────────────────────────────────────────────────────
// Uses two separate droppable zones (top half / bottom half) so dnd-kit's own
// collision detection tells us which side the cursor is on. This avoids any
// pointer/mouse event tracking, which dnd-kit's setPointerCapture blocks.

function MoveTargetColumn({
  widgetId,
  label,
}: {
  widgetId: WidgetId;
  label: string;
}) {
  const { ref: topRef, isDropTarget: isTopTarget } = useDroppable({
    id: `${widgetId}__top`,
  });
  const { ref: midRef, isDropTarget: isMidTarget } = useDroppable({
    id: `${widgetId}__mid`,
  });
  const { ref: bottomRef, isDropTarget: isBottomTarget } = useDroppable({
    id: `${widgetId}__bottom`,
  });

  const widgetBox = (shrunk: boolean, highlighted: boolean) => (
    <div
      className={`flex items-start rounded-xl border p-6 transition-colors ${
        shrunk ? "h-1/2" : "flex-1"
      } ${
        highlighted
          ? "border-brand-stroke-strong bg-brand-fill"
          : "border-transparent bg-white"
      }`}
    >
      <p className="text-paragraph-1 font-semibold text-black/40">
        [{label.toLowerCase()} widget here]
      </p>
    </div>
  );

  const divider = (
    <div className="mx-4 border-t-4 border-brand-stroke-strong" />
  );

  return (
    <div className="relative flex flex-col">
      {/* Three invisible drop zones: top 25% = move above, middle 50% = swap, bottom 25% = move below */}
      <div ref={topRef} className="absolute inset-x-0 top-0 z-10 h-1/4" />
      <div ref={midRef} className="absolute inset-x-0 top-1/4 z-10 h-1/2" />
      <div ref={bottomRef} className="absolute inset-x-0 bottom-0 z-10 h-1/4" />

      {isTopTarget ? (
        <>
          <div className="flex-1" />
          {divider}
          <div className="h-2" />
          {widgetBox(true, false)}
        </>
      ) : isBottomTarget ? (
        <>
          {widgetBox(true, false)}
          <div className="h-2" />
          {divider}
          <div className="flex-1" />
        </>
      ) : (
        widgetBox(false, isMidTarget)
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
  disableDrop?: boolean;
}

function PreviewWidget({
  id,
  label,
  isTall,
  isDragSource,
  disableDrop = false,
}: PreviewWidgetProps) {
  const { ref: dragRef } = useDraggable({ id });
  const { ref: dropRef, isDropTarget } = useDroppable({ id });

  const showHighlight = isDropTarget && !disableDrop;

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
          ? "border-dashed border-brand-hover bg-brand-surface"
          : showHighlight
            ? "border-brand-stroke-strong bg-brand-fill"
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
      className={`flex items-start rounded-xl border border-brand-hover bg-white p-6 shadow-lg ${
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
