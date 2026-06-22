import axios from "axios";
import crypto from "crypto";

const parseWebhookUrls = (): string[] => {
  const raw = process.env.COMMUNITY_WEBHOOK_URLS || "";
  return raw
    .split(",")
    .map((url) => url.trim())
    .filter(Boolean);
};

const signPayload = (payload: string): string | undefined => {
  const secret = process.env.COMMUNITY_WEBHOOK_SECRET;
  if (!secret) return undefined;
  return `sha256=${crypto.createHmac("sha256", secret).update(payload).digest("hex")}`;
};

export const dispatchCommunityWebhook = async (
  event: string,
  payload: unknown
): Promise<void> => {
  const urls = parseWebhookUrls();
  if (urls.length === 0) return;

  const body = {
    event,
    payload,
    occurredAt: new Date().toISOString(),
  };
  const serialized = JSON.stringify(body);
  const signature = signPayload(serialized);

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "X-Community-Event": event,
  };
  if (signature) headers["X-Community-Signature"] = signature;

  const results = await Promise.allSettled(
    urls.map((url) => axios.post(url, body, { headers, timeout: 3500 }))
  );

  results.forEach((result, index) => {
    if (result.status === "rejected") {
      console.error(
        `Community webhook failed (${urls[index]}):`,
        result.reason?.message || result.reason
      );
    }
  });
};
