import { getFont, type FontId } from '../shared/fonts';
import { publicUrl } from './urls';

const loaded = new Set<FontId>();
const tasks = new Map<FontId, Promise<void>>();

export function isFontLoaded(id: FontId) { return loaded.has(id); }

export function loadFont(id: FontId): Promise<void> {
  if (loaded.has(id)) return Promise.resolve();
  const pending = tasks.get(id);
  if (pending) return pending;
  const entry = getFont(id);
  const task = (async () => {
    const face = new FontFace(entry.family, `url(${publicUrl(`fonts/${entry.file}`)})`, {
      weight: id === 'sans' || id === 'serif' ? '100 900' : '400',
    });
    await face.load();
    document.fonts.add(face);
    loaded.add(id);
  })().catch(error => { tasks.delete(id); throw error; });
  tasks.set(id, task);
  return task;
}
