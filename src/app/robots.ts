import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

/** Everything public may be indexed except the poster proxy and the visitor's own lists. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/api/", "/lists"] },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
