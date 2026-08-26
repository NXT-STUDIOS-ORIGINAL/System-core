import { ItemDefinition, ItemDefinitionHistory } from '../types';

/**
 * Generates a consistent, unique itemId slug from an item name
 */
export function generateItemId(name: string): string {
  if (!name) return `item_${Date.now()}`;
  const slug = name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug || `item_${Date.now()}`;
}

/**
 * Creates a clean, uninvented ItemDefinition from explicit data only.
 * Leaves all unprovided fields undefined without fabricating content.
 */
export function createExplicitItemDefinition(
  input: {
    itemName: string;
    itemId?: string;
    description?: string;
    rank?: string;
    type?: string;
    rarity?: string;
    maximumStack?: number;
    sellValue?: number | string;
    buyValue?: number | string;
    usage?: string;
    effects?: string;
    requirements?: string;
    keyType?: string;
    boxType?: string;
    craftingInformation?: string;
    specialProperties?: string;
    notes?: string;
    icon?: string;
    image?: string;
    enabled?: boolean;
    [key: string]: any;
  }
): ItemDefinition {
  const now = new Date().toISOString();
  const trimmedName = (input.itemName || 'Unknown Item').trim();
  const id = input.itemId?.trim() || generateItemId(trimmedName);

  const cleanDef: ItemDefinition = {
    itemId: id,
    itemName: trimmedName,
    enabled: input.enabled !== undefined ? Boolean(input.enabled) : true,
    definitionVersion: 1,
    createdAt: now,
    lastUpdated: now,
  };

  // Only assign fields that are explicitly provided and non-empty
  if (input.description?.trim()) cleanDef.description = input.description.trim();
  if (input.rank?.trim()) cleanDef.rank = input.rank.trim();
  if (input.type?.trim()) cleanDef.type = input.type.trim();
  if (input.rarity?.trim()) cleanDef.rarity = input.rarity.trim();
  if (typeof input.maximumStack === 'number' && !isNaN(input.maximumStack)) cleanDef.maximumStack = input.maximumStack;
  if (input.sellValue !== undefined && input.sellValue !== '') cleanDef.sellValue = input.sellValue;
  if (input.buyValue !== undefined && input.buyValue !== '') cleanDef.buyValue = input.buyValue;
  if (input.usage?.trim()) cleanDef.usage = input.usage.trim();
  if (input.effects?.trim()) cleanDef.effects = input.effects.trim();
  if (input.requirements?.trim()) cleanDef.requirements = input.requirements.trim();
  if (input.keyType?.trim()) cleanDef.keyType = input.keyType.trim();
  if (input.boxType?.trim()) cleanDef.boxType = input.boxType.trim();
  if (input.craftingInformation?.trim()) cleanDef.craftingInformation = input.craftingInformation.trim();
  if (input.specialProperties?.trim()) cleanDef.specialProperties = input.specialProperties.trim();
  if (input.notes?.trim()) cleanDef.notes = input.notes.trim();
  if (input.icon?.trim()) cleanDef.icon = input.icon.trim();
  if (input.image?.trim()) cleanDef.image = input.image.trim();

  return cleanDef;
}

/**
 * Updates an existing ItemDefinition while tracking history and incrementing definitionVersion.
 * NEVER modifies player inventory or stats.
 */
export function updateItemDefinition(
  existing: ItemDefinition,
  updates: Partial<ItemDefinition>,
  changeNote?: string
): ItemDefinition {
  const now = new Date().toISOString();
  const nextVersion = (existing.definitionVersion || 1) + 1;

  const historyEntry: ItemDefinitionHistory = {
    version: existing.definitionVersion || 1,
    updatedAt: now,
    changes: changeNote || 'Manual user edit',
    previousState: { ...existing },
  };

  const nextHistory = [...(existing.history || []), historyEntry];

  const updated: ItemDefinition = {
    ...existing,
    ...updates,
    itemId: existing.itemId, // Keep ID stable
    definitionVersion: nextVersion,
    lastUpdated: now,
    history: nextHistory,
  };

  return updated;
}

/**
 * Finds matching ItemDefinition for an item name or item object
 */
export function findItemDefinition(
  definitions: ItemDefinition[] | undefined,
  itemOrName: string | { name?: string; id?: string }
): ItemDefinition | undefined {
  if (!definitions || !Array.isArray(definitions) || definitions.length === 0) {
    return undefined;
  }

  if (typeof itemOrName === 'string') {
    const query = itemOrName.trim().toLowerCase();
    const querySlug = generateItemId(itemOrName);
    return definitions.find(
      (d) => d.itemId.toLowerCase() === querySlug || d.itemName.toLowerCase() === query
    );
  }

  if (itemOrName && typeof itemOrName === 'object') {
    if (itemOrName.id) {
      const byId = definitions.find((d) => d.itemId.toLowerCase() === itemOrName.id?.toLowerCase());
      if (byId) return byId;
    }
    if (itemOrName.name) {
      const query = itemOrName.name.trim().toLowerCase();
      const querySlug = generateItemId(itemOrName.name);
      return definitions.find(
        (d) => d.itemId.toLowerCase() === querySlug || d.itemName.toLowerCase() === query
      );
    }
  }

  return undefined;
}
