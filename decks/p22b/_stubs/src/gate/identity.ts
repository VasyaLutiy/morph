export interface IdentityEntry { name: string; commit: string; dir: string; install: Record<string, string>; argv: string[]; bytes: number; sha256: string }
export interface IdentityRow { name: string; code: number; bytes: number; sha256: string; ok: boolean }
export interface IdentityDeps { env: Record<string, string>; plan: (argv: string[]) => Promise<number> }
export interface IdentityResult { rows: IdentityRow[]; errors: string[] }
export async function checkIdentity(root: string, entries: readonly IdentityEntry[], deps: IdentityDeps): Promise<IdentityResult> {
  throw new Error("stub checkIdentity " + JSON.stringify([root.length, entries.length, typeof deps.plan]));
}
