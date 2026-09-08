// src/components/admin/FlowFieldBackground.jsx
// Canvas con partículas en flow field — usado como background del LoginScreen.
// Adaptado de un componente shadcn/TS original a JSX puro sin libs externas.
//
// Props:
//   color         — color de las partículas (default ámbar #f59e0b)
//   pulseColor    — color del pulso que recorre el flujo (default: ninguno)
//   pulseSize     — cuántas partículas lo forman (default 46)
//   pulseLife     — cuántos frames dura cada pulso (default 260)
//   pulseGap      — frames de silencio entre un pulso y el siguiente (default 150)
//   trailOpacity  — opacidad del rastro: bajo = trail largo (default 0.1)
//   particleCount — cantidad (default 600)
//   speed         — multiplicador de velocidad (default 0.8)
//   bgColor       — color del canvas en cada frame para crear trails (default #0a0a0a)
//
// ─────────────── LAS VENAS Y EL PULSO QUE LAS RECORRE ───────────────
//
// Son DOS cosas distintas y por eso se dibujan distinto.
//
// LAS VENAS son todas las partículas, todas del mismo color —Volt, que en el
// sistema significa "actividad interna, nunca protagonista"—. Es la máquina
// trabajando: constante, sin acentos, sin nadie mirándola.
//
// EL PULSO es un GRUPO que viaja JUNTO, en oro. No son partículas doradas
// sueltas repartidas entre las otras —eso se probó y no dice nada: de lejos
// es ruido de dos colores—. Nace en un borde, recorre el MISMO campo que las
// venas —así que va por donde van ellas— y se apaga; después de un silencio,
// vuelve a nacer. Eso es lo que lo hace leer como un latido atravesando el
// sistema y no como decoración.
//
// LO QUE LO MANTIENE JUNTO es una fuerza hacia el centro del propio grupo. El
// campo solo no alcanza: dos partículas que arrancan a diez píxeles una de
// otra terminan en ramas distintas del flujo y el bloque se deshace.

import { useEffect, useRef } from "react";
import { crearPulso } from "./pulsoDeFlujo";

export default function FlowFieldBackground({
  color = "#f59e0b",
  pulseColor = null,
  pulseSize = 130,
  pulseLife = 300,
  pulseGap = 140,
  trailOpacity = 0.1,
  particleCount = 600,
  speed = 0.8,
  bgColor = "10,10,10", // rgb sin paréntesis para inyectar en rgba()
  className = "",
  style = {},
}) {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let width = container.clientWidth;
    let height = container.clientHeight;
    let particles = [];
    let animationFrameId;
    const mouse = { x: -1000, y: -1000 };

    class Particle {
      constructor() {
        this.x = Math.random() * width;
        this.y = Math.random() * height;
        this.vx = 0;
        this.vy = 0;
        this.age = 0;
        this.life = Math.random() * 200 + 100;
      }
      update() {
        const angle = (Math.cos(this.x * 0.005) + Math.sin(this.y * 0.005)) * Math.PI;
        this.vx += Math.cos(angle) * 0.2 * speed;
        this.vy += Math.sin(angle) * 0.2 * speed;
        const dx = mouse.x - this.x;
        const dy = mouse.y - this.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        const interactionRadius = 150;
        if (distance < interactionRadius) {
          const force = (interactionRadius - distance) / interactionRadius;
          this.vx -= dx * force * 0.05;
          this.vy -= dy * force * 0.05;
        }
        this.x += this.vx;
        this.y += this.vy;
        this.vx *= 0.95;
        this.vy *= 0.95;
        this.age++;
        if (this.age > this.life) this.reset();
        if (this.x < 0) this.x = width;
        if (this.x > width) this.x = 0;
        if (this.y < 0) this.y = height;
        if (this.y > height) this.y = 0;
      }
      reset() {
        this.x = Math.random() * width;
        this.y = Math.random() * height;
        this.vx = 0;
        this.vy = 0;
        this.age = 0;
        this.life = Math.random() * 200 + 100;
      }
      draw(c) {
        c.fillStyle = color;
        const alpha = 1 - Math.abs(this.age / this.life - 0.5) * 2;
        c.globalAlpha = alpha;
        c.fillRect(this.x, this.y, 1.5, 1.5);
      }
    }

    /* El pulso: un grupo que viaja junto por el mismo campo.
     *
     * La logica vive en `pulsoDeFlujo.js` y no aca adentro por una razon
     * practica: el navegador congela `requestAnimationFrame` cuando la
     * pestania no se dibuja, asi que un pulso metido en el loop de render no
     * se puede medir. Afuera es una funcion de estado a estado y se le pueden
     * pedir cuatrocientos cuadros para comprobar que el grupo sigue junto.
     * Aca queda SOLO como se pinta. */
    const pulso = pulseColor
      ? crearPulso({ ancho: width, alto: height, tamanio: pulseSize, vida: pulseLife, silencio: pulseGap, velocidad: speed })
      : null;

    const dibujarPulso = (c) => {
      if (!pulso) return;
      pulso.mover();
      const alpha = pulso.opacidad();
      if (alpha <= 0) return;
      c.globalAlpha = alpha;
      c.fillStyle = pulseColor;
      // El resplandor lo separa del fondo sin agrandarlo: el oro sobre negro
      // rinde menos que el azul al mismo tamanio.
      c.shadowColor = pulseColor;
      c.shadowBlur = 9;
      // 3px y no 2: el pulso tiene que pesar mas que una vena, no igual.
      for (const p of pulso.estado.puntos) c.fillRect(p.x, p.y, 3, 3);
      c.shadowBlur = 0;
    };

    const init = () => {
      const dpr = window.devicePixelRatio || 1;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      ctx.scale(dpr, dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      particles = [];
      for (let i = 0; i < particleCount; i++) particles.push(new Particle());
    };

    const animate = () => {
      ctx.fillStyle = `rgba(${bgColor}, ${trailOpacity})`;
      ctx.fillRect(0, 0, width, height);
      particles.forEach((p) => {
        p.update();
        p.draw(ctx);
      });
      // El pulso va DESPUES: pasa por encima de las venas, no entre ellas.
      dibujarPulso(ctx);
      animationFrameId = requestAnimationFrame(animate);
    };

    const handleResize = () => {
      width = container.clientWidth;
      height = container.clientHeight;
      init();
    };
    const handleMouseMove = (e) => {
      const rect = canvas.getBoundingClientRect();
      mouse.x = e.clientX - rect.left;
      mouse.y = e.clientY - rect.top;
    };
    const handleMouseLeave = () => {
      mouse.x = -1000;
      mouse.y = -1000;
    };

    init();
    animate();
    window.addEventListener("resize", handleResize);
    container.addEventListener("mousemove", handleMouseMove);
    container.addEventListener("mouseleave", handleMouseLeave);

    return () => {
      window.removeEventListener("resize", handleResize);
      container.removeEventListener("mousemove", handleMouseMove);
      container.removeEventListener("mouseleave", handleMouseLeave);
      cancelAnimationFrame(animationFrameId);
    };
  }, [color, pulseColor, pulseSize, pulseLife, pulseGap, trailOpacity, particleCount, speed, bgColor]);

  return (
    <div
      ref={containerRef}
      className={className}
      style={{
        position: "absolute",
        inset: 0,
        background: `rgb(${bgColor})`,
        overflow: "hidden",
        ...style,
      }}
    >
      <canvas ref={canvasRef} style={{ display: "block", width: "100%", height: "100%" }} />
    </div>
  );
}
