import { Table, Theme } from "@radix-ui/themes";
import React, { ReactNode } from "react";
import styles from "./styles.module.css";
import { useResponsive } from "../../utils/design-system/hooks/useResponsive";
import { getNumericalSizeFromBreakpoint } from "../../utils/design-system/breakpoints/breakpoints";
import BogIcon from "../BogIcon/BogIcon";

type ColumnDatatype = "string" | "string[]" | "number" | "number[]" | "other";

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
    if (sorts.length === 0) return rows;
    const decorated = rows.map((row, idx) => ({ row, idx }));
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
  }, [rows, sorts, columnHeaders]);

  const radixSize: "1" | "2" | "3" =
    size === "responsive"
      ? getNumericalSizeFromBreakpoint(breakpoint)
      : ({ small: "1", medium: "2", large: "3" } as const)[size];

  const sizeClass = `size${radixSize}`;

  return (
    <Theme>
      <div className={styles.bogTable}>
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
                          aria-label={`Sort by ${header.content}${dir ? `, ${dir === "asc" ? "ascending" : "descending"}` : ""}`}
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
