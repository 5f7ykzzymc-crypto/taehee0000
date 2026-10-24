import { copyFile } from "node:fs/promises";
// Retain the old file URL so existing local drafts remain accessible for backup.
await copyFile("작업시작.html", "index.html");
console.log(
  "작업시작.html is the primary entry; index.html remains a compatible entry.",
);
