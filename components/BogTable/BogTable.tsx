import { Table, Theme } from "@radix-ui/themes";
import React, { ReactNode } from "react";
import styles from "./styles.module.css";
import { useResponsive } from "../../utils/design-system/hooks/useResponsive";
import { getNumericalSizeFromBreakpoint } from "../../utils/design-system/breakpoints/breakpoints";
import BogTextInput from "../BogTextInput/BogTextInput";
import BogIcon from "../BogIcon/BogIcon";
import BogButton from "../BogButton/BogButton";
import BogPopover from "../BogPopover/BogPopover";
import { Popover } from "radix-ui";
import BogCheckbox from "../BogCheckbox/BogCheckbox";
import BogDropdown from "../BogDropdown/BogDropdown";
import BogChip from "../BogChip/BogChip";

type ColumnDatatype = "string" | "string[]" | "number" | "number[]" | "other";

type FilterCondition =
  | "Value is"
  | "Value is not"
  | "Value contains"
  | "Value does not contain"
  | "Value is blank"
  | "Value is not blank";

type ColumnFilter = {
  condition: FilterCondition;
  value?: string;
};

export type ColumnHeaderCellContent = {
  /** Props forwarded to Radix Table.Cell / Table.ColumnHeaderCell */
  styleProps?: React.ComponentProps<typeof Table.ColumnHeaderCell>;
  /** Cell text/content */
  content: string;
  /** datatype for sorting behavior */
  datatype: ColumnDatatype;
};

export type RowCellContent = {
  /** Props forwarded to Radix Table.Cell / Table.RowHeaderCell */
  styleProps?: React.ComponentProps<typeof Table.Cell>;
  /** Cell text/content */
  content: ReactNode;
};

export type TableRow = {
  /** Props forwarded to Radix Table.Row */
  styleProps?: React.ComponentProps<typeof Table.Row>;
  /** Cells for this row (first becomes RowHeaderCell) */
  cells: RowCellContent[];
};

interface BogTableProps extends Omit<
  React.ComponentProps<typeof Table.Root>,
  "size"
> {
  /** Column headers for the table (rendered in thead) */
  columnHeaders: ColumnHeaderCellContent[];
  /** Data rows (rendered in tbody) */
  rows: TableRow[];
  /** Visual size; responsive maps breakpoints -> small|medium|large */
  size?: "small" | "medium" | "large" | "responsive";
  /** Tailwind / custom class names */
  className?: string;
  /** Inline styles */
  style?: React.CSSProperties;
}

