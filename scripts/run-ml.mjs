// Starts the FastAPI ML service using the venv created by `npm run setup`.
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const mlDir = join(root, "ml");
const python =
  process.platform === "win32"
    ? join(mlDir, ".venv", "Scripts", "python.exe")
    : join(mlDir, ".venv", "bin", "python");

if (!existsSync(python)) {
  console.error("ML venv not found. Run `npm run setup` first.");
  process.exit(1);
}

const port = process.env.ML_PORT ?? "8765";
const child = spawn(
  python,
  ["-m", "uvicorn", "app.main:app", "--host", "127.0.0.1", "--port", port, "--reload"],
  { cwd: mlDir, stdio: "inherit" },
);
child.on("exit", (code) => process.exit(code ?? 0));
