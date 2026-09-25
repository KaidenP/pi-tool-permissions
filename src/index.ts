import type {
  ExtensionAPI,
  ExtensionContext,
  ToolCallEvent,
  ToolCallEventResult,
} from "@earendil-works/pi-coding-agent"
import { isToolCallEventType } from "@earendil-works/pi-coding-agent"
import { homedir } from "node:os"
import {
  getConfigPaths,
  getRuleSource,
  loadConfig,
  matchRule,
  normalizeToolParams,
  resolveRules,
  setRuleSource,
  type PermissionRuleRecord,
} from "./config-loader.js"
import { logDecision } from "./log.js"
import { appendPermissionRule, createAllowRule } from "./persistence.js"
import {
  PolicyRegistry,
  policyRegistryInstance,
  POLICY_REGISTRATION_EVENT,
  type PolicyDecision,
  type PolicyHandler,
} from "./policy-registry.js"
import {
  promptRendererInstance,
  registerPromptRenderer,
  type PromptUI,
  type PromptRenderer,
  type ChoiceConfig,
} from "./prompt-registry.js"
import "./renderers/default.js"

export {
  PolicyRegistry,
  policyRegistryInstance,
  POLICY_REGISTRATION_EVENT,
  registerPolicy,
} from "./policy-registry.js"
export { registerPromptRenderer, promptRendererInstance } from "./prompt-registry.js"
export type { PolicyDecision, PolicyHandler, PolicyHandlerContext } from "./policy-registry.js"
export type { PromptUI, PromptRenderer, ChoiceConfig } from "./prompt-registry.js"

const PROMPT_CHOICES = [
  "Deny",
  "Allow once",
  "Allow only in this session",
  "Allow always (Project-local)",
  "Allow always (Project)",
  "Allow always (Global)",
] as const

type ChoiceKey = (typeof PROMPT_CHOICES)[number]

type ChoiceResult =
  | { action: "deny"; scope?: never }
  | { action: "allow-once"; scope?: never }
  | { action: "persist"; scope: "session" | "projectLocal" | "project" | "global" }

function resolveChoice(choice: ChoiceKey): ChoiceResult {
  let result: ChoiceResult
  switch (choice) {
    case "Deny": return { action: "deny" }
    case "Allow once": return { action: "allow-once" }
    case "Allow only in this session": return { action: "persist", scope: "session" }
    case "Allow always (Project-local)": return { action: "persist", scope: "projectLocal" }
    case "Allow always (Project)": return { action: "persist", scope: "project" }
    case "Allow always (Global)": return { action: "persist", scope: "global" }
  }
  return { action: "deny", scope: undefined as never } as ChoiceResult
}

type PermissionLogger = (tool: string, action: string, source: string) => void

export interface PermissionHandlerOptions {
  /** Override the home directory and logger in tests or embedded runtimes. */
  homeDir?: string
  logger?: PermissionLogger
  registry?: PolicyRegistry
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
}

function makePromptTitle(toolName: string, parameters: Record<string, unknown>): string {
  const args = JSON.stringify(parameters, null, 2) ?? "{}"
  return `Permission required for ${toolName}\n\nArguments:\n${args}`
}


function priorityForNewAllowRule(winningRule: PermissionRuleRecord): number {
  const current = Math.max(0, winningRule.priority ?? 0)
  const increment = Math.max(1, Math.abs(current) * Number.EPSILON * 2)
  const candidate = current + increment
  return Number.isFinite(candidate) && candidate > current ? candidate : current
}

function denied(reason: string): ToolCallEventResult {
  return { block: true, reason, terminate: true }
}

/**
 * Create the tool-call middleware. Session-only rules for ephemeral sessions
 * are deliberately scoped to this handler instance and cannot leak to another
 * session after a reload or session switch.
 */
