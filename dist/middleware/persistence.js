import { appendPermissionRule } from "../persistence.js";
import { setRuleSource } from "../config-parser.js";
export function persistChoice(result, paths, rule, sessionRulesInMemory, projectTrusted) {
    let persistedTo = "";
    let projectGrantNeedsTrust = false;
    const p = result;
    if (p.scope === "session") {
        if (paths.session) {
            appendPermissionRule(paths.session, rule);
            persistedTo = paths.session;
        }
        else {
            persistedTo = "session memory (ephemeral session)";
            setRuleSource(rule, persistedTo);
            sessionRulesInMemory.push(rule);
        }
    }
    else if (p.scope === "projectLocal") {
        appendPermissionRule(paths.projectLocal, rule);
        persistedTo = paths.projectLocal;
        projectGrantNeedsTrust = !projectTrusted;
    }
    else if (p.scope === "project") {
        appendPermissionRule(paths.project, rule);
        persistedTo = paths.project;
        projectGrantNeedsTrust = !projectTrusted;
    }
    else if (p.scope === "global") {
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
