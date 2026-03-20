import { useState, useEffect } from "react";
import { Shield, Download, CheckCircle, Smartphone, Share, MoreVertical, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

function isIOS() {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
}

function isAndroid() {
  return /Android/.test(navigator.userAgent);
}

export default function Install() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [platform, setPlatform] = useState<"ios" | "android" | "desktop" | "unknown">("unknown");

  useEffect(() => {
    if (window.matchMedia("(display-mode: standalone)").matches) {
      setIsInstalled(true);
    }

    if (isIOS()) setPlatform("ios");
    else if (isAndroid()) setPlatform("android");
    else setPlatform("desktop");

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") setIsInstalled(true);
    setDeferredPrompt(null);
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background p-6">
      <div className="w-full max-w-sm space-y-8 text-center">
        {/* App icon */}
        <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-3xl bg-foreground shadow-xl">
          <Shield className="h-12 w-12 text-primary" />
        </div>

        <div>
          <h1 className="text-3xl font-bold" style={{ fontFamily: "'Playfair Display', serif" }}>
            Due Date Guardian
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">by Legacy Growth Solutions</p>
          <p className="mt-3 text-muted-foreground">
            Add to your home screen for a native app experience with push notifications and offline access.
          </p>
        </div>

        {/* Already installed */}
        {isInstalled ? (
          <div className="space-y-4">
            <div className="flex items-center justify-center gap-2 rounded-xl bg-primary/10 p-4 text-primary">
              <CheckCircle className="h-5 w-5" />
              <span className="font-semibold">App is installed!</span>
            </div>
            <Link to="/">
              <Button className="w-full">Open Dashboard</Button>
            </Link>
          </div>
        ) : deferredPrompt ? (
          /* Android/Desktop — native install prompt available */
          <Button size="lg" className="w-full gap-2 text-base" onClick={handleInstall}>
            <Download className="h-5 w-5" />
            Install App
          </Button>
        ) : platform === "ios" ? (
          /* iOS instructions */
          <div className="space-y-3 rounded-2xl border border-border bg-card p-5 text-left">
            <p className="text-sm font-semibold text-center mb-4">Install on iPhone / iPad</p>
            {[
              { icon: Share, step: "1", text: 'Tap the Share button at the bottom of Safari' },
              { icon: Plus, step: "2", text: 'Scroll down and tap "Add to Home Screen"' },
              { icon: CheckCircle, step: "3", text: 'Tap "Add" in the top right corner' },
            ].map(({ icon: Icon, step, text }) => (
              <div key={step} className="flex items-center gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold">
                  {step}
                </div>
                <div className="flex items-center gap-2">
                  <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
                  <p className="text-sm text-muted-foreground">{text}</p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          /* Android / Desktop fallback instructions */
          <div className="space-y-3 rounded-2xl border border-border bg-card p-5 text-left">
            <p className="text-sm font-semibold text-center mb-4">Install on Android / Desktop</p>
            {[
              { icon: MoreVertical, step: "1", text: "Tap the ⋮ menu in Chrome" },
              { icon: Download, step: "2", text: '"Add to Home Screen" or "Install App"' },
              { icon: CheckCircle, step: "3", text: "Tap Install to confirm" },
            ].map(({ icon: Icon, step, text }) => (
              <div key={step} className="flex items-center gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold">
                  {step}
                </div>
                <div className="flex items-center gap-2">
                  <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
                  <p className="text-sm text-muted-foreground">{text}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Feature highlights */}
        <div className="grid grid-cols-3 gap-3 text-center">
          {[
            { emoji: "🔔", label: "Push alerts" },
            { emoji: "📴", label: "Works offline" },
            { emoji: "⚡", label: "Instant load" },
          ].map(({ emoji, label }) => (
            <div key={label} className="rounded-xl border border-border bg-card p-3">
              <div className="text-2xl">{emoji}</div>
              <p className="mt-1 text-xs text-muted-foreground">{label}</p>
            </div>
          ))}
        </div>

        <Link to="/auth" className="block text-xs text-muted-foreground hover:text-foreground">
          Already have an account? Sign in →
        </Link>
      </div>
    </div>
  );
}
