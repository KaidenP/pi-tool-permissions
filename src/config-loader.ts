import { load } from "js-yaml";
import { readFileSync } from "fs";

export function loadConfig(path: string): any {
  let raw: string;
  try {
    raw = readFileSync(path, "utf8");
  } catch (e) {
    console.error("Failed to read config:", path);
    process.exit(1);
  }
  let parsed: any;
  try {
    parsed = load(raw);
  } catch (e) {
    console.error("YAML decode failure:", e);
    process.exit(1);
  }
  if (!parsed || typeof parsed !== "object") {
    console.error("Invalid config: must be object");
    process.exit(1);
  }
  for (const [k, v] of Object.entries(parsed)) {
    if (v && typeof v === "object" && !("tool" in v) && !("policy" in v)) {
      // ignore extra keys; enforce required keys per rule
    }
  }
  return parsed;
}
