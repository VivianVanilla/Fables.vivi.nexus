// ════════════════════════════════════════════════════════════════════════════
// CollabCursorOverlay.tsx — renders one colored, named caret per collaborator
// currently viewing a note's textarea, Google-Docs-style.
//
// Plain <textarea> elements only expose a single native caret, so a remote
// person's position has to be drawn as an absolutely-positioned overlay. This
// uses the standard "mirror div" technique: an offscreen div replicates the
// textarea's exact font metrics/padding/wrapping, we drop a zero-width marker
// span at the peer's character offset, and measure where that span landed.
// ════════════════════════════════════════════════════════════════════════════

import { useEffect, useLayoutEffect, useRef, useState } from "react"
import type { PeerState } from "./noteSync"

const MIRRORED_PROPS = [
  "boxSizing", "width", "paddingTop", "paddingRight", "paddingBottom", "paddingLeft",
  "borderTopWidth", "borderRightWidth", "borderBottomWidth", "borderLeftWidth",
  "fontFamily", "fontSize", "fontWeight", "fontStyle", "letterSpacing",
  "lineHeight", "textTransform", "tabSize", "wordSpacing",
] as const

function copyStyleProp<K extends typeof MIRRORED_PROPS[number]>(dst: CSSStyleDeclaration, src: CSSStyleDeclaration, prop: K) {
  dst[prop] = src[prop]
}

interface Props {
  textareaRef: React.RefObject<HTMLTextAreaElement | null>
  peers: PeerState[]
  text: string
}

interface Caret { peer: PeerState; top: number; left: number; height: number }

export function CollabCursorOverlay({ textareaRef, peers, text }: Props) {
  const mirrorRef = useRef<HTMLDivElement | null>(null)
  const scrollTargetRef = useRef<HTMLTextAreaElement | null>(null)
  const [carets, setCarets] = useState<Caret[]>([])
  const [scrollTick, setScrollTick] = useState(0)

  useEffect(() => {
    const div = document.createElement("div")
    div.style.position = "absolute"
    div.style.visibility = "hidden"
    div.style.top = "0"
    div.style.left = "-9999px"
    div.style.whiteSpace = "pre-wrap"
    div.style.overflowWrap = "break-word"
    document.body.appendChild(div)
    mirrorRef.current = div
    return () => { div.remove(); mirrorRef.current = null }
  }, [])

  // No dependency array — the textarea DOM node behind `textareaRef` can show
  // up on a later render than this component's own mount, and ref values
  // can't be read while computing a dependency array. This re-checks on
  // every render but bails immediately once it's attached to the current element.
  useEffect(() => {
    const textarea = textareaRef.current
    if (!textarea || scrollTargetRef.current === textarea) return
    scrollTargetRef.current = textarea
    const onScroll = () => setScrollTick(t => t + 1)
    textarea.addEventListener("scroll", onScroll)
    return () => textarea.removeEventListener("scroll", onScroll)
  })

  useLayoutEffect(() => {
    const textarea = textareaRef.current
    const mirror = mirrorRef.current
    const visible = peers.filter(p => p.selStart != null)
    if (!textarea || !mirror || visible.length === 0) { setCarets([]); return }

    const computed = window.getComputedStyle(textarea)
    for (const prop of MIRRORED_PROPS) copyStyleProp(mirror.style, computed, prop)
    mirror.style.width = `${textarea.clientWidth}px`

    const next: Caret[] = []
    for (const peer of visible) {
      const offset = Math.min(peer.selStart ?? 0, text.length)
      mirror.textContent = text.slice(0, offset)
      const marker = document.createElement("span")
      marker.textContent = "​"
      mirror.appendChild(marker)
      const top = marker.offsetTop - textarea.scrollTop
      const left = marker.offsetLeft - textarea.scrollLeft
      const height = marker.offsetHeight || parseFloat(computed.lineHeight) || 16
      if (top > -height && top < textarea.clientHeight) next.push({ peer, top, left, height })
    }
    setCarets(next)
  }, [peers, text, textareaRef, scrollTick])

  if (carets.length === 0) return null

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {carets.map(({ peer, top, left, height }) => (
        <div key={peer.id} className="absolute transition-[top,left] duration-100" style={{ top, left, height }}>
          <div className="w-0.5 h-full" style={{ backgroundColor: peer.color }} />
          <div
            className="absolute -top-4 left-0 whitespace-nowrap text-[9px] font-semibold px-1 py-0.5 rounded text-white shadow z-10"
            style={{ backgroundColor: peer.color }}
          >
            {peer.name}
          </div>
        </div>
      ))}
    </div>
  )
}
