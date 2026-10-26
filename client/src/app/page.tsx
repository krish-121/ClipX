"use client";

import { useState } from "react";
import axios from "axios";

export default function Home() {
  const [tweetUrl, setTweetUrl] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [downloadPath, setDownloadPath] = useState("");

  const handleClip = async () => {
    if (!tweetUrl || !start || !end) {
      alert("Please fill in all fields");
      return;
    }

    try {
      const response = await axios.post("/api/clip", {
        tweetUrl: tweetUrl.trim(),
        start: start.trim(),
        end: end.trim(),
      });

      const path = response.data.downloadPath; // Example: "/download/clipped_1234.mp4"
      setDownloadPath(path);

      setTweetUrl("");
      setStart("");
      setEnd("");
    } catch (error) {
      console.error("Error clipping:", error);
      alert("Failed to clip video");
    }
  };

  return (
    <main className="min-h-screen bg-gray-950 text-white flex flex-col items-center justify-center px-4 py-10">
      <h1 className="text-4xl font-bold mb-8">ClipX - Twitter Video Clipper</h1>

      <div className="max-w-md w-full space-y-4">
        <input
          type="text"
          placeholder="Enter tweet URL"
          value={tweetUrl}
          onChange={(e) => setTweetUrl(e.target.value)}
          className="w-full px-4 py-2 rounded bg-gray-800 border border-gray-700"
        />
        <div className="flex gap-4">
          <input
            type="text"
            placeholder="Start time (e.g. 00:00:05)"
            value={start}
            onChange={(e) => setStart(e.target.value)}
            className="w-1/2 px-4 py-2 rounded bg-gray-800 border border-gray-700"
          />
          <input
            type="text"
            placeholder="End time (e.g. 00:00:15)"
            value={end}
            onChange={(e) => setEnd(e.target.value)}
            className="w-1/2 px-4 py-2 rounded bg-gray-800 border border-gray-700"
          />
        </div>
        <button
          onClick={handleClip}
          className="w-full bg-blue-600 hover:bg-blue-700 py-2 rounded font-semibold transition-all duration-200"
        >
          Clip Video
        </button>

        {downloadPath && (
          <div className="text-center mt-6">
            <a
              href={`${process.env.NEXT_PUBLIC_BACKEND_URL}/download/${downloadPath.split("/").pop()}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block bg-green-600 hover:bg-green-700 text-white font-semibold py-3 px-6 rounded-xl transition-all duration-200 shadow-md"
            >
              🎬 Download Your Clip
            </a>
          </div>
        )}
      </div>
    </main>
  );
}
