#!/usr/bin/env node
import { main } from "./cli/main.js";

const env: Record<string, string> = {};
for (const [key, value] of Object.entries(process.env)) {
  if (value !== undefined) env[key] = value;
}

const code = await main(
  process.argv.slice(2),
  {
    env,
    now: () => Date.now(),
    cwd: process.cwd(),
    transport: null,
  },
  {
    stdout: (text: string) => {
      process.stdout.write(text);
    },
    stderr: (text: string) => {
      process.stderr.write(text);
    },
  },
);

process.exitCode = code;
