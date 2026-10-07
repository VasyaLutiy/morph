import type {
  Actor,
  Component,
  ContourFunction,
  ContourInterface,
  ContourSystem,
  DataObject,
  Definition,
  Example,
  RecordResult,
  Step,
  StepVerb,
} from "./types.js";

export const STEP_VERBS: readonly StepVerb[] = ["calls", "reads", "modifies", "produces", "uses"];

const ROOT_KEYS: readonly string[] = ["version", "System", "Actor", "Requirement", "Guardrail"];
const SYSTEM_KEYS: readonly string[] = ["name", "description", "requirements", "guardrails", "groups"];
const COMPONENT_KEYS: readonly string[] = [
  "name", "description", "language", "requirements", "guardrails",
  "functions", "dataObjects", "interfaces",
];
const FUNCTION_KEYS: readonly string[] = [
  "name", "description", "behavior", "requirements", "guardrails",
  "preconditions", "steps", "examples",
];
const EXAMPLE_KEYS: readonly string[] = ["given", "when", "then", "ref"];
const DATA_OBJECT_KEYS: readonly string[] = ["name", "description", "schema"];
const INTERFACE_KEYS: readonly string[] = ["name", "description", "exposes"];
const ACTOR_KEYS: readonly string[] = ["name", "description", "uses"];
const DEFINITION_KEYS: readonly string[] = ["name", "description"];

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function keyPath(parent: string, key: string): string {
  return parent === "(root)" ? key : `${parent}.${key}`;
}

class RecordWalker {
  readonly problems: string[] = [];
  private readonly componentNames: Set<string> = new Set();
  private readonly dataObjectNames: Set<string> = new Set();

  validate(doc: unknown): RecordResult {
    if (!isPlainObject(doc)) {
      return { ok: false, problems: ["(root): a record must be an object"] };
    }
    this.checkKeys(doc, ROOT_KEYS, ["System"], "(root)");
    if ("version" in doc && doc.version !== 1) {
      this.problems.push("version: must be 1");
    }
    let system: ContourSystem;
    if ("System" in doc) {
      if (!isPlainObject(doc.System)) {
        this.problems.push("System: must be an object");
        system = { name: "", description: "", requirements: [], guardrails: [], groups: [] };
      } else {
        system = this.walkSystem(doc.System);
      }
    } else {
      system = { name: "", description: "", requirements: [], guardrails: [], groups: [] };
    }
    const actors = this.elementList(doc, "Actor", "(root)", (o, p) => this.walkActor(o, p));
    const requirements = this.elementList(doc, "Requirement", "(root)", (o, p) => this.walkDefinition(o, p));
    const guardrails = this.elementList(doc, "Guardrail", "(root)", (o, p) => this.walkDefinition(o, p));
    if (this.problems.length > 0) {
      return { ok: false, problems: this.problems };
    }
    return { ok: true, record: { version: 1, system, actors, requirements, guardrails } };
  }

  private checkKeys(
    o: Record<string, unknown>,
    table: readonly string[],
    required: readonly string[],
    path: string,
  ): void {
    for (const key of required) {
      if (!(key in o)) {
        this.problems.push(`${keyPath(path, key)}: required`);
      }
    }
    for (const key of Object.keys(o)) {
      if (!table.includes(key)) {
        this.problems.push(`${path}: unknown key '${key}' (known: ${table.join(", ")})`);
      }
    }
  }

  private elementList<T>(
    o: Record<string, unknown>,
    key: string,
    parent: string,
    walker: (item: Record<string, unknown>, path: string) => T,
  ): T[] {
    if (!(key in o)) return [];
    const v = o[key];
    if (!Array.isArray(v)) {
      this.problems.push(`${keyPath(parent, key)}: must be a list`);
      return [];
    }
    const out: T[] = [];
    for (let i = 0; i < v.length; i += 1) {
      const item = v[i];
      const path = `${keyPath(parent, key)}[${i}]`;
      if (isPlainObject(item)) {
        out.push(walker(item, path));
      } else {
        this.problems.push(`${path}: must be an object`);
      }
    }
    return out;
  }