export function createPermissionHandler(options: PermissionHandlerOptions = {}) {
  const registry = options.registry ?? policyRegistryInstance
  const logger = options.logger ?? logDecision
  const sessionRulesInMemory: PermissionRuleRecord[] = []

  return async (
    event: ToolCallEvent,
    ctx: ExtensionContext,
  ): Promise<ToolCallEventResult> => {
    let logSource = "permission-middleware"

    try {
      const toolName = event.toolName
      // Use Pi's event guard for typed access. A failed guard is a fail-closed
      // condition, never a reason to let the tool call through.
      if (!isToolCallEventType<string, Record<string, unknown>>(toolName, event)) {
        logger(toolName, "Denied", "unrecognized-tool-call-event")
        return denied("Unable to inspect tool call for permission evaluation")
      }

      if (!isRecord(event.input)) {
        logger(event.toolName, "Denied", "invalid-tool-input")
        return denied("Tool arguments were not a valid object")
      }

      const cwd = ctx.cwd || process.cwd()
      const normalizedParameters = normalizeToolParams(event.toolName, event.input, cwd)
      const sessionFile = ctx.sessionManager.getSessionFile()
      const paths = getConfigPaths(cwd, sessionFile, options.homeDir ?? homedir())

      const globalRules = loadConfig(paths.global)
      // Project permission files can grant execution. Do not honor project
      // configuration until Pi has resolved trust for the current project.
      const projectTrusted = ctx.isProjectTrusted()
      const projectRules = projectTrusted ? loadConfig(paths.project) : []
      const projectLocalRules = projectTrusted ? loadConfig(paths.projectLocal) : []
      const sessionRules = paths.session ? loadConfig(paths.session) : []
      const scopes = [
        globalRules,
        projectRules,
        projectLocalRules,
        [...sessionRules, ...sessionRulesInMemory],
      ]

      const winningRule = resolveRules(scopes, event.toolName, normalizedParameters, cwd)
      logSource = getRuleSource(winningRule) ?? (winningRule.virtual ? "<default ask>" : "<configuration>")

      const policyDecision: PolicyDecision = await registry.resolve(
        winningRule.policy,
        winningRule.priority ?? 0,
        {
          rule: winningRule,
          event,
          extensionContext: ctx,
          cwd,
          parameters: normalizedParameters,
        },
      )

      if (policyDecision.decision === "deny") {
        logger(event.toolName, "Denied", logSource)
        return denied(`Denied by permission policy "${winningRule.policy}"`)
      }

      if (policyDecision.decision === "allow") {
        logger(event.toolName, "Allowed", logSource)
        return { block: false }
      }

      // Unknown/custom decision strings are treated as ask, so custom policies
      // cannot accidentally bypass the user-consent path.
      logger(event.toolName, "Asked", logSource)
      if (!ctx.hasUI) {
        logger(event.toolName, "Denied", `${logSource} (no UI available)`)
        return denied("No UI is available to approve this tool call")
      }

      // Custom prompt UI via registry (e.g., diff view for edit)
      const customRenderer = promptRendererInstance.lookup(event.toolName)
      let promptResult: PromptUI | undefined
      if (customRenderer) {
        try {
          promptResult = await customRenderer(event, normalizedParameters)
        } catch (e) {
          console.error("Custom prompt renderer failed:", e)
        }
      }

      let choice: string | undefined
      if (promptResult && promptResult.kind === "custom") {
        // For custom kind, fall back to default select using title/choices
        // Full component rendering requires host integration; use default for now
        const customChoices = promptResult.choices ?? PROMPT_CHOICES.map((c) => ({ label: c, value: c }))
        choice = await ctx.ui.select(
          promptResult.title,
          customChoices.map((c) => c.label),
        )
      } else {
        const defaultTitle = makePromptTitle(event.toolName, event.input)
        const defaultChoices = (promptResult && promptResult.kind === "default" && promptResult.choices)
          ? promptResult.choices.map((c) => c.label)
          : [...PROMPT_CHOICES]
        const promptTitle = (promptResult && promptResult.kind === "default" && promptResult.title)
          ? promptResult.title
          : defaultTitle
        const promptBody = (promptResult && promptResult.kind === "default" && promptResult.body)
          ? promptResult.body + "\n\n" + (defaultTitle.split("\n\n")[1] || "")
          : defaultTitle
        choice = await ctx.ui.select(
          promptBody || promptTitle,
          defaultChoices,
        )
      }

      const selectedChoice = choice as ChoiceKey | undefined
      const result = selectedChoice ? resolveChoice(selectedChoice) : { action: "deny" }

      if (result.action === "deny") {
        logger(event.toolName, "Denied", "user-denied")
        return denied("Permission denied by user")
      }

      if (result.action === "allow-once") {
        logger(event.toolName, "Allowed", "user-once")
        return { block: false }
      }

      const rule = createAllowRule(
        event.toolName,
        normalizedParameters,
        priorityForNewAllowRule(winningRule),
      )

      let persistedTo = ""
      let projectGrantNeedsTrust = false
      try {
        if (result.action === "persist") {
          const p = result as { action: "persist"; scope: "session" | "projectLocal" | "project" | "global" }
          if (p.scope === "session") {
            if (paths.session) {
              appendPermissionRule(paths.session, rule)
              persistedTo = paths.session
            } else {
              persistedTo = "session memory (ephemeral session)"
              setRuleSource(rule, persistedTo)
              sessionRulesInMemory.push(rule)
            }
          } else if (p.scope === "projectLocal") {
            appendPermissionRule(paths.projectLocal, rule)
            persistedTo = paths.projectLocal
            projectGrantNeedsTrust = !projectTrusted
          } else if (p.scope === "project") {
            appendPermissionRule(paths.project, rule)
            persistedTo = paths.project
            projectGrantNeedsTrust = !projectTrusted
          } else if (p.scope === "global") {
            appendPermissionRule(paths.global, rule)
            persistedTo = paths.global
          }
        } else {
          logger(event.toolName, "Denied", "user-cancelled")
          return denied("Permission denied by user")
        }
      } catch (error) {
        console.error("Failed to persist permission rule:", error)
        if (ctx.hasUI) {
          ctx.ui.notify(
            "Could not save this permission; allowing this call once only.",
            "warning",
          )
        }
        logger(event.toolName, "Allowed", "user-once (persistence failed)")
        return { block: false }
      }

      if (projectGrantNeedsTrust) {
        const memorySource = "session memory (project trust pending)"
        setRuleSource(rule, memorySource)
        sessionRulesInMemory.push(rule)
        try {
          if (ctx.hasUI) {
            ctx.ui.notify(
              "Saved the project grant. It applies for this session; Pi project trust is required to honor it after restart.",
              "warning",
            )
          }
        } catch (error) {
          console.error("Could not notify about pending project trust:", error)
        }
      }

      logger(event.toolName, "Allowed", persistedTo)
      return { block: false }
    } catch (error) {
      console.error("Permission middleware error:", error)
      try {
        logger(event.toolName, "Denied", logSource)
      } catch (loggingError) {
        console.error("Failed to record permission middleware error:", loggingError)
      }
      return denied("Permission middleware error; tool call blocked")
    }
  }
}

export default function (pi: ExtensionAPI): void {
  const unregisterPolicies: Array<() => void> = []
  const removePolicyListener = pi.events.on(POLICY_REGISTRATION_EVENT, (registration: unknown) => {
    if (
      !isRecord(registration) ||
      typeof registration.key !== "string" ||
      typeof registration.handler !== "function"
    ) {
      console.error(`Ignored invalid policy registration on ${POLICY_REGISTRATION_EVENT}`)
      return
    }

    try {
      unregisterPolicies.push(
        policyRegistryInstance.register(registration.key, registration.handler as PolicyHandler),
      )
    } catch (error) {
      console.error("Failed to register permission policy:", error)
    }
  })

  pi.on("session_shutdown", () => {
    removePolicyListener()
    for (const unregister of unregisterPolicies.splice(0)) unregister()
  })
  pi.on("tool_call", createPermissionHandler())
}
