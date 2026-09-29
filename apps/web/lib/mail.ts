type MailInput = {
  to: string[];
  subject: string;
  eyebrow: string;
  title: string;
  lines: string[];
  cta?: { label: string; href: string };
};

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[char] ?? char);
}

export async function sendRiftcoreMail(input: MailInput): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn("[riftcore-mail] RESEND_API_KEY missing; notification skipped");
    return;
  }

  const uniqueTo = [...new Set(input.to.map((value) => value.trim().toLowerCase()).filter(Boolean))];
  if (uniqueTo.length === 0) return;

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://riftcore-five.vercel.app";
  const from = process.env.RIFTCORE_MAIL_FROM ?? "Riftcore <auth@recharza.in>";
  const lines = input.lines.map((line) => `<p style="margin:0 0 12px;color:#9ba7aa;line-height:1.65">${escapeHtml(line)}</p>`).join("");
  const cta = input.cta
    ? `<a href="${escapeHtml(input.cta.href)}" style="display:inline-block;margin-top:14px;background:#b5ff63;color:#071006;text-decoration:none;padding:13px 17px;font-weight:800;font-size:13px">${escapeHtml(input.cta.label)} →</a>`
    : "";

  const html = `<!doctype html><html><body style="margin:0;background:#07090a;font-family:Arial,sans-serif;color:#f4f7f5">
    <div style="max-width:620px;margin:0 auto;padding:38px 22px">
      <div style="border:1px solid #273033;background:#090c0d;padding:28px">
        <div style="color:#b5ff63;font-size:11px;font-weight:800;letter-spacing:.16em">${escapeHtml(input.eyebrow)}</div>
        <h1 style="margin:14px 0 22px;font-size:36px;line-height:1;letter-spacing:-.04em">${escapeHtml(input.title)}</h1>
        ${lines}
        ${cta}
      </div>
      <p style="color:#556064;font-size:11px;margin:18px 0 0">Riftcore · tournament infrastructure · <a href="${appUrl}" style="color:#7d898d">open platform</a></p>
    </div>
  </body></html>`;

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: uniqueTo,
      subject: input.subject,
      html,
    }),
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Resend delivery failed (${response.status}): ${detail.slice(0, 300)}`);
  }
}
