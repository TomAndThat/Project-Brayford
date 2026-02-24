/**
 * PATCH /api/messages/[messageId]/fix-spelling
 *
 * Uses Gemini AI to fix spelling and grammar errors in a message.
 *
 * Operates on the current display text (editedContent ?? content) so that
 * any moderator edits already in progress are preserved as the baseline.
 * Writes the corrected text back to editedContent, keeping the original
 * content field immutable for audit purposes.
 *
 * Requires events:moderate permission on the message's organisation.
 *
 * Response:
 * 200: { correctedContent: string }
 * 400: { error: string }
 * 401: { error: string }
 * 403: { error: string }
 * 404: { error: string }
 * 500: { error: string }
 */

import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import { authenticateRequest } from "@/lib/api-auth";
import { hasPermission, EVENTS_MODERATE } from "@brayford/core";
import type { OrganizationMember } from "@brayford/core";
import { GoogleGenerativeAI } from "@google/generative-ai";

type RouteParams = { params: Promise<{ messageId: string }> };

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY ?? "");

/**
 * Call Gemini to fix spelling and grammar errors.
 * Temperature is set low (0.1) to keep the model conservative — the goal is
 * correction, not creative rewriting.
 */
async function fixSpellingWithAI(text: string): Promise<string> {
  const model = genAI.getGenerativeModel({
    model: "gemini-2.5-flash",
    generationConfig: {
      temperature: 0.1,
      maxOutputTokens: 500,
    },
  });

  const prompt = `You are a professional subtitler correcting audience messages for a live broadcast. Correct the following message to clear, standard English as it would appear in professional subtitles.

RULES:
- Correct all spelling mistakes, including phonetic or informal spellings (e.g. "wot" → "what", "u" → "you", "fink" → "think", "cheez" → "cheese")
- Fix all grammatical errors
- Do NOT rephrase, restructure, or change the meaning — correct only, do not rewrite
- Add punctuation at the end if it is grammatically required (e.g. a question mark for a question), but do NOT add a full stop to a message that doesn't already end with one
- If the message is already correct standard English, return it exactly as-is

Message: "${text}"

Return only the corrected message, with no explanation or additional text.`;

  const result = await model.generateContent(prompt);
  const corrected = result.response.text().trim();

  if (!corrected) {
    throw new Error("AI returned an empty response");
  }

  return corrected;
}

export async function PATCH(
  request: NextRequest,
  { params }: RouteParams,
): Promise<NextResponse> {
  try {
    const { messageId } = await params;

    // 1. Authenticate
    const auth = await authenticateRequest(request);
    if (auth.error) return auth.error;
    const { uid } = auth;

    // 2. Fetch message
    const messageRef = adminDb.collection("messages").doc(messageId);
    const messageDoc = await messageRef.get();

    if (!messageDoc.exists) {
      return NextResponse.json(
        { error: "Message not found" },
        { status: 404 },
      );
    }

    const messageData = messageDoc.data()!;
    const { organizationId, content, editedContent } = messageData as {
      organizationId: string;
      content: string;
      editedContent: string | null;
    };

    if (!organizationId) {
      return NextResponse.json(
        { error: "Message is missing organisation context" },
        { status: 500 },
      );
    }

    // 3. Verify caller has events:moderate permission
    const memberQuery = await adminDb
      .collection("organizationMembers")
      .where("organizationId", "==", organizationId)
      .where("userId", "==", uid)
      .limit(1)
      .get();

    if (memberQuery.empty) {
      return NextResponse.json(
        { error: "You are not a member of this organisation" },
        { status: 403 },
      );
    }

    const memberData = memberQuery.docs[0]!.data();
    const actorMember: OrganizationMember = {
      organizationId: memberData.organizationId as string,
      userId: memberData.userId as string,
      role: memberData.role as OrganizationMember["role"],
      permissions: (memberData.permissions as string[]) ?? [],
      brandAccess: (memberData.brandAccess as string[]) ?? [],
    };

    if (!hasPermission(actorMember, EVENTS_MODERATE)) {
      return NextResponse.json(
        { error: "You do not have permission to moderate messages" },
        { status: 403 },
      );
    }

    // 4. Determine source text: use editedContent if present, otherwise the
    //    original content. This ensures the AI works on whatever the moderator
    //    currently sees on screen.
    const sourceText = editedContent ?? content;

    if (!sourceText) {
      return NextResponse.json(
        { error: "Message has no content to correct" },
        { status: 400 },
      );
    }

    // 5. Call Gemini
    const correctedContent = await fixSpellingWithAI(sourceText);

    // 6. Write back to editedContent (content is intentionally immutable)
    await messageRef.update({
      editedContent: correctedContent,
      updatedAt: FieldValue.serverTimestamp(),
    });

    return NextResponse.json({ correctedContent });
  } catch (err) {
    console.error("[messages/fix-spelling] Unexpected error", err);
    return NextResponse.json(
      { error: "Failed to fix spelling and grammar" },
      { status: 500 },
    );
  }
}
