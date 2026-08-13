/** QuietShare's mark: a minimal "shh" silhouette (finger raised to lips), an
 *  original geometric drawing for this product, not traced from any reference. */
export function Logo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
      {/* Head, side profile: round with a small nose bump */}
      <path
        d="M24 6a15 15 0 0 1 15 15c0 5.6-3 10.5-7.5 13.2V38a3 3 0 0 1-3 3h-9a3 3 0 0 1-3-3v-2.3C11.8 33.2 9 28.4 9 23A15 15 0 0 1 24 6Z"
        fill="currentColor"
      />
      <path d="M38 18.5c1.8.6 3 2.3 3 4.2s-1.2 3.6-3 4.2" fill="currentColor" />
      {/* Raised finger, over the mouth */}
      <rect x="20.5" y="2" width="5" height="20" rx="2.5" fill="white" />
      <circle cx="23" cy="26" r="3" fill="white" />
    </svg>
  );
}
