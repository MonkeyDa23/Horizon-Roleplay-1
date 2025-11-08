


import React, { useEffect } from 'react';
import { useConfig } from '../hooks/useConfig';

interface SEOProps {
  title: string;
  description: string;
  keywords?: string;
  noIndex?: boolean;
  image?: string;
}

const SEO: React.FC<SEOProps> = ({ title, description, keywords, noIndex = false, image }) => {
  const { config } = useConfig();

  useEffect(() => {
    // FIX: Guard against document access in non-browser environments.
    if (typeof document === 'undefined') return;

    document.title = title;

    const updateMetaTag = (name: string, content: string | undefined, isProperty = false) => {
      if (!content) return;
      const selector = isProperty ? `meta[property="${name}"]` : `meta[name="${name}"]`;
      // FIX: Guard against document access in non-browser environments.
      if (typeof document === 'undefined') return;
      let element = document.querySelector(selector) as HTMLMetaElement | null;
      if (!element) {
        // FIX: Guard against document access in non-browser environments.
        if (typeof document === 'undefined') return;
        element = document.createElement('meta');
        if (isProperty) {
          // FIX: Cast element to 'any' to avoid TypeScript lib errors with setAttribute.
          (element as any).setAttribute('property', name);
        } else {
          // FIX: Cast element to 'any' to avoid TypeScript lib errors with setAttribute.
          (element as any).setAttribute('name', name);
        }
        document.head.appendChild(element);
      }
      // FIX: Cast element to 'any' to avoid TypeScript lib errors with setAttribute.
      (element as any).setAttribute('content', content);
    };

    updateMetaTag('description', description);
    updateMetaTag('keywords', keywords);
    updateMetaTag('robots', noIndex ? 'noindex, nofollow' : 'index, follow');

    // Open Graph for rich social media sharing
    updateMetaTag('og:title', title, true);
    updateMetaTag('og:description', description, true);
    updateMetaTag('og:type', 'website', true);
    // FIX: Guard against window access in non-browser environments.
    if (typeof window !== 'undefined') {
      // FIX: Cast window to any to bypass potential tsconfig lib errors for 'location'.
      updateMetaTag('og:url', (window as any).location.href, true);
    }
    updateMetaTag('og:image', image || config.LOGO_URL, true);

    // Twitter Card for rich sharing on Twitter
    updateMetaTag('twitter:card', 'summary_large_image');
    updateMetaTag('twitter:title', title);
    updateMetaTag('twitter:description', description);
    updateMetaTag('twitter:image', image || config.LOGO_URL);

  }, [title, description, keywords, noIndex, image, config.LOGO_URL]);

  return null; // This component doesn't render anything
};

export default SEO;