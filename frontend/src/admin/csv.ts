// A small CSV reader (RFC 4180): quoted fields, doubled quotes, line breaks inside quotes, CRLF; the separator
// (comma, semicolon or tab) is taken from the first line.
export function parseCsv(text: string): string[][] {
  const source = text.replace(/^﻿/, "");
  const firstLine = source.split(/\r?\n/, 1)[0] ?? "";
  const separator = [";", "\t", ","].map((candidate) => ({ candidate, count: firstLine.split(candidate).length })).sort((a, b) => b.count - a.count)[0].candidate;
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < source.length; i++) {
    const char = source[i];
    if (quoted) {
      if (char === '"') { if (source[i + 1] === '"') { cell += '"'; i++; } else quoted = false; }
      else cell += char;
    } else if (char === '"' && cell === "") quoted = true;
    else if (char === separator) { row.push(cell); cell = ""; }
    else if (char === "\n" || char === "\r") {
      if (char === "\r" && source[i + 1] === "\n") i++;
      row.push(cell); cell = "";
      if (row.some((value) => value !== "") || row.length > 1) rows.push(row);
      row = [];
    } else cell += char;
  }
  if (cell !== "" || row.length) { row.push(cell); if (row.some((value) => value !== "")) rows.push(row); }
  return rows;
}
