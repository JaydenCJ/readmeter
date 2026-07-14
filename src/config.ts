/**
 * Strict loader for `.readmeter.json`. Unknown keys, wrong types and
 * unknown check codes are hard errors — a typo in CI config must fail
 * loudly instead of silently grading with the wrong checklist.
 */

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { allCodes } from "./registry.js";

export interface Config {
  /** Check codes excluded from scoring. */
  disable: string[];
  /** Fail (exit 1) below this score; null disables the gate. */
  minScore: number | null;
}

export const DEFAULT_CONFIG: Config = { disable: [], minScore: null };

export const CONFIG_FILENAME = ".readmeter.json";

/** Error type for malformed configuration (reported as exit code 2). */
export class ConfigError extends Error {}

/** Validate a list of check codes, normalizing to uppercase. */
export function validateCodes(codes: readonly string[], source: string): string[] {
  const valid = new Set(allCodes());
  const out: string[] = [];
  for (const code of codes) {
    const upper = String(code).toUpperCase();
    if (!valid.has(upper)) {
      throw new ConfigError(
        `${source}: unknown check code "${code}" (run \`readmeter checks\` for the list)`
      );
    }
    out.push(upper);
  }
  return out;
}

/** Parse and validate config JSON text. `source` names the file for errors. */
export function parseConfig(jsonText: string, source: string): Config {
  let data: unknown;
  try {
    data = JSON.parse(jsonText);
  } catch (err) {
    throw new ConfigError(`${source}: invalid JSON (${(err as Error).message})`);
  }
  if (typeof data !== "object" || data === null || Array.isArray(data)) {
    throw new ConfigError(`${source}: top level must be a JSON object`);
  }
  const record = data as Record<string, unknown>;
  const known = new Set(["disable", "minScore"]);
  for (const key of Object.keys(record)) {
    if (!known.has(key)) {
      throw new ConfigError(`${source}: unknown key "${key}" (allowed: disable, minScore)`);
    }
  }

  const config: Config = { ...DEFAULT_CONFIG, disable: [] };

  if (record["disable"] !== undefined) {
    const disable = record["disable"];
    if (!Array.isArray(disable) || disable.some((d) => typeof d !== "string")) {
      throw new ConfigError(`${source}: "disable" must be an array of check codes`);
    }
    config.disable = validateCodes(disable as string[], source);
  }

  if (record["minScore"] !== undefined && record["minScore"] !== null) {
    const min = record["minScore"];
    if (typeof min !== "number" || !Number.isInteger(min) || min < 0 || min > 100) {
      throw new ConfigError(`${source}: "minScore" must be an integer between 0 and 100`);
    }
    config.minScore = min;
  }

  return config;
}

/**
 * Load config from an explicit path (must exist) or from `.readmeter.json`
 * in `searchDir` (optional). Returns the defaults when neither is present.
 */
export function loadConfig(
  explicitPath: string | null,
  searchDir: string
): { config: Config; path: string | null } {
  if (explicitPath !== null) {
    if (!existsSync(explicitPath)) {
      throw new ConfigError(`config file not found: ${explicitPath}`);
    }
    return {
      config: parseConfig(readFileSync(explicitPath, "utf8"), explicitPath),
      path: explicitPath,
    };
  }
  const implicit = join(searchDir, CONFIG_FILENAME);
  if (existsSync(implicit)) {
    return { config: parseConfig(readFileSync(implicit, "utf8"), implicit), path: implicit };
  }
  return { config: { ...DEFAULT_CONFIG, disable: [] }, path: null };
}
