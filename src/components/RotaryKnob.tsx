import React, { useCallback, useRef } from 'react';
import { clamp } from '../audio/sequencerMath';

interface RotaryKnobProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  defaultValue?: number;
  onChange: (value: number) => void;
  formatValue?: (value: number) => string;
  size?: 'sm' | 'md' | 'lg';
  accent?: 'orange' | 'amber' | 'ivory' | 'red';
  bipolar?: boolean;
  logarithmic?: boolean;
}

const ACCENT_COLORS = {
  orange: '#E27A27',
  amber: '#E0B034',
  ivory: '#EDE5D4',
  red: '#D94626',
};

export const RotaryKnob: React.FC<RotaryKnobProps> = ({
  label,
  value,
  min,
  max,
  step = 1,
  defaultValue,
  onChange,
  formatValue,
  size = 'md',
  accent = 'orange',
  bipolar = false,
  logarithmic = false,
}) => {
  const dragStartY = useRef<number | null>(null);
  const dragStartNorm = useRef<number>(0);

  const toNorm = useCallback(
    (v: number): number => {
      const clamped = clamp(v, min, max);
      if (logarithmic && min > 0) {
        return Math.log(clamped / min) / Math.log(max / min);
      }
      return (clamped - min) / (max - min);
    },
    [min, max, logarithmic]
  );

  const fromNorm = useCallback(
    (n: number): number => {
      const cn = clamp(n, 0, 1);
      let raw: number;
      if (logarithmic && min > 0) {
        raw = min * Math.pow(max / min, cn);
      } else {
        raw = min + cn * (max - min);
      }
      const stepped = Math.round(raw / step) * step;
      return clamp(Number(stepped.toFixed(4)), min, max);
    },
    [min, max, step, logarithmic]
  );

  const norm = toNorm(value);
  // -135 deg to +135 deg sweep
  const angleDeg = -135 + norm * 270;

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    dragStartY.current = e.clientY;
    dragStartNorm.current = norm;
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (dragStartY.current === null) return;
    const dy = dragStartY.current - e.clientY;
    const sensitivity = e.shiftKey ? 340 : 140;
    const nextNorm = clamp(dragStartNorm.current + dy / sensitivity, 0, 1);
    onChange(fromNorm(nextNorm));
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (dragStartY.current !== null) {
      e.currentTarget.releasePointerCapture(e.pointerId);
      dragStartY.current = null;
    }
  };

  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    e.preventDefault();
    const dir = e.deltaY < 0 ? 1 : -1;
    const deltaNorm = dir * (e.shiftKey ? 0.01 : 0.035);
    onChange(fromNorm(norm + deltaNorm));
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const fine = e.shiftKey ? step : Math.max(step, (max - min) / 40);
    if (e.key === 'ArrowUp' || e.key === 'ArrowRight') {
      e.preventDefault();
      onChange(clamp(Number((value + fine).toFixed(4)), min, max));
    } else if (e.key === 'ArrowDown' || e.key === 'ArrowLeft') {
      e.preventDefault();
      onChange(clamp(Number((value - fine).toFixed(4)), min, max));
    } else if (e.key === 'Home') {
      e.preventDefault();
      onChange(min);
    } else if (e.key === 'End') {
      e.preventDefault();
      onChange(max);
    }
  };

  const handleDoubleClick = () => {
    if (defaultValue !== undefined) {
      onChange(defaultValue);
    } else if (bipolar) {
      onChange(0);
    }
  };

  const pxSize = size === 'lg' ? 56 : size === 'sm' ? 36 : 46;
  const cx = pxSize / 2;
  const cy = pxSize / 2;
  const ringR = pxSize * 0.44;
  const capR = pxSize * 0.34;
  const accentHex = ACCENT_COLORS[accent];

  // Helper for SVG arc path
  const polar = (deg: number, r: number) => {
    const rad = ((deg - 90) * Math.PI) / 180;
    return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
  };

  const describeArc = (startDeg: number, endDeg: number, r: number) => {
    if (Math.abs(endDeg - startDeg) < 0.5) return '';
    const s = polar(startDeg, r);
    const e = polar(endDeg, r);
    const largeArc = Math.abs(endDeg - startDeg) > 180 ? 1 : 0;
    const sweep = endDeg > startDeg ? 1 : 0;
    return `M ${s.x.toFixed(2)} ${s.y.toFixed(2)} A ${r} ${r} 0 ${largeArc} ${sweep} ${e.x.toFixed(2)} ${e.y.toFixed(2)}`;
  };

  const trackPath = describeArc(-135, 135, ringR);
  const activePath = bipolar
    ? describeArc(0, angleDeg, ringR)
    : describeArc(-135, angleDeg, ringR);

  const formatted = formatValue ? formatValue(value) : String(Math.round(value));

  return (
    <div className="flex flex-col items-center gap-1 select-none">
      <div
        role="slider"
        tabIndex={0}
        aria-label={label}
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={Number(value.toFixed(2))}
        aria-valuetext={formatted}
        title={`${label}: ${formatted} (drag or scroll, double-click to reset)`}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onWheel={handleWheel}
        onKeyDown={handleKeyDown}
        onDoubleClick={handleDoubleClick}
        className="relative cursor-ns-resize rounded-full focus-visible:outline-2 focus-visible:outline-[#E27A27] focus-visible:outline-offset-2 touch-none"
        style={{ width: pxSize, height: pxSize }}
      >
        <svg width={pxSize} height={pxSize} viewBox={`0 0 ${pxSize} ${pxSize}`} className="overflow-visible">
          {/* Silkscreen calibration ticks */}
          {[-135, -90, -45, 0, 45, 90, 135].map((tickDeg) => {
            const p1 = polar(tickDeg, ringR + 1.5);
            const p2 = polar(tickDeg, ringR + (tickDeg === 0 ? 4.5 : 3.2));
            return (
              <line
                key={tickDeg}
                x1={p1.x}
                y1={p1.y}
                x2={p2.x}
                y2={p2.y}
                stroke={tickDeg === 0 ? '#D9CEBC' : '#6A6256'}
                strokeWidth={tickDeg === 0 ? 1.2 : 0.9}
              />
            );
          })}

          {/* Track arc */}
          <path
            d={trackPath}
            fill="none"
            stroke="#2B2723"
            strokeWidth={2.5}
            strokeLinecap="round"
          />

          {/* Active indicator arc */}
          {activePath && (
            <path
              d={activePath}
              fill="none"
              stroke={accentHex}
              strokeWidth={2.5}
              strokeLinecap="round"
            />
          )}

          {/* Knob skirt shadow */}
          <circle cx={cx} cy={cy + 1.5} r={capR + 1.5} fill="rgba(0,0,0,0.65)" />

          {/* Bakelite / fluted aluminum knob cap */}
          <circle
            cx={cx}
            cy={cy}
            r={capR}
            fill="#2B2723"
            stroke="#595148"
            strokeWidth={1}
          />
          <circle
            cx={cx}
            cy={cy}
            r={capR * 0.78}
            fill="#1D1A17"
            stroke="#3B352F"
            strokeWidth={0.8}
          />

          {/* Rotatable pointer line */}
          <g transform={`rotate(${angleDeg} ${cx} ${cy})`}>
            <line
              x1={cx}
              y1={cy - capR * 0.2}
              x2={cx}
              y2={cy - capR + 2.2}
              stroke={accentHex}
              strokeWidth={size === 'sm' ? 1.8 : 2.3}
              strokeLinecap="round"
            />
          </g>
        </svg>
      </div>

      <span className="text-[11px] font-medium tracking-wide text-[#B7AC9A] leading-none whitespace-nowrap">
        {label}
      </span>
      <span className="font-mono text-[10px] tabular-nums text-[#E8DFCE] leading-none whitespace-nowrap">
        {formatted}
      </span>
    </div>
  );
};
