"use client"

import {
  createElement,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ElementType,
  type ReactNode,
} from "react"
import { gsap } from "gsap"

export interface TextTypeProps {
  text: string | string[]
  /** HTML tag to render as. Defaults to <span> so it can sit inline. */
  as?: ElementType
  typingSpeed?: number
  initialDelay?: number
  pauseDuration?: number
  deletingSpeed?: number
  loop?: boolean
  className?: string
  showCursor?: boolean
  hideCursorWhileTyping?: boolean
  cursorCharacter?: ReactNode
  cursorClassName?: string
  cursorBlinkDuration?: number
  textColors?: string[]
  variableSpeed?: { min: number; max: number }
  onSentenceComplete?: (sentence: string, index: number) => void
  startOnVisible?: boolean
  reverseMode?: boolean
}

/**
 * Typewriter text. Cycles through a list of strings, optionally with a
 * randomized speed for a human-typed feel. Cursor blinks via GSAP.
 *
 * Adapted from React Bits' TextType to TypeScript so it fits the rest
 * of this codebase. Styles live in globals.css under the t-texttype-*
 * convention.
 */
export function TextType({
  text,
  as = "span",
  typingSpeed = 50,
  initialDelay = 0,
  pauseDuration = 2000,
  deletingSpeed = 30,
  loop = true,
  className = "",
  showCursor = true,
  hideCursorWhileTyping = false,
  cursorCharacter = "|",
  cursorClassName = "",
  cursorBlinkDuration = 0.5,
  textColors = [],
  variableSpeed,
  onSentenceComplete,
  startOnVisible = false,
  reverseMode = false,
  ...rest
}: TextTypeProps) {
  const [displayedText, setDisplayedText] = useState("")
  const [currentCharIndex, setCurrentCharIndex] = useState(0)
  const [isDeleting, setIsDeleting] = useState(false)
  const [currentTextIndex, setCurrentTextIndex] = useState(0)
  const [isVisible, setIsVisible] = useState(!startOnVisible)
  const cursorRef = useRef<HTMLSpanElement | null>(null)
  const containerRef = useRef<HTMLElement | null>(null)

  const textArray = useMemo(() => (Array.isArray(text) ? text : [text]), [text])

  const getRandomSpeed = useCallback(() => {
    if (!variableSpeed) return typingSpeed
    const { min, max } = variableSpeed
    return Math.random() * (max - min) + min
  }, [variableSpeed, typingSpeed])

  const getCurrentTextColor = () => {
    if (textColors.length === 0) return "inherit"
    return textColors[currentTextIndex % textColors.length]
  }

  // IntersectionObserver gate — only start typing once visible.
  useEffect(() => {
    if (!startOnVisible || !containerRef.current) return
    const observer = new IntersectionObserver(
      entries => {
        entries.forEach(entry => {
          if (entry.isIntersecting) setIsVisible(true)
        })
      },
      { threshold: 0.1 },
    )
    observer.observe(containerRef.current)
    return () => observer.disconnect()
  }, [startOnVisible])

  // Cursor blink (GSAP yoyo).
  useEffect(() => {
    if (!showCursor || !cursorRef.current) return
    gsap.set(cursorRef.current, { opacity: 1 })
    const tween = gsap.to(cursorRef.current, {
      opacity: 0,
      duration: cursorBlinkDuration,
      repeat: -1,
      yoyo: true,
      ease: "power2.inOut",
    })
    return () => {
      tween.kill()
    }
  }, [showCursor, cursorBlinkDuration])

  // Typing / deleting loop.
  useEffect(() => {
    if (!isVisible) return
    let timeout: ReturnType<typeof setTimeout> | undefined
    const currentText = textArray[currentTextIndex]
    const processedText = reverseMode ? currentText.split("").reverse().join("") : currentText

    const tick = () => {
      if (isDeleting) {
        if (displayedText === "") {
          setIsDeleting(false)
          if (currentTextIndex === textArray.length - 1 && !loop) return
          onSentenceComplete?.(textArray[currentTextIndex], currentTextIndex)
          setCurrentTextIndex(prev => (prev + 1) % textArray.length)
          setCurrentCharIndex(0)
          timeout = setTimeout(() => {}, pauseDuration)
        } else {
          timeout = setTimeout(() => {
            setDisplayedText(prev => prev.slice(0, -1))
          }, deletingSpeed)
        }
      } else if (currentCharIndex < processedText.length) {
        timeout = setTimeout(
          () => {
            setDisplayedText(prev => prev + processedText[currentCharIndex])
            setCurrentCharIndex(prev => prev + 1)
          },
          variableSpeed ? getRandomSpeed() : typingSpeed,
        )
      } else if (textArray.length >= 1) {
        if (!loop && currentTextIndex === textArray.length - 1) return
        timeout = setTimeout(() => {
          setIsDeleting(true)
        }, pauseDuration)
      }
    }

    if (currentCharIndex === 0 && !isDeleting && displayedText === "") {
      timeout = setTimeout(tick, initialDelay)
    } else {
      tick()
    }

    return () => {
      if (timeout) clearTimeout(timeout)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    currentCharIndex,
    displayedText,
    isDeleting,
    typingSpeed,
    deletingSpeed,
    pauseDuration,
    textArray,
    currentTextIndex,
    loop,
    initialDelay,
    isVisible,
    reverseMode,
    variableSpeed,
    onSentenceComplete,
  ])

  const shouldHideCursor =
    hideCursorWhileTyping &&
    (currentCharIndex < textArray[currentTextIndex].length || isDeleting)

  return createElement(
    as,
    {
      ref: containerRef,
      className: `t-texttype ${className}`.trim(),
      ...rest,
    },
    <span className="t-texttype-content" style={{ color: getCurrentTextColor() }}>
      {displayedText}
    </span>,
    showCursor && (
      <span
        ref={cursorRef}
        className={`t-texttype-cursor ${cursorClassName} ${
          shouldHideCursor ? "t-texttype-cursor--hidden" : ""
        }`.trim()}
      >
        {cursorCharacter}
      </span>
    ),
  )
}

export default TextType
