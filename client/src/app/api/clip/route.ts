// app/api/clip/route.ts
import { NextRequest, NextResponse } from "next/server";
import { clipTweet } from "@/app/actions/clip";

export async function POST(req: NextRequest) {
  const { tweetUrl, start, end } = await req.json();
  const result = await clipTweet(tweetUrl, start, end);

  if (!result.success) {
    return NextResponse.json(result.error, { status: 500 });
  }

  return NextResponse.json({ downloadUrl: result.downloadUrl });
}
