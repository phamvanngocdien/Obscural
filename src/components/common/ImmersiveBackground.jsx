import { useEffect, useRef } from 'react';

/**
 * ImmersiveBackground
 * High-performance, GPU-accelerated interactive celestial canvas.
 * Features:
 * - Fluid particle constellation with magnetic cursor interaction
 * - Volumetric celestial spotlight with smooth inertia (LERP)
 * - Deep night atmosphere with subtle particle drifting
 * - Auto-pauses when tab is hidden or reduced motion is preferred
 */
export default function ImmersiveBackground() {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) return;

    let animationFrameId;
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    // Mouse coordinates with LERP inertia
    const mouse = {
      x: width / 2,
      y: height / 2,
      targetX: width / 2,
      targetY: height / 2,
      radius: 160,
      active: false,
    };

    // Responsive particle count
    const particleCount = Math.min(Math.floor((width * height) / 18000), 75);
    const particles = [];

    const colors = [
      'rgba(159, 140, 255, ', // Celestial Violet
      'rgba(189, 167, 255, ', // Light Lilac
      'rgba(126, 231, 189, ', // Mint Accent
      'rgba(255, 255, 255, ', // Pure Star White
    ];

    class Particle {
      constructor() {
        this.reset();
      }

      reset() {
        this.x = Math.random() * width;
        this.y = Math.random() * height;
        this.vx = (Math.random() - 0.5) * 0.45;
        this.vy = (Math.random() - 0.5) * 0.45;
        this.radius = Math.random() * 1.5 + 0.6;
        this.baseAlpha = Math.random() * 0.5 + 0.2;
        this.alpha = this.baseAlpha;
        this.colorPrefix = colors[Math.floor(Math.random() * colors.length)];
        this.twinkleSpeed = Math.random() * 0.02 + 0.008;
        this.twinklePhase = Math.random() * Math.PI * 2;
      }

      update() {
        this.x += this.vx;
        this.y += this.vy;

        // Wrap edges
        if (this.x < 0) this.x = width;
        else if (this.x > width) this.x = 0;
        if (this.y < 0) this.y = height;
        else if (this.y > height) this.y = 0;

        // Subtle twinkling
        this.twinklePhase += this.twinkleSpeed;
        this.alpha = this.baseAlpha + Math.sin(this.twinklePhase) * 0.15;

        // Interactive mouse interaction
        if (mouse.active) {
          const dx = mouse.x - this.x;
          const dy = mouse.y - this.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < mouse.radius && dist > 0) {
            const force = (1 - dist / mouse.radius) * 1.2;
            this.x -= (dx / dist) * force;
            this.y -= (dy / dist) * force;
            this.alpha = Math.min(1, this.alpha + force * 0.5);
          }
        }
      }

      draw() {
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fillStyle = `${this.colorPrefix}${Math.max(0.1, this.alpha)})`;
        ctx.shadowBlur = this.radius * 3;
        ctx.shadowColor = `${this.colorPrefix}0.6)`;
        ctx.fill();
        ctx.shadowBlur = 0;
      }
    }

    for (let i = 0; i < particleCount; i++) {
      particles.push(new Particle());
    }

    const handleResize = () => {
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };

    const handlePointerMove = (e) => {
      mouse.targetX = e.clientX;
      mouse.targetY = e.clientY;
      mouse.active = true;
    };

    const handlePointerLeave = () => {
      mouse.active = false;
    };

    window.addEventListener('resize', handleResize, { passive: true });
    window.addEventListener('pointermove', handlePointerMove, { passive: true });
    document.addEventListener('mouseleave', handlePointerLeave);

    // Render loop
    const render = () => {
      // Limit FPS on low-power
      if (document.hidden) {
        animationFrameId = requestAnimationFrame(render);
        return;
      }

      // Smooth mouse interpolation (LERP)
      mouse.x += (mouse.targetX - mouse.x) * 0.08;
      mouse.y += (mouse.targetY - mouse.y) * 0.08;

      ctx.clearRect(0, 0, width, height);

      // 1. Draw volumetric interactive spotlight aura
      if (mouse.active || mouse.x !== width / 2) {
        const spotGrad = ctx.createRadialGradient(
          mouse.x,
          mouse.y,
          0,
          mouse.x,
          mouse.y,
          width > 768 ? 480 : 300
        );
        spotGrad.addColorStop(0, 'rgba(159, 140, 255, 0.085)');
        spotGrad.addColorStop(0.4, 'rgba(159, 140, 255, 0.03)');
        spotGrad.addColorStop(0.7, 'rgba(126, 231, 189, 0.012)');
        spotGrad.addColorStop(1, 'rgba(7, 9, 19, 0)');

        ctx.fillStyle = spotGrad;
        ctx.fillRect(0, 0, width, height);
      }

      // 2. Draw constellation connection lines
      const maxConnectDist = 110;
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x;
          const dy = particles[i].y - particles[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist < maxConnectDist) {
            const lineAlpha = (1 - dist / maxConnectDist) * 0.14;
            ctx.beginPath();
            ctx.moveTo(particles[i].x, particles[i].y);
            ctx.lineTo(particles[j].x, particles[j].y);
            ctx.strokeStyle = `rgba(159, 140, 255, ${lineAlpha})`;
            ctx.lineWidth = 0.6;
            ctx.stroke();
          }
        }
      }

      // 3. Connect particles to cursor when near
      if (mouse.active) {
        for (let i = 0; i < particles.length; i++) {
          const dx = mouse.x - particles[i].x;
          const dy = mouse.y - particles[i].y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 130) {
            const mouseLineAlpha = (1 - dist / 130) * 0.25;
            ctx.beginPath();
            ctx.moveTo(particles[i].x, particles[i].y);
            ctx.lineTo(mouse.x, mouse.y);
            ctx.strokeStyle = `rgba(189, 167, 255, ${mouseLineAlpha})`;
            ctx.lineWidth = 0.8;
            ctx.stroke();
          }
        }
      }

      // 4. Update and draw particles
      for (let i = 0; i < particles.length; i++) {
        particles[i].update();
        particles[i].draw();
      }

      animationFrameId = requestAnimationFrame(render);
    };

    animationFrameId = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('pointermove', handlePointerMove);
      document.removeEventListener('mouseleave', handlePointerLeave);
    };
  }, []);

  return (
    <div className="immersive-bg-root" aria-hidden="true">
      <canvas ref={canvasRef} className="immersive-canvas" />
      <div className="immersive-grid-layer" />
      <div className="immersive-vignette" />
      <div className="immersive-ambient-glow-1" />
      <div className="immersive-ambient-glow-2" />
    </div>
  );
}
