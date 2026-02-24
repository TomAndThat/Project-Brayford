/**
 * Postmark Connection & Send Test
 *
 * Verifies that Postmark credentials are correctly configured and sends
 * a plain-text test email to confirm end-to-end delivery.
 *
 * Usage (from repo root):
 *   node --env-file=functions/.env functions/scripts/test-email.mjs
 *
 * Required env vars (in functions/.env):
 *   POSTMARK_API_KEY    - Postmark server token
 *   POSTMARK_FROM_EMAIL - Verified sender address
 *   POSTMARK_FROM_NAME  - Sender display name (optional)
 *   EMAIL_DEV_MODE      - Must be 'false' to actually send
 */

import { ServerClient } from "postmark";

const TO_ADDRESS = "support@brayford.live";

// ── Validate environment ──────────────────────────────────────────────────

const apiKey = process.env.POSTMARK_API_KEY;
const fromEmail = process.env.POSTMARK_FROM_EMAIL;
const fromName = process.env.POSTMARK_FROM_NAME || "Project Brayford";
const devMode = process.env.EMAIL_DEV_MODE === "true";

if (!apiKey || apiKey === "your-postmark-server-token-here") {
  console.error(
    "✗  POSTMARK_API_KEY is not set. Add it to functions/.env and try again.",
  );
  process.exit(1);
}

if (!fromEmail) {
  console.error(
    "✗  POSTMARK_FROM_EMAIL is not set. Add it to functions/.env and try again.",
  );
  process.exit(1);
}

if (devMode) {
  console.warn("⚠  EMAIL_DEV_MODE=true — no email will be sent.");
  console.warn(
    "   Set EMAIL_DEV_MODE=false in functions/.env to send a real email.",
  );
  process.exit(0);
}

// ── Run tests ─────────────────────────────────────────────────────────────

const client = new ServerClient(apiKey);

console.log("\nProject Brayford — Postmark Test");
console.log("─".repeat(40));
console.log(`From : ${fromName} <${fromEmail}>`);
console.log(`To   : ${TO_ADDRESS}`);
console.log();

// Step 1: verify API key by fetching server details
process.stdout.write("1. Verifying API key … ");
try {
  const server = await client.getServer();
  console.log(`✓  Connected (server: "${server.Name}")`);
} catch (err) {
  console.error(`✗  Failed — ${err.message}`);
  console.error(
    "   Check that POSTMARK_API_KEY is a valid server token, not an account token.",
  );
  process.exit(1);
}

// Step 2: send a plain-text test email (no template required)
process.stdout.write("2. Sending test email … ");
try {
  const response = await client.sendEmail({
    From: `${fromName} <${fromEmail}>`,
    To: TO_ADDRESS,
    Subject: "Project Brayford – Postmark connection test",
    TextBody: [
      "This is an automated test email from Project Brayford.",
      "",
      "If you are reading this, the Postmark integration is working correctly.",
      "",
      "---",
      "Sent via functions/scripts/test-email.mjs",
    ].join("\n"),
    HtmlBody: `
      <p>This is an automated test email from <strong>Project Brayford</strong>.</p>
      <p>If you are reading this, the Postmark integration is working correctly.</p>
      <hr>
      <p style="color:#888;font-size:12px;">Sent via functions/scripts/test-email.mjs</p>
    `.trim(),
    MessageStream: "outbound",
  });

  console.log(`✓  Sent (Message-ID: ${response.MessageID})`);
  console.log();
  console.log(`✓  All checks passed. Check ${TO_ADDRESS} for the test email.`);
} catch (err) {
  console.error(`✗  Send failed — ${err.message}`);
  if (err.code === 406) {
    console.error(
      "   Hint: the sender address may not be verified in your Postmark account.",
    );
  }
  process.exit(1);
}
