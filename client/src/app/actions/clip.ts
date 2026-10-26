"use server";

export async function clipTweet(tweetUrl: string, start: string, end: string) {
  const backendUrl = process.env.CLIPX_BACKEND_URL || "http://localhost:9000";
  const response = await fetch(`${backendUrl.replace(/\/$/, "")}/clip`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ tweetUrl, start, end }),
  });

  if (!response.ok) {
    throw new Error("Video clipping failed");
  }
  const data = await response.json();

  return data;
}
