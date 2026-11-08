/** Counter delta over elapsed time, in actual bytes per second (not radio link speed). */
export function trafficRate(previous: { rx: number; tx: number; at: number }, current: { rx: number; tx: number; at: number }): { rx: number; tx: number } | undefined {
  const seconds = (current.at - previous.at) / 1000;
  if (seconds <= 0 || !Number.isFinite(seconds) || ![previous.rx, previous.tx, current.rx, current.tx].every((value) => Number.isFinite(value) && value >= 0)) return undefined;
  // A counter reset begins a fresh sample rather than a false throughput spike.
  return { rx: current.rx < previous.rx ? 0 : (current.rx - previous.rx) / seconds, tx: current.tx < previous.tx ? 0 : (current.tx - previous.tx) / seconds };
}
