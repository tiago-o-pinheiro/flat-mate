import Link from "next/link";
export function Logo() {
  return (
    <Link href="/" className="logo" aria-label="Flat Mate, inicio">
      <svg
        width="31"
        height="34"
        viewBox="0 0 32 36"
        fill="none"
        aria-hidden="true"
      >
        <path
          d="M5 29V16L16 5L27 16V29H5Z"
          stroke="currentColor"
          strokeWidth="2.7"
          strokeLinejoin="round"
        />
        <path
          d="M11 29V21Q11 16 16 16Q21 16 21 21V29M1 16L16 1L31 16"
          stroke="currentColor"
          strokeWidth="2.7"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <span>
        flat<span className="logo-light">mate</span>
        <span className="logo-dot">.</span>
      </span>
    </Link>
  );
}
