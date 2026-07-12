function normalizeIndex(total, index) {
  const count = Math.max(0, Number(total) || 0);
  if (!count) return 0;
  return Math.min(Math.max(0, Number(index) || 0), count - 1);
}

function build(total, index) {
  const count = Math.max(0, Number(total) || 0);
  const activeIndex = normalizeIndex(count, index);
  const indicatorCount = Math.min(count, 5);
  const indicatorStart = Math.min(
    Math.max(0, activeIndex - Math.floor(indicatorCount / 2)),
    Math.max(0, count - indicatorCount)
  );

  return {
    activeIndex,
    currentNumber: count ? activeIndex + 1 : 0,
    total: count,
    hasPrevious: activeIndex > 0,
    hasNext: activeIndex < count - 1,
    indicators: Array.from({ length: indicatorCount }, (_, offset) => {
      const indicatorIndex = indicatorStart + offset;
      return {
        index: indicatorIndex,
        active: indicatorIndex === activeIndex
      };
    })
  };
}

module.exports = {
  normalizeIndex,
  build
};
