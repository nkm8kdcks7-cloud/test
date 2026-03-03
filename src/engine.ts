
export type Condition = {
  flagsAny?: string[];
  flagsAll?: string[];
  inventoryHas?: string[];
};

export type Effects = {
  flagsAdd?: string[];
  flagsRemove?: string[];
  inventoryAdd?: string[];
  inventoryRemove?: string[];

  reputation?: number; // общая репутация (delta)
  factionRep?: Record<string, number>; // репутация по фракциям (delta), например { village: +1, order: -2 }
  hp?: number; // delta

  loreAdd?: string[]; // открыть записи лора (id из lore.ru.json)

  reset?: boolean; // reset game state
};

export type Choice = {
  text: string;
  next: string;
  conditions?: Condition;
  effects?: Effects;
};

export type Node = {
  title: string;
  text: string[];
  choices: Choice[];
};

export type Story = {
  meta: {
    title: string;
    version: string;
    startNode: string;
  };
  nodes: Record<string, Node>;
};

export type GameState = {
  nodeId: string;
  flags: string[];
  inventory: string[];
  reputation: number;

  factions: Record<string, number>; // репутация по фракциям
  loreUnlocked: string[]; // открытые записи лора (id)

  hp: number;
  history: { nodeId: string; choiceText?: string; at: number }[];

  deathFrom?: string; // узел, где произошел провал
};

export const DEFAULT_HP = 5;

export const DEFAULT_FACTIONS: Record<string, number> = {
  village: 0,
  hunters: 0,
  order: 0,
  dragons: 0,
};

export function makeInitialState(story: Story): GameState {
  return {
    nodeId: story.meta.startNode,
    flags: [],
    inventory: [],
    reputation: 0,
    factions: { ...DEFAULT_FACTIONS },
    loreUnlocked: [],
    hp: DEFAULT_HP,
    history: [{ nodeId: story.meta.startNode, at: Date.now() }],
    deathFrom: undefined,
  };
}

function hasAll(hay: string[], needles: string[]) {
  const set = new Set(hay);
  return needles.every(n => set.has(n));
}
function hasAny(hay: string[], needles: string[]) {
  const set = new Set(hay);
  return needles.some(n => set.has(n));
}

export function checkCondition(state: GameState, c?: Condition): boolean {
  if (!c) return true;
  if (c.flagsAll && !hasAll(state.flags, c.flagsAll)) return false;
  if (c.flagsAny && !hasAny(state.flags, c.flagsAny)) return false;
  if (c.inventoryHas && !hasAll(state.inventory, c.inventoryHas)) return false;
  return true;
}

export function applyEffects(state: GameState, effects?: Effects): GameState {
  if (!effects) return state;
  if (effects.reset) return { ...state };

  const flags = new Set(state.flags);
  effects.flagsAdd?.forEach(f => flags.add(f));
  effects.flagsRemove?.forEach(f => flags.delete(f));

  const inv = [...state.inventory];
  effects.inventoryAdd?.forEach(item => {
    if (!inv.includes(item)) inv.push(item);
  });
  effects.inventoryRemove?.forEach(item => {
    const idx = inv.indexOf(item);
    if (idx >= 0) inv.splice(idx, 1);
  });

  const factions = { ...state.factions };
  if (effects.factionRep) {
    for (const [k, v] of Object.entries(effects.factionRep)) {
      factions[k] = (factions[k] ?? 0) + v;
    }
  }

  const lore = new Set(state.loreUnlocked);
  effects.loreAdd?.forEach(id => lore.add(id));

  return {
    ...state,
    flags: [...flags],
    inventory: inv,
    reputation: state.reputation + (effects.reputation ?? 0),
    factions,
    loreUnlocked: [...lore],
    hp: Math.max(0, state.hp + (effects.hp ?? 0)),
  };
}
