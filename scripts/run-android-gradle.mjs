import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";

const androidDir = join(process.cwd(), "android");
const gradleWrapper = process.platform === "win32" ? "gradlew.bat" : "./gradlew";
const gradleWrapperPath = join(androidDir, process.platform === "win32" ? "gradlew.bat" : "gradlew");
const tasks = process.argv.slice(2);

if (tasks.length === 0) {
  console.error("Usage: node scripts/run-android-gradle.mjs <gradle-task> [...tasks]");
  process.exit(1);
}

if (!existsSync(androidDir) || !existsSync(gradleWrapperPath)) {
  console.error("Android project is missing. Run `npx cap add android` first.");
  process.exit(1);
}

const child = spawn(gradleWrapper, tasks, {
  cwd: androidDir,
  shell: process.platform === "win32",
  stdio: "inherit",
});

child.on("exit", (code, signal) => {
  if (signal) {
    console.error(`Gradle stopped with signal ${signal}.`);
    process.exit(1);
  }

  process.exit(code ?? 1);
});
