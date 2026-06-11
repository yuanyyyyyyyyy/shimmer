<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue'

const canvas = ref(null)
let animationId = null

onMounted(() => {
  const cvs = canvas.value
  const ctx = cvs.getContext('2d')
  let w, h, particles = []

  const resize = () => {
    w = cvs.width = window.innerWidth
    h = cvs.height = window.innerHeight
  }

  class Particle {
    constructor() { this.reset() }
    reset() {
      this.x = Math.random() * w
      this.y = Math.random() * h
      this.size = Math.random() * 2 + 0.3
      this.speedX = (Math.random() - 0.5) * 0.2
      this.speedY = (Math.random() - 0.5) * 0.2
      this.opacity = Math.random() * 0.3 + 0.05
    }
    update() {
      this.x += this.speedX
      this.y += this.speedY
      if (this.x < -10 || this.x > w + 10) this.reset()
      if (this.y < -10 || this.y > h + 10) this.reset()
    }
    draw() {
      ctx.beginPath()
      ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2)
      ctx.fillStyle = `rgba(255,255,255,${this.opacity})`
      ctx.fill()
    }
  }

  const count = Math.min(50, Math.floor((w * h) / 20000))
  for (let i = 0; i < count; i++) particles.push(new Particle())

  const animate = () => {
    ctx.clearRect(0, 0, w, h)
    particles.forEach(p => { p.update(); p.draw() })
    animationId = requestAnimationFrame(animate)
  }

  resize()
  animate()
  window.addEventListener('resize', resize)
})

onBeforeUnmount(() => {
  cancelAnimationFrame(animationId)
})
</script>

<template>
  <canvas ref="canvas" class="particles-bg"></canvas>
</template>

<style scoped>
.particles-bg {
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: 1;
}
</style>
