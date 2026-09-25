export class PromptRendererRegistry {
    renderers = new Map();
    register(key, renderer) {
        this.renderers.set(key, renderer);
    }
    lookup(toolName) {
        for (const [key, renderer] of this.renderers) {
            if (typeof key === "string" && key === toolName)
                return renderer;
            if (key instanceof RegExp && key.test(toolName))
                return renderer;
        }
        return undefined;
    }
}
export const promptRendererInstance = new PromptRendererRegistry();
export const registerPromptRenderer = (key, renderer) => {
    promptRendererInstance.register(key, renderer);
};
