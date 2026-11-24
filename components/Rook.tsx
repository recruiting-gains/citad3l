import * as React from "react";

export interface RookProps {
  size?: number;
  className?: string;
  title?: string;
}

/** Original rook mark: solid silhouette, three merlons, arrow-slit cut-out. 24-unit grid for crisp small sizes. */
export function Rook({ size = 18, className, title }: RookProps) {
  const labelled = Boolean(title);
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      className={className}
      role={labelled ? "img" : undefined}
      aria-hidden={labelled ? undefined : true}
      focusable="false"
    >
      {title ? <title>{title}</title> : null}
      <path
        fill="currentColor"
        fillRule="evenodd"
        d="M5 2h3v2.5h2.5V2h3v2.5H16V2h3v6l-2 2v7.5l1.5 1.5H5.5L7 17.5V10L5 8V2Zm6 9.5v4h2v-4a1 1 0 0 0-2 0ZM4 20.5h16V22H4v-1.5Z"
      />
    </svg>
  );
}

export default Rook;
