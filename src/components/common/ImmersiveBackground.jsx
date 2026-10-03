import { useEffect, useRef, useCallback } from 'react';

/**
 * ImmersiveBackground — Interactive Cosmic Nebula Canvas
 * 
 * Creates a deep-space atmosphere with:
 * - Multi-layered parallax star field (twinkling, varied sizes)
 * - Volumetric nebula clouds with color shifts
 * - Interactive aurora cursor trail with magnetic particles
 * - Shooting stars / meteor streaks
 * - GPU-optimized with requestAnimationFrame
 * - Pauses on hidden tab & respects prefers-reduced-motion
 */
export default function ImmersiveBackground() {
  const canvasRef = useRef(null);
  const animRef = useRef(null);
  const mouseRef = useRef({ x: -1000, y: -1000, targetX: -1000, targetY: -1000, active: false });

  const init = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) return;

    // Check reduced motion
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    let w = canvas.width = window.innerWidth;
    let h = canvas.height = window.innerHeight;
    const mouse = mouseRef.current;
    let time = 0;

    // ── Star Field ──
    const STAR_COUNT = Math.min(Math.floor((w * h) / 4000), 350);
    const stars = [];
    const STAR_COLORS = [
      [255, 255, 255],    // White
      [200, 220, 255],    // Blue-white
      [255, 240, 220],    // Warm white
      [180, 200, 255],    // Soft blue
      [255, 210, 180],    // Soft orange
      [220, 200, 255],    // Lavender
    ];

    for (let i = 0; i < STAR_COUNT; i++) {
      const layer = Math.random(); // 0=far, 1=close
      const color = STAR_COLORS[Math.floor(Math.random() * STAR_COLORS.length)];
      stars.push({
        x: Math.random() * w,
        y: Math.random() * h,
        radius: layer < 0.6 ? Math.random() * 0.8 + 0.3 : layer < 0.9 ? Math.random() * 1.2 + 0.5 : Math.random() * 2 + 1,
        baseAlpha: layer < 0.6 ? Math.random() * 0.4 + 0.15 : Math.random() * 0.6 + 0.3,
        alpha: 0,
        twinkleSpeed: Math.random() * 0.015 + 0.005,
        twinklePhase: Math.random() * Math.PI * 2,
        color,
        layer,
        drift: (Math.random() - 0.5) * 0.08,
      });
    }

    // ── Nebula Clouds ──
    const nebulae = [
      { x: w * 0.2, y: h * 0.3, rx: w * 0.35, ry: h * 0.3, r: 139, g: 92, b: 246, a: 0.035, phase: 0 },
      { x: w * 0.75, y: h * 0.6, rx: w * 0.3, ry: h * 0.35, r: 6, g: 182, b: 212, a: 0.03, phase: 2 },
      { x: w * 0.5, y: h * 0.15, rx: w * 0.4, ry: h * 0.2, r: 99, g: 102, b: 241, a: 0.025, phase: 4 },
      { x: w * 0.3, y: h * 0.75, rx: w * 0.25, ry: h * 0.25, r: 168, g: 85, b: 247, a: 0.025, phase: 1 },
      { x: w * 0.85, y: h * 0.2, rx: w * 0.2, ry: h * 0.3, r: 45, g: 212, b: 191, a: 0.02, phase: 3 },
    ];

    // ── Interactive Particles ──
    const PARTICLE_COUNT = Math.min(Math.floor((w * h) / 20000), 60);
    const particles = [];

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      particles.push({
        x: Math.random() * w,
        y: Math.random() * h,
        vx: (Math.random() - 0.5) * 0.3,
        vy: (Math.random() - 0.5) * 0.3,
        radius: Math.random() * 1.5 + 0.5,
        baseAlpha: Math.random() * 0.4 + 0.2,
        alpha: 0,
        hue: Math.random() * 60 + 220, // 220-280 range (blue-purple)
      });
    }

    // ── Shooting Stars ──
    const shootingStars = [];
    let nextShootingStar = Math.random() * 300 + 100;

    // ── Resize ──
    const onResize = () => {
      w = canvas.width = window.innerWidth;
      h = canvas.height = window.innerHeight;
      // Re-position nebulae
      nebulae[0].x = w * 0.2; nebulae[0].y = h * 0.3; nebulae[0].rx = w * 0.35; nebulae[0].ry = h * 0.3;
      nebulae[1].x = w * 0.75; nebulae[1].y = h * 0.6; nebulae[1].rx = w * 0.3; nebulae[1].ry = h * 0.35;
      nebulae[2].x = w * 0.5; nebulae[2].y = h * 0.15; nebulae[2].rx = w * 0.4; nebulae[2].ry = h * 0.2;
      nebulae[3].x = w * 0.3; nebulae[3].y = h * 0.75; nebulae[3].rx = w * 0.25; nebulae[3].ry = h * 0.25;
      nebulae[4].x = w * 0.85; nebulae[4].y = h * 0.2; nebulae[4].rx = w * 0.2; nebulae[4].ry = h * 0.3;
    };

    const onPointerMove = (e) => {
      mouse.targetX = e.clientX;
      mouse.targetY = e.clientY;
      mouse.active = true;
    };
    const onPointerLeave = () => { mouse.active = false; };

    window.addEventListener('resize', onResize, { passive: true });
    window.addEventListener('pointermove', onPointerMove, { passive: true });
    document.addEventListener('mouseleave', onPointerLeave);

    // ── Render Loop ──
    const render = () => {
      if (document.hidden) {
        animRef.current = requestAnimationFrame(render);
        return;
      }

      time += 0.016; // ~60fps normalized

      // Smooth mouse LERP
      mouse.x += (mouse.targetX - mouse.x) * 0.06;
      mouse.y += (mouse.targetY - mouse.y) * 0.06;

      ctx.clearRect(0, 0, w, h);

      // 1. Subtle celestial ambient lighting
      const baseGrad = ctx.createRadialGradient(w * 0.5, h * 0.35, 0, w * 0.5, h * 0.5, Math.max(w, h) * 0.75);
      baseGrad.addColorStop(0, 'rgba(139, 92, 246, 0.04)');
      baseGrad.addColorStop(0.5, 'rgba(6, 182, 212, 0.02)');
      baseGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = baseGrad;
      ctx.fillRect(0, 0, w, h);

      // 2. Nebula clouds (slow-moving volumetric ellipses)
      if (!prefersReducedMotion) {
        for (const n of nebulae) {
          const breathe = Math.sin(time * 0.3 + n.phase) * 0.15 + 1;
          const grad = ctx.createRadialGradient(
            n.x + Math.sin(time * 0.2 + n.phase) * 20,
            n.y + Math.cos(time * 0.15 + n.phase) * 15,
            0,
            n.x, n.y,
            Math.max(n.rx, n.ry) * breathe
          );
          grad.addColorStop(0, `rgba(${n.r}, ${n.g}, ${n.b}, ${n.a * 1.5})`);
          grad.addColorStop(0.3, `rgba(${n.r}, ${n.g}, ${n.b}, ${n.a})`);
          grad.addColorStop(0.6, `rgba(${n.r}, ${n.g}, ${n.b}, ${n.a * 0.4})`);
          grad.addColorStop(1, 'rgba(0, 0, 0, 0)');

          ctx.save();
          ctx.translate(n.x, n.y);
          ctx.scale(n.rx / Math.max(n.rx, n.ry), n.ry / Math.max(n.rx, n.ry));
          ctx.translate(-n.x, -n.y);
          ctx.fillStyle = grad;
          ctx.fillRect(n.x - Math.max(n.rx, n.ry) * breathe, n.y - Math.max(n.rx, n.ry) * breathe,
            Math.max(n.rx, n.ry) * breathe * 2, Math.max(n.rx, n.ry) * breathe * 2);
          ctx.restore();
        }
      }

      // 3. Interactive cursor aurora glow
      if (mouse.active || mouse.x > 0) {
        const auroraGrad = ctx.createRadialGradient(mouse.x, mouse.y, 0, mouse.x, mouse.y, w > 768 ? 350 : 220);
        auroraGrad.addColorStop(0, 'rgba(139, 92, 246, 0.08)');
        auroraGrad.addColorStop(0.3, 'rgba(99, 102, 241, 0.04)');
        auroraGrad.addColorStop(0.6, 'rgba(6, 182, 212, 0.025)');
        auroraGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = auroraGrad;
        ctx.fillRect(0, 0, w, h);
      }

      // 4. Star field
      for (const star of stars) {
        if (!prefersReducedMotion) {
          star.twinklePhase += star.twinkleSpeed;
          star.alpha = star.baseAlpha + Math.sin(star.twinklePhase) * star.baseAlpha * 0.5;
          star.x += star.drift;
          if (star.x < -5) star.x = w + 5;
          if (star.x > w + 5) star.x = -5;
        } else {
          star.alpha = star.baseAlpha;
        }

        const [r, g, b] = star.color;
        ctx.beginPath();
        ctx.arc(star.x, star.y, star.radius, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${Math.max(0.05, star.alpha)})`;
        
        // Glow for larger/brighter stars
        if (star.radius > 1.2) {
          ctx.shadowBlur = star.radius * 4;
          ctx.shadowColor = `rgba(${r}, ${g}, ${b}, ${star.alpha * 0.6})`;
        }
        ctx.fill();
        ctx.shadowBlur = 0;
      }

      // 5. Interactive particles with connections
      const maxConnectDist = 100;
      for (const p of particles) {
        if (!prefersReducedMotion) {
          p.x += p.vx;
          p.y += p.vy;
          if (p.x < 0) p.x = w; else if (p.x > w) p.x = 0;
          if (p.y < 0) p.y = h; else if (p.y > h) p.y = 0;
          p.alpha = p.baseAlpha + Math.sin(time * 2 + p.hue) * 0.1;
        } else {
          p.alpha = p.baseAlpha;
        }

        // Mouse repulsion
        if (mouse.active) {
          const dx = mouse.x - p.x;
          const dy = mouse.y - p.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 150 && dist > 0) {
            const force = (1 - dist / 150) * 1.5;
            p.x -= (dx / dist) * force;
            p.y -= (dy / dist) * force;
            p.alpha = Math.min(1, p.alpha + force * 0.3);
          }
        }

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fillStyle = `hsla(${p.hue}, 70%, 70%, ${Math.max(0.1, p.alpha)})`;
        ctx.shadowBlur = p.radius * 3;
        ctx.shadowColor = `hsla(${p.hue}, 80%, 60%, 0.5)`;
        ctx.fill();
        ctx.shadowBlur = 0;
      }

      // Particle connections
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x;
          const dy = particles[i].y - particles[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < maxConnectDist) {
            const lineAlpha = (1 - dist / maxConnectDist) * 0.1;
            ctx.beginPath();
            ctx.moveTo(particles[i].x, particles[i].y);
            ctx.lineTo(particles[j].x, particles[j].y);
            ctx.strokeStyle = `rgba(140, 120, 255, ${lineAlpha})`;
            ctx.lineWidth = 0.5;
            ctx.stroke();
          }
        }
      }

      // Cursor-to-particle connections
      if (mouse.active) {
        for (const p of particles) {
          const dx = mouse.x - p.x;
          const dy = mouse.y - p.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 120) {
            const lineAlpha = (1 - dist / 120) * 0.2;
            ctx.beginPath();
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(mouse.x, mouse.y);
            ctx.strokeStyle = `rgba(160, 140, 255, ${lineAlpha})`;
            ctx.lineWidth = 0.6;
            ctx.stroke();
          }
        }
      }

      // 6. Shooting stars
      if (!prefersReducedMotion) {
        nextShootingStar--;
        if (nextShootingStar <= 0) {
          const startX = Math.random() * w;
          const startY = Math.random() * h * 0.4;
          const angle = Math.PI * 0.15 + Math.random() * Math.PI * 0.2;
          shootingStars.push({
            x: startX, y: startY,
            speed: Math.random() * 8 + 6,
            angle,
            length: Math.random() * 60 + 40,
            life: 1,
            decay: Math.random() * 0.02 + 0.015,
          });
          nextShootingStar = Math.random() * 400 + 150;
        }

        for (let i = shootingStars.length - 1; i >= 0; i--) {
          const s = shootingStars[i];
          s.x += Math.cos(s.angle) * s.speed;
          s.y += Math.sin(s.angle) * s.speed;
          s.life -= s.decay;

          if (s.life <= 0) {
            shootingStars.splice(i, 1);
            continue;
          }

          const tailX = s.x - Math.cos(s.angle) * s.length;
          const tailY = s.y - Math.sin(s.angle) * s.length;

          const trailGrad = ctx.createLinearGradient(tailX, tailY, s.x, s.y);
          trailGrad.addColorStop(0, 'rgba(255, 255, 255, 0)');
          trailGrad.addColorStop(0.7, `rgba(200, 210, 255, ${s.life * 0.3})`);
          trailGrad.addColorStop(1, `rgba(255, 255, 255, ${s.life * 0.8})`);

          ctx.beginPath();
          ctx.moveTo(tailX, tailY);
          ctx.lineTo(s.x, s.y);
          ctx.strokeStyle = trailGrad;
          ctx.lineWidth = 1.5;
          ctx.stroke();

          // Head glow
          ctx.beginPath();
          ctx.arc(s.x, s.y, 2, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(255, 255, 255, ${s.life * 0.9})`;
          ctx.shadowBlur = 8;
          ctx.shadowColor = `rgba(200, 220, 255, ${s.life * 0.8})`;
          ctx.fill();
          ctx.shadowBlur = 0;
        }
      }

      animRef.current = requestAnimationFrame(render);
    };

    animRef.current = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(animRef.current);
      window.removeEventListener('resize', onResize);
      window.removeEventListener('pointermove', onPointerMove);
      document.removeEventListener('mouseleave', onPointerLeave);
    };
  }, []);

  useEffect(() => {
    const cleanup = init();
    return cleanup;
  }, [init]);

  return (
    <div className="immersive-bg-root" aria-hidden="true">
      <canvas ref={canvasRef} className="immersive-canvas" />
      <div className="immersive-nebula-layer" />
      <div className="immersive-vignette" />
    </div>
  );
}
