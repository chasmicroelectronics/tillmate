/** Accuracy (0-100) over the last `window` answers, one value per answer, oldest first. */
export function rollingAccuracy(attempts, window = 20) {
  const sorted = [...attempts].sort((a, b) => a.date - b.date);
  return sorted.map((_, i) => {
    const slice = sorted.slice(Math.max(0, i - window + 1), i + 1);
    const correct = slice.filter((a) => a.correct).length;
    return (correct / slice.length) * 100;
  });
}

/** Percentage correct per session, oldest first. */
export function sessionScores(attempts) {
  const groups = new Map();
  for (const a of attempts) {
    if (!groups.has(a.sessionId)) groups.set(a.sessionId, []);
    groups.get(a.sessionId).push(a);
  }
  return [...groups.values()]
    .map((group) => ({
      date: Math.min(...group.map((a) => a.date)),
      percent: (group.filter((a) => a.correct).length / group.length) * 100,
    }))
    .sort((a, b) => a.date - b.date);
}
