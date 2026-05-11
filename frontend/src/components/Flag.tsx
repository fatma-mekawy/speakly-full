"use client";

import { Language, LANGUAGE_COUNTRY_CODES } from "@/types";

interface Props {
  language: Language;
  /** Width in pixels. Height is auto. Default 24. */
  size?: number;
  className?: string;
}

/**
 * Renders a real flag image for a language. Works the same on every OS,
 * unlike emoji flags which Windows displays as 2-letter codes.
 *
 * Uses flagcdn.com (public free SVG flag CDN, no auth required).
 */
export default function Flag({ language, size = 24, className = "" }: Props) {
  const code = LANGUAGE_COUNTRY_CODES[language];
  return (
    <img
      src={`https://flagcdn.com/${code}.svg`}
      alt={`${language} flag`}
      width={size}
      height={Math.round(size * 0.75)}
      style={{ width: size, height: "auto" }}
      className={`inline-block rounded-sm shadow-sm flex-shrink-0 ${className}`}
      loading="lazy"
    />
  );
}
