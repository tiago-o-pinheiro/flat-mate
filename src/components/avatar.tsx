import { cn } from "@/lib/utils";
const palettes = [
  ["#E7EBDD", "#D4A07D", "#44382F", "#66846B"],
  ["#F7E2D8", "#E6B697", "#61412E", "#C87763"],
  ["#E1E9EF", "#C38C68", "#372F2A", "#6A8C9F"],
  ["#EAE4F1", "#E9B997", "#3C2E27", "#A291B3"],
  ["#F2E9CF", "#A77355", "#292523", "#B5A060"],
  ["#DCEBE5", "#F0C7A5", "#B67C48", "#649888"],
  ["#EBE3DA", "#BA8160", "#443026", "#AF9077"],
  ["#F4DDDF", "#EAC09E", "#554033", "#B7767C"],
];
export function Avatar({
  index = 0,
  name,
  size = 40,
  className,
}: {
  index?: number;
  name: string;
  size?: number;
  className?: string;
}) {
  const [bg, skin, hair, shirt] = palettes[index % palettes.length];
  return (
    <svg
      className={cn("avatar", className)}
      width={size}
      height={size}
      viewBox="0 0 80 80"
      role="img"
      aria-label={name}
    >
      <rect width="80" height="80" rx="40" fill={bg} />
      {index % 2 === 1 && (
        <path d="M18 44C13 10 61 8 63 38L65 65H15Z" fill={hair} />
      )}
      <path d="M10 80C12 52 66 51 71 80" fill={shirt} />
      <path d="M33 48H47V61Q40 68 33 61" fill={skin} />
      <ellipse cx="40" cy="35" rx="18" ry="22" fill={skin} />
      <path
        d={
          index % 3 === 0
            ? "M22 34Q15 12 39 11Q63 11 59 34L51 24Q33 29 25 23Z"
            : index % 3 === 1
              ? "M21 37Q13 12 39 10Q68 13 59 43L54 29Q45 28 42 18Q32 31 21 37"
              : "M21 31Q17 8 40 11Q60 7 59 34L53 23L44 26L36 22L26 26Z"
        }
        fill={hair}
      />
      <path
        d="M30 36h2m16 0h2"
        stroke="#453B35"
        strokeWidth="2.7"
        strokeLinecap="round"
      />
      <path
        d="M36 46q4 3 8 0"
        fill="none"
        stroke="#895A49"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      {index === 0 && (
        <g fill="none" stroke="#433D36" strokeWidth="1.3">
          <rect x="25" y="31" width="12" height="10" rx="4" />
          <rect x="43" y="31" width="12" height="10" rx="4" />
          <path d="M37 35h6" />
        </g>
      )}
    </svg>
  );
}
