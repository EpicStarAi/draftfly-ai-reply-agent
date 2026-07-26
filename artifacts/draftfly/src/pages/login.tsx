import logoUrl from "@assets/file_00000000ab3c81f5a8e0795a67233ab0_1784572119215.png";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

export default function Login() {
  const params = new URLSearchParams(window.location.search);
  const errorCode = params.get("error");

  const errorMessages: Record<string, string> = {
    denied: "You cancelled the Slack sign-in.",
    state: "Invalid request state. Please try again.",
    token: "Could not exchange Slack code. Please try again.",
    identity: "Could not fetch your Slack identity. Please try again.",
    server: "Server error during sign-in. Please try again.",
    config: "Sign-in is not available right now. Please contact the administrator.",
  };

  const errorMsg = errorCode ? (errorMessages[errorCode] ?? "Unknown error.") : null;

  return (
    <div className="min-h-screen bg-[#0A0A0F] flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-sm flex flex-col items-center gap-8">
        <img src={logoUrl} alt="DraftFly" className="h-10 w-auto" />

        <div className="w-full bg-[#13131A] border border-white/8 rounded-2xl p-8 flex flex-col gap-6">
          <div className="text-center">
            <h1 className="text-xl font-semibold text-white">Sign in to DraftFly</h1>
            <p className="mt-1 text-sm text-white/50">Operator access only</p>
          </div>

          {errorMsg && (
            <div className="rounded-lg bg-red-500/10 border border-red-500/20 px-4 py-3 text-sm text-red-400 text-center">
              {errorMsg}
            </div>
          )}

          <a
            href={`${BASE.replace("/app", "")}/api/auth/slack`}
            className="flex items-center justify-center gap-3 w-full rounded-xl bg-[#4A154B] hover:bg-[#5a1a5c] transition-colors px-5 py-3 text-white font-medium text-sm"
          >
            <svg viewBox="0 0 24 24" className="w-5 h-5 flex-shrink-0" fill="currentColor">
              <path d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52zm1.271 0a2.527 2.527 0 0 1 2.521-2.52 2.527 2.527 0 0 1 2.521 2.52v6.313A2.528 2.528 0 0 1 8.834 24a2.528 2.528 0 0 1-2.521-2.522v-6.313zM8.834 5.042a2.528 2.528 0 0 1-2.521-2.52A2.528 2.528 0 0 1 8.834 0a2.528 2.528 0 0 1 2.521 2.522v2.52H8.834zm0 1.271a2.528 2.528 0 0 1 2.521 2.521 2.528 2.528 0 0 1-2.521 2.521H2.522A2.528 2.528 0 0 1 0 8.834a2.528 2.528 0 0 1 2.522-2.521h6.312zm10.122 2.521a2.528 2.528 0 0 1 2.522-2.521A2.528 2.528 0 0 1 24 8.834a2.528 2.528 0 0 1-2.522 2.521h-2.522V8.834zm-1.268 0a2.528 2.528 0 0 1-2.523 2.521 2.527 2.527 0 0 1-2.52-2.521V2.522A2.527 2.527 0 0 1 15.165 0a2.528 2.528 0 0 1 2.523 2.522v6.312zm-2.523 10.122a2.528 2.528 0 0 1 2.523 2.522A2.528 2.528 0 0 1 15.165 24a2.527 2.527 0 0 1-2.52-2.522v-2.522h2.52zm0-1.268a2.527 2.527 0 0 1-2.52-2.523 2.526 2.526 0 0 1 2.52-2.52h6.313A2.527 2.527 0 0 1 24 15.165a2.528 2.528 0 0 1-2.522 2.523h-6.313z"/>
            </svg>
            Sign in with Slack
          </a>

          <p className="text-center text-xs text-white/30">
            Access restricted to authorised operators
          </p>
        </div>
      </div>
    </div>
  );
}
