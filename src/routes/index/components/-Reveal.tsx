// Scroll-triggered entrance wrapper shared by the landing page sections.
import { motion, useReducedMotion } from 'motion/react'
import type { ReactNode } from 'react'

type RevealProps = {
  children: ReactNode
  className?: string
  delay?: number
  // Lets callers keep list semantics (e.g. render as <li> inside an <ol>).
  as?: 'div' | 'li'
}

export function Reveal({ children, className, delay = 0, as = 'div' }: RevealProps) {
  const prefersReducedMotion = useReducedMotion()

  if (prefersReducedMotion) {
    return as === 'li' ? (
      <li className={className}>{children}</li>
    ) : (
      <div className={className}>{children}</div>
    )
  }

  const MotionTag = as === 'li' ? motion.li : motion.div

  return (
    <MotionTag
      className={className}
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-80px' }}
      transition={{ duration: 0.55, delay, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </MotionTag>
  )
}
