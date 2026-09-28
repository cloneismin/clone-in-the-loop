import { LitElement, html, nothing } from "lit";
import { api, completionSuffix, memoryTotal, memoryStatusLabel, messageError } from "./api";
import type {
  AppState,
  Clone,
  Goal,
  GoalDetail,
  InboxItem,
  MemoryResults,
  MemorySource,
  Message,
  Prediction,
  Workspace,
} from "./api";
import { brand, icon } from "./icons";
import { renderMarkdown } from "./markdown";
import { composerLoopInstruction, composerTabAction } from "./composer-shortcuts";
import { conversationTurns } from "./conversation-turns";
import { navigationItems, navigationShortcut, navigationShortcutHint } from "./navigation-shortcuts";
import "./styles.css";
import "./qm-theme.css";

type View = "new" | "goal" | "goals" | "inbox" | "memory";
const projects = ["Business", "Research", "Product", "Marketing"];
const projectColors: Record<string, string> = {
  Business: "#b99067",
  Research: "#9b86c5",
  Product: "#719a92",
  Marketing: "#759cce",
};
const projectIcons: Record<string, string> = { Product: "code", Marketing: "sparkle" };
const starterGoals = [
  {
    project: "Business",
    title: "Find our next opportunity",
    text: "Review our positioning and propose the strongest next move for an AI-native founder. Define completion criteria and make the recommendation concrete.",
  },
  {
    project: "Product",
    title: "Turn an idea into a product",
    text: "Design a focused product experience for a founder who delegates to both AI agents and teammates. Start with a clear problem, a minimal workflow, and observable completion criteria.",
  },
  {
    project: "Marketing",
    title: "Make the launch worth sharing",
    text: "Create a concise launch story for Clone-in-the-Loop. Explain how personal judgment, team memory, and agent execution come together. Make it specific and ready for review.",
  },
];

function personName(clone: Clone | undefined): string {
  return (clone?.name ?? "Min Kim").replace(/^Clone\s+/i, "");
}

