import { addCents } from "../units/addCents.js";

export function renderReport(amounts: number[]): string {
  return amounts.map((a) => String(addCents(a, 0))).join(", ");
}
