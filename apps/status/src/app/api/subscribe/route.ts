const subscribers = new Set<string>();

export function getSubscribersCount(): number {
  return subscribers.size;
}

export function clearSubscribersForTesting(): void {
  subscribers.clear();
}

/**
 * Validates an email address linearly without polynomial regular expression backtracking (ReDoS safe).
 * Enforces RFC 5321 length limits (max 254 chars, max 64 char local-part) and domain label structure.
 */
export function isValidEmail(rawEmail: unknown): rawEmail is string {
  if (typeof rawEmail !== "string") return false;

  const email = rawEmail.trim();
  // RFC 5321: Maximum length of an email address is 254 characters
  if (email.length < 5 || email.length > 254) {
    return false;
  }

  // Enforce single '@' symbol separating local and domain parts
  const atIndex = email.indexOf("@");
  if (
    atIndex <= 0 ||
    atIndex !== email.lastIndexOf("@") ||
    atIndex === email.length - 1
  ) {
    return false;
  }

  const localPart = email.slice(0, atIndex);
  const domainPart = email.slice(atIndex + 1);

  // Local part cannot exceed 64 characters and cannot contain whitespace
  if (localPart.length > 64 || /\s/.test(localPart)) {
    return false;
  }

  // Domain must contain valid labels separated by dots (at least one dot)
  const domainLabels = domainPart.split(".");
  if (domainLabels.length < 2) {
    return false;
  }

  for (const label of domainLabels) {
    // Each label must be 1-63 chars, alphanumeric or hyphen, and not start/end with a hyphen
    if (
      !label ||
      label.length > 63 ||
      !/^[a-zA-Z0-9-]+$/.test(label) ||
      label.startsWith("-") ||
      label.endsWith("-")
    ) {
      return false;
    }
  }

  return true;
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const email = body?.email;

    if (!isValidEmail(email)) {
      return Response.json(
        { error: "Invalid email address format." },
        { status: 400 },
      );
    }

    const normalized = email.toLowerCase().trim();
    subscribers.add(normalized);

    return Response.json({
      success: true,
      message: "Subscription registered for status incident alerts.",
      email: normalized,
    });
  } catch {
    return Response.json({ error: "Invalid JSON payload." }, { status: 400 });
  }
}
