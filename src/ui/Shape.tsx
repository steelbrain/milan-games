import type { ReactElement } from 'react';
import type { ShapeName } from '../content/cards';

function starPoints(cx: number, cy: number, outer: number, inner: number, points = 5): string {
  return Array.from({ length: points * 2 }, (_, i) => {
    const radius = i % 2 === 0 ? outer : inner;
    const angle = (Math.PI / points) * i - Math.PI / 2;
    return `${(cx + radius * Math.cos(angle)).toFixed(1)},${(cy + radius * Math.sin(angle)).toFixed(1)}`;
  }).join(' ');
}

const SHAPES: Record<ShapeName, ReactElement> = {
  circle: <circle cx="50" cy="50" r="42" />,
  square: <rect x="12" y="12" width="76" height="76" rx="6" />,
  triangle: <polygon points="50,9 93,88 7,88" strokeLinejoin="round" />,
  star: <polygon points={starPoints(50, 54, 46, 19)} strokeLinejoin="round" />,
  heart: (
    <path d="M50 88 C 22 68 6 50 12 31 C 18 12 42 10 50 28 C 58 10 82 12 88 31 C 94 50 78 68 50 88 Z" />
  ),
  rectangle: <rect x="5" y="25" width="90" height="50" rx="6" />,
  oval: <ellipse cx="50" cy="50" rx="30" ry="44" />,
  diamond: <polygon points="50,5 88,50 50,95 12,50" strokeLinejoin="round" />,
};

export function Shape({ shape, fill }: { shape: ShapeName; fill: string }) {
  return (
    <svg viewBox="0 0 100 100" width="100%" height="100%" aria-hidden="true">
      <g fill={fill} stroke="rgb(0 0 0 / 0.25)" strokeWidth="3">
        {SHAPES[shape]}
      </g>
    </svg>
  );
}
