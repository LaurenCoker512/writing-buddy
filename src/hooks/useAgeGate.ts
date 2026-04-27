import { useState } from "react";
import { shouldShowAgeGate } from "@/lib/age-gate";

export function useAgeGate(onRatingConfirmed: (rating: string) => void) {
  const [explicitEnabled, setExplicitEnabled] = useState<boolean | null>(null);
  const [showAgeGate, setShowAgeGate] = useState(false);
  const [confirming, setConfirming] = useState(false);

  const handleRatingClick = async (rating: string) => {
    if (rating !== "E") {
      onRatingConfirmed(rating);
      return;
    }
    let enabled = explicitEnabled;
    if (enabled === null) {
      const res = await fetch("/api/account");
      if (res.ok) {
        const data = (await res.json()) as { explicitEnabled: boolean };
        enabled = data.explicitEnabled;
        setExplicitEnabled(enabled);
      }
    }
    if (shouldShowAgeGate(enabled ?? false, "E")) {
      setShowAgeGate(true);
    } else {
      onRatingConfirmed("E");
    }
  };

  const handleAgeGateConfirm = async () => {
    setConfirming(true);
    await fetch("/api/account/explicit-enable", { method: "PATCH" });
    setExplicitEnabled(true);
    setShowAgeGate(false);
    onRatingConfirmed("E");
    setConfirming(false);
  };

  return {
    showAgeGate,
    confirming,
    handleRatingClick,
    handleAgeGateConfirm,
    closeAgeGate: () => setShowAgeGate(false),
  };
}
