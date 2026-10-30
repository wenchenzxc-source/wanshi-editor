export type TearBand = { y: number; height: number; offset: number };

// The layer ID is the seed, so editing, preview and production use the same tears.
export function screenTearBands(id: string, width: number, height: number, strength: number): TearBand[] {
  const amount = Math.min(1, Math.max(0, strength / 100));
  if (!amount || width <= 0 || height <= 0) return [];
  let state = 2166136261;
  for (const char of id) state = Math.imul(state ^ char.charCodeAt(0), 16777619) >>> 0;
  const random = () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
  const count = 1 + Math.round(amount * 7);
  return Array.from({ length: count }, (_, index) => {
    const bandHeight = height * (.012 + amount * .045) * (.55 + random() * .65);
    const center = height * (index + .5 + (random() - .5) * .5) / count;
    const offset = (random() < .5 ? -1 : 1) * width * (.012 + amount * .12) * (.4 + random() * .6);
    return { y: Math.max(0, Math.min(height - bandHeight, center - bandHeight / 2)), height: bandHeight, offset };
  });
}
