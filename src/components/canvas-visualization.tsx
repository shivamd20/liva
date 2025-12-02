import { useEffect, useRef, useState } from "react"

interface Cursor {
  id: number
  x: number
  y: number
  targetX: number
  targetY: number
  color: string
  name: string
}

interface Shape {
  id: number
  type: "rect" | "circle" | "diamond" | "arrow" | "text"
  x: number
  y: number
  width: number
  height: number
  opacity: number
  rotation: number
}

interface GhostShape {
  x: number
  y: number
  opacity: number
  scale: number
  type: "rect" | "circle"
}

export function CanvasVisualization() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animationRef = useRef<number>()
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 })

  const cursorsRef = useRef<Cursor[]>([])
  const shapesRef = useRef<Shape[]>([])
  const ghostRef = useRef<GhostShape>({ x: 0, y: 0, opacity: 0, scale: 0.95, type: "rect" })
  const timeRef = useRef(0)
  const isDarkRef = useRef(false)

  useEffect(() => {
    const updateDimensions = () => {
      setDimensions({
        width: window.innerWidth,
        height: window.innerHeight,
      })
    }

    const checkDark = () => {
      isDarkRef.current = window.matchMedia("(prefers-color-scheme: dark)").matches
    }

    updateDimensions()
    checkDark()

    window.addEventListener("resize", updateDimensions)
    const darkMediaQuery = window.matchMedia("(prefers-color-scheme: dark)")
    darkMediaQuery.addEventListener("change", checkDark)

    return () => {
      window.removeEventListener("resize", updateDimensions)
      darkMediaQuery.removeEventListener("change", checkDark)
    }
  }, [])

  useEffect(() => {
    if (!dimensions.width || !dimensions.height) return

    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext("2d")
    if (!ctx) return

    // Initialize cursors (representing live collaboration)
    const cursorColors = ["#6366f1", "#10b981", "#f59e0b"]
    const cursorNames = ["Sarah", "Alex", "Jordan"]
    cursorsRef.current = cursorColors.map((color, i) => ({
      id: i,
      x: dimensions.width * (0.3 + i * 0.2),
      y: dimensions.height * (0.3 + i * 0.1),
      targetX: dimensions.width * (0.3 + i * 0.2),
      targetY: dimensions.height * (0.3 + i * 0.1),
      color,
      name: cursorNames[i],
    }))

    // Initialize board shapes (like an actual whiteboard)
    const shapes: Shape[] = [
      // Main flowchart nodes
      {
        id: 0,
        type: "rect",
        x: dimensions.width * 0.15,
        y: dimensions.height * 0.25,
        width: 100,
        height: 60,
        opacity: 0.15,
        rotation: 0,
      },
      {
        id: 1,
        type: "diamond",
        x: dimensions.width * 0.35,
        y: dimensions.height * 0.25,
        width: 70,
        height: 70,
        opacity: 0.12,
        rotation: 0,
      },
      {
        id: 2,
        type: "rect",
        x: dimensions.width * 0.55,
        y: dimensions.height * 0.2,
        width: 90,
        height: 50,
        opacity: 0.1,
        rotation: 0,
      },
      {
        id: 3,
        type: "circle",
        x: dimensions.width * 0.75,
        y: dimensions.height * 0.3,
        width: 60,
        height: 60,
        opacity: 0.12,
        rotation: 0,
      },
      // Second row
      {
        id: 4,
        type: "rect",
        x: dimensions.width * 0.25,
        y: dimensions.height * 0.55,
        width: 120,
        height: 70,
        opacity: 0.1,
        rotation: 0,
      },
      {
        id: 5,
        type: "rect",
        x: dimensions.width * 0.5,
        y: dimensions.height * 0.6,
        width: 80,
        height: 45,
        opacity: 0.08,
        rotation: 0,
      },
      {
        id: 6,
        type: "diamond",
        x: dimensions.width * 0.7,
        y: dimensions.height * 0.55,
        width: 55,
        height: 55,
        opacity: 0.1,
        rotation: 0,
      },
      // Text blocks
      {
        id: 7,
        type: "text",
        x: dimensions.width * 0.1,
        y: dimensions.height * 0.7,
        width: 150,
        height: 40,
        opacity: 0.08,
        rotation: 0,
      },
      {
        id: 8,
        type: "text",
        x: dimensions.width * 0.82,
        y: dimensions.height * 0.65,
        width: 100,
        height: 30,
        opacity: 0.06,
        rotation: 0,
      },
    ]
    shapesRef.current = shapes

    // Ghost shape (AI suggestion)
    ghostRef.current = {
      x: dimensions.width * 0.6,
      y: dimensions.height * 0.4,
      opacity: 0,
      scale: 0.95,
      type: "rect",
    }

    const draw = () => {
      timeRef.current += 0.016
      ctx.clearRect(0, 0, dimensions.width, dimensions.height)

      const isDark = isDarkRef.current
      const baseColor = isDark ? [99, 102, 241] : [79, 82, 201]

      // Draw subtle grid
      ctx.strokeStyle = isDark ? "rgba(99, 102, 241, 0.03)" : "rgba(79, 82, 201, 0.04)"
      ctx.lineWidth = 1
      const gridSize = 60
      for (let x = 0; x < dimensions.width; x += gridSize) {
        ctx.beginPath()
        ctx.moveTo(x, 0)
        ctx.lineTo(x, dimensions.height)
        ctx.stroke()
      }
      for (let y = 0; y < dimensions.height; y += gridSize) {
        ctx.beginPath()
        ctx.moveTo(0, y)
        ctx.lineTo(dimensions.width, y)
        ctx.stroke()
      }

      // Draw connection lines between shapes
      const connections = [
        [0, 1],
        [1, 2],
        [2, 3],
        [1, 4],
        [4, 5],
        [5, 6],
      ]
      ctx.strokeStyle = isDark ? "rgba(99, 102, 241, 0.1)" : "rgba(79, 82, 201, 0.12)"
      ctx.lineWidth = 2
      ctx.setLineDash([8, 6])

      connections.forEach(([fromIdx, toIdx]) => {
        const from = shapesRef.current[fromIdx]
        const to = shapesRef.current[toIdx]
        if (!from || !to) return

        ctx.beginPath()
        const fromX = from.x + from.width / 2
        const fromY = from.y + from.height / 2
        const toX = to.x + to.width / 2
        const toY = to.y + to.height / 2

        // Curved line
        const midX = (fromX + toX) / 2
        const midY = (fromY + toY) / 2 - 30
        ctx.moveTo(fromX, fromY)
        ctx.quadraticCurveTo(midX, midY, toX, toY)
        ctx.stroke()
      })
      ctx.setLineDash([])

      // Draw shapes
      shapesRef.current.forEach((shape) => {
        ctx.save()
        ctx.globalAlpha = shape.opacity
        ctx.fillStyle = isDark ? `rgba(${baseColor.join(",")}, 0.2)` : `rgba(${baseColor.join(",")}, 0.15)`
        ctx.strokeStyle = isDark ? `rgba(${baseColor.join(",")}, 0.35)` : `rgba(${baseColor.join(",")}, 0.25)`
        ctx.lineWidth = 1.5

        const centerX = shape.x + shape.width / 2
        const centerY = shape.y + shape.height / 2

        switch (shape.type) {
          case "rect":
            ctx.beginPath()
            ctx.roundRect(shape.x, shape.y, shape.width, shape.height, 8)
            ctx.fill()
            ctx.stroke()
            break
          case "circle":
            ctx.beginPath()
            ctx.arc(centerX, centerY, shape.width / 2, 0, Math.PI * 2)
            ctx.fill()
            ctx.stroke()
            break
          case "diamond":
            ctx.beginPath()
            ctx.moveTo(centerX, shape.y)
            ctx.lineTo(shape.x + shape.width, centerY)
            ctx.lineTo(centerX, shape.y + shape.height)
            ctx.lineTo(shape.x, centerY)
            ctx.closePath()
            ctx.fill()
            ctx.stroke()
            break
          case "text":
            // Draw text lines
            const lineHeight = 6
            const lineGap = 8
            for (let i = 0; i < 3; i++) {
              const lineWidth = shape.width * (1 - i * 0.15)
              ctx.fillStyle = isDark ? `rgba(${baseColor.join(",")}, 0.25)` : `rgba(${baseColor.join(",")}, 0.2)`
              ctx.beginPath()
              ctx.roundRect(shape.x, shape.y + i * (lineHeight + lineGap), lineWidth, lineHeight, 3)
              ctx.fill()
            }
            break
        }
        ctx.restore()
      })

      // Draw AI ghost suggestion (pulsing in and out)
      const ghostCycle = (Math.sin(timeRef.current * 0.8) + 1) / 2
      const ghostOpacity = ghostCycle > 0.7 ? (ghostCycle - 0.7) * 1.5 : 0
      if (ghostOpacity > 0) {
        ctx.save()
        ctx.globalAlpha = ghostOpacity * 0.25
        ctx.strokeStyle = isDark ? "rgba(16, 185, 129, 0.5)" : "rgba(16, 185, 129, 0.4)"
        ctx.setLineDash([4, 4])
        ctx.lineWidth = 2
        ctx.beginPath()
        ctx.roundRect(ghostRef.current.x, ghostRef.current.y, 100, 60, 8)
        ctx.stroke()

        // AI label
        ctx.font = "10px system-ui"
        ctx.fillStyle = isDark ? "rgba(16, 185, 129, 0.6)" : "rgba(16, 185, 129, 0.5)"
        ctx.fillText("AI suggestion", ghostRef.current.x, ghostRef.current.y - 8)
        ctx.restore()
      }

      // Update and draw cursors with smooth movement
      cursorsRef.current.forEach((cursor, i) => {
        // Update target position periodically
        if (Math.random() < 0.01) {
          cursor.targetX = dimensions.width * (0.2 + Math.random() * 0.6)
          cursor.targetY = dimensions.height * (0.2 + Math.random() * 0.5)
        }

        // Smooth interpolation
        cursor.x += (cursor.targetX - cursor.x) * 0.02
        cursor.y += (cursor.targetY - cursor.y) * 0.02

        // Draw cursor
        ctx.save()

        // Cursor pointer
        ctx.fillStyle = cursor.color
        ctx.beginPath()
        ctx.moveTo(cursor.x, cursor.y)
        ctx.lineTo(cursor.x + 12, cursor.y + 10)
        ctx.lineTo(cursor.x + 5, cursor.y + 10)
        ctx.lineTo(cursor.x + 5, cursor.y + 16)
        ctx.lineTo(cursor.x, cursor.y + 12)
        ctx.closePath()
        ctx.fill()

        // Name label
        ctx.fillStyle = cursor.color
        ctx.globalAlpha = 0.9
        ctx.beginPath()
        ctx.roundRect(cursor.x + 14, cursor.y + 8, cursor.name.length * 7 + 10, 18, 4)
        ctx.fill()

        ctx.font = "11px system-ui"
        ctx.fillStyle = "white"
        ctx.fillText(cursor.name, cursor.x + 19, cursor.y + 20)

        ctx.restore()
      })

      animationRef.current = requestAnimationFrame(draw)
    }

    draw()

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }
    }
  }, [dimensions])

  return (
    <canvas
      ref={canvasRef}
      width={dimensions.width}
      height={dimensions.height}
      className="absolute inset-0 w-full h-full"
      aria-hidden="true"
    />
  )
}
