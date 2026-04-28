export async function loadLevelData(levelsUrl) {
  const response = await fetch(levelsUrl);
  if (!response.ok) {
    throw new Error(`Failed to load levels.json (${response.status})`);
  }

  const payload = await response.json();
  return normalizeLevelPayload(payload);
}

export function normalizeLevelPayload(payload) {
  const meta = payload?.meta ?? {};
  const levels = [...(payload?.levels ?? [])].sort((a, b) => a.id - b.id);

  validateLevels(levels);

  return { meta, levels };
}

export function validateLevels(levels) {
  if (!Array.isArray(levels) || levels.length === 0) {
    throw new Error("levels.json does not contain any playable levels.");
  }

  const seenIds = new Set();

  levels.forEach((level) => {
    if (!Number.isInteger(level.id)) {
      throw new Error("Each level must have an integer id.");
    }

    if (seenIds.has(level.id)) {
      throw new Error(`Duplicate level id ${level.id} in levels.json.`);
    }
    seenIds.add(level.id);

    if (typeof level.name !== "string" || level.name.length === 0) {
      throw new Error(`Level ${level.id} is missing a valid name.`);
    }

    if (!Number.isFinite(level.par)) {
      throw new Error(`Level ${level.id} is missing a valid par score.`);
    }

    if (!Array.isArray(level.birds) || level.birds.length === 0) {
      throw new Error(`Level ${level.id} must declare at least one bird.`);
    }

    if (!Array.isArray(level.structures) || level.structures.length === 0) {
      throw new Error(`Level ${level.id} must declare at least one structure.`);
    }
  });
}

export function getLevelById(levels, levelId) {
  return levels.find((level) => level.id === levelId) ?? null;
}

export function getLevelIndex(levels, levelId) {
  return levels.findIndex((level) => level.id === levelId);
}

export function getNextLevel(levels, levelId) {
  const nextIndex = getLevelIndex(levels, levelId) + 1;
  return levels[nextIndex] ?? null;
}
