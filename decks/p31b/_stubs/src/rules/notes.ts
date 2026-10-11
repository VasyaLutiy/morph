export interface NoteCard { id: string; extra: string | null; targets: readonly string[] }
export function planNotes(cards: readonly NoteCard[], layersFile: boolean, guard: string): string[] {
  throw new Error("stub planNotes " + String(cards.length) + String(layersFile) + guard);
}
