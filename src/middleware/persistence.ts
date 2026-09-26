import { appendPermissionRule } from "../persistence.js";
import { createAllowRule } from "../persistence.js";
import { setRuleSource } from "../config-parser.js";
import type { PermissionRuleRecord } from "../types.js";

export interface PersistenceResult {
  persistedTo: string;
  rule?: PermissionRuleRecord;
  needsMemory?: boolean;
  memorySource?: string;
}

/**
 * Logic for persisting a user's permission choice.
 * 
 * The choice may be stored in different scopes (global, project, session),
 * depending on the user's selection. If project trust is not yet established,
 * grants are stored in memory until the project is trusted.
 */
export function persistChoice(
  result: { action: "persist"; scope: string },
  paths: { session?: string; projectLocal: string; project: string; global: string },
  rule: PermissionRuleRecord,
  sessionRulesInMemory: PermissionRuleRecord[],
  projectTrusted: boolean,
): PersistenceResult {

  let persistedTo = "";
  let projectGrantNeedsTrust = false;
  const p = result as { action: "persist"; scope: "session" | "projectLocal" | "project" | "global" };
  if (p.scope === "session") {
    if (paths.session) {
      appendPermissionRule(paths.session, rule);
      persistedTo = paths.session;
    } else {
      persistedTo = "session memory (ephemeral session)";
      setRuleSource(rule, persistedTo);
      sessionRulesInMemory.push(rule);
    }
  } else if (p.scope === "projectLocal") {
    appendPermissionRule(paths.projectLocal, rule);
    persistedTo = paths.projectLocal;
    projectGrantNeedsTrust = !projectTrusted;
  } else if (p.scope === "project") {
    appendPermissionRule(paths.project, rule);
    persistedTo = paths.project;
    projectGrantNeedsTrust = !projectTrusted;
  } else if (p.scope === "global") {
    appendPermissionRule(paths.global, rule);
    persistedTo = paths.global;
  }

  if (projectGrantNeedsTrust) {
    const memorySource = "session memory (project trust pending)";
    setRuleSource(rule, memorySource);
    sessionRulesInMemory.push(rule);
    return { persistedTo, rule, needsMemory: true, memorySource };
  }
  return { persistedTo, rule };
}
