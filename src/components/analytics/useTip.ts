import { useEffect, useState } from "react";
import { tipPosition } from "./format";

// Hover/click tooltip state for chart marks tagged with data-tip-target. A pinned tip closes on Escape or a tap elsewhere.
export function useTip<T extends { key: string }>() {
  const [tip, setTip] = useState<(T & { x: number; y: number; pinned: boolean }) | null>(null);
  const pinned = tip?.pinned ?? false;
  useEffect(() => {
    if (!pinned) return;
    const close = () => setTip(null);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    const onDown = (e: PointerEvent) => !(e.target as Element).closest?.("[data-tip-target]") && close();
    window.addEventListener("keydown", onKey);
    window.addEventListener("pointerdown", onDown);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("pointerdown", onDown);
    };
  }, [pinned]);

  const show = (item: T, clientX: number, clientY: number, pin: boolean) => setTip({ ...item, ...tipPosition(clientX, clientY), pinned: pin });
  const handlers = (item: T) => ({
    "data-tip-target": true,
    role: "button",
    tabIndex: 0,
    onPointerEnter: (e: React.PointerEvent) => !pinned && show(item, e.clientX, e.clientY, false),
    onPointerMove: (e: React.PointerEvent) => !pinned && show(item, e.clientX, e.clientY, false),
    onPointerLeave: () => !pinned && setTip(null),
    onClick: (e: React.MouseEvent) => (pinned && tip?.key === item.key ? setTip(null) : show(item, e.clientX, e.clientY, true)),
    onKeyDown: (e: React.KeyboardEvent<Element>) => {
      if (e.key !== "Enter" && e.key !== " ") return;
      e.preventDefault();
      const r = e.currentTarget.getBoundingClientRect();
      show(item, r.left + r.width / 2, r.top + r.height / 2, true);
    },
  });
  return { tip, handlers };
}
