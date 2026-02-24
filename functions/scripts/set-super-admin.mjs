/**
 * Set Super Admin Claim
 *
 * Grants or revokes the `superAdmin: true` Firebase Auth custom claim for a
 * given user account. This claim gates access to the Project Brayford Admin
 * Portal — only accounts with this claim can sign in.
 *
 * Usage (from repo root):
 *   node functions/scripts/set-super-admin.mjs --email user@example.com
 *   node functions/scripts/set-super-admin.mjs --email user@example.com --revoke
 *
 * Authentication:
 *   The script uses Application Default Credentials (ADC). Before running,
 *   authenticate with one of:
 *     a) gcloud auth application-default login
 *     b) Set GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json
 *
 * Required env var:
 *   GCLOUD_PROJECT  (or FIREBASE_PROJECT_ID) — the Firebase project ID.
 *   These are typically already set in your shell after running `firebase use`.
 */

import { initializeApp, cert, applicationDefault } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";

// ── Parse arguments ───────────────────────────────────────────────────────

const args = process.argv.slice(2);
const emailIndex = args.indexOf("--email");
const revoke = args.includes("--revoke");

if (emailIndex === -1 || !args[emailIndex + 1]) {
  console.error(
    "Usage: node functions/scripts/set-super-admin.mjs --email <email> [--revoke]",
  );
  process.exit(1);
}

const email = args[emailIndex + 1].toLowerCase().trim();
const action = revoke ? "revoke" : "grant";

// ── Initialise Firebase Admin ─────────────────────────────────────────────

const projectId = process.env.GCLOUD_PROJECT ?? process.env.FIREBASE_PROJECT_ID;

if (!projectId) {
  console.error(
    "\n✗  Could not determine Firebase project ID.\n" +
      "   Set GCLOUD_PROJECT or FIREBASE_PROJECT_ID, or run `firebase use <project>`.\n",
  );
  process.exit(1);
}

const serviceAccountPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;

try {
  initializeApp({
    credential: serviceAccountPath
      ? cert(serviceAccountPath)
      : applicationDefault(),
    projectId,
  });
} catch (err) {
  console.error(
    "\n✗  Firebase Admin initialisation failed.\n" +
      "   Ensure you are authenticated:\n" +
      "     gcloud auth application-default login\n" +
      `   Error: ${err.message}\n`,
  );
  process.exit(1);
}

// ── Set / revoke claim ────────────────────────────────────────────────────

async function run() {
  const adminAuth = getAuth();

  let userRecord;
  try {
    userRecord = await adminAuth.getUserByEmail(email);
  } catch (err) {
    if (err.code === "auth/user-not-found") {
      console.error(
        `\n✗  No Firebase Auth account found for ${email}.\n` +
          "   The user must sign in with Google at least once before being granted access.\n",
      );
    } else {
      console.error(`\n✗  Failed to look up user: ${err.message}\n`);
    }
    process.exit(1);
  }

  const currentClaims = userRecord.customClaims ?? {};
  const newClaims = revoke
    ? { ...currentClaims, superAdmin: false }
    : { ...currentClaims, superAdmin: true };

  await adminAuth.setCustomUserClaims(userRecord.uid, newClaims);

  const verb = revoke ? "revoked from" : "granted to";
  console.log(
    `\n✓  superAdmin claim ${verb} ${email} (uid: ${userRecord.uid})\n`,
  );

  if (!revoke) {
    console.log(
      "  The user must sign out and sign back in (or refresh their token)\n" +
        "  for the new claim to take effect.\n",
    );
  }
}

run().catch((err) => {
  console.error(`\n✗  Unexpected error: ${err.message}\n`);
  process.exit(1);
});
