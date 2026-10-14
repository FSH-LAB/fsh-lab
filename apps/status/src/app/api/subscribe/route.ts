const subscribers = new Set<string>();

export function getSubscribersCount(): number {
  return subscribers.size;
}

export function clearSubscribersForTesting(): void {
  subscribers.clear();
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const email = body?.email;

    if (
      !email ||
      typeof email !== "string" ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
    ) {
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
