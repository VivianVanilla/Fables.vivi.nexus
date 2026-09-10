// ════════════════════════════════════════════════════════════════════════════
// ScrollHint — a "there's more text below, scroll to see it" cue for any
// height-capped scroll area (a long spell/feature description in a fixed
// modal, a description box that would otherwise balloon a card, …).
//
// Usage: put a `relative` wrapper AROUND the scrolling element (not inside
// it — the cue has to stay pinned to the visible bottom edge, not scroll
// away with the content), give the scroller the `ref` from useScrollHint,
// and drop <ScrollHint show={hasMore} /> in as the wrapper's last child.
// ════════════════════════════════════════════════════════════════════════════

import { useCallback, useRef, useState } from "react"
import { ChevronDown } from "lucide-react"
import { cn } from "@/lib/utils"

/**
 * Tracks whether a scroll container still has content past its bottom edge.
 * `hasMore` is true only while the element both overflows AND isn't scrolled
 * to the bottom, so the cue disappears once you've reached the end.
 *
 * `ref` is a callback ref (not an object ref) so it re-arms correctly when
 * the scroller mounts/unmounts later than the hook — e.g. a description
 * that's only in the DOM once its card is expanded (PopTransition). Watches
 * the scroller and its content for size changes (ResizeObserver) plus the
 * scroll position itself.
 */
export function useScrollHint<T extends HTMLElement = HTMLDivElement>() {
  const [hasMore, setHasMore] = useState(false)
  const teardown = useRef<(() => void) | null>(null)

  const ref = useCallback((el: T | null) => {
    teardown.current?.()
    teardown.current = null
    if (!el) return

    // 8px slack so a sub-pixel rounding gap doesn't leave the cue stuck on.
    const check = () => setHasMore(el.scrollHeight - el.clientHeight - el.scrollTop > 8)
    check()

    el.addEventListener("scroll", check, { passive: true })
    const ro = new ResizeObserver(check)
    ro.observe(el)
    // The scroller's own box doesn't change when content grows past the cap
    // (async markdown layout, an image finishing loading) — watch the content
    // element too so those still update the cue.
    if (el.firstElementChild) ro.observe(el.firstElementChild)

    teardown.current = () => {
      el.removeEventListener("scroll", check)
      ro.disconnect()
    }
  }, [])

  return { ref, hasMore }
}

export function ScrollHint({ show, className }: { show: boolean; className?: string }) {
  return (
    <div
      aria-hidden
      className={cn(
        "pointer-events-none absolute inset-x-0 bottom-0 flex h-9 items-end justify-center pb-1",
        "bg-gradient-to-t from-black/35 to-transparent transition-opacity duration-200",
        show ? "opacity-100" : "opacity-0",
        className,
      )}
    >
      <ChevronDown className="size-4 text-white/70 fables-scrollhint-nudge" />
    </div>
  )
}
