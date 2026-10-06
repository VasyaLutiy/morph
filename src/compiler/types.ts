import type { Fault, Reasoning } from "../cards/types.js";
export type Role = "system" | "user" | "assistant";
export interface Message { role: Role; content: string }
export interface Request {
  customId: string;            // "<cardId>.v<n>", n from 1
  model: string | null;        // Card.model
  maxTokens: number | null;    // Card.maxTokens
  reasoning: Reasoning | null; // Card.reasoning
  messages: Message[];
}
export type InputDigest = Record<string, string>;   // 16 hex chars or "absent"; keys sorted
export type CompileResult =
  | { ok: true; requests: Request[]; inputs: InputDigest }
  | { ok: false; faults: Fault[] };
export type ParsedAnswer =
  | { files: Record<string, string> }
  | { corrupt: string }
  | { truncated: true };
