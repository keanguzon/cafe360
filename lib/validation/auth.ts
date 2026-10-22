const avatarMimeTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
const maxAvatarSize = 5 * 1024 * 1024;
const usernamePattern = /^[a-z0-9_]{3,24}$/;

type ValidationError = { error: string };
type AvatarInput = Pick<File, "size" | "type">;

export function normalizeUsername(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

export function validateCredentials(
  email: string,
  password: string,
): { email: string; password: string } | ValidationError {
  const normalizedEmail = email.trim().toLowerCase();

  if (!/^\S+@\S+\.\S+$/.test(normalizedEmail)) {
    return { error: "Enter a valid email address." };
  }

  if (password.length < 8) {
    return { error: "Password must be at least 8 characters." };
  }

  return { email: normalizedEmail, password };
}

export function validateSignUp(input: {
  displayName: string;
  email: string;
  password: string;
  username: string;
}):
  | { displayName: string; email: string; password: string; username: string }
  | ValidationError {
  const credentials = validateCredentials(input.email, input.password);

  if ("error" in credentials) {
    return credentials;
  }

  const displayName = input.displayName.trim();
  const username = normalizeUsername(input.username);

  if (!displayName) {
    return { error: "Display name is required." };
  }

  if (displayName.length > 80) {
    return { error: "Display name must be 80 characters or fewer." };
  }

  if (!usernamePattern.test(username)) {
    return { error: "Username must use 3-24 letters, numbers, or underscores." };
  }

  return { ...credentials, displayName, username };
}

export function validateProfile(input: {
  bio: string;
  displayName: string;
  username: string;
}): { bio: string; displayName: string; username: string } | ValidationError {
  const displayName = input.displayName.trim();
  const username = normalizeUsername(input.username);
  const bio = input.bio.trim();

  if (!displayName) {
    return { error: "Display name is required." };
  }

  if (displayName.length > 80) {
    return { error: "Display name must be 80 characters or fewer." };
  }

  if (!usernamePattern.test(username)) {
    return { error: "Username must use 3-24 letters, numbers, or underscores." };
  }

  if (bio.length > 240) {
    return { error: "Bio must be 240 characters or fewer." };
  }

  return { bio, displayName, username };
}

export function validateAvatar(input: AvatarInput): ValidationError | null {
  if (!avatarMimeTypes.has(input.type)) {
    return { error: "Choose a JPEG, PNG, or WebP image." };
  }

  if (input.size > maxAvatarSize) {
    return { error: "Choose an image smaller than 5 MB." };
  }

  return null;
}
