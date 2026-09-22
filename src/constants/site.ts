// The site's canonical origin, in one place so a hosting rename can't strand
// the metadata again. Everything search engines and social cards read —
// og:url, og:image, twitter:image, the JSON-LD url, robots.txt and
// sitemap.xml — must agree on this exact host.
//
// It is the www host, not the apex: Vercel serves www and 301s the apex to it,
// so a canonical pointing at the apex would point at a redirect. The four HTML
// entry points and the two files in public/ can't import this, so they carry
// the same string literally — change them together.
//
// Note the embed generators still link back to the apex
// (`https://graphingcollegefootball.com/...`). Those are ordinary reader-facing
// links, so the redirect is harmless, and they're left as they are rather than
// changing what already-published embeds would be regenerated as.
export const SITE_URL = 'https://www.graphingcollegefootball.com';