const BogTable: React.FC<BogTableProps> = ({
  columnHeaders,
  rows,
  size = "responsive",
  className,
  style,
  ...rootProps
}) => {
  const breakpoint = useResponsive();
  type SortDirection = "asc" | "desc";
  type SortEntry = { index: number; direction: SortDirection };

  const [sorts, setSorts] = React.useState<SortEntry[]>([]);
  const [query, setQuery] = React.useState("");

  const [selectedColumns, setSelectedColumns] = React.useState<number[]>([]);
  const [draftFilterCols, setDraftFilterCols] = React.useState<number[]>([]);
  const [columnFilters, setColumnFilters] = React.useState<
    Record<number, ColumnFilter>
  >({});
  const [draftColumnFilters, setDraftColumnFilters] = React.useState<
    Record<number, ColumnFilter>
  >({});

  const extractText = (node: ReactNode): string => {
    if (node == null || typeof node === "boolean") return "";
    if (typeof node === "string" || typeof node === "number")
      return String(node);
    if (Array.isArray(node)) return node.map(extractText).join(" ");
    if (React.isValidElement(node)) {
      const { children } = (node.props as { children?: ReactNode }) ?? {};
      return extractText(children);
    }
    return "";
  };

  const matchesFilter = (text: string, f: ColumnFilter): boolean => {
    const v = text.trim();
    const lc = v.toLowerCase();
    switch (f.condition) {
      case "Value is":
        return f.value != null && lc === String(f.value).toLowerCase().trim();
      case "Value is not":
        return f.value != null && lc !== String(f.value).toLowerCase().trim();
      case "Value contains":
        return f.value != null && lc.includes(String(f.value).toLowerCase());
      case "Value does not contain":
        return f.value != null && !lc.includes(String(f.value).toLowerCase());
      case "Value is blank":
        return v.length === 0;
      case "Value is not blank":
        return v.length > 0;
      default:
        return true;
    }
  };

  const filteredRows = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    const afterSearch = !q
      ? rows
      : rows.filter((row) =>
          row.cells.some((cell) =>
            extractText(cell.content).toLowerCase().includes(q),
          ),
        );

    const active = Object.entries(columnFilters)
      .map(([k, v]) => [Number(k), v] as const)
      .filter(([idx]) => selectedColumns.includes(idx));

    if (active.length === 0) return afterSearch;

    return afterSearch.filter((row) =>
      active.every(([colIdx, f]) => {
        const cell = row.cells[colIdx];
        if (!cell) return false;
        const txt = extractText(cell.content);
        return matchesFilter(txt, f);
      }),
    );
  }, [rows, query, selectedColumns, columnFilters]);

  const getSortForColumn = (colIndex: number): SortDirection | undefined =>
    sorts.find((s) => s.index === colIndex)?.direction;

  const toggleSort = (colIndex: number) => {
    setSorts((prev) => {
      const i = prev.findIndex((s) => s.index === colIndex);
      if (i === -1) {
        return [...prev, { index: colIndex, direction: "asc" }];
      }
      const dir = prev[i].direction;
      if (dir === "asc") {
        const next = [...prev];
        next[i] = { index: colIndex, direction: "desc" };
        return next;
      }
      return prev.filter((s) => s.index !== colIndex);
    });
  };

  const getSortValue = (
    node: ReactNode,
    datatype?: ColumnDatatype,
  ): number | string => {
    const text = extractText(node).trim();
    switch (datatype) {
      case "number":
      case "number[]": {
        const nums = text.match(/-?\d+(\.\d+)?/g)?.map(Number) ?? [];
        return nums.length ? nums[0] : Number.NaN;
      }
      case "string":
      case "string[]":
      default:
        return text.toLowerCase();
    }
  };

  const sortedRows = React.useMemo(() => {
    if (sorts.length === 0) return filteredRows;
    const decorated = filteredRows.map((row, idx) => ({ row, idx }));
    decorated.sort((a, b) => {
      for (const { index, direction } of sorts) {
        const dt = columnHeaders[index]?.datatype;
        const av = getSortValue(a.row.cells[index]?.content, dt);
        const bv = getSortValue(b.row.cells[index]?.content, dt);

        let cmp = 0;
        if (typeof av === "number" && typeof bv === "number") {
          const aNum = Number.isNaN(av) ? Number.POSITIVE_INFINITY : av;
          const bNum = Number.isNaN(bv) ? Number.POSITIVE_INFINITY : bv;
          cmp = aNum - bNum;
        } else {
          cmp = String(av).localeCompare(String(bv), undefined, {
            numeric: true,
            sensitivity: "base",
          });
        }
        if (cmp !== 0) {
          return direction === "asc" ? cmp : -cmp;
        }
      }
      return a.idx - b.idx;
    });
    return decorated.map((d) => d.row);
  }, [filteredRows, sorts, columnHeaders]);

  const handleSearchChange: React.FormEventHandler<HTMLDivElement> = (e) => {
    const el = e.target as HTMLInputElement;
    if (el && typeof el.value === "string") setQuery(el.value);
  };

  const radixSize: "1" | "2" | "3" =
    size === "responsive"
      ? getNumericalSizeFromBreakpoint(breakpoint)
      : ({ small: "1", medium: "2", large: "3" } as const)[size];

  const sizeClass = `size${radixSize}`;

  const removeColumnFilter = (colIdx: number) => {
    setSelectedColumns((prev) => prev.filter((i) => i !== colIdx));
    setColumnFilters((prev) => {
      const next = { ...prev };
      delete next[colIdx];
      return next;
    });
  };

  const hasChips = selectedColumns.length > 0;

  return (
    <Theme>
      <div className={styles.bogTable}>
        <div className={styles.topBar}>
          <div className={styles.searchWrapper} onChange={handleSearchChange}>
            <BogTextInput
              name="search"
              placeholder="Enter text to search"
              className={styles.searchWithIcon}
            />
            <BogIcon name="search" size={16} className={styles.searchIcon} />
          </div>
          <BogPopover
            title={<span />}
            onOpenChange={(open) => {
              if (open) setDraftFilterCols(selectedColumns);
            }}
            contentProps={{
              className: styles.popoverContentRoot,
              side: "bottom",
              align: "end",
              sideOffset: 6,
            }}
            arrowProps={{
              className: styles.hiddenArrow,
              width: 0,
              height: 0,
              style: { display: "none" },
            }}
            closeProps={{
              closeButton: <span />,
              style: { display: "none" },
            }}
            trigger={
              <BogButton
                className={styles.filterButton}
                variant={hasChips ? "primary" : "secondary"}
                size="medium"
                iconProps={{
                  iconProps: {
                    name: "funnel-simple",
                    size: 20,
                    className: styles.filterIcon,
                  },
                  position: "right",
                }}
              >
                Filter
              </BogButton>
            }
            content={
              <div className={styles.popoverContent}>
                <h4 className={styles.popoverTitle}>
                  Select Columns to Filter
                </h4>
                <div className={styles.popoverBody}>
                  {columnHeaders.map((h, i) => (
                    <BogCheckbox
                      key={`filter-col-${i}`}
                      label={h.content}
                      name={`filter-col-${i}`}
                      checked={draftFilterCols.includes(i)}
                      onCheckedChange={(checked) => {
                        setDraftFilterCols((prev) =>
                          checked === true
                            ? Array.from(new Set([...prev, i]))
                            : prev.filter((x) => x !== i),
                        );
                      }}
                    />
                  ))}
                </div>
                <div className={styles.popoverFooter}>
                  <Popover.Close asChild>
                    <BogButton
                      variant="secondary"
                      size="medium"
                      className={styles.popoverActionBtn}
                    >
                      Cancel
                    </BogButton>
                  </Popover.Close>
                  <Popover.Close asChild>
                    <BogButton
                      variant="primary"
                      size="medium"
                      className={styles.popoverActionBtn}
                      onClick={() => {
                        setSelectedColumns(draftFilterCols);
                        setColumnFilters((prev) => {
                          const next: Record<number, ColumnFilter> = {};
                          draftFilterCols.forEach((col) => {
                            if (prev[col]) next[col] = prev[col];
                          });
                          return next;
                        });
                      }}
                    >
                      Apply Filter
                    </BogButton>
                  </Popover.Close>
                </div>
              </div>
            }
          />
        </div>

        <div className={styles.tableDivider}>
          {selectedColumns.map((colIdx) => {
            const header =
              columnHeaders[colIdx]?.content ?? `Column ${colIdx + 1}`;
            const active = columnFilters[colIdx];

            const isActiveChip =
              !!active &&
              (active.condition === "Value is blank" ||
                active.condition === "Value is not blank" ||
                (active.value ?? "").trim().length > 0);
            const chipText = active?.condition
              ? `${header}: ${active.condition}${active.value ? `: ${active.value}` : ""}`
              : header;

            return (
              <BogPopover
                title={<span />}
                key={`chip-${colIdx}`}
                onOpenChange={(open) => {
                  if (open) {
                    setDraftColumnFilters((prev) => {
                      const next = { ...prev };
                      if (columnFilters[colIdx]) {
                        next[colIdx] = columnFilters[colIdx]!;
                      } else {
                        delete next[colIdx];
                      }
                      return next;
                    });
                  }
                }}
                contentProps={{
                  className: styles.chipPopoverContentRoot,
                  side: "bottom",
                  align: "start",
                  sideOffset: 6,
                }}
                arrowProps={{
                  className: styles.hiddenArrow,
                  width: 0,
                  height: 0,
                  style: { display: "none" },
                }}
                closeProps={{
                  closeButton: <span />,
                  style: { display: "none" },
                }}
                trigger={
                  <BogChip
                    size="responsive"
                    radius="full"
                    className={`${styles.filterChip} ${isActiveChip ? styles.filterChipActive : ""}`}
                    data-table-chip="true"
                    data-active={isActiveChip}
                  >
                    {chipText}
                    <BogIcon name="chevron-down" size={16} />
                  </BogChip>
                }
                content={
                  <div className={styles.chipPopoverContent}>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                      }}
                    >
                      <h4 style={{ margin: 0 }}>{`Filter: ${header}`}</h4>
                      <div
                        style={{ cursor: "pointer" }}
                        onClick={() => removeColumnFilter(colIdx)}
                      >
                        <BogIcon
                          name="trash"
                          size={22}
                          aria-label="Remove filter"
                        />
                      </div>
                    </div>

                    <div className={styles.chipPopoverBody}>
                      <div className={styles.chipDropdownWrapper}>
                        <p className={styles.chipPopoverLabel}>Condition</p>
                        <BogDropdown
                          type="radio"
                          className={styles.chipPopoverDropdownInput}
                          options={[
                            "Value is",
                            "Value is not",
                            "Value contains",
                            "Value does not contain",
                            "Value is blank",
                            "Value is not blank",
                          ]}
                          placeholder="Select Condition"
                          name={`chip-cond-${colIdx}`}
                          onSelectionChange={(sel) => {
                            if (!sel) {
                              setDraftColumnFilters((prev) => {
                                const next = { ...prev };
                                delete next[colIdx];
                                return next;
                              });
                              return;
                            }
                            const cond = sel as FilterCondition;
                            setDraftColumnFilters((prev) => {
                              const current = prev[colIdx] ?? {
                                condition: "contains",
                                value: "",
                              };
                              const value =
                                cond === "Value is blank" ||
                                cond === "Value is not blank"
                                  ? ""
                                  : (current.value ?? "");
                              return {
                                ...prev,
                                [colIdx]: { condition: cond, value },
                              };
                            });
                          }}
                          value={draftColumnFilters[colIdx]?.condition ?? ""}
                          style={{ width: "100%" }}
                        />
                      </div>
                      <div className={styles.chipInputWrapper}>
                        <p className={styles.chipPopoverLabel}>Value</p>
                        <BogTextInput
                          name={`chip-value-${colIdx}`}
                          className={styles.chipPopoverTextInput}
                          value={draftColumnFilters[colIdx]?.value ?? ""}
                          placeholder={
                            draftColumnFilters[colIdx]?.value ||
                            "Enter Filter Value"
                          }
                          onChange={(e) => {
                            const v = (e.target as HTMLInputElement).value;
                            setDraftColumnFilters((prev) => ({
                              ...prev,
                              [colIdx]: {
                                ...(prev[colIdx] ?? { condition: "contains" }),
                                value: v,
                              },
                            }));
                          }}
                          disabled={
                            draftColumnFilters[colIdx]?.condition ===
                              "Value is blank" ||
                            draftColumnFilters[colIdx]?.condition ===
                              "Value is not blank"
                          }
                        />
                      </div>
                    </div>

                    <div className={styles.chipPopoverFooter}>
                      <Popover.Close asChild>
                        <BogButton
                          variant="secondary"
                          size="medium"
                          className={styles.chipPopoverFooterBtn}
                        >
                          Cancel
                        </BogButton>
                      </Popover.Close>
                      <Popover.Close asChild>
                        <BogButton
                          variant="primary"
                          size="medium"
                          className={styles.chipPopoverFooterBtn}
                          onClick={() => {
                            setColumnFilters((prev) => {
                              const next = { ...prev };
                              const draft = draftColumnFilters[colIdx];

                              const isBlankCheck =
                                draft?.condition === "Value is blank" ||
                                draft?.condition === "Value is not blank";
                              const hasValue =
                                (draft?.value ?? "").trim().length > 0;

                              if (!draft || (!isBlankCheck && !hasValue)) {
                                delete next[colIdx];
                              } else {
                                next[colIdx] = draft;
                              }
                              return next;
                            });
                          }}
                        >
                          Apply Filter
                        </BogButton>
                      </Popover.Close>
                    </div>
                  </div>
                }
              />
            );
          })}
        </div>

        <div className={styles.container}>
          <Table.Root
            {...rootProps}
            size={radixSize}
            className={`${styles.root} ${className || ""}`}
            style={style}
          >
            <Table.Header>
              <Table.Row className={styles.headerRow}>
                {columnHeaders.map((header, i) => {
                  const dir = getSortForColumn(i);
                  const isSortable = header.datatype !== "other";
                  return (
                    <Table.ColumnHeaderCell
                      key={`col-${i}`}
                      {...header.styleProps}
                      className={`${styles.columnHeaderCell} ${styles.cellBase} ${styles[sizeClass]}`}
                    >
                      {header.content}

                      {isSortable && (
                        <div
                          className={styles.sortIcons}
                          role="button"
                          tabIndex={0}
                          aria-label={`Sort by ${header.content}${
                            dir
                              ? `, ${dir === "asc" ? "ascending" : "descending"}`
                              : ""
                          }`}
                          onClick={() => toggleSort(i)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              toggleSort(i);
                            }
                          }}
                        >
                          <BogIcon
                            name="caret-up"
                            className={
                              dir === "asc"
                                ? styles.sortChevronActive
                                : styles.sortChevronInactive
                            }
                          />
                          <BogIcon
                            name="caret-down"
                            className={
                              dir === "desc"
                                ? styles.sortChevronActive
                                : styles.sortChevronInactive
                            }
                          />
                        </div>
                      )}
                    </Table.ColumnHeaderCell>
                  );
                })}
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {sortedRows.map((row, rIdx) => (
                <Table.Row key={`row-${rIdx}`} {...row.styleProps}>
                  {row.cells.map((cell, cIdx) =>
                    cIdx === 0 ? (
                      <Table.RowHeaderCell
                        key={`row-${rIdx}-cell-${cIdx}`}
                        {...cell.styleProps}
                        className={`${styles.rowHeaderCell} ${styles.cellBase} ${styles[sizeClass]}`}
                      >
                        {cell.content}
                      </Table.RowHeaderCell>
                    ) : (
                      <Table.Cell
                        key={`row-${rIdx}-cell-${cIdx}`}
                        {...cell.styleProps}
                        className={`${styles.cell} ${styles.cellBase} ${styles[sizeClass]}`}
                      >
                        {cell.content}
                      </Table.Cell>
                    ),
                  )}
                </Table.Row>
              ))}
            </Table.Body>
          </Table.Root>
        </div>
      </div>
    </Theme>
  );
};
export default BogTable;
