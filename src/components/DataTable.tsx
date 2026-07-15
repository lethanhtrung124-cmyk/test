import type { ReactNode } from 'react';

interface DataTableProps<T> {
  columns: string[];
  rows: T[];
  renderRow: (row: T) => ReactNode;
  emptyText?: string;
}

export function DataTable<T>({ columns, rows, renderRow, emptyText = 'Không có dữ liệu' }: DataTableProps<T>) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column}>{column}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length > 0 ? (
            rows.map(renderRow)
          ) : (
            <tr>
              <td colSpan={columns.length}>{emptyText}</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
