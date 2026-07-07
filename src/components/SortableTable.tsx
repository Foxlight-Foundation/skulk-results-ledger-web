import { useMemo, useState, type ReactNode } from 'react';
import styled from 'styled-components';

export interface Column<T> {
  key: string;
  header: string;
  /** Sort value; when omitted the column is not sortable. */
  sortValue?: (row: T) => number | string;
  render: (row: T) => ReactNode;
  align?: 'left' | 'right' | 'center';
  width?: string;
}

const Scroll = styled.div`
  overflow-x: auto;
  border: 1px solid ${({ theme }) => theme.colors.border1};
  border-radius: ${({ theme }) => theme.radii.card};
  background: ${({ theme }) => theme.colors.panelBg};
  backdrop-filter: blur(14px);
`;

const Table = styled.table`
  width: 100%;
  border-collapse: collapse;
  font-size: ${({ theme }) => theme.typography.fontSize.sm};
`;

const Th = styled.th<{ $align?: string; $sortable?: boolean }>`
  text-align: ${({ $align }) => $align ?? 'left'};
  text-transform: uppercase;
  font-family: ${({ theme }) => theme.typography.fontFamily.mono};
  font-size: ${({ theme }) => theme.typography.fontSize.eyebrow};
  letter-spacing: ${({ theme }) => theme.typography.letterSpacing.eyebrow};
  color: ${({ theme }) => theme.colors.text3};
  font-weight: ${({ theme }) => theme.typography.fontWeight.medium};
  padding: ${({ theme }) => `${theme.spacing.md} ${theme.spacing.md}`};
  position: sticky;
  top: 0;
  background: ${({ theme }) => theme.colors.nightMid};
  border-bottom: 1px solid ${({ theme }) => theme.colors.border1};
  cursor: ${({ $sortable }) => ($sortable ? 'pointer' : 'default')};
  white-space: nowrap;
  user-select: none;

  &:hover {
    color: ${({ $sortable, theme }) => ($sortable ? theme.colors.text1 : theme.colors.text3)};
  }
`;

const Td = styled.td<{ $align?: string }>`
  text-align: ${({ $align }) => $align ?? 'left'};
  padding: ${({ theme }) => `${theme.spacing.sm} ${theme.spacing.md}`};
  border-bottom: 1px solid ${({ theme }) => theme.colors.border0};
  color: ${({ theme }) => theme.colors.text2};
  vertical-align: middle;
`;

const Tr = styled.tr<{ $clickable?: boolean }>`
  cursor: ${({ $clickable }) => ($clickable ? 'pointer' : 'default')};
  transition: background 120ms ease;
  &:hover {
    background: ${({ $clickable, theme }) => ($clickable ? theme.colors.moonWash : 'transparent')};
  }
`;

const Arrow = styled.span`
  color: ${({ theme }) => theme.colors.amber};
  margin-left: 6px;
`;

interface SortableTableProps<T> {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  onRowClick?: (row: T) => void;
  initialSortKey?: string;
  initialSortDir?: 'asc' | 'desc';
}

export function SortableTable<T>({
  columns,
  rows,
  rowKey,
  onRowClick,
  initialSortKey,
  initialSortDir = 'desc',
}: SortableTableProps<T>) {
  const [sortKey, setSortKey] = useState<string | undefined>(initialSortKey);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>(initialSortDir);

  const sorted = useMemo(() => {
    const col = columns.find((c) => c.key === sortKey);
    if (!col?.sortValue) return rows;
    const get = col.sortValue;
    const dir = sortDir === 'asc' ? 1 : -1;
    return [...rows].sort((a, b) => {
      const av = get(a);
      const bv = get(b);
      if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * dir;
      return String(av).localeCompare(String(bv)) * dir;
    });
  }, [columns, rows, sortKey, sortDir]);

  const toggle = (col: Column<T>) => {
    if (!col.sortValue) return;
    if (sortKey === col.key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(col.key);
      setSortDir('desc');
    }
  };

  return (
    <Scroll>
      <Table>
        <thead>
          <tr>
            {columns.map((col) => (
              <Th
                key={col.key}
                $align={col.align}
                $sortable={!!col.sortValue}
                style={col.width ? { width: col.width } : undefined}
                onClick={() => toggle(col)}
              >
                {col.header}
                {sortKey === col.key && <Arrow>{sortDir === 'asc' ? '▲' : '▼'}</Arrow>}
              </Th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map((row) => (
            <Tr key={rowKey(row)} $clickable={!!onRowClick} onClick={() => onRowClick?.(row)}>
              {columns.map((col) => (
                <Td key={col.key} $align={col.align}>
                  {col.render(row)}
                </Td>
              ))}
            </Tr>
          ))}
        </tbody>
      </Table>
    </Scroll>
  );
}
