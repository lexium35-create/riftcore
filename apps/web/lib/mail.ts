import { RIFTCORE_COMMUNITY } from "@/lib/community";

type MailFact = {
  label: string;
  value: string;
};

type MailInput = {
  to: string[];
  subject: string;
  eyebrow: string;
  title: string;
  intro?: string;
  lines?: string[];
  facts?: MailFact[];
  nextSteps?: string[];
  status?: string;
  cta?: { label: string; href: string };
  secondaryCta?: { label: string; href: string };
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

function plainText(input: MailInput): string {
  const blocks = [
    input.eyebrow,
    input.title,
    input.intro ?? "",
    ...(input.lines ?? []),
    ...(input.facts ?? []).map((fact) => `${fact.label}: ${fact.value}`),
    ...(input.nextSteps ?? []).map((step, index) => `${index + 1}. ${step}`),
    input.cta ? `${input.cta.label}: ${input.cta.href}` : "",
    input.secondaryCta ? `${input.secondaryCta.label}: ${input.secondaryCta.href}` : "",
    `Telegram: ${RIFTCORE_COMMUNITY.telegramGroup}`,
    `Discord: ${RIFTCORE_COMMUNITY.discord}`,
  ].filter(Boolean);

  return blocks.join("\n\n");
}

export async function sendRiftcoreMail(input: MailInput): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn("[riftcore-mail] RESEND_API_KEY missing; notification skipped");
    return;
  }

  const uniqueTo = [...new Set(input.to.map((value) => value.trim().toLowerCase()).filter(Boolean))];
  if (uniqueTo.length === 0) return;

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? RIFTCORE_COMMUNITY.site;
  const from = process.env.RIFTCORE_MAIL_FROM ?? "Riftcore <auth@recharza.in>";
  const bodyLines = (input.lines ?? [])
    .map((line) => `<p style="margin:0 0 12px;color:#9ba7aa;line-height:1.65">${escapeHtml(line)}</p>`)
    .join("");

  const facts = input.facts?.length
    ? `<div style="margin:24px 0 0;border-top:1px solid #253034;border-left:1px solid #253034">
        ${input.facts.map((fact) => `
          <div style="display:flex;justify-content:space-between;gap:18px;padding:12px 14px;border-right:1px solid #253034;border-bottom:1px solid #253034">
            <span style="color:#687477;font-size:11px;font-weight:700;letter-spacing:.08em">${escapeHtml(fact.label.toUpperCase())}</span>
            <strong style="color:#eef2ef;font-size:12px;text-align:right">${escapeHtml(fact.value)}</strong>
          </div>`).join("")}
      </div>`
    : "";

  const nextSteps = input.nextSteps?.length
    ? `<div style="margin-top:26px">
        <div style="color:#b5ff63;font-size:10px;font-weight:800;letter-spacing:.14em">WHAT HAPPENS NEXT</div>
        <ol style="margin:14px 0 0;padding-left:20px;color:#9ba7aa;line-height:1.75;font-size:13px">
          ${input.nextSteps.map((step) => `<li style="padding-left:4px">${escapeHtml(step)}</li>`).join("")}
        </ol>
      </div>`
    : "";

  const ctas = input.cta || input.secondaryCta
    ? `<div style="margin-top:26px;display:flex;flex-wrap:wrap;gap:9px">
        ${input.cta ? `<a href="${escapeHtml(input.cta.href)}" style="display:inline-block;background:#b5ff63;color:#071006;text-decoration:none;padding:13px 17px;font-weight:800;font-size:13px">${escapeHtml(input.cta.label)} →</a>` : ""}
        ${input.secondaryCta ? `<a href="${escapeHtml(input.secondaryCta.href)}" style="display:inline-block;border:1px solid #334044;color:#dce4df;text-decoration:none;padding:12px 16px;font-weight:800;font-size:13px">${escapeHtml(input.secondaryCta.label)} ↗</a>` : ""}
      </div>`
    : "";

  const status = input.status
    ? `<span style="display:inline-block;margin-top:16px;border:1px solid #526339;color:#b5ff63;padding:6px 9px;font-size:10px;font-weight:800;letter-spacing:.1em">${escapeHtml(input.status.toUpperCase())}</span>`
    : "";

  const html = `<!doctype html>
  <html>
    <body style="margin:0;background:#07090a;font-family:Arial,Helvetica,sans-serif;color:#f4f7f5">
      <div style="display:none;max-height:0;overflow:hidden;color:transparent">${escapeHtml(input.intro ?? input.subject)}</div>
      <div style="max-width:650px;margin:0 auto;padding:34px 18px">
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:14px">
          <span style="display:inline-block;border:1px solid #b5ff63;color:#b5ff63;padding:7px 9px;font-size:10px;font-weight:900;letter-spacing:.14em">R//C</span>
          <span style="color:#6f7b7f;font-size:10px;font-weight:800;letter-spacing:.15em">RIFTCORE</span>
        </div>

        <div style="border:1px solid #273033;background:#090c0d;padding:30px">
          <div style="color:#b5ff63;font-size:10px;font-weight:800;letter-spacing:.16em">${escapeHtml(input.eyebrow)}</div>
          ${status}
          <h1 style="margin:15px 0 18px;font-size:38px;line-height:1;letter-spacing:-.045em">${escapeHtml(input.title)}</h1>
          ${input.intro ? `<p style="margin:0 0 18px;color:#c6cfcc;font-size:15px;line-height:1.6">${escapeHtml(input.intro)}</p>` : ""}
          ${bodyLines}
          ${facts}
          ${nextSteps}
          ${ctas}
        </div>

        <div style="margin-top:12px;border:1px solid #1f282b;background:#080b0c;padding:18px">
          <div style="color:#657174;font-size:9px;font-weight:800;letter-spacing:.14em;margin-bottom:10px">OFFICIAL RIFTCORE COMMUNITY</div>
          <div style="font-size:12px;line-height:1.8">
            <a href="${RIFTCORE_COMMUNITY.telegramGroup}" style="color:#b5ff63;text-decoration:none">Telegram group ↗</a>
            <span style="color:#394245"> · </span>
            <a href="${RIFTCORE_COMMUNITY.discord}" style="color:#b5ff63;text-decoration:none">Discord server ↗</a>
            <span style="color:#394245"> · </span>
            <a href="${appUrl}/community" style="color:#b5ff63;text-decoration:none">Community hub ↗</a>
          </div>
        </div>

        <p style="color:#4e595c;font-size:10px;line-height:1.6;margin:16px 2px 0">
          This message was sent because your email is connected to a Riftcore account
          or tournament roster. Official tournament links always resolve to Riftcore
          or the community channels above.
        </p>
      </div>
    </body>
  </html>`;

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
      text: plainText(input),
    }),
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Resend delivery failed (${response.status}): ${detail.slice(0, 300)}`);
  }
}
