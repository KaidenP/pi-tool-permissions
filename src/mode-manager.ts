export type Mode = "default" | "permission-bypass";

export class ModeState {
  private current: Mode = "default";

  get mode(): Mode {
    return this.current;
  }

  toggle(): Mode {
    this.current = this.current === "default" ? "permission-bypass" : "default";
    return this.current;
  }

  set(mode: Mode): Mode {
    this.current = mode;
    return this.current;
  }
}

export const modeState = new ModeState();