  private stringList(o: Record<string, unknown>, key: string, path: string): string[] {
    if (!(key in o)) return [];
    const v = o[key];
    if (!Array.isArray(v)) {
      this.problems.push(`${keyPath(path, key)}: must be a list`);
      return [];
    }
    const out: string[] = [];
    for (let i = 0; i < v.length; i += 1) {
      const item = v[i];
      if (typeof item === "string" && item.trim() !== "") {
        out.push(item.trim());
      } else {
        this.problems.push(`${keyPath(path, key)}[${i}]: must be a non-empty string`);
      }
    }
    return out;
  }

  private readText(o: Record<string, unknown>, key: string, path: string): string | null {
    if (!(key in o)) return null;
    const v = o[key];
    if (typeof v === "string" && v.trim() !== "") {
      return v.trim();
    }
    this.problems.push(`${keyPath(path, key)}: must be a non-empty string`);
    return null;
  }

  private walkSystem(o: Record<string, unknown>): ContourSystem {
    this.checkKeys(o, SYSTEM_KEYS, ["name", "description", "groups"], "System");
    const name = this.readText(o, "name", "System");
    const description = this.readText(o, "description", "System");
    const requirements = this.stringList(o, "requirements", "System");
    const guardrails = this.stringList(o, "guardrails", "System");
    const groups = this.elementList(o, "groups", "System", (g, p) => this.walkComponent(g, p));
    return {
      name: name ?? "",
      description: description ?? "",
      requirements,
      guardrails,
      groups,
    };
  }

  private walkComponent(o: Record<string, unknown>, path: string): Component {
    this.checkKeys(o, COMPONENT_KEYS, ["name", "description"], path);
    const name = this.readText(o, "name", path);
    if (name !== null) {
      if (this.componentNames.has(name)) {
        this.problems.push(`${keyPath(path, "name")}: duplicate Component name '${name}'`);
      } else {
        this.componentNames.add(name);
      }
    }
    const description = this.readText(o, "description", path);
    const language = this.readText(o, "language", path);
    const requirements = this.stringList(o, "requirements", path);
    const guardrails = this.stringList(o, "guardrails", path);
    const functionNames: Set<string> = new Set();
    const functions = this.elementList(o, "functions", path, (f, p) => this.walkFunction(f, p, functionNames));
    const dataObjects = this.elementList(o, "dataObjects", path, (d, p) => this.walkDataObject(d, p));
    const interfaces = this.elementList(o, "interfaces", path, (i, p) => this.walkInterface(i, p));
    return {
      name: name ?? "",
      description: description ?? "",
      language,
      requirements,
      guardrails,
      functions,
      dataObjects,
      interfaces,
    };
  }

  private walkFunction(o: Record<string, unknown>, path: string, functionNames: Set<string>): ContourFunction {
    this.checkKeys(o, FUNCTION_KEYS, ["name", "description", "behavior", "examples"], path);
    const name = this.readText(o, "name", path);
    if (name !== null) {
      if (functionNames.has(name)) {
        this.problems.push(`${keyPath(path, "name")}: duplicate Function name '${name}'`);
      } else {
        functionNames.add(name);
      }
    }
    const description = this.readText(o, "description", path);
    const behavior = this.readText(o, "behavior", path);
    const requirements = this.stringList(o, "requirements", path);
    const guardrails = this.stringList(o, "guardrails", path);
    const preconditions = this.stringList(o, "preconditions", path);
    const steps = this.readSteps(o, path);
    const examples = this.readExamples(o, path);
    return {
      name: name ?? "",
      description: description ?? "",
      behavior: behavior ?? "",
      requirements,
      guardrails,
      preconditions,
      steps,
      examples,
    };
  }

  private readSteps(o: Record<string, unknown>, path: string): Step[] {
    if (!("steps" in o)) return [];
    const v = o.steps;
    if (!Array.isArray(v)) {
      this.problems.push(`${keyPath(path, "steps")}: must be a list`);
      return [];
    }
    const out: Step[] = [];
    for (let i = 0; i < v.length; i += 1) {
      const item = v[i];
      const itemPath = `${keyPath(path, "steps")}[${i}]`;
      if (!isPlainObject(item) || Object.keys(item).length !== 1) {
        this.problems.push(`${itemPath}: a step is an object with exactly one key`);
        continue;
      }
      const verb = Object.keys(item)[0] as string;
      if (!STEP_VERBS.includes(verb as StepVerb)) {
        this.problems.push(
          `${itemPath}: unknown step verb '${verb}' (known: calls, reads, modifies, produces, uses)`,
        );
        continue;
      }
      const value = item[verb];
      if (typeof value === "string" && value.trim() !== "") {
        out.push({ verb: verb as StepVerb, target: value.trim() });
      } else {
        this.problems.push(`${itemPath}.${verb}: must be a non-empty string`);
      }
    }
    return out;
  }

