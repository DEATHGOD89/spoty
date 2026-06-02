import React, { useEffect, useRef } from 'react';
import './Visualizer.css';

export default function Visualizer({ analyser, isPlaying }) {
  const canvasRef = useRef(null);
  const animationRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    let width = (canvas.width = canvas.parentElement.clientWidth);
    let height = (canvas.height = canvas.parentElement.clientHeight);

    // Handle Resize
    const resizeObserver = new ResizeObserver(() => {
      if (canvas && canvas.parentElement) {
        width = canvas.width = canvas.parentElement.clientWidth;
        height = canvas.height = canvas.parentElement.clientHeight;
      }
    });
    resizeObserver.observe(canvas.parentElement);

    // Buffers for real Web Audio Analyser
    const bufferLength = analyser ? analyser.frequencyBinCount : 0;
    const dataArray = analyser ? new Uint8Array(bufferLength) : null;

    // Simulated Idle Wave Animation States
    let simOffset = 0;

    const draw = () => {
      animationRef.current = requestAnimationFrame(draw);

      // Create a gorgeous semi-transparent fade effect for neon trails
      ctx.fillStyle = 'rgba(6, 6, 9, 0.15)';
      ctx.fillRect(0, 0, width, height);

      if (analyser && isPlaying && dataArray) {
        // --- REAL TIME FREQUENCY BAR VISUALIZER ---
        analyser.getByteFrequencyData(dataArray);

        const barWidth = (width / bufferLength) * 2.5;
        let x = 0;

        for (let i = 0; i < bufferLength; i++) {
          const barHeight = (dataArray[i] / 255) * height * 0.8;

          // Glowing multi-color gradient for active bands
          const percent = i / bufferLength;
          const r = Math.floor(139 + percent * 97); // Transition from violet to pink
          const g = Math.floor(92 - percent * 20);
          const b = Math.floor(246 - percent * 93);

          ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
          ctx.shadowBlur = 15;
          ctx.shadowColor = `rgba(${r}, ${g}, ${b}, 0.5)`;

          // Rounded bars
          ctx.beginPath();
          ctx.roundRect(x, height - barHeight, barWidth - 2, barHeight, [4, 4, 0, 0]);
          ctx.fill();

          x += barWidth;
        }
        ctx.shadowBlur = 0; // Reset
      } else {
        // --- IDLE / SIMULATED MUSIC WAVE (WOW Factor when paused/idle) ---
        ctx.shadowBlur = 10;
        ctx.shadowColor = 'rgba(139, 92, 246, 0.3)';

        // Draw multiple beautiful sine waves
        const waveCount = 3;
        const colors = [
          'rgba(139, 92, 246, 0.4)', // Purple
          'rgba(236, 72, 153, 0.3)', // Pink
          'rgba(6, 182, 212, 0.25)'  // Cyan
        ];

        simOffset += 0.02;

        for (let w = 0; w < waveCount; w++) {
          ctx.beginPath();
          ctx.lineWidth = w === 0 ? 3 : 1.5;
          ctx.strokeStyle = colors[w];

          const frequency = 0.005 + w * 0.002;
          const amplitude = 30 + w * 15;
          const speed = simOffset * (1 + w * 0.5);

          for (let x = 0; x < width; x++) {
            const y =
              height / 2 +
              Math.sin(x * frequency + speed) *
                amplitude *
                Math.sin(x * 0.002); // Taper edges
            if (x === 0) {
              ctx.moveTo(x, y);
            } else {
              ctx.lineTo(x, y);
            }
          }
          ctx.stroke();
        }
        ctx.shadowBlur = 0;
      }
    };

    draw();

    return () => {
      cancelAnimationFrame(animationRef.current);
      resizeObserver.disconnect();
    };
  }, [analyser, isPlaying]);

  return (
    <div className="visualizer-container">
      <canvas ref={canvasRef} className="visualizer-canvas" />
      <div className="visualizer-overlay">
        <span>DYNAMIC AUDIO VISUALIZER</span>
      </div>
    </div>
  );
}
