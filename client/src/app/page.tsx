

"use client";
import { useState } from "react";
import axios from "axios";
import Link from "next/link";
import Image from 'next/image';

export default function Home() {
  const [tweetUrl, setTweetUrl] = useState<string>("");
  const [start, setStart] = useState<string>("");
  const [end, setEnd] = useState<string>("");
  const [error, setError] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);
  const [timeError, setTimeError] = useState<string>("");
  const [downloadUrl, setDownloadUrl] = useState<string>("");

  const validateTimeFormat = (time: string): boolean => {
    if (!time.trim()) return true; // Optional
    const timeRegex = /^([0-1]?[0-9]|2[0-3]):([0-5]?[0-9]):([0-5]?[0-9])$/;
    return timeRegex.test(time);
  };

  const isFormValid = (): boolean => {
    if (!tweetUrl.trim()) return false;
    if (!tweetUrl.includes("twitter.com") && !tweetUrl.includes("x.com")) return false;
    if (start.trim() && !validateTimeFormat(start)) return false;
    if (end.trim() && !validateTimeFormat(end)) return false;
    return true;
  };

  const handleTimeChange = (value: string, setter: (value: string) => void, field: string): void => {
    setter(value);
    if (value.trim() && !validateTimeFormat(value)) {
      setTimeError(`${field} must be in HH:MM:SS format (e.g., 00:01:30)`);
    } else {
      setTimeError("");
    }
  };

  const handleClip = async () => {
    if (!tweetUrl.trim()) {
      setError("Please enter a Twitter URL");
      return;
    }

    if (!tweetUrl.includes("twitter.com") && !tweetUrl.includes("x.com")) {
      setError("Please enter a valid Twitter/X URL");
      return;
    }

    setLoading(true);
    setError("");
    setDownloadUrl("");

      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";


    try {
      const response = await axios.post(`${apiUrl}/clip`, {
        tweetUrl: tweetUrl.trim(),
        start: start.trim(),
        end: end.trim(),
      });
      const { downloadUrl } = response.data;
      setDownloadUrl(downloadUrl);

    } catch (err) {
      console.error("Error:", err);
      if (axios.isAxiosError(err)) {
        if (err.response?.data) {
          setError(typeof err.response.data === 'string' ? err.response.data : 'An error occurred');
        } else if (err.message) {
          setError(`Error: ${err.message}`);
        } else {
          setError("Network error occurred");
        }
      } else {
        setError("An unexpected error occurred");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setTweetUrl("");
    setStart("");
    setEnd("");
    setDownloadUrl("");
    setError("");
    setTimeError("");
  };

  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 flex flex-col items-center justify-center px-4">
      <div className="flex flex-col items-center mb-12">
        <div className="flex items-center text-7xl md:text-8xl font-black mb-6 text-center">
          <Image
            className="rounded-full mr-4"
            src="/favicon.png"
            width={100}
            height={100}
            alt="ClipX Logo"
          />
          <span className="bg-gradient-to-r from-blue-400 via-purple-500 to-cyan-400 bg-clip-text text-transparent">
            ClipX
          </span>
        </div>
        <div className="text-xl md:text-2xl text-slate-400 text-center max-w-2xl leading-relaxed">
          Download any X/Twitter video in just 1 click!
          <span className="block text-slate-500 text-lg mt-2">
            No shady Ads, No paywall!
          </span>
        </div>
      </div>

      <div className="w-full max-w-lg">
        <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 p-8 rounded-2xl shadow-2xl">
          <div className="mb-6">
            <label className="block text-slate-300 text-sm font-medium mb-2">
              Twitter/X URL
            </label>
            <input
              type="text"
              placeholder="https://twitter.com/username/status/..."
              value={tweetUrl}
              onChange={(e) => setTweetUrl(e.target.value)}
              className="w-full p-4 rounded-xl bg-slate-900/70 border border-slate-600/50 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all duration-200"
            />
          </div>

          <div className="grid grid-cols-2 gap-4 mb-8">
            <div>
              <label className="block text-slate-300 text-sm font-medium mb-2">
                Start Time
              </label>
              <input
                type="text"
                placeholder="00:00:05"
                value={start}
                onChange={(e) => handleTimeChange(e.target.value, setStart, "Start time")}
                className="w-full p-4 rounded-xl bg-slate-900/70 border border-slate-600/50 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all duration-200"
              />
            </div>
            <div>
              <label className="block text-slate-300 text-sm font-medium mb-2">
                End Time
              </label>
              <input
                type="text"
                placeholder="00:00:15"
                value={end}
                onChange={(e) => handleTimeChange(e.target.value, setEnd, "End time")}
                className="w-full p-4 rounded-xl bg-slate-900/70 border border-slate-600/50 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all duration-200"
              />
            </div>
          </div>

          {!downloadUrl ? (
            <button
              onClick={handleClip}
              disabled={loading || !isFormValid()}
              className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 disabled:from-slate-600 disabled:to-slate-700 disabled:cursor-not-allowed text-white font-semibold py-4 px-6 rounded-xl transition-all duration-200 transform hover:scale-[1.02] disabled:hover:scale-100 shadow-lg hover:shadow-blue-500/25"
            >
              {loading ? (
                <div className="flex items-center justify-center">
                  <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent mr-2"></div>
                  Processing...
                </div>
              ) : (
                "Generate Clip"
              )}
            </button>
          ) : (
            <div className="space-y-4">
              <button
                onClick={handleReset}
                className="w-full bg-slate-600 hover:bg-slate-700 text-white font-semibold py-3 px-6 rounded-xl transition-all duration-200"
              >
                Create Another Clip
              </button>
            </div>
          )}

          {timeError && (
            <div className="mt-4 p-4 bg-yellow-900/20 border border-yellow-500/30 rounded-xl">
              <p className="text-yellow-400 text-sm">{timeError}</p>
            </div>
          )}

          {error && (
            <div className="mt-4 p-4 bg-red-900/20 border border-red-500/30 rounded-xl">
              <p className="text-red-400 text-sm">{error}</p>
            </div>
          )}

          {/* Download button at the end */}
          {downloadUrl && (
            <div className="mt-6 text-center">
              <a
                href={downloadUrl}
                download
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block bg-green-600 hover:bg-green-700 text-white font-semibold py-3 px-6 rounded-xl transition-all duration-200 shadow-md"
              >
                Download Your Clip
              </a>
            </div>
          )}
        </div>

        <div className="text-center mt-8">
          <p className="text-slate-500 text-md mb-4">
            Fast and completely free to use
          </p>
          <p className="text-slate-200 text-md">
            Created by - <Link href="http://localhost:3000" target="_blank" rel="noopener noreferrer" className="underline hover:text-blue-400">Krishna</Link>
          </p>
          <p className="text-slate-200 text-md">
            Follow at - <Link href="http://localhost:3000" target="_blank" rel="noopener noreferrer" className="underline hover:text-blue-400">ClipX</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
