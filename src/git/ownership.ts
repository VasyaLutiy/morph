export interface OwnershipCommit {
  card: string;
  model: string;
  run: string | null;
  paths: string[];
}

export interface OwnershipWrite {
  card: string;
  model: string;
  run: string | null;
}

export interface OwnedPath {
  path: string;
  writes: OwnershipWrite[];
}

export interface Ownership {
  commits: number;
  models: { model: string; commits: number }[];
  paths: OwnedPath[];
}

export function readOwnership(commits: OwnershipCommit[]): Ownership {
  const modelCounts = new Map<string, number>();
  for (const commit of commits) {
    modelCounts.set(commit.model, (modelCounts.get(commit.model) ?? 0) + 1);
  }
  const models = Array.from(modelCounts.entries()).map(([model, count]) => ({
    model,
    commits: count,
  }));

  const writesByPath = new Map<string, OwnershipWrite[]>();
  for (const commit of commits) {
    const seen = new Set<string>();
    for (const path of commit.paths) {
      if (seen.has(path)) continue;
      seen.add(path);
      const write: OwnershipWrite = { card: commit.card, model: commit.model, run: commit.run };
      const writes = writesByPath.get(path);
      if (writes === undefined) {
        writesByPath.set(path, [write]);
      } else {
        writes.push(write);
      }
    }
  }
  const paths = Array.from(writesByPath.entries()).map(([path, writes]) => ({ path, writes }));

  return { commits: commits.length, models, paths };
}
