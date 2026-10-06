// One-time local setup: installs deps, creates ./data, the SQLite schema, the
// fixture book, and the Python venv for the ML service.
import { execSync } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const run = (cmd, cwd = root) => {
  console.log(`\n> ${cmd}`);
  execSync(cmd, { cwd, stdio: "inherit" });
};

mkdirSync(join(root, "data"), { recursive: true });

run("npm install");
run("npm install", join(root, "web"));
run("npx prisma db push --skip-generate", join(root, "web"));
run("npx prisma generate", join(root, "web"));
run("npm run seed", join(root, "web"));

const mlDir = join(root, "ml");
const venvPython =
  process.platform === "win32"
    ? join(mlDir, ".venv", "Scripts", "python.exe")
    : join(mlDir, ".venv", "bin", "python");
if (!existsSync(venvPython)) {
  const sysPython = process.platform === "win32" ? "py -3" : "python3";
  run(`${sysPython} -m venv .venv`, mlDir);
}
run(`"${venvPython}" -m pip install -q -r requirements.txt`, mlDir);

console.log("\nSetup complete. Run `npm run dev` to start the web app and ML service.");