  private readExamples(o: Record<string, unknown>, path: string): Example[] {
    if (!("examples" in o)) return [];
    const v = o.examples;
    if (!Array.isArray(v)) {
      this.problems.push(`${keyPath(path, "examples")}: must be a list`);
      return [];
    }
    const out: Example[] = [];
    for (let i = 0; i < v.length; i += 1) {
      const item = v[i];
      const itemPath = `${keyPath(path, "examples")}[${i}]`;
      if (isPlainObject(item)) {
        out.push(this.walkExample(item, itemPath));
      } else {
        this.problems.push(`${itemPath}: must be an object`);
      }
    }
    if (v.length === 0) {
      this.problems.push(`${keyPath(path, "examples")}: must hold at least one example`);
    }
    return out;
  }

  private walkExample(o: Record<string, unknown>, path: string): Example {
    this.checkKeys(o, EXAMPLE_KEYS, ["given", "when", "then"], path);
    const given = this.readText(o, "given", path);
    const when = this.readText(o, "when", path);
    const then = this.readText(o, "then", path);
    const ref = this.readText(o, "ref", path);
    return {
      given: given ?? "",
      when: when ?? "",
      then: then ?? "",
      ref,
    };
  }

  private walkDataObject(o: Record<string, unknown>, path: string): DataObject {
    this.checkKeys(o, DATA_OBJECT_KEYS, ["name", "description"], path);
    const name = this.readText(o, "name", path);
    if (name !== null) {
      if (this.dataObjectNames.has(name)) {
        this.problems.push(`${keyPath(path, "name")}: duplicate Data Object name '${name}'`);
      } else {
        this.dataObjectNames.add(name);
      }
    }
    const description = this.readText(o, "description", path);
    const schema = this.readSchema(o, path);
    return {
      name: name ?? "",
      description: description ?? "",
      schema,
    };
  }

  private readSchema(o: Record<string, unknown>, parent: string): string | null {
    if (!("schema" in o)) {
      return null;
    }
    const v = o.schema;
    if (typeof v === "string") {
      if (v.trim() !== "") {
        return v.trim();
      }
      this.problems.push(`${keyPath(parent, "schema")}: must be a non-empty string`);
      return null;
    }
    if (isPlainObject(v)) {
      const out: Record<string, string> = {};
      for (const k of Object.keys(v)) {
        const val = v[k];
        if (typeof val === "string" && val.trim() !== "") {
          out[k] = val.trim();
        } else {
          this.problems.push(`${keyPath(parent, "schema")}.${k}: must be a non-empty string`);
        }
      }
      return JSON.stringify(out, null, 2);
    }
    this.problems.push(`${keyPath(parent, "schema")}: must be a non-empty string`);
    return null;
  }

  private walkInterface(o: Record<string, unknown>, path: string): ContourInterface {
    this.checkKeys(o, INTERFACE_KEYS, ["name", "description", "exposes"], path);
    const name = this.readText(o, "name", path);
    const description = this.readText(o, "description", path);
    const exposes = this.stringList(o, "exposes", path);
    if ("exposes" in o && Array.isArray(o.exposes) && o.exposes.length === 0) {
      this.problems.push(`${keyPath(path, "exposes")}: must hold at least one name`);
    }
    return {
      name: name ?? "",
      description: description ?? "",
      exposes,
    };
  }

  private walkActor(o: Record<string, unknown>, path: string): Actor {
    this.checkKeys(o, ACTOR_KEYS, ["name", "description"], path);
    const name = this.readText(o, "name", path);
    const description = this.readText(o, "description", path);
    const uses = this.stringList(o, "uses", path);
    return {
      name: name ?? "",
      description: description ?? "",
      uses,
    };
  }

  private walkDefinition(o: Record<string, unknown>, path: string): Definition {
    this.checkKeys(o, DEFINITION_KEYS, ["name", "description"], path);
    const name = this.readText(o, "name", path);
    const description = this.readText(o, "description", path);
    return {
      name: name ?? "",
      description: description ?? "",
    };
  }
}

export function validateRecord(doc: unknown): RecordResult {
  return new RecordWalker().validate(doc);
}
