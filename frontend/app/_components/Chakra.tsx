/** Ambient background motif: a lotus of leaf-shaped petals slow-spinning
 * around a rupee mark, pinned to the viewport (not the hero) so it stays
 * visible for the whole scroll. Sits in the right margin outside the
 * content column, behind everything (-z-10), pure CSS rotation. */
export default function Chakra() {
  const petalCount = 12;
  const petals = Array.from({ length: petalCount }, (_, i) => i);
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed -right-56 top-28 z-0 hidden h-[40rem] w-[40rem] opacity-[0.4] xl:block"
    >
      <svg viewBox="0 0 400 400" className="animate-spin-slower h-full w-full">
        <circle
          cx="200"
          cy="200"
          r="192"
          fill="none"
          stroke="#65a30d"
          strokeOpacity="0.15"
          strokeWidth="1"
        />
        {petals.map((i) => {
          const angle = (i / petalCount) * 360;
          return (
            <path
              key={i}
              d="M200,145 C182,110 182,60 200,32 C218,60 218,110 200,145 Z"
              fill="#84cc16"
              fillOpacity={i % 2 === 0 ? "0.14" : "0.07"}
              stroke="#4d7c0f"
              strokeOpacity="0.3"
              strokeWidth="1"
              transform={`rotate(${angle} 200 200)`}
            />
          );
        })}
        <circle
          cx="200"
          cy="200"
          r="36"
          fill="#fafaf6"
          stroke="#65a30d"
          strokeOpacity="0.4"
          strokeWidth="1"
        />
        <text
          x="200"
          y="212"
          textAnchor="middle"
          fontSize="32"
          fontWeight="600"
          fill="#4d7c0f"
          fillOpacity="0.6"
        >
          ₹
        </text>
      </svg>
    </div>
  );
}
