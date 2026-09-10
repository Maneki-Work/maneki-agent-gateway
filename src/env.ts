/**
 * Minimal .env loader: applied before anything else, tolerant of a missing
 * file so a fresh clone boots with sane defaults (sample dataset, no
 * payments configured). Real env vars always win over file values.
 */
import { readFileSync } from "node:fs";

try {
  for (const line of readFileSync(".env", "utf8").split(/\r?\n/)) {
    const m = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].trim();
  }
} catch {
  // no .env — defaults apply
}
