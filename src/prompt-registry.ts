export type ChoiceConfig = {
  label: string
  value: string
}

export type PromptUI =
  | {
      kind: "default"
      title: string
      body?: string
      choices?: ChoiceConfig[]
    }
  | {
      kind: "custom"
      title: string
      component?: unknown
      choices?: ChoiceConfig[]
    }

export type PromptRenderer = (
  event: { toolName: string; input: Record<string, unknown> },
  normalizedParameters: Record<string, unknown>,
) => PromptUI | Promise<PromptUI>

export class PromptRendererRegistry {
  private renderers = new Map<string | RegExp, PromptRenderer>()

  register(key: string | RegExp, renderer: PromptRenderer) {
    this.renderers.set(key, renderer)
  }

  lookup(toolName: string): PromptRenderer | undefined {
    for (const [key, renderer] of this.renderers) {
      if (typeof key === "string" && key === toolName) return renderer
      if (key instanceof RegExp && key.test(toolName)) return renderer
    }
    return undefined
  }
}

export const promptRendererInstance = new PromptRendererRegistry()
export const registerPromptRenderer = (key: string | RegExp, renderer: PromptRenderer) => {
  promptRendererInstance.register(key, renderer)
}