function memorySourceLabel(source: string | undefined): string {
  if (/^Clone conversation [0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(source ?? "")) return "Session history";
  return source || "Conversation";
}

function cloneName(clone: Clone | undefined): string {
  return clone ? `Clone ${personName(clone).split(/\s+/)[0]}` : "Your Clone";
}

function goalColumn(goal: Goal): string {
  if (goal.status === "completed") return "Completed";
  if (goal.status === "error" || goal.phase === "error") return "Needs attention";
  if (goal.loopEnabled || ["predicting", "executing", "reviewing", "improving", "stopping"].includes(goal.phase))
    return "In progress";
  if (goal.status === "paused") return "Paused";
  return "Ready";
}

class CloneApp extends LitElement {
  static properties = {
    state: { state: true },
    view: { state: true },
    workspace: { state: true },
    active: { state: true },
    draft: { state: true },
    prediction: { state: true },
    acceptedPrediction: { state: true },
    selectedCloneId: { state: true },
    selectedProject: { state: true },
    pending: { state: true },
    error: { state: true },
    predicting: { state: true },
    workspaceMenu: { state: true },
    cloneMenu: { state: true },
    memoryData: { state: true },
    memoryQuery: { state: true },
    memoryLoading: { state: true },
    inbox: { state: true },
    inboxLoading: { state: true },
    selectedSource: { state: true },
    booting: { state: true },
    showKeyboardHelp: { state: true },
    filterProject: { state: true },
  };

  private state: AppState | null = null;
  private view: View = "new";
  private workspace: Workspace = "personal";
  private active: GoalDetail | null = null;
  private draft = "";
  private prediction: Prediction | null = null;
  private selectedCloneId = "";
  private selectedProject = "Business";
  private pending = false;
  private error = "";
  private predicting = false;
  private workspaceMenu = false;
  private cloneMenu = false;
  private memoryData: MemoryResults | null = null;
  private memoryQuery = "";
  private memoryLoading = false;
  private inbox: InboxItem[] = [];
  private inboxLoading = false;
  private selectedSource: MemorySource | null = null;
  private booting = true;
  private showKeyboardHelp = false;
  private filterProject = "";
  private drafts = new Map<string, string>();
  private draftOrigins = new Map<string, { original: string; accepted: string }>();
  private pollTimer?: ReturnType<typeof setInterval>;
  private stateTimer?: ReturnType<typeof setInterval>;
  private predictionTimer?: ReturnType<typeof setTimeout>;
  private predictionExpiry?: ReturnType<typeof setTimeout>;
  private predictionAbort?: AbortController;
  private composing = false;
  private predictionOrigin?: { original: string; accepted: string };
  private memoryTimer?: ReturnType<typeof setTimeout>;
  private revision = 0;
  private acceptedPrediction = "";
  private loadingGoal = false;
  private lastPredictionContext = "";
  private navigationRevision = 0;
  private operationRevision = 0;
  private failedAvatars = new Set<string>();

  protected createRenderRoot() {
    return this;
  }

  connectedCallback() {
    super.connectedCallback();
    void this.boot();
    this.pollTimer = setInterval(() => {
      if (this.active) void this.refreshGoal();
    }, 1500);
    this.stateTimer = setInterval(() => {
      void this.refreshState();
    }, 7000);
    window.addEventListener("keydown", this.globalKeydown);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    clearInterval(this.pollTimer);
    clearInterval(this.stateTimer);
    this.clearPrediction();
    clearTimeout(this.memoryTimer);
    window.removeEventListener("keydown", this.globalKeydown);
  }

  private globalKeydown = (event: KeyboardEvent) => {
    if (event.key === "Escape") {
      this.workspaceMenu = false;
      this.cloneMenu = false;
      this.selectedSource = null;
      this.showKeyboardHelp = false;
    }
    const destination = navigationShortcut(event);
    if (destination) {
      event.preventDefault();
      this.showKeyboardHelp = false;
      if (destination === "new") void this.startNewGoal();
      else void this.navigate(destination);
    }
  };

  private get isMac(): boolean {
    return /Mac|iPhone|iPad/.test(globalThis.navigator?.platform ?? "");
  }

  private get clones(): Clone[] {
    return this.state?.clones ?? [];
  }
  private get currentClone(): Clone | undefined {
    return (
      this.clones.find((clone) => clone.id === (this.active?.goal.cloneId || this.selectedCloneId)) ?? this.clones[0]
    );
  }
  private get workspaceGoals(): Goal[] {
    return (this.state?.goals ?? []).filter((goal) => goal.workspace === this.workspace);
  }
  private get working(): boolean {
    return (
      !!this.active && /execut|review|predict|running|working|planning|stopping/.test(this.active.goal.phase || "")
    );
  }
  private get loopOn(): boolean {
    return !!this.active?.goal.loopEnabled;
  }
  private get modelLabel(): string {
    return this.state?.models?.[0]?.label ?? "QM agent";
  }

  private async boot() {
    this.booting = true;
    try {
      await this.refreshState(true);
      const savedWorkspace = localStorage.getItem("clone.workspace");
      if (savedWorkspace === "team" || savedWorkspace === "personal") this.workspace = savedWorkspace;
      this.selectedCloneId = this.clones[0]?.id ?? "";
      const savedGoal = localStorage.getItem("clone.activeGoal");
      if (savedGoal && this.state?.goals.some((goal) => goal.id === savedGoal)) await this.openGoal(savedGoal);
    } catch (error) {
      this.error = messageError(error);
    } finally {
      this.booting = false;
      if (this.view === "new" && this.state) this.schedulePrediction();
    }
  }

  private async refreshState(throwError = false) {
    try {
      this.state = await api<AppState>("/state");
    } catch (error) {
      if (throwError) throw error;
    }
  }

  private saveDraft() {
    const key = this.active?.goal.id ?? `new:${this.workspace}`;
    this.drafts.set(key, this.draft);
    if (this.predictionOrigin) this.draftOrigins.set(key, this.predictionOrigin);
    else this.draftOrigins.delete(key);
  }

  private clearPrediction() {
    clearTimeout(this.predictionTimer);
    clearTimeout(this.predictionExpiry);
    this.predictionAbort?.abort();
    this.revision += 1;
    this.prediction = null;
    this.predicting = false;
    this.acceptedPrediction = "";
  }

  private async navigate(view: View, project = "") {
    this.navigationRevision += 1;
    this.operationRevision += 1;
    this.pending = false;
    this.memoryLoading = false;
    this.inboxLoading = false;
    this.selectedSource = null;
    this.saveDraft();
    this.predictionOrigin = undefined;
    this.clearPrediction();
    this.view = view;
    this.filterProject = project;
    if (project) this.selectedProject = project;
    this.workspaceMenu = false;
    this.cloneMenu = false;
    this.error = "";
    if (view === "new") {
      this.active = null;
      this.draft = this.drafts.get(`new:${this.workspace}`) ?? "";
      this.predictionOrigin = this.draftOrigins.get(`new:${this.workspace}`);
      localStorage.removeItem("clone.activeGoal");
      await this.updateComplete;
      this.querySelector<HTMLTextAreaElement>(".composer-input")?.focus();
      this.schedulePrediction();
    }
    if (view === "memory") await this.loadMemory();
    if (view === "inbox") await this.loadInbox();
  }

  private startNewGoal() {
    const project = (this.view === "goals" && this.filterProject) || this.selectedProject;
    this.saveDraft();
    this.active = null;
    this.draft = "";
    this.predictionOrigin = undefined;
    return this.navigate("new", project);
  }

  private async switchWorkspace(workspace: Workspace) {
    this.saveDraft();
    this.workspace = workspace;
    this.active = null;
    this.memoryData = null;
    this.memoryQuery = "";
    this.inbox = [];
    this.selectedSource = null;
    this.draft = this.drafts.get(`new:${workspace}`) ?? "";
    this.predictionOrigin = this.draftOrigins.get(`new:${workspace}`);
    clearTimeout(this.memoryTimer);
    this.selectedCloneId = this.clones[0]?.id ?? "";
    localStorage.setItem("clone.workspace", workspace);
    await this.navigate("new");
  }

  private async openGoal(id: string) {
    const navigationRevision = ++this.navigationRevision;
    const operationRevision = ++this.operationRevision;
    this.selectedSource = null;
    this.saveDraft();
    this.predictionOrigin = undefined;
    this.clearPrediction();
    this.pending = true;
    this.error = "";
    try {
      const detail = await api<GoalDetail>(`/goals/${encodeURIComponent(id)}`);
      if (navigationRevision !== this.navigationRevision) return;
      this.active = detail;
      this.view = "goal";
      this.workspace = detail.goal.workspace;
      this.selectedCloneId = detail.goal.cloneId;
      this.selectedProject = detail.goal.project;
      this.draft = this.drafts.get(id) ?? "";
      this.predictionOrigin = this.draftOrigins.get(id);
      localStorage.setItem("clone.activeGoal", id);
      localStorage.setItem("clone.workspace", this.workspace);
      await this.updateComplete;
      this.scrollToLatest();
      if (!this.working && !this.loopOn) this.schedulePrediction();
    } catch (error) {
      if (navigationRevision === this.navigationRevision) this.error = messageError(error);
    } finally {
      if (operationRevision === this.operationRevision) this.pending = false;
    }
  }

  private async refreshGoal() {
    if (!this.active || this.loadingGoal) return;
    this.loadingGoal = true;
    const id = this.active.goal.id;
    const previousCount = this.active.messages.length;
    const viewport = this.querySelector<HTMLElement>(".conversation-scroll");
    const follow = !viewport || viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight < 170;
    try {
      const detail = await api<GoalDetail>(`/goals/${encodeURIComponent(id)}`);
      if (this.active?.goal.id !== id) return;
      this.active = detail;
      const changed = detail.messages.length !== previousCount;
      if (changed) this.clearPrediction();
      if (changed && follow) {
        await this.updateComplete;
        this.scrollToLatest();
      }
      if (!this.working && !this.loopOn && this.view === "goal") {
        const context = `${id}:${detail.messages.at(-1)?.id ?? ""}:${this.draft}`;
        if (context !== this.lastPredictionContext) this.schedulePrediction();
      }
    } catch (error) {
      if (this.active?.goal.id === id) this.error = `Connection interrupted: ${messageError(error)}`;
    } finally {
      this.loadingGoal = false;
    }
  }

  private scrollToLatest() {
    const viewport = this.querySelector<HTMLElement>(".conversation-scroll");
    if (viewport) viewport.scrollTop = viewport.scrollHeight;
  }

  private onDraft(event: Event) {
    this.draft = (event.target as HTMLTextAreaElement).value;
    if (!this.draft || this.draft === this.predictionOrigin?.original) this.predictionOrigin = undefined;
    this.clearPrediction();
    this.schedulePrediction();
  }

  private schedulePrediction() {
    clearTimeout(this.predictionTimer);
    if (!this.state || this.composing || (this.view !== "new" && this.view !== "goal") || this.loopOn || this.working)
      return;
    this.predictionTimer = setTimeout(() => {
      void this.predict();
    }, 650);
  }

  private async predict() {
    const id = this.active?.goal.id;
    const home = this.view === "new";
    const input = this.querySelector<HTMLTextAreaElement>(".composer-input");
    if (
      (!id && !home) ||
      this.loopOn ||
      this.composing ||
      !this.selectedCloneId ||
      document.activeElement !== input ||
      input?.selectionStart !== this.draft.length ||
      input?.selectionEnd !== this.draft.length
    )
      return;
    this.predictionAbort?.abort();
    const controller = new AbortController();
    this.predictionAbort = controller;
    const revision = ++this.revision;
    const draft = this.draft;
    this.predicting = true;
    this.lastPredictionContext = `${id}:${this.active?.messages.at(-1)?.id ?? ""}:${draft}`;
    try {
      const prediction = await api<Prediction>(
        home ? "/predict" : `/goals/${encodeURIComponent(id!)}/predict`,
        {
          draft,
          revision,
          ...(home ? { workspace: this.workspace, cloneId: this.selectedCloneId, project: this.selectedProject } : {}),
        },
        controller.signal,
      );
      if (revision === this.revision && this.active?.goal.id === id && this.draft === draft) {
        if (prediction.status === "suggested" && prediction.expiresAt * 1000 > Date.now()) {
          this.prediction = prediction;
          clearTimeout(this.predictionExpiry);
          this.predictionExpiry = setTimeout(
            () => this.clearPrediction(),
            Math.min(60_000, prediction.expiresAt * 1000 - Date.now()),
          );
        } else this.prediction = null;
        if (this.error.startsWith("Prediction unavailable:")) this.error = "";
      }
    } catch (error) {
      if (revision === this.revision && !(error instanceof Error && error.name === "AbortError"))
        this.error = `Prediction unavailable: ${messageError(error)}`;
    } finally {
      if (revision === this.revision) this.predicting = false;
    }
  }

  private acceptPrediction(fromKeyboard = false) {
    if (!this.prediction?.text || this.prediction.expiresAt * 1000 <= Date.now()) return;
    const original = this.draft;
    const text = this.prediction.text;
    const input = this.querySelector<HTMLTextAreaElement>(".composer-input");
    input?.focus();
    input?.setSelectionRange(this.draft.length, this.draft.length);
    if (input && !document.execCommand("insertText", false, text.slice(original.length))) input.value = text;
    this.draft = text;
    this.predictionOrigin = { original, accepted: text };
    clearTimeout(this.predictionExpiry);
    clearTimeout(this.predictionTimer);
    this.prediction = null;
    this.acceptedPrediction = fromKeyboard ? this.draft : "";
    this.revision += 1;
    this.lastPredictionContext = `${this.active?.goal.id}:${this.active?.messages.at(-1)?.id ?? ""}:${this.draft}`;
    void this.updateComplete.then(() => {
      const input = this.querySelector<HTMLTextAreaElement>(".composer-input");
      input?.focus();
      input?.setSelectionRange(this.draft.length, this.draft.length);
    });
  }

  private onComposerKey(event: KeyboardEvent) {
    if (event.isComposing || this.composing) return;
    const input = event.target as HTMLTextAreaElement;
    if (input.selectionStart !== this.draft.length || input.selectionEnd !== this.draft.length) this.clearPrediction();
    if (this.prediction && this.prediction.expiresAt * 1000 <= Date.now()) this.clearPrediction();
    if (event.key === "Escape") {
      this.clearPrediction();
      return;
    }
    if (event.key === "Tab") {
      const action = composerTabAction(event, this.draft, this.prediction?.text, this.acceptedPrediction);
      if (action !== "move-focus") event.preventDefault();
      if (action === "enable-loop") {
        this.acceptedPrediction = "";
        void this.toggleLoop(true);
      } else if (action === "accept") {
        this.acceptPrediction(true);
      } else if (action === "move-focus") {
        this.acceptedPrediction = "";
      }
      return;
    }
    if (!["Shift", "Control", "Alt", "Meta"].includes(event.key)) this.acceptedPrediction = "";
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      if (!this.pending && !this.working && this.draft.trim()) void this.send();
    }
  }

  private async send(): Promise<boolean> {
    const text = this.draft.trim();
    let origin = "human";
    if (this.predictionOrigin)
      origin = this.draft === this.predictionOrigin.accepted ? "accepted_prediction" : "edited_prediction";
    if (!text || this.pending || this.working) return false;
    const navigation = this.navigationRevision;
    const operation = ++this.operationRevision;
    const workspace = this.workspace;
    const draft = this.draft;
    let goal = this.view === "new" ? undefined : this.active?.goal;
    const draftKey = goal?.id ?? `new:${workspace}`;
    const current = () =>
      navigation === this.navigationRevision && workspace === this.workspace && operation === this.operationRevision;
    this.pending = true;
    this.error = "";
    this.clearPrediction();
    try {
      if (!goal) {
        const created = await api<{ goal: Goal }>("/goals", {
          title: text.split(/[\n.!?]/)[0].slice(0, 100),
          project: this.selectedProject,
          workspace,
          cloneId: this.selectedCloneId || this.clones[0]?.id,
        });
        goal = created.goal;
      }
      await api(`/goals/${encodeURIComponent(goal.id)}/send`, { text, origin });
      if (current()) this.predictionOrigin = undefined;
      if (this.drafts.get(draftKey) === draft) {
        this.drafts.delete(draftKey);
        this.draftOrigins.delete(draftKey);
      }
      if (!current()) return true;
      if (this.active?.goal.id !== goal.id) this.active = { goal, messages: [] };
      this.view = "goal";
      localStorage.setItem("clone.activeGoal", goal.id);
      if (this.draft === draft) this.draft = "";
      await this.refreshGoal();
      await this.refreshState();
      if (current()) {
        await this.updateComplete;
        this.scrollToLatest();
      }
      return true;
    } catch (error) {
      if (current()) this.error = messageError(error);
      return false;
    } finally {
      if (operation === this.operationRevision) this.pending = false;
    }
  }

  private async toggleLoop(enabled = !this.loopOn) {
    if (this.pending) return;
    if (this.prediction && this.prediction.expiresAt * 1000 <= Date.now()) this.clearPrediction();
    if (!this.active && !this.draft.trim() && !this.prediction?.text) return;
    const navigation = this.navigationRevision;
    const operation = ++this.operationRevision;
    const workspace = this.workspace;
    const draft = this.draft;
    const instruction = composerLoopInstruction(Boolean(this.active?.goal), draft, this.prediction?.text);
    let goal = this.active?.goal;
    const draftKey = goal?.id ?? `new:${workspace}`;
    const current = () =>
      navigation === this.navigationRevision && workspace === this.workspace && operation === this.operationRevision;
    this.pending = true;
    this.clearPrediction();
    try {
      if (!goal) {
        const created = await api<{ goal: Goal }>("/goals", {
          title: (instruction ?? "").split(/[\n.!?]/)[0].slice(0, 100),
          project: this.selectedProject,
          workspace,
          cloneId: this.selectedCloneId || this.clones[0]?.id,
        });
        goal = created.goal;
      }
      await api(`/goals/${encodeURIComponent(goal.id)}/loop`, {
        enabled,
        ...(enabled && instruction ? { instruction } : {}),
      });
      if (enabled && instruction && this.drafts.get(draftKey) === draft) {
        this.drafts.delete(draftKey);
        this.draftOrigins.delete(draftKey);
      }
      if (!current()) return;
      if (this.active?.goal.id !== goal.id) this.active = { goal, messages: [] };
      this.view = "goal";
      localStorage.setItem("clone.activeGoal", goal.id);
      if (enabled && instruction && this.draft === draft) {
        this.draft = "";
        this.predictionOrigin = undefined;
      }
      await this.refreshGoal();
      await this.refreshState();
    } catch (error) {
      if (current()) this.error = messageError(error);
    } finally {
      if (operation === this.operationRevision) this.pending = false;
    }
  }

  private async selectClone(clone: Clone) {
    this.cloneMenu = false;
    if (this.active && this.view === "goal") {
      const navigation = this.navigationRevision;
      const operation = ++this.operationRevision;
      const id = this.active.goal.id;
      const current = () =>
        navigation === this.navigationRevision && operation === this.operationRevision && this.active?.goal.id === id;
      this.pending = true;
      try {
        await api(`/goals/${encodeURIComponent(id)}/clone`, { cloneId: clone.id });
        if (!current()) return;
        await this.refreshGoal();
        if (!current()) return;
        this.selectedCloneId = clone.id;
        this.clearPrediction();
        this.schedulePrediction();
      } catch (error) {
        if (current()) this.error = messageError(error);
      } finally {
        if (operation === this.operationRevision) this.pending = false;
      }
    } else {
      this.selectedCloneId = clone.id;
      this.clearPrediction();
      this.schedulePrediction();
    }
  }

  private async loadMemory() {
    const navigation = this.navigationRevision;
    const scope = `${this.workspace}:${this.selectedCloneId}:${this.memoryQuery}`;
    const current = () =>
      navigation === this.navigationRevision &&
      this.view === "memory" &&
      scope === `${this.workspace}:${this.selectedCloneId}:${this.memoryQuery}`;
    this.memoryLoading = true;
    const query = new URLSearchParams({
      workspace: this.workspace,
      cloneId: this.selectedCloneId,
      query: this.memoryQuery,
    });
    try {
      const result = await api<MemoryResults>(`/memory?${query}`);
      if (current()) this.memoryData = result;
    } catch (error) {
      if (current()) this.error = messageError(error);
    } finally {
      if (current()) this.memoryLoading = false;
    }
  }

  private async loadInbox() {
    const navigation = this.navigationRevision;
    const workspace = this.workspace;
    const current = () =>
      navigation === this.navigationRevision && this.view === "inbox" && workspace === this.workspace;
    this.inboxLoading = true;
    try {
      const result = await api<{ items: InboxItem[] }>(`/inbox?workspace=${workspace}`);
      if (current()) this.inbox = result.items ?? [];
    } catch (error) {
      if (current()) this.error = messageError(error);
    } finally {
      if (current()) this.inboxLoading = false;
    }
  }

  private async startPrompt(text: string, project: string) {
    await this.navigate("new");
    this.selectedProject = project;
    this.draft = text;
    await this.updateComplete;
    this.querySelector<HTMLTextAreaElement>(".composer-input")?.focus();
  }

  private avatar(clone: Clone | undefined, small = false) {
    const avatar = clone?.avatar;
    return html`<span
      class="avatar ${small ? "small" : ""} ${clone?.demo ? "teammate-avatar" : ""}"
      style=${clone?.color ? `--avatar-color:${clone.color}` : ""}
      >${
        avatar && !this.failedAvatars.has(avatar)
          ? html`<img
              src=${avatar}
              alt=""
              @error=${() => {
                this.failedAvatars.add(avatar);
                this.requestUpdate();
              }}
            />`
          : personName(clone).charAt(0)
      }</span
    >`;
  }

  private projectDot(project: string) {
    return html`<span class="project-dot" style=${`background:${projectColors[project] ?? "#9b9da6"}`}></span>`;
  }

  private sidebar() {
    return html`<aside class="sidebar" aria-label="Workspace navigation">
      <button class="brand" @click=${() => this.navigate("new")} aria-label="QM with Clone-in-the-Loop home">
        ${brand()}<span>QM <span class="brand-caption">with Clone-in-the-Loop</span></span>
      </button>
      <div class="workspace-wrap">
        <button
          class="workspace-button"
          @click=${() => {
            this.workspaceMenu = !this.workspaceMenu;
          }}
          aria-expanded=${this.workspaceMenu}
          aria-label="Switch workspace"
        >
          <span class="workspace-icon">${icon(this.workspace === "team" ? "team" : "user", 17)}</span
          ><span
            >${this.workspace === "team" ? "Company workspace" : "Personal workspace"}<small
              >${this.workspace === "team" ? "Shared context, individual judgment" : "Your context. Your judgment."}</small
            ></span
          >${icon("chevron", 14)}
        </button>
        ${this.workspaceMenu ? html`<div class="popover workspace-options"><span class="menu-label">WORKSPACES</span>${(["personal", "team"] as Workspace[]).map((workspace) => html`<button @click=${() => this.switchWorkspace(workspace)}>${icon(workspace === "team" ? "team" : "user")}<span>${workspace === "team" ? "Company workspace" : "Personal workspace"}</span>${workspace === this.workspace ? icon("check", 15) : nothing}</button>`)}</div>` : nothing}
      </div>
      <nav class="main-nav" aria-label="Main navigation">
        ${navigationItems.map(
          (item) =>
            html`<button
              class="nav-item ${this.view === item.view && !(item.view === "goals" && this.filterProject) ? "active" : ""}"
              @click=${() => (item.view === "new" ? this.startNewGoal() : this.navigate(item.view))}
              aria-label=${item.label}
              aria-keyshortcuts=${`${this.isMac ? "Meta" : "Control"}+Alt+${item.digit}`}
              title=${`${item.label} (${navigationShortcutHint(item.digit, this.isMac)})`}
            >
              ${icon(item.icon)}<span>${item.label}</span><kbd>${navigationShortcutHint(item.digit, this.isMac)}</kbd>
            </button>`,
        )}
      </nav>
      <div class="sidebar-section-label">Projects<span>${icon("folder", 13)}</span></div>
      <nav class="project-nav">
        ${projects.map((project) => html`<button class="nav-item ${this.view === "goals" && this.filterProject === project ? "active" : ""}" @click=${() => this.navigate("goals", project)}>${this.projectDot(project)}<span>${project}</span></button>`)}
      </nav>
      ${
        this.workspaceGoals.length
          ? html`<div class="sidebar-section-label recent-label">Recents</div>
              <div class="recent-goals">
                ${this.workspaceGoals.slice(0, 6).map((goal) => html`<button class="recent-goal ${this.active?.goal.id === goal.id && this.view === "goal" ? "active" : ""}" @click=${() => this.openGoal(goal.id)} title=${goal.title}><span class="goal-state-dot ${goal.loopEnabled ? "running" : ""}"></span><span>${goal.title}</span></button>`)}
              </div>`
          : nothing
      }
      <div class="sidebar-bottom">
        <button
          class="profile"
          aria-label="Keyboard shortcuts"
          title="Keyboard shortcuts"
          @click=${() => {
            this.showKeyboardHelp = !this.showKeyboardHelp;
          }}
        >
          ${this.avatar(this.clones[0], true)}<span
            >${personName(this.clones[0])}<small>Your personal AGI workspace</small></span
          >${icon("settings", 16)}
        </button>
      </div>
    </aside>`;
  }

  private header() {
    let pageTitle = this.filterProject || `${this.view.charAt(0).toUpperCase()}${this.view.slice(1)}`;
    if (this.view === "goal") pageTitle = this.active?.goal.project ?? "Goal";
    else if (this.view === "new") pageTitle = "New";
    else if (this.view === "goals") pageTitle = this.filterProject || "Goals";
    else if (this.view === "memory") pageTitle = "Memories";
    return html`<header class="topbar">
      <div class="breadcrumb">
        <span>${this.workspace === "team" ? "Company" : "Personal"}</span
        ><span class="slash">/</span
        >${this.view === "goal" ? this.projectDot(this.active?.goal.project ?? "") : nothing}<span class="current-crumb"
          >${pageTitle}</span
        >
      </div>
      <div class="topbar-right">
        ${this.workspace === "team" ? html`<div class="avatar-stack">${this.clones.slice(0, 3).map((clone) => this.avatar(clone, true))}</div>` : nothing}<button
          class="memory-status"
          @click=${() => this.navigate("memory")}
          title="Inspect the memory behind your Clone"
        >
          <span
            class="status-dot ${/error|unavailable|offline/i.test(memoryStatusLabel(this.state?.memory?.status)) ? "muted" : ""}"
          ></span
          >Memory ${memoryStatusLabel(this.state?.memory?.status)}
        </button>
      </div>
    </header>`;
  }

  private home() {
    return html`<div class="home-page">
      <div class="home-main">
        <h1>${this.workspace === "team" ? "What should the team work on?" : "What can I help with?"}</h1>
        ${this.composer(true)}
        <div class="starter-grid">
          ${starterGoals.map((goal) => html`<button class="starter-card" @click=${() => this.startPrompt(goal.text, goal.project)}>${icon(projectIcons[goal.project] ?? "goals", 17)}<strong>${goal.title}</strong><span class="starter-project">${goal.project}</span><span class="starter-arrow">${icon("right", 15)}</span></button>`)}
        </div>
      </div>
    </div>`;
  }

  private clonePicker() {
    const available = this.workspace === "personal" ? this.clones.filter((clone) => !clone.demo) : this.clones;
    const historyLabel =
      this.workspace === "team" ? "Grounded in shared team history" : "Grounded in your personal history";
    const selected =
      this.view === "new"
        ? (this.clones.find((clone) => clone.id === this.selectedCloneId) ?? this.clones[0])
        : this.currentClone;
    return html`<div class="clone-picker-wrap">
      <button
        class="clone-picker"
        @click=${() => {
          this.cloneMenu = !this.cloneMenu;
        }}
        aria-expanded=${this.cloneMenu}
        aria-label="Choose whose Clone guides the work"
      >
        ${this.avatar(selected, true)}<span>${cloneName(selected)}</span>${icon("chevron", 13)}</button
      >${
        this.cloneMenu
          ? html`<div class="popover clone-options">
              <span class="menu-label">WHOSE JUDGMENT GUIDES THIS GOAL?</span>${available.map(
                (clone) =>
                  html`<button @click=${() => this.selectClone(clone)}>
                    ${this.avatar(clone, true)}<span
                      >${cloneName(clone)}<small>${clone.demo ? "Less pitch. More proof." : historyLabel}</small></span
                    >${selected?.id === clone.id ? icon("check", 15) : nothing}
                  </button>`,
              )}
            </div>`
          : nothing
      }
    </div>`;
  }

  private ghostContent(suffix: string) {
    const draft = html`<span class="ghost-draft">${this.draft}</span>`;
    const completion = html`<span class="ghost-suggestion">${suffix}</span>`;
    return html`<div class="ghost-layer" aria-hidden="true">${draft}${completion}</div>`;
  }

  private composer(home = false) {
    const suffix = this.prediction?.text ? completionSuffix(this.draft, this.prediction.text) : "";
    const separatePrediction = this.prediction?.text && !suffix && this.prediction.text !== this.draft;
    const active = this.loopOn || this.working;
    const stopping = active && (this.pending || this.active?.goal.phase === "stopping");
    const hasInstruction = !!this.active || !!this.draft.trim() || !!this.prediction?.text;
    const toggleDisabled =
      this.pending || this.booting || stopping || (!this.loopOn && (this.working || !hasInstruction));
    let toggleTitle = this.loopOn ? "Turn off Clone" : "Turn on Clone";
    if (!this.loopOn && this.working) toggleTitle = "Stop the current run to enable Clone";
    else if (!hasInstruction) toggleTitle = "Add direction to enable Clone";
    let placeholder = "Ask anything";
    if (stopping) placeholder = "Stopping…";
    else if (active) placeholder = "Press Stop to add direction…";
    else if (suffix) placeholder = "";
    return html`<div class="composer-area ${home ? "home-composer" : ""}">
      ${
        separatePrediction
          ? html`<button class="prediction-preview" @click=${() => this.acceptPrediction()}>
              <span>${icon("sparkle", 15)}Suggested next instruction</span>
              <p>${this.prediction?.text}</p>
              <kbd>Tab</kbd>
            </button>`
          : nothing
      }
      <div class="composer ${this.loopOn ? "loop-active" : ""}">
        <div class="composer-writing" tabindex="0" aria-label="Prompt and suggestion, scroll to read the full text">
          <div class="composer-content">
            <div class="composer-measure" aria-hidden="true">${this.draft + suffix + "\n"}</div>
            ${this.ghostContent(suffix)}
            <textarea
              class="composer-input"
              aria-label="Message your agent"
              aria-describedby="composer-state composer-shortcuts"
              placeholder=${placeholder}
              .value=${this.draft}
              ?readonly=${active}
              rows="1"
              @input=${this.onDraft}
              @keydown=${this.onComposerKey}
              @focus=${this.schedulePrediction}
              @select=${(event: Event) => {
                const input = event.target as HTMLTextAreaElement;
                if (input.selectionStart !== this.draft.length || input.selectionEnd !== this.draft.length)
                  this.clearPrediction();
              }}
              @compositionstart=${() => {
                this.composing = true;
                this.clearPrediction();
              }}
              @compositionend=${() => {
                this.composing = false;
                this.schedulePrediction();
              }}
              @blur=${() => {
                this.clearPrediction();
              }}
            ></textarea>
          </div>
        </div>
        <div class="composer-controls">
          <div class="composer-left">
            <div class="composer-clone-controls">
              ${this.workspace === "team" ? this.clonePicker() : nothing}<button
                class="loop-toggle"
                role="switch"
                aria-label="Clone"
                aria-checked=${String(this.loopOn)}
                title=${toggleTitle}
                @click=${() => this.toggleLoop(!this.loopOn)}
                ?disabled=${toggleDisabled}
              >
                ${this.workspace === "personal" ? html`<span>Clone</span>` : nothing}<span
                  class="loop-switch-track"
                  aria-hidden="true"
                ></span>
              </button>
            </div>
          </div>
          <div class="composer-actions">
            <span class="model-label">${icon("code", 13)}${this.modelLabel}</span>${
              active
                ? html`<button
                    class="send-button stop-button"
                    aria-label=${stopping ? "Stopping" : "Stop"}
                    title=${stopping ? "Stopping" : "Stop"}
                    @click=${() => this.toggleLoop(false)}
                    ?disabled=${stopping}
                  >
                    ${icon("stop", 20)}
                  </button>`
                : html`<button
                    class="send-button"
                    aria-label="Send message"
                    @click=${() => this.send()}
                    ?disabled=${!this.draft.trim() || this.pending || this.booting}
                  >
                    ${this.pending ? html`<span class="button-spinner"></span>` : icon("arrow", 19)}
                  </button>`
            }
          </div>
        </div>
      </div>
      <div class="composer-hints">
        <span id="composer-state" role="status" aria-live="polite" aria-atomic="true">${this.predictionHint()}</span
        ><span id="composer-shortcuts">${this.shortcutHint()}</span>
      </div>
    </div>`;
  }

  private predictionHint() {
    if (this.loopOn) {
      let phase = "Working";
      if (this.active?.goal.phase === "stopping") phase = "Stopping";
      else if (/review/.test(this.active?.goal.phase ?? "")) phase = "Reviewing";
      else if (/predict|plan/.test(this.active?.goal.phase ?? "")) phase = "Choosing the next step";
      return html`${icon("loop", 12)}Clone · ${phase}`;
    }
    if (this.working) return nothing;
    if (this.acceptedPrediction === this.draft && this.acceptedPrediction)
      return html`${icon("check", 12)}Prediction accepted. Ready when you are.`;
    if (this.predicting) return html`<span class="tiny-spinner"></span>Reading your context…`;
    return nothing;
  }

  private shortcutHint() {
    if (this.loopOn || this.working) return nothing;
    if (this.acceptedPrediction === this.draft && this.acceptedPrediction)
      return html`<kbd>Tab</kbd> again: Clone <span class="hint-divider">·</span> <kbd>↵</kbd> send`;
    if (this.prediction?.text)
      return html`<kbd>Tab</kbd> once: accept <span class="hint-divider">·</span> <kbd>Tab</kbd> twice: Clone
        <span class="hint-divider">·</span> <kbd>Esc</kbd> dismiss`;
    return html`<kbd>↵</kbd> send <span class="hint-divider">·</span> <kbd>Shift ↵</kbd> new line`;
  }

  private conversation() {
    if (!this.active) return nothing;
    const goal = this.active.goal;
    return html`<div class="goal-page">
      <div class="goal-heading">
        <div>
          <div class="goal-meta">
            ${this.projectDot(goal.project)}${goal.project}<span>·</span><span>${goal.status || "Active"}</span>
          </div>
          <h1>${goal.title}</h1>
        </div>
        ${goal.iterations ? html`<span class="session-iterations">${goal.iterations} ${goal.iterations === 1 ? "iteration" : "iterations"}</span>` : nothing}
      </div>
      ${goal.error ? html`<div class="error-banner goal-error" role="alert"><span>${goal.error}</span></div>` : nothing}
      <div class="conversation-scroll">
        <div class="conversation-content">
          ${
            this.active.messages.length
              ? conversationTurns(this.active.messages).map((messages) => this.renderMessage(messages))
              : html`<div class="conversation-empty">
                  ${icon("sparkle", 26)}
                  <h2>A goal, ready to move.</h2>
                  <p>Your agent executes. Your Clone brings the context and judgment.</p>
                </div>`
          }${this.working ? html`<div class="activity-row" role="status"><span class="activity-symbol">${icon(this.active.goal.phase.includes("review") ? "check" : "code", 17)}</span><span class="live-pulse"></span><span>${this.phaseLabel(goal.phase)}</span><span class="activity-model">${this.modelLabel}</span></div>` : nothing}
          <div class="conversation-end"></div>
        </div>
      </div>
      <div class="goal-composer">${this.composer()}</div>
    </div>`;
  }

  private phaseLabel(phase: string) {
    if (phase === "stopping") return "Stopping the current run";
    if (/review/.test(phase)) return `${cloneName(this.currentClone)} is reviewing the result`;
    if (/predict|plan/.test(phase)) return `${cloneName(this.currentClone)} is choosing the next move`;
    return "QM agent is working on your goal";
  }

  private renderMessage(messages: Message[]) {
    const message = messages[0];
    const sources = [
      ...new Map(messages.flatMap((entry) => entry.sources ?? []).map((source) => [source.id, source])).values(),
    ];
    const clone = this.clones.find((item) => item.id === message.cloneId) ?? this.currentClone;
    const isClone = message.role === "clone" || message.role === "review";
    let label = "QM agent";
    if (message.role === "user") label = "You";
    else if (isClone) label = cloneName(clone);
    return html`<article class="message message-${message.role}">
      <div class="message-avatar">
        ${message.role === "assistant" ? html`<span class="agent-avatar">${icon("code", 18)}</span>` : this.avatar(message.role === "user" ? this.clones[0] : clone, true)}
      </div>
      <div class="message-main">
        <div class="message-header">
          <strong>${label}</strong
          >${message.role === "assistant" ? html`<span class="message-model">${this.modelLabel}</span>` : nothing}<time
            datetime=${message.createdAt}
            >${Number.isNaN(Date.parse(message.createdAt)) ? "" : new Date(message.createdAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</time
          >
        </div>
        <div class="message-content">${renderMarkdown(messages.map((entry) => entry.content).join(" "))}</div>
        ${
          sources.length
            ? html`<div class="message-sources" aria-label="Sources used in this turn">
                <span>${icon("memory", 12)}Grounded in</span>${sources.map(
                  (source) =>
                    html`<button
                      @click=${() => {
                        this.selectedSource = source;
                      }}
                      title=${source.title || memorySourceLabel(source.source)}
                    >
                      ${icon("link", 11)}<span class="source-chip-text"
                        >${source.title || memorySourceLabel(source.source)}</span
                      >
                    </button>`,
                )}
              </div>`
            : nothing
        }
      </div>
    </article>`;
  }

  private goalsPage() {
    const goals = this.workspaceGoals.filter((goal) => !this.filterProject || goal.project === this.filterProject);
    const columns = ["Ready", "In progress", "Paused"];
    for (const label of ["Needs attention", "Completed"])
      if (goals.some((goal) => goalColumn(goal) === label)) columns.push(label);
    return html`<div class="collection-page">
      <div class="collection-heading">
        <div>
          <h1>${this.filterProject || "Goals"}</h1>
        </div>
        <button class="primary-button" @click=${() => this.startNewGoal()}>${icon("plus", 16)}New</button>
      </div>
      <div class="collection-tabs">
        <span class="selected">All goals <b>${goals.length}</b></span
        ><span>${goals.filter((goal) => goal.loopEnabled).length} in the loop</span>
      </div>
      ${
        goals.length
          ? html`<div class="goals-board" aria-label="Goals by status">
              ${columns.map((label) => {
                const items = goals.filter((goal) => goalColumn(goal) === label);
                return html`<section class="goal-column" aria-label=${label}>
                  <div class="goal-column-heading">
                    <h2>${label}</h2>
                    <span>${items.length}</span>
                  </div>
                  <div class="goal-column-cards">
                    ${
                      items.length
                        ? items.map(
                            (goal) =>
                              html`<button class="goal-board-card" @click=${() => this.openGoal(goal.id)}>
                                <strong>${goal.title}</strong>
                                <span class="goal-card-project">${this.projectDot(goal.project)}${goal.project}</span>
                                <span class="goal-card-footer">
                                  <span>${goal.iterations} ${goal.iterations === 1 ? "iteration" : "iterations"}</span>
                                  ${this.avatar(
                                    this.clones.find((clone) => clone.id === goal.cloneId),
                                    true,
                                  )}
                                </span>
                              </button>`,
                          )
                        : html`<span class="goal-column-empty">No goals</span>`
                    }
                  </div>
                </section>`;
              })}
            </div>`
          : html`<div class="empty-state">
              ${icon("goals", 34)}
              <h2>Big things start with a little direction.</h2>
              <p>Start a goal and let your Clone help carry it forward.</p>
              <button class="text-button" @click=${() => this.startNewGoal()}>
                Start your first goal ${icon("right", 15)}
              </button>
            </div>`
      }
    </div>`;
  }

  private memoryPage() {
    const total = memoryTotal(this.memoryData?.counts ?? this.state?.memory?.counts);
    return html`<div class="collection-page memory-page">
      <div class="collection-heading">
        <div>
          <h1>Memories</h1>
        </div>
        <span class="provider-label">Powered by <strong>GBrain</strong>${icon("memory", 20)}</span>
      </div>
      <div class="memory-summary">
        <div><strong>${total.toLocaleString()}</strong><span>Memory records</span></div>
        <div>
          <strong>${this.workspace === "team" ? "Shared" : "Personal"}</strong
          ><span
            >${this.workspace === "team" ? "Permission-scoped team context" : "Your Codex and Claude history"}</span
          >
        </div>
        <div>
          <strong class="status-text"
            ><span class="status-dot"></span
            >${memoryStatusLabel(this.memoryData?.status ?? this.state?.memory?.status)}</strong
          ><span>Retrieval status</span>
        </div>
      </div>
      <div class="memory-search">
        ${icon("search", 19)}<input
          aria-label="Search memory"
          placeholder="Search decisions, feedback, and past conversations…"
          .value=${this.memoryQuery}
          @input=${(event: Event) => {
            this.memoryQuery = (event.target as HTMLInputElement).value;
            clearTimeout(this.memoryTimer);
            this.memoryTimer = setTimeout(() => {
              void this.loadMemory();
            }, 350);
          }}
        /><span
          >${this.memoryLoading ? html`<span class="tiny-spinner"></span>` : `${this.memoryData?.results?.length ?? 0} ${this.memoryData?.results?.length === 1 ? "result" : "results"}`}</span
        >
      </div>
      <div class="memory-results">
        ${
          this.memoryData?.results?.length
            ? this.memoryData.results.map(
                (source) =>
                  html`<button
                    class="memory-card"
                    @click=${() => {
                      this.selectedSource = source;
                    }}
                  >
                    <span class="memory-card-top"
                      ><span class="source-label" title=${memorySourceLabel(source.source)}
                        >${icon("book", 13)}<span class="source-chip-text"
                          >${memorySourceLabel(source.source)}</span
                        ></span
                      >${source.demo ? html`<span class="tiny-tag">DEMO DATA</span>` : nothing}${icon("external", 13)}</span
                    >
                    <h3>${source.title || "Conversation memory"}</h3>
                    <p>${source.excerpt}</p>
                    <span class="memory-card-footer">Inspect source ${icon("right", 13)}</span>
                  </button>`,
              )
            : html`<div class="empty-state">
                ${icon("memory", 32)}
                <h2>${this.memoryLoading ? "Retrieving your context" : "No matching memories"}</h2>
                <p>
                  ${this.memoryLoading ? "GBrain is finding relevant conversation history." : "Try another search, or import conversation history using the setup guide."}
                </p>
              </div>`
        }
      </div>
    </div>`;
  }

  private inboxPage() {
    return html`<div class="collection-page">
      <div class="collection-heading">
        <div>
          <h1>Inbox</h1>
          <p>Suggested next goals.</p>
        </div>
        <span class="provider-label">${icon("sparkle", 18)}From your Clone</span>
      </div>
      <div class="inbox-list">
        ${
          this.inbox.length
            ? this.inbox.map(
                (item) =>
                  html`<article class="inbox-card">
                    <span class="inbox-icon">${icon("sparkle", 19)}</span>
                    <div>
                      <span class="starter-project">${this.projectDot(item.project)}${item.project}</span>
                      <h2>${item.title}</h2>
                      <p>${item.reason}</p>
                      <button class="text-button" @click=${() => this.startPrompt(item.title, item.project)}>
                        Start goal ${icon("right", 15)}
                      </button>
                    </div>
                  </article>`,
              )
            : html`<div class="empty-state">
                ${icon("inbox", 34)}
                <h2>${this.inboxLoading ? "Finding your next moves" : "Room for the next good idea."}</h2>
                <p>
                  ${this.inboxLoading ? "Reading your workspace context." : "As your context grows, suggested goals will appear here."}
                </p>
              </div>`
        }
      </div>
    </div>`;
  }

  private sourcePanel() {
    const source = this.selectedSource;
    if (!source) return nothing;
    return html`<div
        class="panel-backdrop"
        @click=${() => {
          this.selectedSource = null;
        }}
      ></div>
      <aside class="source-panel" role="dialog" aria-modal="true" aria-label="Memory source">
        <div class="source-panel-header">
          <span>${icon("memory", 19)}Memory source</span
          ><button
            class="icon-button"
            aria-label="Close memory source"
            @click=${() => {
              this.selectedSource = null;
            }}
          >
            ${icon("close", 20)}
          </button>
        </div>
        <div class="source-panel-body">
          <span class="source-label" title=${memorySourceLabel(source.source)}
            ><span class="source-chip-text">${memorySourceLabel(source.source)}</span></span
          >${source.demo ? html`<span class="demo-source-label">Synthetic demo data</span>` : nothing}
          <h2>${source.title || "Conversation memory"}</h2>
          <div class="source-excerpt">${renderMarkdown(source.excerpt)}</div>
          <div class="source-provenance">
            ${icon("link", 15)}
            <div>
              <strong>Retrieved context</strong>
              <p>
                This excerpt grounds the Clone's suggestion. Past conversation is context, not proof that an outcome was
                verified.
              </p>
            </div>
          </div>
        </div>
        <div class="source-panel-footer">
          <span>Context by <strong>GBrain</strong></span
          ><button
            class="text-button"
            @click=${() => {
              this.selectedSource = null;
              void this.navigate("memory");
            }}
          >
            Explore memory ${icon("right", 15)}
          </button>
        </div>
      </aside>`;
  }

  private mainContent() {
    if (this.booting && !this.state)
      return html`<div class="boot-state">
        ${brand(44)}
        <p>Bringing your workspace together…</p>
      </div>`;
    switch (this.view) {
      case "new":
        return this.home();
      case "goal":
        return this.conversation();
      case "goals":
        return this.goalsPage();
      case "memory":
        return this.memoryPage();
      default:
        return this.inboxPage();
    }
  }

  protected render() {
    return html`<div class="app-shell">
      ${this.sidebar()}
      <main class="main-shell">
        ${this.header()}${
          this.error
            ? html`<div class="error-banner" role="alert">
                <span>${this.error}</span
                >${!this.state ? html`<button @click=${() => this.boot()}>Retry connection</button>` : nothing}<button
                  class="icon-button"
                  aria-label="Dismiss error"
                  @click=${() => {
                    this.error = "";
                  }}
                >
                  ${icon("close", 15)}
                </button>
              </div>`
            : nothing
        }${this.mainContent()}
      </main>
      ${this.sourcePanel()}${
        this.showKeyboardHelp
          ? html`<div class="keyboard-help">
              <button
                class="icon-button"
                aria-label="Close keyboard shortcuts"
                @click=${() => {
                  this.showKeyboardHelp = false;
                }}
              >
                ${icon("close", 16)}
              </button>
              <h3>Keep your flow.</h3>
              ${navigationItems.map((item) => html`<p><kbd>${navigationShortcutHint(item.digit, this.isMac)}</kbd><span>${item.label}</span></p>`)}
              <p><kbd>Tab</kbd><span>Press once to accept the prediction</span></p>
              <p><kbd>Tab</kbd><kbd>Tab</kbd><span>Press twice to enable Clone</span></p>
              <p><kbd>Esc</kbd><span>Dismiss a suggestion</span></p>
              <small>Clone continues until you press Stop.</small>
            </div>`
          : nothing
      }
    </div>`;
  }
}

customElements.define("clone-app", CloneApp);
