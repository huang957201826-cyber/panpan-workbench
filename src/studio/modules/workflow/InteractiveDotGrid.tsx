import React, { useRef, useEffect } from 'react';

interface InteractiveDotGridProps {
  pan?: { x: number; y: number };
  spacing?: number;
  className?: string;
  /** 拖拽时暂停动画，避免和拖拽抢帧 */
  paused?: boolean;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  alpha: number;
  maxLife: number;
  life: number;
  size: number;
}

export const InteractiveDotGrid: React.FC<InteractiveDotGridProps> = ({
  pan = { x: 0, y: 0 },
  spacing = 24,
  className = '',
  paused = false,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const pausedRef = useRef(paused);
  pausedRef.current = paused;
  const renderFnRef = useRef<(() => void) | null>(null);

  // Motion state refs (avoid React re-render overhead for 60fps canvas)
  const mouseRef = useRef<{ x: number; y: number; prevX: number; prevY: number; isMoving: boolean; lastMoveTime: number }>({
    x: -1000,
    y: -1000,
    prevX: -1000,
    prevY: -1000,
    isMoving: false,
    lastMoveTime: 0,
  });

  const panRef = useRef(pan);
  panRef.current = pan;

  const particlesRef = useRef<Particle[]>([]);
  const animFrameIdRef = useRef<number | null>(null);

  useEffect(() => {
    if (paused || animFrameIdRef.current !== null) return;
    if (renderFnRef.current) animFrameIdRef.current = requestAnimationFrame(renderFnRef.current);
  }, [paused]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) return;

    let width = 0;
    let height = 0;
    let dpr = 1;

    // Resize observer to handle container dimension changes perfectly
    const handleResize = () => {
      const parent = canvas.parentElement;
      if (!parent) return;

      const rect = parent.getBoundingClientRect();
      dpr = Math.min(window.devicePixelRatio || 1, 2); // Cap at 2 for performance
      width = rect.width;
      height = rect.height;

      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;

      ctx.scale(dpr, dpr);
    };

    handleResize();

    const resizeObserver = new ResizeObserver(() => {
      handleResize();
    });
    if (canvas.parentElement) {
      resizeObserver.observe(canvas.parentElement);
    }

    // Mouse listener on parent container
    const parent = canvas.parentElement;
    const handleParentMouseMove = (e: MouseEvent) => {
      if (!parent) return;
      const rect = parent.getBoundingClientRect();
      const newX = e.clientX - rect.left;
      const newY = e.clientY - rect.top;

      const m = mouseRef.current;
      m.prevX = m.x;
      m.prevY = m.y;
      m.x = newX;
      m.y = newY;
      m.lastMoveTime = performance.now();
      m.isMoving = true;

      // Spawn ambient micro sparkle particles on mouse move
      const dist = Math.hypot(newX - m.prevX, newY - m.prevY);
      if (dist > 3 && dist < 120 && particlesRef.current.length < 24) {
        // Spawn 1 micro particle with probability
        if (Math.random() > 0.45) {
          const angle = Math.random() * Math.PI * 2;
          const speed = 0.3 + Math.random() * 0.8;
          particlesRef.current.push({
            x: newX + (Math.random() - 0.5) * 12,
            y: newY + (Math.random() - 0.5) * 12,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed - 0.3, // Slight upward drift
            alpha: 0.65 + Math.random() * 0.35,
            maxLife: 20 + Math.random() * 18,
            life: 0,
            size: 0.8 + Math.random() * 0.7,
          });
        }
      }
    };

    const handleParentMouseLeave = () => {
      const m = mouseRef.current;
      m.x = -1000;
      m.y = -1000;
      m.isMoving = false;
    };

    if (parent) {
      parent.addEventListener('mousemove', handleParentMouseMove, { passive: true });
      parent.addEventListener('mouseleave', handleParentMouseLeave);
    }

    // Render loop
    const render = () => {
      const isDark = document.documentElement.classList.contains('dark');
      const curPan = panRef.current;
      const m = mouseRef.current;
      const now = performance.now();

      // Clear canvas
      ctx.clearRect(0, 0, width, height);

      // Dot colors based on theme
      // Normal state: very subtle shadow/ghost dot
      // Highlight state: solid, clear, refined dot
      const baseR = isDark ? 255 : 15;
      const baseG = isDark ? 255 : 23;
      const baseB = isDark ? 255 : 42;

      const baseAlpha = isDark ? 0.12 : 0.15;
      const activeAlpha = isDark ? 0.75 : 0.65;

      const INTERACTION_RADIUS = 135;
      const MAX_DISPLACEMENT = 3.5; // Subtle Apple-grade physical spring push

      // Calculate grid offset from pan
      const offsetX = ((curPan.x % spacing) + spacing) % spacing;
      const offsetY = ((curPan.y % spacing) + spacing) % spacing;

      const startX = offsetX - spacing;
      const startY = offsetY - spacing;

      // Draw dot grid
      for (let x = startX; x < width + spacing; x += spacing) {
        for (let y = startY; y < height + spacing; y += spacing) {
          const dx = x - m.x;
          const dy = y - m.y;
          const dist = Math.hypot(dx, dy);

          let renderX = x;
          let renderY = y;
          let alpha = baseAlpha;
          let dotRadius = 0.95;

          if (dist < INTERACTION_RADIUS) {
            // Distance falloff curve (smooth hermite)
            const factor = 1 - dist / INTERACTION_RADIUS;
            const easeFactor = factor * factor * (3 - 2 * factor);

            // 1. Solidify: interpolate from base alpha to active alpha
            alpha = baseAlpha + (activeAlpha - baseAlpha) * easeFactor;

            // 2. Expand slightly for precision tactile feel
            dotRadius = 0.95 + 0.45 * easeFactor;

            // 3. Elastic Spring displacement: gently push away from cursor
            if (dist > 1) {
              const push = easeFactor * MAX_DISPLACEMENT;
              renderX += (dx / dist) * push;
              renderY += (dy / dist) * push;
            }
          }

          ctx.fillStyle = `rgba(${baseR}, ${baseG}, ${baseB}, ${alpha})`;
          ctx.beginPath();
          ctx.arc(renderX, renderY, dotRadius, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // Update & Render Micro Sparkle Particles
      const particles = particlesRef.current;
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.life++;
        p.x += p.vx;
        p.y += p.vy;
        p.vx *= 0.96;
        p.vy *= 0.96;

        const progress = p.life / p.maxLife;
        const currentAlpha = p.alpha * (1 - progress);

        if (progress >= 1) {
          particles.splice(i, 1);
          continue;
        }

        // Draw particle with gentle glow
        ctx.fillStyle = `rgba(${baseR}, ${baseG}, ${baseB}, ${currentAlpha})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * (1 - progress * 0.3), 0, Math.PI * 2);
        ctx.fill();
      }

      animFrameIdRef.current = pausedRef.current ? null : requestAnimationFrame(render);
    };

    renderFnRef.current = render;
    animFrameIdRef.current = requestAnimationFrame(render);

    return () => {
      if (animFrameIdRef.current) {
        cancelAnimationFrame(animFrameIdRef.current);
      }
      if (parent) {
        parent.removeEventListener('mousemove', handleParentMouseMove);
        parent.removeEventListener('mouseleave', handleParentMouseLeave);
      }
      resizeObserver.disconnect();
    };
  }, [spacing]);

  return (
    <canvas
      ref={canvasRef}
      className={`absolute inset-0 pointer-events-none ${className}`}
      style={{ display: 'block' }}
    />
  );
};
