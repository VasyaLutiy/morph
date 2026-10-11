import type { AcceptanceResult, RunOptions } from "./types.js";
import { spawn } from "node:child_process";
import type { ChildProcess } from "node:child_process";

export const DEFAULT_TIMEOUT_MS = 300000;
export const LOG_CAP = 4000;

const DIAGNOSIS = /FAIL|Error|assert|expected/;
const HEAD_CHARS = 1500;
const TAIL_CHARS = 1500;
const DIAGNOSIS_BUDGET = 800;
const DIAGNOSIS_LINE_CAP = 200;

/**
 * Clips a raw command log to at most LOG_CAP chars: the first 1500 and the last
 * 1500 chars kept whole, and between them one elision marker, the middle's
 * diagnosis lines (FAIL, Error, assert, expected) within 800 chars, and a
 * closing marker.
 */
export function clipLog(text: string): string {
  if (text.length <= LOG_CAP) {
    return text;
  }
  const head = text.slice(0, HEAD_CHARS);
  const tail = text.slice(text.length - TAIL_CHARS);
  const middle = text.slice(HEAD_CHARS, text.length - TAIL_CHARS);
  const kept: string[] = [];
  let budget = 0;
  for (const raw of middle.split("\n")) {
    const line = raw.length > DIAGNOSIS_LINE_CAP ? raw.slice(0, DIAGNOSIS_LINE_CAP) : raw;
    if (!DIAGNOSIS.test(line)) {
      continue;
    }
    if (budget + line.length + 1 > DIAGNOSIS_BUDGET) {
      break;
    }
    kept.push(line);
    budget += line.length + 1;
  }
  return (
    head +
    "\n[... " +
    middle.length +
    " chars clipped; diagnosis lines kept:]\n" +
    kept.map((l) => l + "\n").join("") +
    "[...]\n" +
    tail
  );
}

/**
 * Builds the child's environment as a NEW object: every entry of `env` whose
 * upper-cased key starts with MORPH_PROCESSOR_ or ends with _KEY or _TOKEN is
 * dropped, so no API key reaches a model-written test. `env` is not changed.
 */
function childEnv(env: Record<string, string>): Record<string, string> {
  const filtered: Record<string, string> = {};
  for (const [key, value] of Object.entries(env)) {
    const upper = key.toUpperCase();
    if (upper.startsWith("MORPH_PROCESSOR_") || upper.endsWith("_KEY") || upper.endsWith("_TOKEN")) {
      continue;
    }
    filtered[key] = value;
  }
  return filtered;
}

/**
 * Runs the card's acceptance command in `/bin/sh -c` with cwd = root, the given
 * environment minus the processor/secret keys (with NO_COLOR=1 and CI=1 laid
 * over it), detached in its own process group. On expiry of timeoutMs the whole
 * group is killed; a SIGINT/SIGTERM of this process during the call kills the
 * group the same way (the listeners are added before the spawn, so a signal
 * caught before the child exists kills it as soon as it is spawned, and they are
 * removed when the child closes or fails to start: none outlives the call).
 * Resolves on the child's "close" event; the promise never rejects.
 */
export function runAcceptance(
  command: string,
  root: string,
  options: RunOptions,
): Promise<AcceptanceResult> {
  return new Promise<AcceptanceResult>((resolve) => {
    const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    let timedOut = false;
    let signalled: NodeJS.Signals | null = null;
    const chunks: Buffer[] = [];

    let child: ChildProcess | undefined;

    /** Kills the child's process group, if it has one: the timeout uses this too. */
    const killGroup = (): void => {
      if (child !== undefined && child.pid !== undefined) {
        try {
          process.kill(-child.pid, "SIGKILL");
        } catch {
          // the group is already gone: no error
        }
      }
    };

    /**
     * Records the FIRST signal's name and kills the group at once; a signal that
     * arrives before the spawn kills the child right after it. While a listener
     * is present Node does not exit on that signal: the caller decides.
     */
    const onSignal = (signal: NodeJS.Signals): void => {
      if (signalled !== null) {
        return;
      }
      signalled = signal;
      killGroup();
    };

    const removeListeners = (): void => {
      process.off("SIGINT", onSignal);
      process.off("SIGTERM", onSignal);
    };

    process.on("SIGINT", onSignal);
    process.on("SIGTERM", onSignal);

    try {
      child = spawn("/bin/sh", ["-c", "exec 2>&1\n" + command], {
        cwd: root,
        env: { ...childEnv(options.env), NO_COLOR: "1", CI: "1" },
        detached: true,
        stdio: ["ignore", "pipe", "pipe"],
      });
    } catch (err: unknown) {
      removeListeners();
      const message = err instanceof Error ? err.message : String(err);
      resolve({
        exit: null,
        log: "acceptance could not start: " + message + "\n",
        timedOut: false,
      });
      return;
    }

    if (signalled !== null) {
      killGroup();
    }

    const timer = setTimeout(() => {
      timedOut = true;
      killGroup();
    }, timeoutMs);

    child.stdout?.on("data", (chunk: Buffer) => {
      chunks.push(chunk);
    });
    child.stderr?.on("data", (chunk: Buffer) => {
      chunks.push(chunk);
    });

    child.on("error", (err: Error) => {
      clearTimeout(timer);
      removeListeners();
      resolve({
        exit: null,
        log: "acceptance could not start: " + err.message + "\n",
        timedOut: false,
      });
    });

    child.on("close", (code: number | null) => {
      clearTimeout(timer);
      removeListeners();
      let log = clipLog(Buffer.concat(chunks).toString("utf8"));
      if (timedOut) {
        if (log.length > 0 && !log.endsWith("\n")) {
          log += "\n";
        }
        log += "acceptance timed out after " + timeoutMs + " ms\n";
      }
      if (signalled !== null) {
        if (log.length > 0 && !log.endsWith("\n")) {
          log += "\n";
        }
        log += "acceptance interrupted by " + signalled + "\n";
      }
      resolve({
        exit: timedOut || signalled !== null ? null : code,
        log,
        timedOut,
      });
    });
  });
}
