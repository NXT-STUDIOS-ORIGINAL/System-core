import {
  ProcessedSystemInputResult,
  StateChangeSummary,
  MemoryEntry,
  QuestItem,
  SkillItem,
  AchievementItem,
  InventoryItem,
} from '../types';
import { normalizeItemName } from './inventoryManager';

/**
 * Fast string hash for detecting duplicate raw messages
 */
export function calculateMessageHash(text: string): string {
  let hash = 0;
  const str = text.trim();
  if (str.length === 0) return 'empty';
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0; // Convert to 32bit integer
  }
  return `h_${Math.abs(hash).toString(16)}`;
}

/**
 * Extract block content between [TAG] and [END TAG] or [END UPDATE]
 */
function extractBlock(text: string, tag: string, endTags: string[] = ['[END UPDATE]', '[END]', `[/${tag}]`]): string | null {
  const openTagPattern = new RegExp(`\\[${tag}\\]`, 'i');
  const match = text.match(openTagPattern);
  if (!match || match.index === undefined) return null;

  const startIndex = match.index + match[0].length;
  const remaining = text.slice(startIndex);

  let closestEndIndex = -1;
  for (const endTag of endTags) {
    const endTagPattern = new RegExp(endTag.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    const endMatch = remaining.match(endTagPattern);
    if (endMatch && endMatch.index !== undefined) {
      if (closestEndIndex === -1 || endMatch.index < closestEndIndex) {
        closestEndIndex = endMatch.index;
      }
    }
  }

  if (closestEndIndex !== -1) {
    return remaining.slice(0, closestEndIndex).trim();
  }

  // If no explicit end tag, take up to the next bracket block or end of text
  const nextBracketMatch = remaining.match(/\n\s*\[[A-Z0-9 _-]+\]/i);
  if (nextBracketMatch && nextBracketMatch.index !== undefined) {
    return remaining.slice(0, nextBracketMatch.index).trim();
  }

  return remaining.trim();
}

/**
 * Parses numeric delta or explicit value
 * Handles "+120", "-50", "120", "= 120"
 */
function parseNumericValue(valStr: string): { isDelta: boolean; value: number } | null {
  const cleaned = valStr.replace(/^[=:\s]+/, '').trim();
  
  // Check for explicit sign (+ or -)
  if (/^[+-]\s*\d+(\.\d+)?$/.test(cleaned)) {
    const num = parseFloat(cleaned.replace(/\s+/g, ''));
    if (!isNaN(num)) {
      return { isDelta: true, value: num };
    }
  }

  // Pure number without sign -> absolute set
  if (/^\d+(\.\d+)?$/.test(cleaned)) {
    const num = parseFloat(cleaned);
    if (!isNaN(num)) {
      return { isDelta: false, value: num };
    }
  }

  return null;
}

/**
 * Extracts item name, quantity, and any associated coins from an item statement
 */
function parseItemStatement(statement: string): { name: string; quantity: number; coins?: number } {
  let clean = statement.trim();
  let coins: number | undefined = undefined;

  // Extract coin rewards e.g. "for 50 coins", "(+50 Coins)", "50 gold", "for 100 gold"
  const coinMatch = clean.match(/(?:for|\+)?\s*(\d+)\s*(?:coins?|gold|silver|credits?)/i) ||
    clean.match(/\(\s*\+?\s*(\d+)\s*(?:coins?|gold|silver|credits?)\s*\)/i);
  if (coinMatch) {
    const parsedCoins = parseInt(coinMatch[1], 10);
    if (!isNaN(parsedCoins)) {
      coins = parsedCoins;
    }
    // Strip coin clause
    clean = clean.replace(/(?:for|\+)?\s*\d+\s*(?:coins?|gold|silver|credits?)/gi, '').replace(/\(\s*\+?\s*\d+\s*(?:coins?|gold|silver|credits?)\s*\)/gi, '').trim();
  }

  // Extract quantity e.g. "Iron Dagger x2", "×2 Iron Dagger", "2 Iron Dagger"
  let quantity = 1;
  const trailingQtyMatch = clean.match(/[×x*]\s*(\d+)/i) || clean.match(/\((\d+)\)/);
  const leadingQtyMatch = clean.match(/^(\d+)\s+([A-Za-z0-9\s_-]+)$/);

  if (trailingQtyMatch) {
    const q = parseInt(trailingQtyMatch[1], 10);
    if (!isNaN(q) && q > 0) quantity = q;
    clean = clean.replace(/[×x*]\s*\d+/gi, '').replace(/\(\d+\)/g, '').trim();
  } else if (leadingQtyMatch) {
    const q = parseInt(leadingQtyMatch[1], 10);
    if (!isNaN(q) && q > 0) {
      quantity = q;
      clean = leadingQtyMatch[2].trim();
    }
  }

  return {
    name: normalizeItemName(clean),
    quantity,
    coins,
  };
}

/**
 * Modular parser for System messages.
 * Extracts structured state changes and memory entries.
 */
export function parseSystemMessage(rawMessage: string, eventId: string = ''): ProcessedSystemInputResult {
  const timestamp = new Date().toISOString();
  const summary: StateChangeSummary = {
    progressionUpdates: {},
    attributesUpdated: {},
    skillsAdded: [],
    questsUpdated: [],
    achievementsAdded: [],
    titlesAdded: [],
    inventoryUpdated: [],
    inventoryRemoved: [],
    worldStateUpdated: {},
    systemVariablesUpdated: {},
    importantMemoriesAdded: [],
    rawParsedLines: [],
    hasChanges: false,
  };

  const lines = rawMessage.split('\n').map((l) => l.trim()).filter(Boolean);

  // 1. Check for explicit [STATE UPDATE] block
  const stateUpdateBlock = extractBlock(rawMessage, 'STATE UPDATE') || extractBlock(rawMessage, 'STATUS UPDATE');
  const targetLines = (stateUpdateBlock ? stateUpdateBlock.split('\n') : lines)
    .flatMap((l) => l.split(/(?<=[.!?])\s+/))
    .map((l) => l.trim())
    .filter(Boolean);

  // 2. Check for explicit [MEMORY] or [IMPORTANT MEMORY] blocks
  const memoryBlock = extractBlock(rawMessage, 'MEMORY');
  const importantMemoryBlock = extractBlock(rawMessage, 'IMPORTANT MEMORY') || extractBlock(rawMessage, 'IMPORTANT');

  let explicitMemoryText = memoryBlock || '';
  if (importantMemoryBlock) {
    const importantEntry: MemoryEntry = {
      id: `mem_imp_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 6)}`,
      timestamp,
      summary: importantMemoryBlock.trim(),
      sourceEventId: eventId,
      importance: 'high',
      category: 'milestone',
    };
    summary.importantMemoriesAdded = [importantEntry];
    summary.hasChanges = true;
  }

  // 3. Process lines
  for (const rawLine of targetLines) {
    const line = rawLine.replace(/[.!?]+$/, '').trim();
    if (!line) continue;
    // Skip plain tag lines like [STATUS UPDATE]
    if (line.startsWith('[') && line.endsWith(']')) continue;

    let matched = false;

    // --- A. XP & Progression Parsing ---
    // Matches: "XP: 350 / 500", "XP: 350/500", "XP: +120", "XP +120", "XP: 500", "XP = 620", "+120 XP", "EXP: +50", "Experience: 400 / 1000"
    const xpRatioMatch = line.match(/^(?:EXP|XP|EXPERIENCE)\s*[:=]?\s*(\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)/i);
    const xpDeltaPrefixMatch = line.match(/^(?:(?:EXP|XP|EXPERIENCE)\s*[:=]?\s*([+-]\s*\d+(?:\.\d+)?))/i) ||
      line.match(/^(?:([+-]\s*\d+(?:\.\d+)?)\s*(?:EXP|XP|EXPERIENCE))/i);
    const xpSetMatch = line.match(/^(?:EXP|XP|EXPERIENCE)\s*[:=]\s*(\d+(?:\.\d+)?)/i);
    const requiredXpMatch = line.match(/^(?:REQUIRED\s+XP|MAX\s+XP|NEXT\s+LEVEL\s+XP|TARGET\s+XP)\s*[:=]\s*(\d+(?:\.\d+)?)/i);
    const overflowXpMatch = line.match(/^(?:OVERFLOW\s+XP|XP\s+OVERFLOW)\s*[:=]?\s*([+-]?\s*\d+(?:\.\d+)?)/i);
    const rankMatch = line.match(/^(?:RANK|PLAYER\s+RANK)\s*[:=]\s*(.+)$/i);
    const statPointsMatch = line.match(/^(?:STAT\s+POINTS?|ATTRIBUTE\s+POINTS?|FREE\s+POINTS?)\s*[:=]?\s*([+-]?\s*\d+)/i);
    const skillPointsMatch = line.match(/^(?:SKILL\s+POINTS?)\s*[:=]?\s*([+-]?\s*\d+)/i);

    if (xpRatioMatch) {
      const currentVal = parseFloat(xpRatioMatch[1]);
      const maxVal = parseFloat(xpRatioMatch[2]);
      if (!isNaN(currentVal) && !isNaN(maxVal)) {
        summary.progressionUpdates = summary.progressionUpdates || {};
        summary.progressionUpdates.xp = currentVal;
        summary.progressionUpdates.requiredXp = maxVal;
        summary.progressionUpdates.maxXp = maxVal;
        summary.rawParsedLines?.push(line);
        summary.hasChanges = true;
        matched = true;
      }
    } else if (xpDeltaPrefixMatch) {
      const parsed = parseNumericValue(xpDeltaPrefixMatch[1]);
      if (parsed) {
        summary.progressionUpdates = summary.progressionUpdates || {};
        summary.progressionUpdates.xpDelta = (summary.progressionUpdates.xpDelta || 0) + parsed.value;
        summary.rawParsedLines?.push(line);
        summary.hasChanges = true;
        matched = true;
      }
    } else if (xpSetMatch) {
      const parsed = parseNumericValue(xpSetMatch[1]);
      if (parsed) {
        summary.progressionUpdates = summary.progressionUpdates || {};
        summary.progressionUpdates.xp = parsed.value;
        summary.rawParsedLines?.push(line);
        summary.hasChanges = true;
        matched = true;
      }
    }

    if (requiredXpMatch) {
      const parsed = parseFloat(requiredXpMatch[1]);
      if (!isNaN(parsed)) {
        summary.progressionUpdates = summary.progressionUpdates || {};
        summary.progressionUpdates.requiredXp = parsed;
        summary.progressionUpdates.maxXp = parsed;
        summary.rawParsedLines?.push(line);
        summary.hasChanges = true;
        matched = true;
      }
    }

    if (overflowXpMatch) {
      const parsed = parseNumericValue(overflowXpMatch[1]);
      if (parsed) {
        summary.progressionUpdates = summary.progressionUpdates || {};
        summary.progressionUpdates.overflowXp = parsed.value;
        summary.rawParsedLines?.push(line);
        summary.hasChanges = true;
        matched = true;
      }
    }

    if (rankMatch) {
      const r = rankMatch[1].trim();
      if (r) {
        summary.progressionUpdates = summary.progressionUpdates || {};
        summary.progressionUpdates.rank = r;
        summary.rawParsedLines?.push(line);
        summary.hasChanges = true;
        matched = true;
      }
    }

    if (statPointsMatch) {
      const parsed = parseNumericValue(statPointsMatch[1]);
      if (parsed) {
        summary.progressionUpdates = summary.progressionUpdates || {};
        summary.progressionUpdates.statPoints = parsed.value;
        summary.rawParsedLines?.push(line);
        summary.hasChanges = true;
        matched = true;
      }
    }

    if (skillPointsMatch) {
      const parsed = parseNumericValue(skillPointsMatch[1]);
      if (parsed) {
        summary.progressionUpdates = summary.progressionUpdates || {};
        summary.progressionUpdates.skillPoints = parsed.value;
        summary.rawParsedLines?.push(line);
        summary.hasChanges = true;
        matched = true;
      }
    }

    // --- B. Level Parsing ---
    // Matches: "Level: 2", "Level: +1", "Level +1", "Level = 3", "Lvl: 5", "Level Up!"
    if (!matched) {
      const levelUpMatch = line.match(/^LEVEL\s+UP!?/i);
      const levelMatch = line.match(/^(?:LEVEL|LVL)\s*[:=]?\s*([+-]?\s*\d+)/i);
      
      if (levelUpMatch) {
        summary.progressionUpdates = summary.progressionUpdates || {};
        summary.progressionUpdates.levelDelta = (summary.progressionUpdates.levelDelta || 0) + 1;
        summary.rawParsedLines?.push(line);
        summary.hasChanges = true;
        matched = true;
      } else if (levelMatch) {
        const parsed = parseNumericValue(levelMatch[1]);
        if (parsed) {
          summary.progressionUpdates = summary.progressionUpdates || {};
          if (parsed.isDelta) {
            summary.progressionUpdates.levelDelta = (summary.progressionUpdates.levelDelta || 0) + parsed.value;
          } else {
            summary.progressionUpdates.level = parsed.value;
          }
          summary.rawParsedLines?.push(line);
          summary.hasChanges = true;
          matched = true;
        }
      }
    }

    // --- C. Skills ---
    // Matches: "Skill Unlocked: Sprint", "New Skill: Sprint", "Skill: Sprint (Lv. 1)", "Skill Learned: ..."
    if (!matched) {
      const skillMatch = line.match(/^(?:SKILL\s+UNLOCKED|NEW\s+SKILL|SKILL\s+LEARNED|SKILL\s+ACQUIRED|SKILL)\s*[:=]\s*(.+)$/i);
      if (skillMatch) {
        const rawSkill = skillMatch[1].trim();
        if (rawSkill) {
          const lvMatch = rawSkill.match(/^(.+?)\s*\((?:Lv\.?|Level)?\s*(\d+)\)$/i);
          if (lvMatch) {
            summary.skillsAdded = summary.skillsAdded || [];
            summary.skillsAdded.push({
              name: lvMatch[1].trim(),
              level: parseInt(lvMatch[2], 10),
            });
          } else {
            summary.skillsAdded = summary.skillsAdded || [];
            summary.skillsAdded.push(rawSkill);
          }
          summary.rawParsedLines?.push(line);
          summary.hasChanges = true;
          matched = true;
        }
      }
    }

    // --- D. Quests ---
    // Matches: "Quest Completed: Morning Training", "Quest Failed: ...", "New Quest: Defeat Boss [Active]", "Quest: ..."
    if (!matched) {
      const questCompletedMatch = line.match(/^(?:QUEST\s+COMPLETED|QUEST\s+FINISHED|QUEST\s+CLEARED|COMPLETED\s+QUEST)\s*[:=]\s*(.+)$/i);
      const questFailedMatch = line.match(/^(?:QUEST\s+FAILED|FAILED\s+QUEST)\s*[:=]\s*(.+)$/i);
      const questNewMatch = line.match(/^(?:NEW\s+QUEST|QUEST\s+ACCEPTED|QUEST)\s*[:=]\s*(.+)$/i);

      if (questCompletedMatch) {
        const title = questCompletedMatch[1].trim();
        summary.questsUpdated = summary.questsUpdated || [];
        summary.questsUpdated.push({
          title,
          status: 'COMPLETED',
          completedAt: timestamp,
        });
        summary.rawParsedLines?.push(line);
        summary.hasChanges = true;
        matched = true;
      } else if (questFailedMatch) {
        const title = questFailedMatch[1].trim();
        summary.questsUpdated = summary.questsUpdated || [];
        summary.questsUpdated.push({
          title,
          status: 'FAILED',
        });
        summary.rawParsedLines?.push(line);
        summary.hasChanges = true;
        matched = true;
      } else if (questNewMatch) {
        const rawTitle = questNewMatch[1].trim();
        let status: 'ACTIVE' | 'COMPLETED' = 'ACTIVE';
        let cleanTitle = rawTitle;
        if (/\[completed\]/i.test(rawTitle)) {
          status = 'COMPLETED';
          cleanTitle = rawTitle.replace(/\[completed\]/i, '').trim();
        }
        summary.questsUpdated = summary.questsUpdated || [];
        summary.questsUpdated.push({
          title: cleanTitle,
          status,
        });
        summary.rawParsedLines?.push(line);
        summary.hasChanges = true;
        matched = true;
      }
    }

    // --- E. Titles ---
    if (!matched) {
      const titleMatch = line.match(/^(?:TITLE\s+UNLOCKED|NEW\s+TITLE|TITLE\s+EARNED|TITLE)\s*[:=]\s*(.+)$/i);
      if (titleMatch) {
        const titleName = titleMatch[1].trim();
        if (titleName) {
          summary.titlesAdded = summary.titlesAdded || [];
          summary.titlesAdded.push(titleName);
          summary.rawParsedLines?.push(line);
          summary.hasChanges = true;
          matched = true;
        }
      }
    }

    // --- F. Achievements ---
    if (!matched) {
      const achMatch = line.match(/^(?:ACHIEVEMENT\s+UNLOCKED|NEW\s+ACHIEVEMENT|ACHIEVEMENT)\s*[:=]\s*(.+)$/i);
      if (achMatch) {
        const achTitle = achMatch[1].trim();
        if (achTitle) {
          summary.achievementsAdded = summary.achievementsAdded || [];
          summary.achievementsAdded.push({
            title: achTitle,
            unlockedAt: timestamp,
          });
          summary.rawParsedLines?.push(line);
          summary.hasChanges = true;
          matched = true;
        }
      }
    }

    // --- G. Structured Inventory & Items (Removals, Sales, Breaks, Consumptions, Additions) ---
    if (!matched) {
      const itemSoldMatch = line.match(/^(?:ITEM\s+SOLD|SOLD\s+ITEM|SOLD|SELL\s+ITEM|SELL)\s*[:=]\s*(.+)$/i);
      const itemBrokenMatch = line.match(/^(?:ITEM\s+BROKEN|BROKEN\s+ITEM|ITEM\s+DESTROYED|BREAK\s+ITEM|BREAK)\s*[:=]\s*(.+)$/i);
      const itemDismantledMatch = line.match(/^(?:ITEM\s+DISMANTLED|DISMANTLED\s+ITEM|DISMANTLE\s+ITEM|DISMANTLE)\s*[:=]\s*(.+)$/i);
      const itemConsumedMatch = line.match(/^(?:ITEM\s+CONSUMED|CONSUME\s+ITEM|ITEM\s+USED|USE\s+ITEM|ITEM\s+REMOVED|REMOVE\s+ITEM|ITEM\s+DROPPED|DROP\s+ITEM|DISCARD\s+ITEM|OPEN\s+LOOT\s*BOX|OPEN\s+BOX)\s*[:=]\s*(.+)$/i);
      const itemAcquiredMatch = line.match(/^(?:NEW\s+ITEM|ITEM\s+ACQUIRED|ITEM\s+OBTAINED|ITEM|INVENTORY)\s*[:=]\s*(.+)$/i);

      if (itemSoldMatch) {
        const parsed = parseItemStatement(itemSoldMatch[1]);
        if (parsed.name) {
          summary.inventoryRemoved = summary.inventoryRemoved || [];
          summary.inventoryRemoved.push({
            name: parsed.name,
            quantity: parsed.quantity,
          });
          if (parsed.coins && parsed.coins > 0) {
            summary.systemVariablesUpdated = summary.systemVariablesUpdated || {};
            const currentCoins = typeof summary.systemVariablesUpdated.coins === 'number' ? summary.systemVariablesUpdated.coins : 0;
            summary.systemVariablesUpdated.coins = currentCoins + parsed.coins;
          }
          summary.rawParsedLines?.push(line);
          summary.hasChanges = true;
          matched = true;
        }
      } else if (itemBrokenMatch) {
        const parsed = parseItemStatement(itemBrokenMatch[1]);
        if (parsed.name) {
          summary.inventoryRemoved = summary.inventoryRemoved || [];
          summary.inventoryRemoved.push({
            name: parsed.name,
            quantity: parsed.quantity,
          });
          summary.rawParsedLines?.push(line);
          summary.hasChanges = true;
          matched = true;
        }
      } else if (itemDismantledMatch) {
        const parsed = parseItemStatement(itemDismantledMatch[1]);
        if (parsed.name) {
          summary.inventoryRemoved = summary.inventoryRemoved || [];
          summary.inventoryRemoved.push({
            name: parsed.name,
            quantity: parsed.quantity,
          });
          summary.rawParsedLines?.push(line);
          summary.hasChanges = true;
          matched = true;
        }
      } else if (itemConsumedMatch) {
        const parsed = parseItemStatement(itemConsumedMatch[1]);
        if (parsed.name) {
          summary.inventoryRemoved = summary.inventoryRemoved || [];
          summary.inventoryRemoved.push({
            name: parsed.name,
            quantity: parsed.quantity,
          });
          summary.rawParsedLines?.push(line);
          summary.hasChanges = true;
          matched = true;
        }
      } else if (itemAcquiredMatch) {
        const parsed = parseItemStatement(itemAcquiredMatch[1]);
        if (parsed.name) {
          summary.inventoryUpdated = summary.inventoryUpdated || [];
          summary.inventoryUpdated.push({
            name: parsed.name,
            quantity: parsed.quantity,
          });
          summary.rawParsedLines?.push(line);
          summary.hasChanges = true;
          matched = true;
        }
      }
    }

    // --- H. Attributes (Dynamic key/values) ---
    // Matches: "Strength: +1", "Strength +1", "Agility: +2", "Vitality: 15", "Intelligence = 20", "Stat: Strength +1"
    if (!matched) {
      const attrMatch = line.match(/^(?:STAT:\s*)?([A-Za-z\s_]+)\s*[:=]\s*([+-]?\s*\d+(?:\.\d+)?)$/) ||
        line.match(/^([A-Za-z\s_]+)\s+([+-]\s*\d+(?:\.\d+)?)$/);
      
      if (attrMatch) {
        const statKey = attrMatch[1].trim();
        const statValStr = attrMatch[2].trim();
        const parsed = parseNumericValue(statValStr);
        
        const lowerKey = statKey.toLowerCase();
        if (!['lines', 'chars', 'words', 'level', 'lvl', 'xp', 'exp', 'session', 'id', 'source', 'state version', 'context version'].includes(lowerKey)) {
          if (parsed) {
            summary.attributesUpdated = summary.attributesUpdated || {};
            summary.attributesUpdated[statKey] = parsed;
            summary.rawParsedLines?.push(line);
            summary.hasChanges = true;
            matched = true;
          }
        }
      }
    }

    // --- J. Natural Language Sentence Matching ---
    if (!matched) {
      // 1. Natural XP sentences: "Training completed. You gained +500 XP.", "XP is now 0 / 2400"
      const nlXpSetRatioMatch = line.match(/(?:EXP|XP|EXPERIENCE)\s+(?:is\s+now|now|set\s+to|=)\s*(\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)/i);
      const nlXpGainMatch = line.match(/(?:gained|earned|received|\+)\s*([+-]?\s*\d+(?:\.\d+)?)\s*(?:EXP|XP|EXPERIENCE)/i) ||
        line.match(/(?:EXP|XP|EXPERIENCE)\s*(?:gained|increased\s+by|\+)\s*([+-]?\s*\d+(?:\.\d+)?)/i) ||
        line.match(/([+-]\s*\d+(?:\.\d+)?)\s*(?:EXP|XP|EXPERIENCE)/i);
      const nlXpSetMatch = line.match(/(?:EXP|XP|EXPERIENCE)\s+(?:is\s+now|now|set\s+to|=)\s*(\d+(?:\.\d+)?)/i);

      if (nlXpSetRatioMatch) {
        const curr = parseFloat(nlXpSetRatioMatch[1]);
        const req = parseFloat(nlXpSetRatioMatch[2]);
        summary.progressionUpdates = summary.progressionUpdates || {};
        summary.progressionUpdates.xp = curr;
        summary.progressionUpdates.requiredXp = req;
        summary.progressionUpdates.maxXp = req;
        summary.rawParsedLines?.push(line);
        summary.hasChanges = true;
        matched = true;
      } else if (nlXpGainMatch) {
        const parsedVal = parseFloat(nlXpGainMatch[1].replace(/\s+/g, ''));
        if (!isNaN(parsedVal)) {
          summary.progressionUpdates = summary.progressionUpdates || {};
          summary.progressionUpdates.xpDelta = (summary.progressionUpdates.xpDelta || 0) + parsedVal;
          summary.rawParsedLines?.push(line);
          summary.hasChanges = true;
          matched = true;
        }
      } else if (nlXpSetMatch) {
        const parsed = parseNumericValue(nlXpSetMatch[1]);
        if (parsed) {
          summary.progressionUpdates = summary.progressionUpdates || {};
          summary.progressionUpdates.xp = parsed.value;
          summary.rawParsedLines?.push(line);
          summary.hasChanges = true;
          matched = true;
        }
      }

      // 2. Natural Level sentences: "reached Level 2", "leveled up to Level 3"
      const nlLevelMatch = line.match(/(?:reached|achieved|advanced\s+to|leveled\s+up\s+to|level\s+is\s+now)\s+(?:Level|Lvl)?\s*(\d+)/i);
      if (nlLevelMatch) {
        const lvl = parseInt(nlLevelMatch[1], 10);
        if (!isNaN(lvl)) {
          summary.progressionUpdates = summary.progressionUpdates || {};
          summary.progressionUpdates.level = lvl;
          summary.rawParsedLines?.push(line);
          summary.hasChanges = true;
          matched = true;
        }
      }

      // 3. Natural Attribute sentences: "Your Strength increased by 2.", "Agility decreased by 1"
      const nlAttrMatch = line.match(/(?:Your\s+)?([A-Za-z]+)\s+(increased\s+by|decreased\s+by|grew\s+by|\+|-)\s*(\d+(?:\.\d+)?)/i);
      if (nlAttrMatch) {
        const attrName = nlAttrMatch[1].trim();
        const action = nlAttrMatch[2].toLowerCase();
        const numVal = parseFloat(nlAttrMatch[3]);
        const delta = action.includes('decreas') || action.includes('-') ? -numVal : numVal;
        
        const lower = attrName.toLowerCase();
        if (!['level', 'xp', 'exp', 'rank', 'points'].includes(lower)) {
          const formattedAttr = attrName.charAt(0).toUpperCase() + attrName.slice(1);
          summary.attributesUpdated = summary.attributesUpdated || {};
          summary.attributesUpdated[formattedAttr] = { isDelta: true, value: delta };
          summary.rawParsedLines?.push(line);
          summary.hasChanges = true;
          matched = true;
        }
      }

      // 4. Natural Skill sentences: "You unlocked the Sprint skill."
      const nlSkillMatch = line.match(/(?:unlocked|learned|acquired)\s+(?:the\s+)?([A-Za-z0-9\s_-]+?)\s+(?:skill|ability)/i) ||
        line.match(/skill\s+([A-Za-z0-9\s_-]+?)\s+(?:unlocked|acquired|learned)/i);
      if (nlSkillMatch) {
        const sName = nlSkillMatch[1].trim();
        if (sName && sName.length > 1) {
          summary.skillsAdded = summary.skillsAdded || [];
          summary.skillsAdded.push(sName);
          summary.rawParsedLines?.push(line);
          summary.hasChanges = true;
          matched = true;
        }
      }

      // 5. Natural Quest sentences: "Morning Training quest completed."
      const nlQuestMatch = line.match(/(?:Quest\s+)['"“]?([A-Za-z0-9\s_-]+?)['"”]?\s+(?:completed|finished|cleared)/i) ||
        line.match(/['"“]([A-Za-z0-9\s_-]+?)['"”]\s+(?:quest\s+)?(?:completed|finished|cleared)/i) ||
        line.match(/([A-Za-z0-9\s_-]+?)\s+quest\s+(?:completed|finished|cleared)/i) ||
        line.match(/(?:completed|finished|cleared)\s+(?:the\s+)?quest\s+['"“]?([A-Za-z0-9\s_-]+?)['"”]?/i);
      if (nlQuestMatch) {
        const qTitle = nlQuestMatch[1].trim();
        if (qTitle && !['all', 'the', 'new', 'daily'].includes(qTitle.toLowerCase())) {
          summary.questsUpdated = summary.questsUpdated || [];
          summary.questsUpdated.push({
            title: qTitle,
            status: 'COMPLETED',
            completedAt: timestamp,
          });
          summary.rawParsedLines?.push(line);
          summary.hasChanges = true;
          matched = true;
        }
      }

      // 6. Natural Language Item SELL: "Sell Iron Dagger for 50 coins", "Sold Iron Dagger", "Sold 2 Iron Dagger for 100 gold"
      const nlSellMatch = line.match(/(?:Sell|Sold)\s+(?:item\s+)?['"“]?([A-Za-z0-9\s_-]+?)['"”]?(?:\s+for\s+(\d+)\s*(?:coins?|gold|silver|credits?))?$/i);
      if (nlSellMatch && !matched) {
        const parsed = parseItemStatement(nlSellMatch[1]);
        if (parsed.name && !['xp', 'exp', 'skill', 'level', 'quest'].includes(parsed.name.toLowerCase())) {
          summary.inventoryRemoved = summary.inventoryRemoved || [];
          summary.inventoryRemoved.push({
            name: parsed.name,
            quantity: parsed.quantity,
          });
          const coinAmount = nlSellMatch[2] ? parseInt(nlSellMatch[2], 10) : parsed.coins;
          if (coinAmount && coinAmount > 0) {
            summary.systemVariablesUpdated = summary.systemVariablesUpdated || {};
            const curCoins = typeof summary.systemVariablesUpdated.coins === 'number' ? summary.systemVariablesUpdated.coins : 0;
            summary.systemVariablesUpdated.coins = curCoins + coinAmount;
          }
          summary.rawParsedLines?.push(line);
          summary.hasChanges = true;
          matched = true;
        }
      }

      // 7. Natural Language Item BREAK: "Iron Dagger broke.", "Iron Dagger broke in battle", "Iron Dagger shattered"
      const nlBreakMatch = line.match(/['"“]?([A-Za-z0-9\s_-]+?)['"”]?\s+(?:broke|broken|shattered|destroyed)(?:\s+in\s+battle)?/i) ||
        line.match(/(?:broke|destroyed)\s+['"“]?([A-Za-z0-9\s_-]+?)['"”]?/i);
      if (nlBreakMatch && !matched) {
        const rawName = nlBreakMatch[1].trim();
        const parsed = parseItemStatement(rawName);
        if (parsed.name && !['shield', 'armor', 'barrier', 'seal', 'xp', 'level'].includes(parsed.name.toLowerCase())) {
          summary.inventoryRemoved = summary.inventoryRemoved || [];
          summary.inventoryRemoved.push({
            name: parsed.name,
            quantity: parsed.quantity,
          });
          summary.rawParsedLines?.push(line);
          summary.hasChanges = true;
          matched = true;
        }
      }

      // 8. Natural Language Item CONSUME / USE: "Used Healing Potion", "Consumed 1 Healing Potion", "Drank Elixir"
      const nlConsumeMatch = line.match(/(?:You\s+)?(?:used|consumed|drank|ate)\s+(?:item\s+)?['"“]?([A-Za-z0-9\s_-]+?)['"”]?(?:\s*[×x*]\s*(\d+))?$/i);
      if (nlConsumeMatch && !matched) {
        const rawName = nlConsumeMatch[1].trim();
        const parsed = parseItemStatement(rawName);
        const qty = nlConsumeMatch[2] ? parseInt(nlConsumeMatch[2], 10) : parsed.quantity;
        if (parsed.name && !['skill', 'ability', 'mana', 'stamina', 'energy'].includes(parsed.name.toLowerCase())) {
          summary.inventoryRemoved = summary.inventoryRemoved || [];
          summary.inventoryRemoved.push({
            name: parsed.name,
            quantity: qty,
          });
          summary.rawParsedLines?.push(line);
          summary.hasChanges = true;
          matched = true;
        }
      }

      // 9. Natural Language Item DISMANTLE / DROP / REMOVE: "Dismantled Iron Dagger", "Dropped Iron Dagger", "Discarded Iron Dagger"
      const nlDropMatch = line.match(/(?:You\s+)?(?:dismantled|dropped|discarded|removed|lost|traded|gave\s+away)\s+(?:item\s+)?['"“]?([A-Za-z0-9\s_-]+?)['"”]?(?:\s*[×x*]\s*(\d+))?$/i);
      if (nlDropMatch && !matched) {
        const rawName = nlDropMatch[1].trim();
        const parsed = parseItemStatement(rawName);
        const qty = nlDropMatch[2] ? parseInt(nlDropMatch[2], 10) : parsed.quantity;
        if (parsed.name && !['xp', 'exp', 'skill', 'level', 'quest'].includes(parsed.name.toLowerCase())) {
          summary.inventoryRemoved = summary.inventoryRemoved || [];
          summary.inventoryRemoved.push({
            name: parsed.name,
            quantity: qty,
          });
          summary.rawParsedLines?.push(line);
          summary.hasChanges = true;
          matched = true;
        }
      }

      // 10. Natural Item ACQUISITIONS: "You obtained E-Rank Loot Box ×1.", "Acquired Healing Potion x2", "Found Steel Key"
      const nlItemMatch = line.match(/(?:You\s+)?(?:obtained|acquired|found|received)\s+(?:item\s+)?['"“]?([A-Za-z0-9\s_-]+?)['"”]?(?:\s*[×x*]\s*(\d+))?$/i);
      if (nlItemMatch && !matched) {
        const rawName = nlItemMatch[1].trim();
        const parsed = parseItemStatement(rawName);
        const qty = nlItemMatch[2] ? parseInt(nlItemMatch[2], 10) : parsed.quantity;
        if (parsed.name && !['xp', 'exp', 'skill', 'level', 'quest', 'title'].includes(parsed.name.toLowerCase())) {
          summary.inventoryUpdated = summary.inventoryUpdated || [];
          summary.inventoryUpdated.push({
            name: parsed.name,
            quantity: isNaN(qty) || qty < 1 ? 1 : qty,
          });
          summary.rawParsedLines?.push(line);
          summary.hasChanges = true;
          matched = true;
        }
      }
    }

    // --- K. System Variables & World State ---
    if (!matched) {
      const sysVarMatch = line.match(/^(?:SYSTEM\s+VARIABLE|VARIABLE)\s*[:=]\s*([A-Za-z0-9_-]+)\s*[:=]\s*(.+)$/i);
      const worldStateMatch = line.match(/^(?:WORLD\s+STATE|WORLD)\s*[:=]\s*([A-Za-z0-9_-]+)\s*[:=]\s*(.+)$/i) ||
        line.match(/^(?:WORLD\s+STATE|WORLD)\s*[:=]\s*(.+)$/i);

      if (sysVarMatch) {
        summary.systemVariablesUpdated = summary.systemVariablesUpdated || {};
        summary.systemVariablesUpdated[sysVarMatch[1].trim()] = sysVarMatch[2].trim();
        summary.rawParsedLines?.push(line);
        summary.hasChanges = true;
        matched = true;
      } else if (worldStateMatch) {
        summary.worldStateUpdated = summary.worldStateUpdated || {};
        if (worldStateMatch[2]) {
          summary.worldStateUpdated[worldStateMatch[1].trim()] = worldStateMatch[2].trim();
        } else {
          summary.worldStateUpdated['state'] = worldStateMatch[1].trim();
        }
        summary.rawParsedLines?.push(line);
        summary.hasChanges = true;
        matched = true;
      }
    }
  }

  // 4. Generate rolling Memory Entry
  let summaryText = explicitMemoryText.trim();
  if (!summaryText) {
    const parts: string[] = [];
    if (summary.progressionUpdates?.levelDelta !== undefined) {
      parts.push(`Level ${summary.progressionUpdates.levelDelta > 0 ? '+' : ''}${summary.progressionUpdates.levelDelta}`);
    } else if (summary.progressionUpdates?.level !== undefined) {
      parts.push(`Level ${summary.progressionUpdates.level}`);
    }

    if (summary.progressionUpdates?.xpDelta !== undefined) {
      parts.push(`XP ${summary.progressionUpdates.xpDelta > 0 ? '+' : ''}${summary.progressionUpdates.xpDelta}`);
    } else if (summary.progressionUpdates?.xp !== undefined) {
      if (summary.progressionUpdates.requiredXp !== undefined) {
        parts.push(`XP: ${summary.progressionUpdates.xp}/${summary.progressionUpdates.requiredXp}`);
      } else {
        parts.push(`XP: ${summary.progressionUpdates.xp}`);
      }
    } else if (summary.progressionUpdates?.requiredXp !== undefined) {
      parts.push(`Required XP: ${summary.progressionUpdates.requiredXp}`);
    }

    if (summary.attributesUpdated) {
      for (const [attr, val] of Object.entries(summary.attributesUpdated)) {
        if (typeof val === 'object' && val.isDelta) {
          parts.push(`${attr} ${val.value > 0 ? '+' : ''}${val.value}`);
        } else if (typeof val === 'object') {
          parts.push(`${attr}: ${val.value}`);
        } else {
          parts.push(`${attr}: ${val}`);
        }
      }
    }

    if (summary.skillsAdded && summary.skillsAdded.length > 0) {
      for (const sk of summary.skillsAdded) {
        const name = typeof sk === 'string' ? sk : sk.name;
        parts.push(`Skill: ${name}`);
      }
    }

    if (summary.questsUpdated && summary.questsUpdated.length > 0) {
      for (const q of summary.questsUpdated) {
        const title = typeof q === 'string' ? q : q.title;
        const status = typeof q === 'string' ? 'COMPLETED' : q.status;
        parts.push(`Quest "${title}" [${status}]`);
      }
    }

    if (summary.inventoryUpdated && summary.inventoryUpdated.length > 0) {
      for (const item of summary.inventoryUpdated) {
        const name = typeof item === 'string' ? item : item.name;
        const qty = typeof item === 'object' && item.quantity ? ` ×${item.quantity}` : '';
        parts.push(`+Item: ${name}${qty}`);
      }
    }

    if (summary.inventoryRemoved && summary.inventoryRemoved.length > 0) {
      for (const item of summary.inventoryRemoved) {
        const name = typeof item === 'string' ? item : item.name;
        const qty = typeof item === 'object' && item.quantity ? ` ×${item.quantity}` : '';
        parts.push(`-Item: ${name}${qty}`);
      }
    }

    if (summary.systemVariablesUpdated && summary.systemVariablesUpdated.coins !== undefined) {
      parts.push(`Coins: ${summary.systemVariablesUpdated.coins}`);
    }

    if (parts.length > 0) {
      summaryText = parts.join(' | ');
    } else {
      summaryText = rawMessage.trim().split('\n')[0].substring(0, 100);
    }
  }

  const memoryEntry: MemoryEntry = {
    id: `mem_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 6)}`,
    timestamp,
    summary: summaryText,
    sourceEventId: eventId,
    importance: inferImportance(rawMessage, summary),
    category: inferCategory(summary),
  };

  return {
    rawMessage,
    timestamp,
    stateChanges: summary,
    memoryEntry,
    eventType: inferEventType(summary),
  };
}

/**
 * Infer the event category
 */
function inferCategory(summary: StateChangeSummary): string {
  if (summary.questsUpdated && summary.questsUpdated.length > 0) return 'quest';
  if (summary.progressionUpdates?.levelDelta || summary.progressionUpdates?.level) return 'level_up';
  if (summary.skillsAdded && summary.skillsAdded.length > 0) return 'skill';
  if (summary.inventoryRemoved && summary.inventoryRemoved.length > 0) return 'inventory_removal';
  if (summary.inventoryUpdated && summary.inventoryUpdated.length > 0) return 'inventory';
  if (summary.achievementsAdded && summary.achievementsAdded.length > 0) return 'achievement';
  if (summary.titlesAdded && summary.titlesAdded.length > 0) return 'title';
  return 'general';
}

/**
 * Infer the event type string
 */
function inferEventType(summary: StateChangeSummary): string {
  if (summary.questsUpdated && summary.questsUpdated.length > 0) return 'quest_update';
  if (summary.progressionUpdates?.levelDelta) return 'level_up';
  if (summary.skillsAdded && summary.skillsAdded.length > 0) return 'skill_unlocked';
  if (summary.inventoryRemoved && summary.inventoryRemoved.length > 0) return 'inventory_removal';
  if (summary.inventoryUpdated && summary.inventoryUpdated.length > 0) return 'item_acquired';
  if (summary.hasChanges) return 'state_update';
  return 'system_message';
}

/**
 * Infer importance (LOW, MEDIUM, HIGH, CRITICAL)
 */
export function inferImportance(
  rawMessage: string,
  summary?: StateChangeSummary,
  explicitImportance?: string
): 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' {
  if (explicitImportance) {
    const exp = explicitImportance.toUpperCase();
    if (exp === 'CRITICAL' || exp === 'HIGH' || exp === 'MEDIUM' || exp === 'LOW') {
      return exp as 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    }
  }

  const upper = rawMessage.toUpperCase();

  // 1. Critical triggers
  if (
    upper.includes('[CRITICAL]') ||
    upper.includes('EMERGENCY QUEST') ||
    upper.includes('PENALTY APPLIED') ||
    upper.includes('DEATH') ||
    upper.includes('BOSS DEFEATED') ||
    upper.includes('DUNGEON BREAK')
  ) {
    return 'CRITICAL';
  }

  // 2. High triggers
  if (
    upper.includes('[IMPORTANT]') ||
    upper.includes('[HIGH]') ||
    upper.includes('LEVEL UP') ||
    summary?.progressionUpdates?.levelDelta ||
    (summary?.skillsAdded && summary.skillsAdded.length > 0) ||
    (summary?.titlesAdded && summary.titlesAdded.length > 0) ||
    (summary?.achievementsAdded && summary.achievementsAdded.length > 0)
  ) {
    return 'HIGH';
  }

  // 3. Medium triggers
  if (
    summary?.hasChanges ||
    (summary?.questsUpdated && summary.questsUpdated.length > 0) ||
    (summary?.inventoryUpdated && summary.inventoryUpdated.length > 0) ||
    (summary?.inventoryRemoved && summary.inventoryRemoved.length > 0)
  ) {
    return 'MEDIUM';
  }

  // 4. Default to LOW
  return 'LOW';
}

export const determineEventImportance = inferImportance;

/**
 * Converts a deterministic StateChangeSummary into a GeminiStateChange array
 */
export function convertSummaryToGeminiChanges(summary: StateChangeSummary): any[] {
  const changes: any[] = [];

  if (summary.progressionUpdates?.levelDelta) {
    changes.push({ operation: 'ADD', path: 'progression.level', value: summary.progressionUpdates.levelDelta });
  } else if (summary.progressionUpdates?.level !== undefined) {
    changes.push({ operation: 'SET', path: 'progression.level', value: summary.progressionUpdates.level });
  }

  if (summary.progressionUpdates?.xpDelta) {
    changes.push({ operation: 'ADD', path: 'progression.currentXP', value: summary.progressionUpdates.xpDelta });
  } else if (summary.progressionUpdates?.xp !== undefined) {
    changes.push({ operation: 'SET', path: 'progression.currentXP', value: summary.progressionUpdates.xp });
  }

  if (summary.progressionUpdates?.requiredXp !== undefined) {
    changes.push({ operation: 'SET', path: 'progression.requiredXP', value: summary.progressionUpdates.requiredXp });
  }

  if (summary.attributesUpdated) {
    for (const [attr, update] of Object.entries(summary.attributesUpdated)) {
      changes.push({
        operation: update.isDelta ? 'ADD' : 'SET',
        path: `attributes.${attr}`,
        value: update.value,
      });
    }
  }

  if (summary.skillsAdded) {
    for (const skill of summary.skillsAdded) {
      const name = typeof skill === 'string' ? skill : skill.name;
      changes.push({ operation: 'UNLOCK', path: 'skills', value: name, id: name });
    }
  }

  if (summary.questsUpdated) {
    for (const quest of summary.questsUpdated) {
      const title = typeof quest === 'string' ? quest : quest.title;
      const status = typeof quest === 'string' ? 'COMPLETED' : quest.status;
      changes.push({ operation: status === 'COMPLETED' ? 'COMPLETE' : 'UPDATE', path: 'quests', value: status, id: title });
    }
  }

  // Inventory additions
  if (summary.inventoryUpdated) {
    for (const item of summary.inventoryUpdated) {
      const name = typeof item === 'string' ? item : item.name;
      const quantity = typeof item === 'object' && item.quantity ? item.quantity : 1;
      changes.push({ operation: 'ADD', path: 'inventory', value: { name, quantity }, id: name });
    }
  }

  // Inventory removals
  if (summary.inventoryRemoved) {
    for (const item of summary.inventoryRemoved) {
      const name = typeof item === 'string' ? item : item.name;
      const quantity = typeof item === 'object' && item.quantity ? item.quantity : 1;
      changes.push({ operation: 'REMOVE', path: 'inventory', value: { name, quantity }, id: name });
    }
  }

  if (summary.systemVariablesUpdated) {
    for (const [k, v] of Object.entries(summary.systemVariablesUpdated)) {
      changes.push({ operation: 'SET', path: `systemVariables.${k}`, value: v });
    }
  }

  if (summary.worldStateUpdated) {
    for (const [k, v] of Object.entries(summary.worldStateUpdated)) {
      changes.push({ operation: 'SET', path: `worldState.${k}`, value: v });
    }
  }

  return changes;
}
