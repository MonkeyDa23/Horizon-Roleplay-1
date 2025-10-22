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
    document.title = title;

    const updateMetaTag = (name: string, content: string | undefined, isProperty = false) => {
      if (!content) return;
      const selector = isProperty ? `meta[property="${name}"]` : `meta[name="${name}"]`;
      let element = document.querySelector(selector) as HTMLMetaElement | null;
      if (!element) {
        element = document.createElement('meta');
        if (isProperty) {
          element.setAttribute('property', name);
        } else {
          element.setAttribute('name', name);
        }
        document.head.appendChild(element);
      }
      element.setAttribute('content', content);
    };

    updateMetaTag('description', description);
    updateMetaTag('keywords', keywords);
    updateMetaTag('robots', noIndex ? 'noindex, nofollow' : 'index, follow');

    // Open Graph for rich social media sharing
    updateMetaTag('og:title', title, true);
    updateMetaTag('og:description', description, true);
    updateMetaTag('og:type', 'website', true);
    updateMetaTag('og:url', window.location.href, true);
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
