import type { Example } from "../contour/types.js";
import type { LanguageProfile } from "../language/types.js";

export interface SkeletonInput {
  id: string;
  profile: LanguageProfile;
  functions: { name: string; examples: Example[] }[];
  targets: string[];
}

export function probeSkeleton(input: SkeletonInput): string {
  throw new Error("stub probeSkeleton " + input.id);
}
