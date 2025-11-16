import {
  getSupabaseAnonClient,
  getSupabaseServiceClient,
} from "@/lib/supabase";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const USERNAME_REGEX = /^[a-zA-Z0-9_]+$/;
const PHONE_REGEX = /^\+[1-9]\d{1,14}$/;

export function sanitizeUser(user) {
  if (!user) return null;
  const metadata = user.user_metadata ?? {};
  const firstName = metadata.firstName ?? metadata.given_name ?? null;
  const lastName = metadata.lastName ?? metadata.family_name ?? null;
  const username = metadata.username ?? null;
  const phone = user.phone ?? metadata.phone ?? null;

  const composedName =
    metadata.name ??
    metadata.full_name ??
    ([firstName, lastName].filter(Boolean).join(" ") || null);

  return {
    id: user.id,
    email: user.email,
    username,
    firstName,
    lastName,
    phone,
    name: composedName,
    createdAt: user.created_at ?? null,
    emailConfirmedAt: user.email_confirmed_at ?? null,
    lastSignInAt: user.last_sign_in_at ?? null,
    appMetadata: user.app_metadata ?? {},
    userMetadata: metadata,
  };
}

export function validateRegistrationInput({
  firstName,
  lastName,
  username,
  email,
  phone,
  password,
}) {
  const issues = {};

  if (!firstName || firstName.trim().length < 2) {
    issues.firstName = "First name must be at least 2 characters long.";
  }

  if (!lastName || lastName.trim().length < 2) {
    issues.lastName = "Last name must be at least 2 characters long.";
  }

  if (!username || username.trim().length < 3) {
    issues.username = "Username must be at least 3 characters long.";
  } else if (!USERNAME_REGEX.test(username.trim())) {
    issues.username =
      "Username can only contain letters, numbers, and underscores.";
  }

  if (!email || !EMAIL_REGEX.test(email.trim().toLowerCase())) {
    issues.email = "A valid email address is required.";
  }

  const normalizedPhone = phone?.trim();
  if (normalizedPhone && !PHONE_REGEX.test(normalizedPhone)) {
    issues.phone = "Phone number must use international E.164 format (e.g. +12065550123).";
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

export async function createUser({
  firstName,
  lastName,
  username,
  email,
  phone,
  password,
}) {
  const supabase = getSupabaseServiceClient();
  const normalizedEmail = email.trim().toLowerCase();
  const trimmedFirst = firstName.trim();
  const trimmedLast = lastName.trim();
  const trimmedUsername = username.trim();
  const normalizedPhone = phone?.trim() ?? null;

  const payload = {
    email: normalizedEmail,
    password,
    email_confirm: true,
    user_metadata: {
      firstName: trimmedFirst,
      lastName: trimmedLast,
      username: trimmedUsername,
      phone: normalizedPhone,
      name: `${trimmedFirst} ${trimmedLast}`.trim(),
    },
  };

  if (normalizedPhone) {
    payload.phone = normalizedPhone;
  }

  const { data, error } = await supabase.auth.admin.createUser(payload);

  if (error) {
    if (
      error.status === 422 ||
      error.message?.toLowerCase().includes("already registered")
    ) {
      const dup = new Error("Account already exists for this email");
      dup.code = "ACCOUNT_EXISTS";
      throw dup;
    }
    throw error;
  }

  return sanitizeUser(data.user);
}

export async function verifyUserCredentials(email, password) {
  const supabase = getSupabaseAnonClient();
  const normalizedEmail = email.trim().toLowerCase();

  const { data, error } = await supabase.auth.signInWithPassword({
    email: normalizedEmail,
    password,
  });

  if (error) {
    if (
      error.status === 400 ||
      error.status === 422 ||
      error.message?.toLowerCase().includes("invalid login credentials")
    ) {
      return null;
    }
    throw error;
  }

  return {
    user: sanitizeUser(data.user),
    session: {
      accessToken: data.session?.access_token ?? null,
      refreshToken: data.session?.refresh_token ?? null,
      expiresAt: data.session?.expires_at ?? null,
      tokenType: data.session?.token_type ?? "bearer",
    },
  };
}

export async function getUserById(userId) {
  if (!userId) return null;
  const supabase = getSupabaseServiceClient();
  
  const { data, error } = await supabase.auth.admin.getUserById(userId);
  
  if (error) {
    if (error.status === 404 || error.message?.toLowerCase().includes("not found")) {
      return null;
    }
    throw error;
  }
  
  return sanitizeUser(data.user);
}

export async function getAllUsers(options = {}) {
  const supabase = getSupabaseServiceClient();
  const { page = 1, perPage = 1000 } = options;
  
  try {
    const { data, error } = await supabase.auth.admin.listUsers({
      page,
      perPage,
    });
    
    if (error) {
      throw error;
    }
    
    return {
      users: (data?.users || []).map(user => sanitizeUser(user)),
      total: data?.total ?? data?.users?.length ?? 0,
    };
  } catch (error) {
    console.error("Error in getAllUsers:", error);
    throw error;
  }
}