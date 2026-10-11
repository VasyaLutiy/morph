export interface TreeProfile {
  id: string;
  fileLine: string;
  config: string | null;
  command: string | null;
}

export const TREE_PROFILES: readonly TreeProfile[] = [
  {
    id: "typescript",
    fileLine: "^(\\S+?\\.tsx?)(\\(\\d+,\\d+\\).*)$",
    config: "tsconfig.card.json",
    command: "node_modules/.bin/tsc --noEmit -p {config}",
  },
  {
    id: "python",
    fileLine: "^(\\S+?\\.pyi?)(:\\d+.*)$",
    config: null,
    command: null,
  },
  {
    id: "go",
    fileLine: "^(?:vet: )?(?:\\./)?(\\S+?\\.go)(:\\d+.*)$",
    config: "full.json",
    command: "go build -overlay {config} ./... ; go vet -overlay {config} ./...",
  },
];

export function treeProfileFor(id: string): TreeProfile | null {
  for (const profile of TREE_PROFILES) {
    if (profile.id === id) {
      return profile;
    }
  }
  return null;
}

export interface TestProfile {
  id: string;
  failLine: string | null;
  locationLine: string | null;
  packageLine: string | null;
}

export const TEST_LINES: readonly TestProfile[] = [
  {
    id: "typescript",
    failLine: "^\\s*FAIL\\s+(\\S+?\\.[cm]?[jt]sx?)(?:\\s|$)",
    locationLine: "^\\s+\\u276f\\s+(?:\\S+\\s+)?(\\S+?\\.[cm]?[jt]sx?):\\d+:\\d+",
    packageLine: null,
  },
  {
    id: "python",
    failLine: "^(?:FAILED|ERROR) (\\S+?\\.pyi?)(?:::|\\s|$)",
    locationLine: null,
    packageLine: null,
  },
  {
    id: "go",
    failLine: null,
    locationLine: "^\\s+(\\S+?\\.go):\\d+",
    packageLine: "^FAIL\\t(\\S+)",
  },
];
