const enabled = process.env.RIFTCORE_FIX_TELEGRAM_PROVIDER === "1";

if (!enabled) {
  console.log("[telegram-provider-fix] skipped");
  process.exit(0);
}

const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const adminKey = process.env.RIFTCORE_SUPABASE_ADMIN_KEY;

if (!baseUrl || !adminKey) {
  throw new Error("Missing Supabase URL or temporary admin key");
}

async function authAdmin(path, init = {}) {
  const response = await fetch(baseUrl.replace(/\/$/, "") + path, {
    ...init,
    headers: {
      apikey: adminKey,
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
  });

  const raw = await response.text();
  let data = null;
  try {
    data = raw ? JSON.parse(raw) : null;
  } catch {
    data = raw;
  }

  if (!response.ok) {
    throw new Error(
      `${init.method || "GET"} ${path} -> ${response.status}: ${typeof data === "string" ? data : JSON.stringify(data)}`,
    );
  }

  return data;
}

function providerList(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.providers)) return payload.providers;
  if (Array.isArray(payload?.data)) return payload.data;
  return [];
}

const before = providerList(
  await authAdmin("/auth/v1/admin/custom-providers"),
);
const telegram = before.find(
  (provider) => provider?.identifier === "custom:telegram",
);

if (!telegram) {
  throw new Error(
    "custom:telegram was not found. Present providers: " +
      before.map((provider) => provider?.identifier).filter(Boolean).join(", "),
  );
}

console.log(
  "[telegram-provider-fix] found",
  JSON.stringify({
    identifier: telegram.identifier,
    provider_type: telegram.provider_type,
    email_optional: telegram.email_optional === true,
    issuer: telegram.issuer || null,
  }),
);

await authAdmin("/auth/v1/admin/custom-providers/custom:telegram", {
  method: "PUT",
  body: JSON.stringify({ email_optional: true }),
});

const after = providerList(
  await authAdmin("/auth/v1/admin/custom-providers"),
);
const verified = after.find(
  (provider) => provider?.identifier === "custom:telegram",
);

if (!verified || verified.email_optional !== true) {
  throw new Error("custom:telegram did not persist email_optional=true");
}

console.log(
  "[telegram-provider-fix] verified",
  JSON.stringify({
    identifier: verified.identifier,
    provider_type: verified.provider_type,
    email_optional: verified.email_optional,
    issuer: verified.issuer || null,
  }),
);
