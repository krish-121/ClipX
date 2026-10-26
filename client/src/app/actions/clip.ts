// app/actions/clip.ts
"use server";

import axios from "axios";

export async function clipTweet(tweetUrl: string, start: string, end: string) {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

  try {
    const response = await axios.post(`${apiUrl}/clip`, {
      tweetUrl: tweetUrl.trim(),
      start: start.trim(),
      end: end.trim(),
    });

    const { downloadUrl } = response.data;
    return { success: true, downloadUrl };
  } catch (err: any) {
    console.error("Server Action Error:", err);
    return {
      success: false,
      error:
        err.response?.data || err.message || "An error occurred during clipping",
    };
  }
}
