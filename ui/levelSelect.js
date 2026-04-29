function getCardState(levelId, currentLevelId, saveHelpers) {
  const record = saveHelpers.getLevelRecord(levelId);
  const unlocked = saveHelpers.isLevelUnlocked(levelId);

  if (!unlocked) return "locked";
  if (levelId === currentLevelId) return record.completed ? "completed" : "current";
  if (record.completed) return "completed";
  return "unplayed";
}

function renderStars(count) {
  return Array.from({ length: 3 }, (_, index) => (index < count ? "★" : "☆")).join(" ");
}

function getCardMeta(level, state, record) {
  if (state === "locked") {
    return {
      badge: "LOCKED",
      score: "SEALED",
      helper: `CLEAR ${String(level.id - 1).padStart(2, "0")} TO OPEN`,
    };
  }

  if (state === "current") {
    return {
      badge: "LIVE",
      score: record.completed ? record.highScore.toLocaleString() : "ACTIVE",
      helper: "SELECT TO DEPLOY",
    };
  }

  if (state === "completed") {
    return {
      badge: "CLEAR",
      score: record.highScore.toLocaleString(),
      helper: "BEST SCORE",
    };
  }

  return {
    badge: "READY",
    score: "STANDBY",
    helper: "UNLOCKED",
  };
}

export function buildLevelCards({ container, levels, currentLevelId, saveHelpers, onSelect }) {
  container.innerHTML = "";

  levels.forEach((level) => {
    const state = getCardState(level.id, currentLevelId, saveHelpers);
    const record = saveHelpers.getLevelRecord(level.id);
    const unlocked = state !== "locked";
    const meta = getCardMeta(level, state, record);
    const button = document.createElement("button");
    button.type = "button";
    button.className = `level-card level-card--${state}`;
    button.disabled = !unlocked;

    button.innerHTML = `
      <span class="level-card__header">
        <span class="level-card__number">${String(level.id).padStart(2, "0")}</span>
        <span class="level-card__badge">${meta.badge}</span>
      </span>
      <span class="level-card__name">${level.name}</span>
      <span class="level-card__stars">${unlocked ? renderStars(record.stars) : "— — —"}</span>
      <span class="level-card__helper">${meta.helper}</span>
      <span class="level-card__score">${meta.score}</span>
    `;

    if (unlocked) {
      button.addEventListener("click", () => onSelect(level.id));
    }

    container.append(button);
  });
}
