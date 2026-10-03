import fs from "node:fs";
import path from "node:path";
import os from "node:os";

const testDataDir = path.join(os.tmpdir(), "planifica_maestro_test_data");
if (!fs.existsSync(testDataDir)) {
  try {
    fs.mkdirSync(testDataDir, { recursive: true });
  } catch (e) {}
}

process.env.PM_DATA_DIR = testDataDir;
process.env.NODE_ENV = "test";
