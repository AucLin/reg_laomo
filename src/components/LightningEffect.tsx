import { useEffect, useState } from 'react';

export default function LightningEffect() {
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReducedMotion(query.matches);

    function handleChange(event: MediaQueryListEvent) {
      setReducedMotion(event.matches);
    }
    query.addEventListener('change', handleChange);
    return () => query.removeEventListener('change', handleChange);
  }, []);

  return (
    <svg
      data-testid="lightning"
      aria-hidden="true"
      viewBox="0 0 400 400"
      className={`pointer-events-none absolute inset-0 h-full w-full ${
        // 開了「減少動態效果」就不動。這對前庭敏感的使用者是必要的，
        // 不是可有可無的貼心。
        reducedMotion ? 'opacity-20' : 'animate-lightning opacity-0'
      }`}
    >
      <defs>
        <linearGradient id="lightning-gradient" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#bfdbfe" />
          <stop offset="60%" stopColor="#60a5fa" />
          <stop offset="100%" stopColor="#2563eb" />
        </linearGradient>
        <filter id="lightning-glow">
          <feGaussianBlur stdDeviation="4" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      <g filter="url(#lightning-glow)" fill="url(#lightning-gradient)">
        <path d="M232 40 L150 210 L200 210 L168 360 L268 170 L212 170 Z" />
        <path
          d="M120 90 L70 190 L100 190 L82 280 L140 170 L108 170 Z"
          opacity="0.6"
        />
        <path
          d="M320 120 L282 200 L306 200 L292 268 L336 186 L310 186 Z"
          opacity="0.45"
        />
      </g>
    </svg>
  );
}
