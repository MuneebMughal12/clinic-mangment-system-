import { safeStorage } from "electron";
import {
  existsSync,
  readFileSync,
  renameSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";

export function createAuthSession(dataDir) {
  const path = join(dataDir, "auth-session.bin");
  const temporaryPath = `${path}.tmp`;

  return {
    load() {
      if (!existsSync(path) || !safeStorage.isEncryptionAvailable())
        return null;
      try {
        return JSON.parse(safeStorage.decryptString(readFileSync(path)));
      } catch {
        unlinkSync(path);
        return null;
      }
    },
    save(value) {
      if (!safeStorage.isEncryptionAvailable()) return false;
      const encrypted = safeStorage.encryptString(JSON.stringify(value));
      writeFileSync(temporaryPath, encrypted, { mode: 0o600 });
      renameSync(temporaryPath, path);
      return true;
    },
    clear() {
      if (existsSync(path)) unlinkSync(path);
      if (existsSync(temporaryPath)) unlinkSync(temporaryPath);
    },
  };
}
