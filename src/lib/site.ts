export const SITE_TITLE = "סרט הערב";
export const SITE_DESCRIPTION = "מה מוקרן לידך היום, בכל בתי הקולנוע בישראל, במקום אחד.";

/**
 * Every share preview needs an absolute address for the image, and a relative one silently
 * becomes localhost; the sitemap and robots.txt need it too. Vercel hands us the production
 * domain; a domain of our own would go in NEXT_PUBLIC_SITE_URL and win.
 */
export const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ??
  (process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : "http://localhost:3000");
