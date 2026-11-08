import { useEffect, useRef } from 'react'

interface InteractiveDotGridProps {
  pan?: { x: number; y: number }
  spacing?: number
  className?: string
}

interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  alpha: number
  maxLife: number
  life: number
  size: number
}

/** 画布点阵：光标附近的点实心化并被轻微推开，移动时飘出微粒；静止后停止重绘 */
export function InteractiveDotGrid({ pan = { x: 0, y: 0 }, spacing = 24, className = '' }: InteractiveDotGridProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const mouseRef = useRef({ x: -1000, y: -1000, prevX: -1000, prevY: -1000, lastMoveTime: 0 })
  const panRef = useRef(pan)
  panRef.current = pan
  const particlesRef = useRef<Particle[]>([])
  // 平移/缩放变化时由外部唤醒绘制，避免常驻 rAF 一直占着主线程
  const scheduleRef = useRef<() => void>(() => {})

  useEffect(() => {
    const canvas = canvasRef.current
    const parent = canvas?.parentElement
    const ctx = canvas?.getContext('2d', { alpha: true })
    if (!canvas || !parent || !ctx) return

    let width = 0
    let height = 0
    let rafId = 0
    let running = false

    const resize = () => {
      const rect = parent.getBoundingClientRect()
      if (rect.width === width && rect.height === height) return
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      width = rect.width
      height = rect.height
      canvas.width = Math.round(width * dpr)
      canvas.height = Math.round(height * dpr)
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }

    const draw = () => {
      const isDark = document.documentElement.classList.contains('dark')
      const curPan = panRef.current
      const m = mouseRef.current

      ctx.clearRect(0, 0, width, height)

      const baseR = isDark ? 255 : 15
      const baseG = isDark ? 255 : 23
      const baseB = isDark ? 255 : 42
      const baseAlpha = isDark ? 0.12 : 0.15
      const activeAlpha = isDark ? 0.8 : 0.72

      // 光标附近的点染成品牌蓝：不再叠一层光斑，颜色变化本身就是「光源」
      const accentR = isDark ? 96 : 37
      const accentG = isDark ? 165 : 99
      const accentB = isDark ? 250 : 235

      const interactionRadius = 110
      const maxDisplacement = 3.5

      const offsetX = ((curPan.x % spacing) + spacing) % spacing
      const offsetY = ((curPan.y % spacing) + spacing) % spacing
      const startX = offsetX - spacing
      const startY = offsetY - spacing

      for (let x = startX; x < width + spacing; x += spacing) {
        for (let y = startY; y < height + spacing; y += spacing) {
          const dx = x - m.x
          const dy = y - m.y
          const dist = Math.hypot(dx, dy)

          let renderX = x
          let renderY = y
          let alpha = baseAlpha
          let dotRadius = 0.95
          let red = baseR
          let green = baseG
          let blue = baseB

          if (dist < interactionRadius) {
            const factor = 1 - dist / interactionRadius
            const ease = factor * factor * (3 - 2 * factor)
            alpha = baseAlpha + (activeAlpha - baseAlpha) * ease
            dotRadius = 0.95 + 0.5 * ease
            red = Math.round(baseR + (accentR - baseR) * ease)
            green = Math.round(baseG + (accentG - baseG) * ease)
            blue = Math.round(baseB + (accentB - baseB) * ease)
            if (dist > 1) {
              const push = ease * maxDisplacement
              renderX += (dx / dist) * push
              renderY += (dy / dist) * push
            }
          }

          ctx.fillStyle = `rgba(${red}, ${green}, ${blue}, ${alpha})`
          ctx.beginPath()
          ctx.arc(renderX, renderY, dotRadius, 0, Math.PI * 2)
          ctx.fill()
        }
      }

      const particles = particlesRef.current
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i]
        p.life++
        p.x += p.vx
        p.y += p.vy
        p.vx *= 0.96
        p.vy *= 0.96

        const progress = p.life / p.maxLife
        if (progress >= 1) {
          particles.splice(i, 1)
          continue
        }

        ctx.fillStyle = `rgba(${baseR}, ${baseG}, ${baseB}, ${p.alpha * (1 - progress)})`
        ctx.beginPath()
        ctx.arc(p.x, p.y, p.size * (1 - progress * 0.3), 0, Math.PI * 2)
        ctx.fill()
      }
    }

    const tick = () => {
      draw()
      const idle = particlesRef.current.length === 0 && performance.now() - mouseRef.current.lastMoveTime > 240
      if (idle) {
        running = false
        rafId = 0
        return
      }
      rafId = requestAnimationFrame(tick)
    }

    const schedule = () => {
      if (running) return
      running = true
      rafId = requestAnimationFrame(tick)
    }
    scheduleRef.current = schedule

    const onMouseMove = (event: MouseEvent) => {
      const rect = parent.getBoundingClientRect()
      const newX = event.clientX - rect.left
      const newY = event.clientY - rect.top

      const m = mouseRef.current
      m.prevX = m.x
      m.prevY = m.y
      m.x = newX
      m.y = newY
      m.lastMoveTime = performance.now()

      const dist = Math.hypot(newX - m.prevX, newY - m.prevY)
      if (dist > 3 && dist < 120 && particlesRef.current.length < 24 && Math.random() > 0.45) {
        const angle = Math.random() * Math.PI * 2
        const speed = 0.3 + Math.random() * 0.8
        particlesRef.current.push({
          x: newX + (Math.random() - 0.5) * 12,
          y: newY + (Math.random() - 0.5) * 12,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed - 0.3,
          alpha: 0.65 + Math.random() * 0.35,
          maxLife: 20 + Math.random() * 18,
          life: 0,
          size: 0.8 + Math.random() * 0.7,
        })
      }

      schedule()
    }

    const onMouseLeave = () => {
      const m = mouseRef.current
      m.x = -1000
      m.y = -1000
      schedule()
    }

    const observer = new ResizeObserver(() => {
      resize()
      schedule()
    })

    resize()
    observer.observe(parent)
    parent.addEventListener('mousemove', onMouseMove, { passive: true })
    parent.addEventListener('mouseleave', onMouseLeave)
    schedule()

    return () => {
      if (rafId) cancelAnimationFrame(rafId)
      running = false
      observer.disconnect()
      parent.removeEventListener('mousemove', onMouseMove)
      parent.removeEventListener('mouseleave', onMouseLeave)
      scheduleRef.current = () => {}
    }
  }, [spacing])

  useEffect(() => {
    scheduleRef.current()
  }, [pan.x, pan.y])

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className={`absolute inset-0 h-full w-full pointer-events-none ${className}`}
      style={{ display: 'block' }}
    />
  )
}
