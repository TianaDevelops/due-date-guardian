import { useState, useEffect } from "react";
import { Shield, Download, CheckCircle, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export default function Install() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", handler);

    if (window.matchMedia("(display-mode: standalone)").matches) {
      setIsInstalled(true);
    }

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
    <div className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="w-full max-w-md text-center space-y-8">
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-2xl bg-primary/10 border border-primary/20">
          <Shield className="h-10 w-10 text-primary" />
        </div>

        <div>
          <h1 className="text-2xl font-bold tracking-tight">Install LGS Tracker</h1>
          <p className="mt-2 text-muted-foreground">
            Add Legacy Growth Solutions Payment Tracker to your home screen for quick access and offline support.
          </p>
        </div>

        {isInstalled ? (
          <div className="flex items-center justify-center gap-2 text-accent-foreground">
            <CheckCircle className="h-5 w-5" />
            <span className="font-medium">App is installed!</span>
          </div>
        ) : deferredPrompt ? (
          <Button size="lg" className="w-full gap-2" onClick={handleInstall}>
            <Download className="h-5 w-5" />
            Install App
          </Button>
        ) : (
          <div className="space-y-4 rounded-xl border border-border bg-card p-6 text-left">
            <div className="flex items-start gap-3">
              <Smartphone className="mt-0.5 h-5 w-5 text-primary" />
              <div>
                <p className="font-medium text-sm">iOS (Safari)</p>
                <p className="text-xs text-muted-foreground">
                  Tap Share → "Add to Home Screen"
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Smartphone className="mt-0.5 h-5 w-5 text-primary" />
              <div>
                <p className="font-medium text-sm">Android (Chrome)</p>
                <p className="text-xs text-muted-foreground">
                  Tap ⋮ menu → "Add to Home Screen"
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
