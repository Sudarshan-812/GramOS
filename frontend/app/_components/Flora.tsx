/** Ambient background motif for the left margin, balancing the Chakra on
 * the right: grass, a sugarcane stalk with its plume, and a maize stalk
 * with a cob, each swaying independently like wind. Fixed to the viewport
 * (not the hero) so it's visible for the whole scroll. */
export default function Flora() {
  const flowers = [
    { cx: 55, cy: 468 },
    { cx: 102, cy: 458 },
  ];

  const rightFlowers = [
    { cx: 193, cy: 480 },
    { cx: 224, cy: 468 },
  ];

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed -left-20 bottom-0 z-0 hidden h-[30rem] w-64 opacity-[0.4] xl:block"
    >
      <svg viewBox="0 0 260 520" className="h-full w-full">
        {/* Grass */}
        <g
          className="animate-sway"
          style={{ transformOrigin: "68px 500px", animationDelay: "-1s" }}
        >
          {[
            "M20,500 Q10,460 14,420",
            "M45,500 Q55,440 40,380",
            "M70,500 Q60,470 68,440",
            "M95,500 Q105,450 92,390",
            "M115,500 Q108,470 118,430",
          ].map((d, i) => (
            <path
              key={i}
              d={d}
              fill="none"
              stroke="#4d7c0f"
              strokeOpacity={i % 2 === 0 ? "0.4" : "0.25"}
              strokeWidth="3"
              strokeLinecap="round"
            />
          ))}
        </g>

        {/* Small flowers */}
        {flowers.map(({ cx, cy }, fi) => (
          <g key={fi}>
            {Array.from({ length: 5 }, (_, i) => (
              <ellipse
                key={i}
                cx={cx}
                cy={cy - 7}
                rx="6"
                ry="3"
                fill="#bef264"
                fillOpacity="0.35"
                transform={`rotate(${(i / 5) * 360} ${cx} ${cy})`}
              />
            ))}
            <circle cx={cx} cy={cy} r="2.5" fill="#4d7c0f" fillOpacity="0.5" />
          </g>
        ))}

        {/* Sugarcane */}
        <g
          className="animate-sway-slow"
          style={{ transformOrigin: "170px 500px", animationDelay: "-2.5s" }}
        >
          <path
            d="M170,500 L170,140"
            stroke="#4d7c0f"
            strokeOpacity="0.4"
            strokeWidth="5"
            strokeLinecap="round"
          />
          {[460, 420, 380, 340, 300, 260, 220, 180].map((y) => (
            <path
              key={y}
              d={`M162,${y} L178,${y}`}
              stroke="#4d7c0f"
              strokeOpacity="0.3"
              strokeWidth="2.5"
              strokeLinecap="round"
            />
          ))}
          {[
            "M170,140 Q150,100 130,75",
            "M170,140 Q160,95 145,65",
            "M170,140 Q168,90 160,55",
            "M170,140 Q170,85 170,50",
            "M170,140 Q172,90 180,55",
            "M170,140 Q180,95 195,65",
            "M170,140 Q190,100 210,75",
          ].map((d, i) => (
            <path
              key={i}
              d={d}
              fill="none"
              stroke="#84cc16"
              strokeOpacity="0.4"
              strokeWidth="2"
              strokeLinecap="round"
            />
          ))}
        </g>

        {/* Small flowers, right side of the cane */}
        {rightFlowers.map(({ cx, cy }, fi) => (
          <g key={fi}>
            {Array.from({ length: 5 }, (_, i) => (
              <ellipse
                key={i}
                cx={cx}
                cy={cy - 7}
                rx="6"
                ry="3"
                fill="#bef264"
                fillOpacity="0.35"
                transform={`rotate(${(i / 5) * 360} ${cx} ${cy})`}
              />
            ))}
            <circle cx={cx} cy={cy} r="2.5" fill="#4d7c0f" fillOpacity="0.5" />
          </g>
        ))}

        {/* Maize */}
        <g
          className="animate-sway"
          style={{ transformOrigin: "210px 500px", animationDelay: "-0.3s" }}
        >
          <path
            d="M210,500 L210,220"
            stroke="#4d7c0f"
            strokeOpacity="0.4"
            strokeWidth="5"
            strokeLinecap="round"
          />
          <path
            d="M210,380 C185,360 170,320 175,280 C195,300 212,340 210,380 Z"
            fill="#84cc16"
            fillOpacity="0.14"
            stroke="#4d7c0f"
            strokeOpacity="0.3"
            strokeWidth="1"
          />
          <path
            d="M210,300 C235,280 250,240 245,200 C225,220 208,260 210,300 Z"
            fill="#84cc16"
            fillOpacity="0.14"
            stroke="#4d7c0f"
            strokeOpacity="0.3"
            strokeWidth="1"
          />
          <ellipse
            cx="226"
            cy="345"
            rx="10"
            ry="24"
            fill="#bef264"
            fillOpacity="0.2"
            stroke="#4d7c0f"
            strokeOpacity="0.35"
            strokeWidth="1"
            transform="rotate(12 226 345)"
          />
          {[
            "M210,220 Q200,200 195,185",
            "M210,220 Q210,195 210,175",
            "M210,220 Q220,200 225,185",
          ].map((d, i) => (
            <path
              key={i}
              d={d}
              fill="none"
              stroke="#84cc16"
              strokeOpacity="0.4"
              strokeWidth="2"
              strokeLinecap="round"
            />
          ))}
        </g>
      </svg>
    </div>
  );
}
