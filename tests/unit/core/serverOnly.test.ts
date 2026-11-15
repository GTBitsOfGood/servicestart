// @vitest-environment node
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

// Every service imports "server-only", so a client component that imports one
// fails `pnpm build` instead of shipping the database client to the browser.
const root = path.resolve(__dirname, "../../..");
const services = readdirSync(path.join(root, "features")).flatMap((context) => {
  const dir = path.join("features", context, "services");
  try {
    return readdirSync(path.join(root, dir))
      .filter((file) => file.endsWith(".ts"))
      .map((file) => path.join(dir, file));
  } catch {
    return [];
  }
});

describe("server-only services", () => {
  it("finds the services", () => {
    expect(services.length).toBeGreaterThan(0);
  });

  it.each(services)('%s starts with import "server-only"', (file) => {
    const source = readFileSync(path.join(root, file), "utf8");
    expect(source.startsWith('import "server-only";\n')).toBe(true);
  });
});
