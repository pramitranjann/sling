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

export function buildLevelCards({ container, levels, currentLevelId, saveHelpers, onSelect }) {
  container.innerHTML = "";

  levels.forEach((level) => {
    const state = getCardState(level.id, currentLevelId, saveHelpers);
    const record = saveHelpers.getLevelRecord(level.id);
    const unlocked = state !== "locked";
    const button = document.createElement("button");
    button.type = "button";
    button.className = `level-card level-card--${state}`;
    button.disabled = !unlocked;

    const scoreCopy = unlocked
      ? record.completed
        ? record.highScore.toLocaleString()
        : state === "current"
          ? "ACTIVE"
          : "UNPLAYD"
      : "LOCKD";

    button.innerHTML = `
      <span class="level-card__header">
        <span class="level-card__header-band"></span>
        <span class="level-card__number">${String(level.id).padStart(2, "0")}</span>
      </span>
      <span class="level-card__stars">${unlocked ? renderStars(record.stars) : "— — —"}</span>
      <span class="level-card__score">${scoreCopy}</span>
    `;

    if (unlocked) {
      button.addEventListener("click", () => onSelect(level.id));
    }

    container.append(button);
  });
}
