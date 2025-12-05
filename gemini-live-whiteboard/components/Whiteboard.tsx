
import React, { useRef, useEffect, useState, useCallback, useImperativeHandle, forwardRef, memo } from 'react';
import { Point, WhiteboardHandle } from '../types';
import { arrayBufferToBase64 } from '../utils/audioUtils';

interface WhiteboardProps {
  onFrameCapture: (base64: string) => void;
  isActive: boolean;
}

const COLORS = ['#FFFFFF', '#EF4444', '#10B981', '#3B82F6', '#F59E0B', '#8B5CF6'];
const BRUSH_SIZES = [2, 4, 8, 12];

const WhiteboardComponent = forwardRef<WhiteboardHandle, WhiteboardProps>(({ onFrameCapture, isActive }, ref) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentColor, setCurrentColor] = useState(COLORS[0]);
  const [currentSize, setCurrentSize] = useState(BRUSH_SIZES[1]);
  const lastPoint = useRef<Point | null>(null);

  // Expose methods to parent (AI control)
  useImperativeHandle(ref, () => ({
    drawLines: (input: any) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const width = canvas.width;
      const height = canvas.height;

      console.log("Whiteboard raw input:", typeof input, input);

      let linesToDraw: any[] = [];

      // 1. Normalize Input
      let data = input;
      
      // Attempt to parse if string
      if (typeof data === 'string') {
        try {
          // Fix potentially double-escaped strings
          if (data.startsWith('"') || data.startsWith("'")) {
             data = JSON.parse(data);
          }
          // Parse JSON
          if (typeof data === 'string') {
             data = JSON.parse(data);
          }
        } catch (e) {
          console.error("Failed to parse input string", e);
        }
      }

      // Check structure after parsing
      if (Array.isArray(data)) {
        linesToDraw = data;
      } else if (typeof data === 'object' && data !== null) {
        if (Array.isArray(data.lines)) {
          linesToDraw = data.lines;
        } else {
          // Assume single object is a line
          linesToDraw = [data];
        }
      }

      console.log(`Processing ${linesToDraw.length} potential lines`);

      linesToDraw.forEach((rawLine, i) => {
        let line = rawLine;

        // Handle stringified line objects in array
        if (typeof line === 'string') {
          try {
            line = JSON.parse(line);
          } catch (e) {
            console.warn(`Skipping invalid line string at index ${i}`, rawLine);
            return;
          }
        }

        if (!line) return;

        // Helper to extract point safely
        const getVal = (obj: any, key: string, altKey?: string) => {
          if (obj && typeof obj === 'object') {
             if (key in obj) return obj[key];
             if (altKey && altKey in obj) return obj[altKey];
          }
          return undefined;
        }

        let startX, startY, endX, endY;

        // Try standard structure: start: {x,y}
        const start = line.start;
        const end = line.end;

        if (start && typeof start === 'object') {
             startX = getVal(start, 'x');
             startY = getVal(start, 'y');
        }
        if (end && typeof end === 'object') {
             endX = getVal(end, 'x');
             endY = getVal(end, 'y');
        }

        // Fallback: flat structure { x1, y1, x2, y2 } or { startX... }
        if (startX === undefined) startX = getVal(line, 'x1', 'startX');
        if (startY === undefined) startY = getVal(line, 'y1', 'startY');
        if (endX === undefined) endX = getVal(line, 'x2', 'endX');
        if (endY === undefined) endY = getVal(line, 'y2', 'endY');

        // Parse to float
        const sx = parseFloat(startX);
        const sy = parseFloat(startY);
        const ex = parseFloat(endX);
        const ey = parseFloat(endY);

        if (!isNaN(sx) && !isNaN(sy) && !isNaN(ex) && !isNaN(ey)) {
            // Convert normalized 1000x1000 coords to canvas size
            const canvasStartX = (sx / 1000) * width;
            const canvasStartY = (sy / 1000) * height;
            const canvasEndX = (ex / 1000) * width;
            const canvasEndY = (ey / 1000) * height;

            ctx.beginPath();
            ctx.moveTo(canvasStartX, canvasStartY);
            ctx.lineTo(canvasEndX, canvasEndY);
            
            ctx.strokeStyle = line.color || '#60A5FA'; // Light Blue
            ctx.lineWidth = line.width ? Number(line.width) : 4;
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            ctx.stroke();
            
            // console.log(`Drew line: ${sx},${sy} -> ${ex},${ey}`);
        } else {
             console.warn("Invalid coordinates for line:", line);
        }
      });
    },
    clear: () => {
      clearBoard();
    }
  }));

  // Initialize canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const resizeCanvas = () => {
      // Check if actual resize needed
      if (canvas.width !== container.clientWidth || canvas.height !== container.clientHeight) {
          canvas.width = container.clientWidth;
          canvas.height = container.clientHeight;
          
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.fillStyle = '#111827'; // gray-900
            ctx.fillRect(0, 0, canvas.width, canvas.height);
          }
      }
    };

    window.addEventListener('resize', resizeCanvas);
    resizeCanvas();

    return () => window.removeEventListener('resize', resizeCanvas);
  }, []);

  // Frame Capture Interval
  useEffect(() => {
    if (!isActive) return;

    const intervalId = setInterval(() => {
      const canvas = canvasRef.current;
      if (canvas) {
        canvas.toBlob(async (blob) => {
          if (blob) {
            const buffer = await blob.arrayBuffer();
            const base64 = arrayBufferToBase64(buffer);
            onFrameCapture(base64);
          }
        }, 'image/jpeg', 0.5);
      }
    }, 1000); // 1 FPS capture

    return () => clearInterval(intervalId);
  }, [isActive, onFrameCapture]);

  const getCoordinates = (e: React.MouseEvent | React.TouchEvent): Point | null => {
    const canvas = canvasRef.current;
    if (!canvas) return null;

    const rect = canvas.getBoundingClientRect();
    let clientX, clientY;

    if ('touches' in e) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = (e as React.MouseEvent).clientX;
      clientY = (e as React.MouseEvent).clientY;
    }

    return {
      x: clientX - rect.left,
      y: clientY - rect.top,
    };
  };

  const draw = useCallback((start: Point, end: Point) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.beginPath();
    ctx.moveTo(start.x, start.y);
    ctx.lineTo(end.x, end.y);
    ctx.strokeStyle = currentColor;
    ctx.lineWidth = currentSize;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke();
  }, [currentColor, currentSize]);

  const handleStart = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault(); 
    const point = getCoordinates(e);
    if (point) {
      setIsDrawing(true);
      lastPoint.current = point;
    }
  };

  const handleMove = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    if (!isDrawing || !lastPoint.current) return;

    const newPoint = getCoordinates(e);
    if (newPoint) {
      draw(lastPoint.current, newPoint);
      lastPoint.current = newPoint;
    }
  };

  const handleEnd = () => {
    setIsDrawing(false);
    lastPoint.current = null;
  };

  const clearBoard = () => {
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = '#111827';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }
    }
  };

  return (
    <div className="relative w-full h-full flex flex-col overflow-hidden" ref={containerRef}>
      {/* Canvas */}
      <canvas
        ref={canvasRef}
        className="touch-none cursor-crosshair active:cursor-crosshair"
        onMouseDown={handleStart}
        onMouseMove={handleMove}
        onMouseUp={handleEnd}
        onMouseLeave={handleEnd}
        onTouchStart={handleStart}
        onTouchMove={handleMove}
        onTouchEnd={handleEnd}
      />

      {/* Toolbar */}
      <div className="absolute top-4 left-1/2 transform -translate-x-1/2 bg-gray-800/90 backdrop-blur-sm p-3 rounded-full flex items-center gap-4 shadow-xl border border-gray-700 pointer-events-auto">
        <div className="flex gap-2 items-center border-r border-gray-600 pr-4">
          {COLORS.map((color) => (
            <button
              key={color}
              onClick={() => setCurrentColor(color)}
              className={`w-6 h-6 rounded-full border-2 transition-transform ${
                currentColor === color ? 'border-white scale-125' : 'border-transparent hover:scale-110'
              }`}
              style={{ backgroundColor: color }}
              aria-label={`Select color ${color}`}
            />
          ))}
        </div>

        <div className="flex gap-2 items-center border-r border-gray-600 pr-4">
          {BRUSH_SIZES.map((size) => (
            <button
              key={size}
              onClick={() => setCurrentSize(size)}
              className={`rounded-full bg-gray-400 transition-all ${
                currentSize === size ? 'bg-white' : 'hover:bg-gray-300'
              }`}
              style={{ width: size + 4, height: size + 4 }}
              aria-label={`Select brush size ${size}`}
            />
          ))}
        </div>

        <button
          onClick={clearBoard}
          className="text-gray-400 hover:text-white transition-colors"
          title="Clear Board"
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
            <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
          </svg>
        </button>
      </div>
    </div>
  );
});

WhiteboardComponent.displayName = 'Whiteboard';

export const Whiteboard = memo(WhiteboardComponent);
