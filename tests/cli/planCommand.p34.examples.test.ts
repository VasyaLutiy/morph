import { test, expect } from "vitest";
import { planCommand } from "../../src/cli/planCommand.js";
import { fixture, fixtureJson, tmpRoot } from "../helpers.js";
import type { PlanArgs, PlanDocument } from "../../src/cli/types.js";

test("Plan Command example 16: the two Contour records of the old Morph's experiments load and cut like the old decks", () => {
  const want = fixtureJson("contour/parity/expected.json") as Record<
    string,
    {
      cards: { customId: string; dependsOn: string[]; targets: string[] }[];
      generations: string[][];
      warnings: string[];
    }
  >;
  const r = tmpRoot();
  try {
    r.write("contour.yaml", fixture("contour/parity/ccledger.contour.yaml"));
    r.write("morph-map.json", fixture("contour/parity/ccledger.map.json"));
    const args: PlanArgs = {
      name: "plan",
      root: ".",
      pretty: false,
      spec: "contour.yaml",
      components: [],
      map: "morph-map.json",
      judge: false,
      out: null,
    };
    const res = planCommand(r.root, args);
    expect(res.code).toBe(0);
    const doc = res.document as PlanDocument & { warnings?: string[] };
    expect(
      doc.cards.map((c) => ({
        customId: c.customId,
        dependsOn: c.dependsOn,
        targets: c.targets,
      })),
    ).toStrictEqual(want["ccledger"].cards);
    expect(doc.generations).toStrictEqual(want["ccledger"].generations);
    expect(doc.warnings).toStrictEqual(want["ccledger"].warnings);

    const resJudge = planCommand(r.root, { ...args, judge: true });
    expect(resJudge.code).toBe(0);
    const docJudge = resJudge.document as PlanDocument & { warnings?: string[] };
    expect(
      docJudge.cards.map((c) => ({
        customId: c.customId,
        dependsOn: c.dependsOn,
        targets: c.targets,
      })),
    ).toStrictEqual(want["ccledger"].cards);
    expect(docJudge.generations).toStrictEqual(want["ccledger"].generations);
    expect(docJudge.warnings).toStrictEqual(want["ccledger"].warnings);
  } finally {
    r.rm();
  }

  const rEngine = tmpRoot();
  try {
    rEngine.write("contour.yaml", fixture("contour/parity/contour-engine.contour.yaml"));
    rEngine.write("morph-map.json", fixture("contour/parity/contour-engine.map.json"));
    const args: PlanArgs = {
      name: "plan",
      root: ".",
      pretty: false,
      spec: "contour.yaml",
      components: ["contour-engine"],
      map: "morph-map.json",
      judge: false,
      out: null,
    };
    const res = planCommand(rEngine.root, args);
    expect(res.code).toBe(0);
    const doc = res.document as PlanDocument & { warnings?: string[] };
    expect(
      doc.cards.map((c) => ({
        customId: c.customId,
        dependsOn: c.dependsOn,
        targets: c.targets,
      })),
    ).toStrictEqual(want["contour-engine"].cards);
    expect(doc.generations).toStrictEqual(want["contour-engine"].generations);
    expect(doc.warnings).toStrictEqual(want["contour-engine"].warnings);
  } finally {
    rEngine.rm();
  }
});

test("Plan Command example 17: the plan document warns the record's 10 unknown keys and the assumed language, warnings last", () => {
  const r = tmpRoot();
  try {
    r.write("contour.json", fixture("contour/contourKeys.json"));
    const args: PlanArgs = {
      name: "plan",
      root: ".",
      pretty: false,
      spec: "contour.json",
      components: ["orders", "catalog"],
      map: null,
      judge: false,
      out: null,
    };
    const res = planCommand(r.root, args);
    expect(res.code).toBe(0);
    const doc = res.document as PlanDocument & { warnings?: string[] };
    expect(doc.warnings).toStrictEqual([
      ...(fixtureJson("contour/contourKeys.warnings.json") as string[]),
      "no language on Component catalog and none in the map: typescript assumed",
    ]);
    expect(Object.keys(doc).at(-1)).toBe("warnings");
    expect(doc.generations).toStrictEqual([
      ["cancel-order", "list-prices", "place-order"],
      ["orders-api"],
    ]);
  } finally {
    r.rm();
  }
});
