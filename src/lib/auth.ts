import { promises as fs } from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const DATA_DIR = path.join(process.cwd(), "data");
const USERS_FILE = path.join(DATA_DIR, "users.json");
const SESSIONS_FILE = path.join(DATA_DIR, "sessions.json");

const SCRYPT_KEYLEN = 64;
const SCRYPT_SALT_LEN = 16;
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export interface User {
  id: string;
  username: string;
  passwordHash: string;
  createdAt: number;
  isAdmin: boolean;
}

export interface Session {
  token: string;
  userId: string;
  createdAt: number;
  expiresAt: number;
}

export const SESSION_COOKIE = "emojigen_session";

export interface PublicUser {
  id: string;
  username: string;
  isAdmin: boolean;
}

async function ensureDir() {
  await fs.mkdir(DATA_DIR, { recursive: true });
}

async function readJson<T>(file: string, fallback: T): Promise<T> {
  try {
    const raw = await fs.readFile(file, "utf8");
    return JSON.parse(raw) as T;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return fallback;
    throw err;
  }
}

async function writeJsonAtomic(file: string, data: unknown) {
  await ensureDir();
  const tmp = `${file}.${process.pid}.${Date.now()}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(data, null, 2), "utf8");
  await fs.rename(tmp, file);
}

function hashPassword(password: string): string {
  const salt = crypto.randomBytes(SCRYPT_SALT_LEN).toString("hex");
  const derived = crypto.scryptSync(password, salt, SCRYPT_KEYLEN).toString("hex");
  return `scrypt$${salt}$${derived}`;
}

function verifyPassword(password: string, stored: string): boolean {
  const parts = stored.split("$");
  if (parts.length !== 3 || parts[0] !== "scrypt") return false;
  const salt = parts[1];
  const expected = parts[2];
  const derived = crypto.scryptSync(password, salt, SCRYPT_KEYLEN).toString("hex");
  if (derived.length !== expected.length) return false;
  return crypto.timingSafeEqual(Buffer.from(derived, "hex"), Buffer.from(expected, "hex"));
}

export function toPublicUser(u: User): PublicUser {
  return { id: u.id, username: u.username, isAdmin: u.isAdmin };
}

export async function ensureAdminUser(username: string, password: string) {
  const users = await readJson<User[]>(USERS_FILE, []);
  if (users.some((u) => u.username === username)) return;
  users.push({
    id: crypto.randomUUID(),
    username,
    passwordHash: hashPassword(password),
    createdAt: Date.now(),
    isAdmin: true,
  });
  await writeJsonAtomic(USERS_FILE, users);
}

export async function findUserByUsername(username: string): Promise<User | null> {
  const users = await readJson<User[]>(USERS_FILE, []);
  return users.find((u) => u.username === username) ?? null;
}

export async function findUserById(id: string): Promise<User | null> {
  const users = await readJson<User[]>(USERS_FILE, []);
  return users.find((u) => u.id === id) ?? null;
}

export async function createUser(username: string, password: string): Promise<PublicUser> {
  const cleanName = username.trim();
  if (!cleanName) throw new Error("用户名不能为空");
  if (cleanName.length < 2 || cleanName.length > 24) throw new Error("用户名长度需在 2-24 之间");
  if (!/^[\p{L}\p{N}_-]+$/u.test(cleanName)) throw new Error("用户名仅支持中英文/数字/下划线/短横线");
  if (password.length < 6) throw new Error("密码至少 6 位");

  const users = await readJson<User[]>(USERS_FILE, []);
  if (users.some((u) => u.username === cleanName)) {
    throw new Error("用户名已存在");
  }
  const user: User = {
    id: crypto.randomUUID(),
    username: cleanName,
    passwordHash: hashPassword(password),
    createdAt: Date.now(),
    isAdmin: false,
  };
  users.push(user);
  await writeJsonAtomic(USERS_FILE, users);
  return toPublicUser(user);
}

export async function verifyCredentials(
  username: string,
  password: string,
): Promise<PublicUser | null> {
  const user = await findUserByUsername(username.trim());
  if (!user) return null;
  if (!verifyPassword(password, user.passwordHash)) return null;
  return toPublicUser(user);
}

export async function createSession(userId: string): Promise<Session> {
  const sessions = await readJson<Session[]>(SESSIONS_FILE, []);
  const now = Date.now();
  const session: Session = {
    token: crypto.randomBytes(32).toString("hex"),
    userId,
    createdAt: now,
    expiresAt: now + SESSION_TTL_MS,
  };
  sessions.push(session);
  await writeJsonAtomic(SESSIONS_FILE, sessions);
  return session;
}

export async function destroySession(token: string) {
  const sessions = await readJson<Session[]>(SESSIONS_FILE, []);
  const next = sessions.filter((s) => s.token !== token);
  if (next.length !== sessions.length) {
    await writeJsonAtomic(SESSIONS_FILE, next);
  }
}

export async function getUserBySessionToken(token: string | undefined | null): Promise<PublicUser | null> {
  if (!token) return null;
  const sessions = await readJson<Session[]>(SESSIONS_FILE, []);
  const now = Date.now();
  const valid = sessions.find((s) => s.token === token && s.expiresAt > now);
  if (!valid) return null;
  const user = await findUserById(valid.userId);
  if (!user) return null;
  return toPublicUser(user);
}

export function readSessionCookie(req: Request): string | null {
  const cookieHeader = req.headers.get("cookie") || "";
  const cookies = cookieHeader.split(";").map((c) => c.trim());
  for (const c of cookies) {
    if (c.startsWith(`${SESSION_COOKIE}=`)) {
      return decodeURIComponent(c.slice(SESSION_COOKIE.length + 1));
    }
  }
  return null;
}

export function buildSessionCookie(token: string): string {
  const maxAge = Math.floor(SESSION_TTL_MS / 1000);
  return `${SESSION_COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}`;
}

export function buildLogoutCookie(): string {
  return `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
}
