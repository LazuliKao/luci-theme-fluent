import type { TileConstraints } from "../core/tiles";
import type { TileSize, WidgetConfig } from "../core/types";
import type { DataService } from "../data/service";

export interface WidgetContext {
  data: DataService;
  config: WidgetConfig;
  setStatus(message: string): void;
}
export interface WidgetInstance {
  mount(container: HTMLElement): void;
  updateConfig(config: WidgetConfig): void;
  resize(width: number, height: number): void;
  setVisible(visible: boolean): void;
  destroy(): void;
}
export interface WidgetDefinition {
  type: string;
  version: number;
  title: string;
  description: string;
  category: string;
  icon: string;
  supportedSizes: TileSize[];
  defaultSize: Exclude<TileSize, "custom">;
  constraints: TileConstraints;
  defaultConfig: WidgetConfig;
  requiredData: string[];
  validateConfig(config: WidgetConfig): boolean;
  migrateConfig?(config: WidgetConfig, fromVersion: number): WidgetConfig;
  createInstance(context: WidgetContext): WidgetInstance;
}
export class WidgetRegistry {
  private definitions = new Map<string, WidgetDefinition>();
  register(definition: WidgetDefinition): void {
    if (this.definitions.has(definition.type)) throw new Error(`Duplicate widget: ${definition.type}`);
    if (!definition.validateConfig(definition.defaultConfig)) throw new Error(`Invalid default config: ${definition.type}`);
    this.definitions.set(definition.type, definition);
  }
  get(type: string): WidgetDefinition | undefined {
    return this.definitions.get(type);
  }
  list(): WidgetDefinition[] {
    return [...this.definitions.values()];
  }
}
