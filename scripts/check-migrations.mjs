import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";

const provider =
  process.env.DATABASE_PROVIDER ??
  process.env.INFRA_DATABASE_PROVIDER ??
  "postgres";
const directory =
  process.env.DATABASE_MIGRATIONS_DIR ?? `migrations/sql/${provider}`;

const files = (await readdir(directory))
  .filter((file) => file.endsWith(".sql"))
  .sort();

if (files.length === 0) {
  throw new Error(`No migration files found in ${directory}`);
}

for (const file of files) {
  const content = await readFile(join(directory, file), "utf8");
  const checksum = createHash("sha256").update(content).digest("hex");
  console.log(`${provider}:${file}:${checksum}`);
}
