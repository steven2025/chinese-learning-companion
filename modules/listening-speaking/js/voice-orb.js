(function () {
  "use strict";

  class VoiceOrb {
    constructor(root, options = {}) {
      this.root = root;
      this.canvas = root?.querySelector("canvas") || null;
      this.ctx = this.canvas?.getContext("2d") || null;
      this.theme = options.theme || root?.dataset.orbTheme || "cyan";
      this.state = "idle";
      this.audioContext = null;
      this.analyser = null;
      this.source = null;
      this.data = null;
      this.synthetic = false;
      this.frame = 0;
      this.raf = 0;
      this.particles = Array.from({ length: 72 }, (_, index) => ({
        angle: (Math.PI * 2 * index) / 72,
        drift: Math.random() * Math.PI * 2,
        speed: 0.006 + Math.random() * 0.01,
        size: 1.2 + Math.random() * 2.4
      }));

      if (!this.root || !this.canvas || !this.ctx) return;
      this.root.dataset.orbTheme = this.theme;
      this.resize();
      this.setState("idle");
      window.addEventListener("resize", () => this.resize());
      this.draw();
    }

    setTheme(theme) {
      this.theme = theme || "cyan";
      if (this.root) this.root.dataset.orbTheme = this.theme;
    }

    setState(state, options = {}) {
      this.state = state || "idle";
      this.synthetic = Boolean(options.synthetic);
      if (!this.root) return;
      this.root.classList.toggle("is-active", ["playing", "recording", "processing"].includes(this.state));
      this.root.classList.toggle("is-complete", this.state === "complete");
      this.root.classList.toggle("is-error", this.state === "error");
      if (!this.raf) this.draw();
    }

    async attachStream(stream) {
      this.detachAudio(false);
      if (!stream || !window.AudioContext) return;
      this.audioContext = new AudioContext();
      this.source = this.audioContext.createMediaStreamSource(stream);
      this.attachAnalyser();
    }

    async attachMediaElement(audio) {
      this.detachAudio(false);
      if (!audio || !window.AudioContext) return;
      this.audioContext = new AudioContext();
      this.source = this.audioContext.createMediaElementSource(audio);
      this.attachAnalyser();
      this.analyser.connect(this.audioContext.destination);
    }

    attachAnalyser() {
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 512;
      this.data = new Uint8Array(this.analyser.frequencyBinCount);
      this.source.connect(this.analyser);
    }

    detachAudio(closeContext = true) {
      try { this.source?.disconnect(); } catch (_) {}
      try { this.analyser?.disconnect(); } catch (_) {}
      if (closeContext) this.audioContext?.close?.().catch(() => {});
      this.audioContext = null;
      this.analyser = null;
      this.source = null;
      this.data = null;
      this.synthetic = false;
    }

    destroy() {
      if (this.raf) cancelAnimationFrame(this.raf);
      this.raf = 0;
      this.detachAudio();
    }

    resize() {
      const rect = this.root.getBoundingClientRect();
      const ratio = Math.max(1, Math.min(window.devicePixelRatio || 1, 2));
      const size = Math.max(1, Math.round(Math.min(rect.width || 96, rect.height || 96)));
      this.canvas.width = Math.round(size * ratio);
      this.canvas.height = Math.round(size * ratio);
      this.canvas.style.width = `${size}px`;
      this.canvas.style.height = `${size}px`;
      this.ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    }

    getEnergy() {
      if (this.analyser && this.data) {
        this.analyser.getByteFrequencyData(this.data);
        const total = this.data.reduce((sum, value) => sum + value, 0);
        return Math.min(1, total / this.data.length / 110);
      }
      if (this.synthetic || ["playing", "recording", "processing"].includes(this.state)) {
        return 0.45 + Math.sin(this.frame * 0.075) * 0.18 + Math.sin(this.frame * 0.021) * 0.12;
      }
      if (this.state === "complete") return 0.34;
      if (this.state === "error") return 0.28;
      return 0.16 + Math.sin(this.frame * 0.025) * 0.05;
    }

    palette() {
      const palettes = {
        cyan: ["rgba(100,231,230,.95)", "rgba(31,137,214,.55)", "rgba(215,255,255,.9)"],
        violet: ["rgba(184,137,255,.96)", "rgba(110,79,226,.55)", "rgba(244,235,255,.9)"],
        green: ["rgba(120,229,173,.96)", "rgba(38,176,121,.5)", "rgba(237,255,246,.9)"],
        red: ["rgba(255,126,148,.96)", "rgba(222,71,103,.5)", "rgba(255,238,241,.9)"]
      };
      return palettes[this.theme] || palettes.cyan;
    }

    draw = () => {
      if (!this.ctx || !this.canvas) return;
      this.frame += 1;
      const width = this.canvas.clientWidth || 96;
      const height = this.canvas.clientHeight || 96;
      const cx = width / 2;
      const cy = height / 2;
      const radius = Math.min(width, height) * 0.3;
      const energy = Math.max(0, Math.min(1, this.getEnergy()));
      const [primary, glow, highlight] = this.palette();

      this.ctx.clearRect(0, 0, width, height);
      const gradient = this.ctx.createRadialGradient(cx, cy, 2, cx, cy, radius * (1.45 + energy));
      gradient.addColorStop(0, highlight);
      gradient.addColorStop(0.38, primary);
      gradient.addColorStop(1, "rgba(7,19,30,0)");
      this.ctx.fillStyle = gradient;
      this.ctx.beginPath();
      this.ctx.arc(cx, cy, radius * (1 + energy * 0.22), 0, Math.PI * 2);
      this.ctx.fill();

      this.ctx.strokeStyle = glow;
      this.ctx.lineWidth = 1.2;
      this.ctx.beginPath();
      this.particles.forEach((particle, index) => {
        const pulse = Math.sin(this.frame * particle.speed + particle.drift) * 0.5 + 0.5;
        const ring = radius * (1.12 + energy * 0.62 + pulse * 0.14);
        const angle = particle.angle + this.frame * 0.003;
        const x = cx + Math.cos(angle) * ring;
        const y = cy + Math.sin(angle) * ring;
        if (index === 0) this.ctx.moveTo(x, y);
        else this.ctx.lineTo(x, y);
      });
      this.ctx.closePath();
      this.ctx.stroke();

      this.particles.forEach(particle => {
        const pulse = Math.sin(this.frame * particle.speed + particle.drift) * 0.5 + 0.5;
        const ring = radius * (1.2 + energy * 0.85 + pulse * 0.2);
        const angle = particle.angle - this.frame * 0.004;
        this.ctx.fillStyle = primary;
        this.ctx.globalAlpha = 0.22 + energy * 0.45;
        this.ctx.beginPath();
        this.ctx.arc(cx + Math.cos(angle) * ring, cy + Math.sin(angle) * ring, particle.size, 0, Math.PI * 2);
        this.ctx.fill();
      });
      this.ctx.globalAlpha = 1;

      this.raf = requestAnimationFrame(this.draw);
    };
  }

  window.VoiceOrb = VoiceOrb;
})();
