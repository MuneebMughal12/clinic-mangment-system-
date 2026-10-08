import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { join } from "node:path";

const fileName = "admin-credentials.json";

export function createAdminCredentials(dataDir, legacy = {}) {
  const path = join(dataDir, fileName);
  let saved = existsSync(path) ? JSON.parse(readFileSync(path, "utf8")) : null;
  const legacyUsername = String(legacy.username || "").trim();
  const legacyPassword = String(legacy.password || "");

  const username = () => saved?.username || (legacyUsername && legacyPassword ? legacyUsername : "");
  const configured = () => Boolean(username());
  const verify = (candidateUsername, candidatePassword) => {
    if (String(candidateUsername || "").trim().toLowerCase() !== username().toLowerCase()) return false;
    if (saved) {
      if (typeof candidatePassword !== "string") return false;
      const actual = scryptSync(candidatePassword, Buffer.from(saved.salt, "hex"), 64);
      const expected = Buffer.from(saved.hash, "hex");
      return actual.length === expected.length && timingSafeEqual(actual, expected);
    }
    const actual = Buffer.from(String(candidatePassword || ""));
    const expected = Buffer.from(legacyPassword);
    return actual.length === expected.length && timingSafeEqual(actual, expected);
  };
  return {
    username,
    configured,
    verify,
    fingerprint: () => saved?.hash || (configured() ? scryptSync(legacyPassword, "clinic-desk-session", 64).toString("hex") : ""),
    setup(input) {
      if (configured()) throw new Error("Admin account is already configured.");
      const name = String(input?.username || "").trim();
      const password = String(input?.password || "");
      if (!/^[a-zA-Z0-9._-]{3,60}$/.test(name))
        throw new Error("Use 3–60 letters, numbers, dots, underscores or hyphens for the admin username.");
      if (password.length < 12) throw new Error("Admin password must have at least 12 characters.");
      const salt = randomBytes(32).toString("hex");
      const next = { username: name, salt, hash: scryptSync(password, Buffer.from(salt, "hex"), 64).toString("hex") };
      writeFileSync(path, JSON.stringify(next), { flag: "wx", mode: 0o600 });
      saved = next;
      return { username: name };
    },
  };
}
