interface IconProps {
  className?: string;
}

/** "arrows_more_up" — ascending step arrows, for cash flow forecasting. Floats gently. */
export function ForecastIcon({ className }: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="120 -840 640 640"
      fill="currentColor"
      className={`animate-float motion-reduce:animate-none ${className ?? ""}`}
    >
      <path d="M480-200v-360H120v-80h440v440h-80Zm200-200v-360H320v-80h440v440h-80Z" />
    </svg>
  );
}

/** "auto_awesome" — sparkle cluster, for the XAI / Gemini-generated explanations. Twinkles
 * with each shape offset so they don't pulse in unison. */
export function AIIcon({ className }: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
    >
      <polygon
        points="19,9 20.25,6.25 23,5 20.25,3.75 19,1 17.75,3.75 15,5 17.75,6.25"
        className="origin-center animate-twinkle motion-reduce:animate-none [transform-box:fill-box]"
        style={{ animationDelay: "0.3s" }}
      />
      <polygon
        points="19,15 17.75,17.75 15,19 17.75,20.25 19,23 20.25,20.25 23,19 20.25,17.75"
        className="origin-center animate-twinkle motion-reduce:animate-none [transform-box:fill-box]"
        style={{ animationDelay: "0.9s" }}
      />
      <path
        d="M11.5,9.5L9,4L6.5,9.5L1,12l5.5,2.5L9,20l2.5-5.5L17,12L11.5,9.5z M9.99,12.99L9,15.17l-0.99-2.18L5.83,12l2.18-0.99 L9,8.83l0.99,2.18L12.17,12L9.99,12.99z"
        className="origin-center animate-twinkle motion-reduce:animate-none [transform-box:fill-box]"
      />
    </svg>
  );
}

/** "public" — globe, for satellite climate monitoring. Rotates slowly, like a live feed. */
export function GlobeIcon({ className }: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="currentColor"
      className={`animate-spin-slow motion-reduce:animate-none ${className ?? ""}`}
    >
      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zM4 12c0-.61.08-1.21.21-1.78L8.99 15v1c0 1.1.9 2 2 2v1.93C7.06 19.43 4 16.07 4 12zm13.89 5.4c-.26-.81-1-1.4-1.9-1.4h-1v-3c0-.55-.45-1-1-1h-6v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41C17.92 5.77 20 8.65 20 12c0 2.08-.81 3.98-2.11 5.4z" />
    </svg>
  );
}
