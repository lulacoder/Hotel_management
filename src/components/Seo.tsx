// Dynamic SEO and structured metadata component using React 19 native head-hoisting.
import { staticAssets } from '../lib/staticAssets'

export interface SeoProps {
  /** Page title without branding suffix (branding suffix will be added automatically) */
  title?: string
  /** Meta description for search engines and social sharing */
  description?: string
  /** Canonical URL path or full URL */
  canonicalUrl?: string
  /** Open Graph and Twitter card preview image */
  ogImage?: string
  /** Open Graph type (default: 'website') */
  ogType?: 'website' | 'article' | 'hotel' | 'profile'
  /** Keywords for search indexing */
  keywords?: Array<string>
  /** Set to true to disallow search crawlers (e.g. for private admin/auth pages) */
  noIndex?: boolean
  /** Single JSON-LD object or array of objects to inject as schema.org structured data */
  jsonLd?: Record<string, unknown> | Array<Record<string, unknown>>
}

const DEFAULT_TITLE = 'Tripways Hotels | Luxury Stays & Boutique Hotel Booking'
const DEFAULT_DESCRIPTION =
  'Discover and book handpicked luxury hotels, boutique stays, and premier resort suites. Enjoy seamless booking, instant confirmation, and exclusive guest experiences.'
const DEFAULT_KEYWORDS = [
  'hotel booking',
  'luxury hotels',
  'boutique hotels',
  'resort stays',
  'hotel reservations',
  'vacation suites',
  'Tripways hotels',
  'Ethiopia hotels',
  'Addis Ababa hotels',
]
const SITE_NAME = 'Tripways Hotels'
const SITE_URL = 'https://Tripways.com'
const DEFAULT_OG_IMAGE = staticAssets.infinityPool

/**
 * Renders SEO meta tags directly into document head via React 19's native tag hoisting.
 */
export function Seo({
  title,
  description = DEFAULT_DESCRIPTION,
  canonicalUrl,
  ogImage = DEFAULT_OG_IMAGE,
  ogType = 'website',
  keywords = DEFAULT_KEYWORDS,
  noIndex = false,
  jsonLd,
}: SeoProps) {
  const fullTitle = title
    ? `${title} | ${SITE_NAME}`
    : DEFAULT_TITLE

  const canonicalHref = canonicalUrl
    ? canonicalUrl.startsWith('http')
      ? canonicalUrl
      : `${SITE_URL}${canonicalUrl.startsWith('/') ? canonicalUrl : `/${canonicalUrl}`}`
    : undefined

  const fullOgImage = ogImage.startsWith('http')
    ? ogImage
    : `${SITE_URL}${ogImage.startsWith('/') ? ogImage : `/${ogImage}`}`

  const keywordsString = keywords.length > 0 ? keywords.join(', ') : undefined

  return (
    <>
      <title>{fullTitle}</title>
      <meta name="description" content={description} />
      {keywordsString && <meta name="keywords" content={keywordsString} />}
      <meta name="application-name" content={SITE_NAME} />
      <meta name="apple-mobile-web-app-title" content={SITE_NAME} />

      {/* Robots Directive */}
      {noIndex ? (
        <meta name="robots" content="noindex, nofollow" />
      ) : (
        <meta
          name="robots"
          content="index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1"
        />
      )}

      {/* Canonical Link */}
      {canonicalHref && <link rel="canonical" href={canonicalHref} />}

      {/* Open Graph / Facebook / Telegram */}
      <meta property="og:site_name" content={SITE_NAME} />
      <meta property="og:type" content={ogType} />
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={description} />
      <meta property="og:image" content={fullOgImage} />
      {canonicalHref && <meta property="og:url" content={canonicalHref} />}
      <meta property="og:locale" content="en_US" />
      <meta property="og:locale:alternate" content="am_ET" />

      {/* Twitter / X */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={fullOgImage} />

      {/* Structured Data (JSON-LD) */}
      {jsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(
              Array.isArray(jsonLd)
                ? {
                    '@context': 'https://schema.org',
                    '@graph': jsonLd,
                  }
                : {
                    '@context': 'https://schema.org',
                    ...jsonLd,
                  },
            ),
          }}
        />
      )}
    </>
  )
}
