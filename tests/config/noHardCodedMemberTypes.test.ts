import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = path.resolve(import.meta.dirname, "../..");
const SCAN_ROOTS = ["app", "features", "core", "components"] as const;
const PATTERN = /\b(applicant|attendee)s?\b/i;

const listSourceFiles = (dir: string, out: string[] = []) => {
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    const rel = path.relative(ROOT, full);
    if (rel.startsWith(`components${path.sep}bog${path.sep}`)) continue;
    if (statSync(full).isDirectory()) {
      listSourceFiles(full, out);
    } else if (/\.(ts|tsx)$/.test(entry)) {
      out.push(full);
    }
  }
  return out;
};

describe("noHardCodedMemberTypes", () => {
  it("forbids applicant and attendee in production source", () => {
    const hits: string[] = [];
    for (const root of SCAN_ROOTS) {
      const abs = path.join(ROOT, root);
      for (const file of listSourceFiles(abs)) {
        const lines = readFileSync(file, "utf8").split("\n");
        lines.forEach((line, index) => {
          if (PATTERN.test(line)) {
            hits.push(
              `${path.relative(ROOT, file)}:${index + 1}: ${line.trim()}`,
            );
          }
        });
      }
    }
    expect(hits).toEqual([]);
  });
});
