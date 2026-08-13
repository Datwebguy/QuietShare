/** QuietShare's mark: a ring holding one share, an original geometric drawing for this product. */
export function Logo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
      <path
        d="M13 29 A 19.5 19.5 0 1 0 51 29"
        stroke="currentColor"
        strokeWidth="8.5"
        strokeLinecap="round"
      />
      <circle cx="32" cy="37" r="7.2" fill="currentColor" />
    </svg>
  );
}
