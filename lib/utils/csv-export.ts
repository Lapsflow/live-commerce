import type { Table } from "@tanstack/react-table";

export function exportTableToCsv<TData>(
  table: Table<TData>,
  fileName: string = "export"
) {
  const headers = table
    .getAllLeafColumns()
    .filter((col) => col.getIsVisible() && col.id !== "select")
    .map((col) => {
      const header = col.columnDef.header;
      let str = typeof header === "string" ? header : col.id;
      if (/^[=+\-@\t\r]/.test(str)) {
        str = `'${str}`;
      }
      return str;
    });

  const rows = table.getFilteredRowModel().rows.map((row) =>
    table
      .getAllLeafColumns()
      .filter((col) => col.getIsVisible() && col.id !== "select")
      .map((col) => {
        const value = row.getValue(col.id);
        let str = value == null ? "" : String(value);
        // CSV Injection 방어: 수식 해석 방지 (=, +, -, @, \t, \r)
        if (/^[=+\-@\t\r]/.test(str)) {
          str = `'${str}`;
        }
        // CSV escape: 쉼표, 줄바꿈, 큰따옴표 포함 시 감싸기
        if (str.includes(",") || str.includes("\n") || str.includes('"')) {
          return `"${str.replace(/"/g, '""')}"`;
        }
        return str;
      })
  );

  // BOM + CSV content (한글 Excel 호환)
  const BOM = "\uFEFF";
  const csvContent = [headers.join(","), ...rows.map((r) => r.join(","))].join(
    "\n"
  );

  const blob = new Blob([BOM + csvContent], {
    type: "text/csv;charset=utf-8;",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${fileName}_${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}
