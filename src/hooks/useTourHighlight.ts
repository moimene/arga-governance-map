import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import { useTour } from "@/context/TourContext";

/**
 * Adds the `.tour-highlight` class for ~2s when the tour navigates to a step
 * whose `highlightId` matches an element on the current screen.
 */
export function useTourHighlight() {
  const { step } = useTour();
  const location = useLocation();
  const lastHandled = useRef<{ step: number; path: string } | null>(null);

  useEffect(() => {
    if (step === 0) return;
    const key = { step, path: location.pathname };
    if (lastHandled.current && lastHandled.current.step === key.step && lastHandled.current.path === key.path) return;
    lastHandled.current = key;

    // Run after the destination page has had a chance to mount
    const tries = [80, 250, 600];
    const timers = tries.map((t) =>
      window.setTimeout(() => {
        const els = document.querySelectorAll(".tour-target");
        els.forEach((el) => {
          el.classList.remove("tour-highlight");
          // Force reflow to restart the animation
          void (el as HTMLElement).offsetWidth;
          el.classList.add("tour-highlight");
        });
      }, t),
    );
    return () => timers.forEach((id) => clearTimeout(id));
  }, [step, location.pathname]);
}
