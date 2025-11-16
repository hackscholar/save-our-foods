import crypto from "crypto";
import { getSupabaseClient } from "@/lib/supabase";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const USERS_TABLE = "app_users";

export async function findUserByEmail(email) {
  if (!email) return null;
  const normalizedEmail = email.trim().toLowerCase();
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from(USERS_TABLE)
    .select("*")
    .eq("email", normalizedEmail)
    .maybeSingle();

  if (error && error.code !== "PGRST116") {
    throw error;
  }

  return data ? formatUserRecord(data) : null;
}

export function sanitizeUser(user) {
  if (!user) return null;
  const { passwordHash, passwordSalt, ...safeUser } = user;
  return safeUser;
}

function createPasswordHash(password, salt = crypto.randomBytes(16).toString("hex")) {
  const derived = crypto.scryptSync(password, salt, 64).toString("hex");
  return { salt, hash: derived };
}

export async function createUser({ name, email, password }) {
  const normalizedEmail = email.trim().toLowerCase();
  const trimmedName = name.trim();
  const { salt, hash } = createPasswordHash(password);
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from(USERS_TABLE)
    .insert({
      name: trimmedName,
      email: normalizedEmail,
      password_hash: hash,
      password_salt: salt,
    })
    .select("*")
    .single();

  if (error) {
    if (error.code === "23505") {
      const dup = new Error("Account already exists for this email");
      dup.code = "ACCOUNT_EXISTS";
      throw dup;
    }
    throw error;
  }

  return sanitizeUser(formatUserRecord(data));
}

export async function verifyUserCredentials(email, password) {
  const user = await findUserByEmail(email);
  if (!user) {
    return null;
  }

  const { passwordHash, passwordSalt } = user;
  try {
    const attempted = Buffer.from(createPasswordHash(password, passwordSalt).hash, "hex");
    const expected = Buffer.from(passwordHash, "hex");
    const matches =
      expected.length === attempted.length && crypto.timingSafeEqual(expected, attempted);
    return matches ? sanitizeUser(user) : null;
  } catch {
    return null;
  }
}

export function validateRegistrationInput({ name, email, password }) {
  const issues = {};

  if (!name || name.trim().length < 2) {
    issues.name = "Name must be at least 2 characters long.";
  }

  if (!email || !EMAIL_REGEX.test(email.trim().toLowerCase())) {
    issues.email = "A valid email address is required.";
  }

  if (!password || password.length < 8) {
    issues.password = "Password must be at least 8 characters long.";
  }

  return issues;
}

export function validateLoginInput({ email, password }) {
  const issues = {};

  if (!email || !EMAIL_REGEX.test(email.trim().toLowerCase())) {
    issues.email = "A valid email address is required.";
  }

  if (!password) {
    issues.password = "Password is required.";
  }

  return issues;
}

function formatUserRecord(record) {
  if (!record) return null;
  const formatted = {
    ...record,
    passwordHash: record.passwordHash ?? record.password_hash,
    passwordSalt: record.passwordSalt ?? record.password_salt,
    createdAt: record.createdAt ?? record.created_at,
  };
  delete formatted.password_hash;
  delete formatted.password_salt;
  delete formatted.created_at;
  return formatted;
}
