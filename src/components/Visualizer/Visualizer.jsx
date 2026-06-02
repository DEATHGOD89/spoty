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

    const getThemeColors = () => {
      const root = document.documentElement;
      if (root.classList.contains('theme-black')) {
        return {
          barFill: (percent) => {
            const r = Math.floor(0 + percent * 168);
            const g = Math.floor(229 - percent * 144);
            const b = Math.floor(255 - percent * 8);
            return `rgb(${r}, ${g}, ${b})`;
          },
          idleWaves: [
            'rgba(0, 229, 255, 0.4)',
            'rgba(168, 85, 247, 0.3)',
            'rgba(0, 229, 255, 0.2)'
          ]
        };
      } else if (root.classList.contains('theme-white')) {
        return {
          barFill: (percent) => {
            const r = Math.floor(79 - percent * 73);
            const g = Math.floor(70 + percent * 112);
            const b = Math.floor(229 - percent * 17);
            return `rgb(${r}, ${g}, ${b})`;
          },
          idleWaves: [
            'rgba(79, 70, 229, 0.4)',
            'rgba(6, 182, 212, 0.3)',
            'rgba(236, 72, 153, 0.2)'
          ]
        };
      } else if (root.classList.contains('theme-green')) {
        return {
          barFill: (percent) => {
            const r = Math.floor(16 + percent * 36);
            const g = Math.floor(185 + percent * 26);
            const b = Math.floor(129 + percent * 24);
            return `rgb(${r}, ${g}, ${b})`;
          },
          idleWaves: [
            'rgba(16, 185, 129, 0.4)',
            'rgba(52, 211, 153, 0.3)',
            'rgba(5, 150, 105, 0.2)'
          ]
        };
      } else if (root.classList.contains('theme-orange')) {
        return {
          barFill: (percent) => {
            const r = Math.floor(249 + percent * 1);
            const g = Math.floor(115 + percent * 89);
            const b = Math.floor(22 - percent * 7);
            return `rgb(${r}, ${g}, ${b})`;
          },
          idleWaves: [
            'rgba(249, 115, 22, 0.4)',
            'rgba(250, 204, 21, 0.3)',
            'rgba(251, 146, 60, 0.2)'
          ]
        };
      } else {
        return {
          barFill: (percent) => {
            const r = Math.floor(142 + percent * 101);
            const g = Math.floor(46 + percent * 69);
            const b = Math.floor(62 + percent * 31);
            return `rgb(${r}, ${g}, ${b})`;
          },
          idleWaves: [
            'rgba(142, 46, 62, 0.4)',
            'rgba(243, 115, 93, 0.3)',
            'rgba(226, 88, 110, 0.25)'
          ]
        };
      }
    };

    const draw = () => {
      animationRef.current = requestAnimationFrame(draw);
      const themeColors = getThemeColors();

      // Create a gorgeous semi-transparent fade effect for neon trails
      ctx.fillStyle = document.documentElement.classList.contains('theme-white') ? 'rgba(238, 241, 246, 0.15)' : 'rgba(6, 6, 9, 0.15)';
      ctx.fillRect(0, 0, width, height);

      if (analyser && isPlaying && dataArray) {
        // --- REAL TIME FREQUENCY BAR VISUALIZER ---
        analyser.getByteFrequencyData(dataArray);

        const barWidth = (width / bufferLength) * 2.5;
        let x = 0;

        for (let i = 0; i < bufferLength; i++) {
          const barHeight = (dataArray[i] / 255) * height * 0.8;

          // Glowing multi-color gradient for active bands based on active theme
          const percent = i / bufferLength;
          const colorVal = themeColors.barFill(percent);

          ctx.fillStyle = colorVal;
          ctx.shadowBlur = 15;
          ctx.shadowColor = colorVal;

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
        ctx.shadowColor = themeColors.idleWaves[0];

        // Draw multiple beautiful sine waves
        const waveCount = 3;
        const colors = themeColors.idleWaves;

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
