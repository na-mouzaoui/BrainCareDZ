import { cn } from '@/lib/utils';

interface SpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  fullPage?: boolean;
  text?: string;
  className?: string;
}

const sizeConfig = {
  sm: { box: 'h-8 w-8', stroke: 3 },
  md: { box: 'h-14 w-14', stroke: 3.5 },
  lg: { box: 'h-20 w-20', stroke: 4 },
};

const VIEW = 88;
const CENTER = VIEW / 2;
const RADIUS = 38;

// segments empilés partant tous du même point de départ : le premier est le
// plus court et le plus épais (la tête), chaque segment suivant est plus long
// et plus fin, donnant un vrai dégradé d'épaisseur le long de la traîne.
const TAPER_SEGMENTS = [
  { length: 8, widthFactor: 2.3, opacity: 1 },
  { length: 14, widthFactor: 1.6, opacity: 0.85 },
  { length: 20, widthFactor: 1.1, opacity: 0.65 },
  { length: 26, widthFactor: 0.7, opacity: 0.45 },
  { length: 32, widthFactor: 0.4, opacity: 0.25 },
];

function SpinnerIcon({ size, className }: { size: SpinnerProps['size']; className?: string }) {
  const { box, stroke } = sizeConfig[size ?? 'md'];

  return (
    <div className={cn(box, className, 'relative')} role="status" aria-label="Chargement">
      {/* couche fixe : simple anneau, jamais transformée */}
      <svg viewBox={`0 0 ${VIEW} ${VIEW}`} fill="none" className="absolute inset-0 h-full w-full">
        <circle cx={CENTER} cy={CENTER} r={RADIUS} stroke="currentColor" strokeOpacity={0.1} strokeWidth={stroke} />
      </svg>

      {/* couche animée : seule cette div tourne, centrée sur sa propre boîte */}
      <div
        className="absolute inset-0 animate-spin motion-reduce:animate-none [animation-duration:1.1s] [animation-timing-function:cubic-bezier(0.65,0,0.35,1)]"
        style={{ animationDirection: 'reverse' }}
      >
        <svg
          viewBox={`0 0 ${VIEW} ${VIEW}`}
          fill="none"
          className="h-full w-full"
          pathLength={100}
        >
          {/* du plus long/fin (dessous) au plus court/épais (dessus, la tête) */}
          {[...TAPER_SEGMENTS].reverse().map((segment) => (
            <circle
              key={segment.length}
              cx={CENTER}
              cy={CENTER}
              r={RADIUS}
              pathLength={100}
              stroke="currentColor"
              strokeOpacity={segment.opacity}
              strokeWidth={stroke * segment.widthFactor}
              strokeLinecap="round"
              strokeDasharray={`${segment.length} ${100 - segment.length}`}
              strokeDashoffset={0}
            />
          ))}
        </svg>
      </div>
    </div>
  );
}

export function Spinner({ size = 'md', fullPage, text, className }: SpinnerProps) {
  const icon = <SpinnerIcon size={size} className={cn('text-brand-600', className)} />;

  if (fullPage) {
    return (
      <div className="relative min-h-screen flex flex-col items-center justify-center gap-4">
        <div
          className="pointer-events-none absolute h-56 w-56 rounded-full bg-brand-100/60 blur-3xl"
          aria-hidden="true"
        />
        <div className="relative flex flex-col items-center gap-4">
          {icon}
          {text && <p className="text-sm text-gray-500 animate-pulse motion-reduce:animate-none">{text}</p>}
        </div>
      </div>
    );
  }

  if (text) {
    return (
      <div className="flex items-center justify-center gap-3 py-8">
        {icon}
        <span className="text-sm text-gray-500">{text}</span>
      </div>
    );
  }

  return icon;
}