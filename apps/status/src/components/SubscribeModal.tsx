"use client";

import { useState } from "react";

interface SubscribeModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SubscribeModal({ isOpen, onClose }: SubscribeModalProps) {
  const [activeTab, setActiveTab] = useState<"email" | "rss" | "api">("email");
  const [email, setEmail] = useState("");
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [copiedType, setCopiedType] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleCopy = (text: string, type: string) => {
    navigator.clipboard.writeText(text);
    setCopiedType(type);
    setTimeout(() => setCopiedType(null), 2000);
  };

  const handleEmailSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    setIsSubmitted(true);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl relative space-y-5">
        {/* Close button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 text-slate-400 hover:text-slate-200 p-1 rounded-lg transition-colors"
          aria-label="Close modal"
        >
          <svg
            className="w-5 h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>

        <div>
          <h3 className="text-lg font-bold text-white tracking-tight">
            Subscribe to Status Updates
          </h3>
          <p className="text-xs text-slate-400 mt-1">
            Get instant notifications whenever incidents or maintenance affect
            FSH Lab apps.
          </p>
        </div>

        {/* Tab switcher */}
        <div className="flex border-b border-slate-800 gap-4 text-xs font-medium">
          <button
            type="button"
            onClick={() => setActiveTab("email")}
            className={`pb-2.5 transition-colors border-b-2 -mb-px ${
              activeTab === "email"
                ? "border-emerald-500 text-emerald-400"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            Email
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("rss")}
            className={`pb-2.5 transition-colors border-b-2 -mb-px ${
              activeTab === "rss"
                ? "border-emerald-500 text-emerald-400"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            Atom / RSS Feed
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("api")}
            className={`pb-2.5 transition-colors border-b-2 -mb-px ${
              activeTab === "api"
                ? "border-emerald-500 text-emerald-400"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            REST API
          </button>
        </div>

        {/* Tab 1: Email */}
        {activeTab === "email" && (
          <div className="space-y-4">
            {isSubmitted ? (
              <div className="bg-emerald-950/30 border border-emerald-500/30 rounded-xl p-4 text-center space-y-2">
                <div className="w-8 h-8 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto text-sm">
                  ✓
                </div>
                <h4 className="font-semibold text-emerald-300 text-sm">
                  Subscription Confirmed
                </h4>
                <p className="text-xs text-slate-300">
                  Updates will be sent to{" "}
                  <strong className="text-white">{email}</strong> when incidents
                  occur.
                </p>
              </div>
            ) : (
              <form onSubmit={handleEmailSubmit} className="space-y-3">
                <label
                  htmlFor="email-input"
                  className="block text-xs font-medium text-slate-300"
                >
                  Email address
                </label>
                <input
                  id="email-input"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  required
                  className="w-full bg-slate-950 border border-slate-700/80 rounded-lg px-3.5 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                />
                <button
                  type="submit"
                  className="w-full py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold rounded-lg text-xs transition-colors"
                >
                  Subscribe via Email
                </button>
              </form>
            )}
          </div>
        )}

        {/* Tab 2: RSS */}
        {activeTab === "rss" && (
          <div className="space-y-3 text-xs">
            <p className="text-slate-400">
              Subscribe to incident updates in Slack, Discord, or any RSS/Atom
              reader.
            </p>
            <div className="flex items-center gap-2 bg-slate-950 border border-slate-800 rounded-lg p-2.5 font-mono text-[11px] text-slate-300">
              <span className="truncate flex-1">/api/feed.xml</span>
              <button
                type="button"
                onClick={() =>
                  handleCopy(`${window.location.origin}/api/feed.xml`, "rss")
                }
                className="px-2 py-1 bg-slate-800 hover:bg-slate-700 rounded text-slate-200 transition-colors shrink-0"
              >
                {copiedType === "rss" ? "Copied!" : "Copy URL"}
              </button>
            </div>
            <a
              href="/api/feed.xml"
              target="_blank"
              rel="noreferrer"
              className="inline-block text-emerald-400 hover:underline text-xs"
            >
              Open feed in browser &rarr;
            </a>
          </div>
        )}

        {/* Tab 3: API */}
        {activeTab === "api" && (
          <div className="space-y-3 text-xs">
            <p className="text-slate-400">
              Query programmatic system status in JSON format (compatible with
              standard statuspage consumers).
            </p>
            <div className="bg-slate-950 border border-slate-800 rounded-lg p-3 space-y-2">
              <div className="flex justify-between items-center text-slate-400 text-[11px]">
                <span className="font-mono">cURL Command</span>
                <button
                  type="button"
                  onClick={() =>
                    handleCopy(
                      `curl -s ${window.location.origin}/api/status.json`,
                      "api",
                    )
                  }
                  className="text-emerald-400 hover:underline"
                >
                  {copiedType === "api" ? "Copied!" : "Copy"}
                </button>
              </div>
              <pre className="font-mono text-[11px] text-slate-300 overflow-x-auto">
                curl -s{" "}
                {typeof window !== "undefined"
                  ? window.location.origin
                  : "https://status.fsh-lab.dev"}
                /api/status.json
              </pre>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
