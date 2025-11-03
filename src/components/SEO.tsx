import React, { useEffect } from 'react';
import { useConfig } from '../hooks/useConfig';

interface SEOProps {
  title: string;
  description: string;
  keywords?: string;
  noIndex?: boolean;
  image?: string;
}

const SEO: React.FC<SEOProps> = ({ title, description, keywords, noIndex, image }) => {
  const { config } = useConfig();

  useEffect(() => {
    document.title = title;

    const setMeta = (attr: 'name' | 'property', key: string, content: string | undefined) => {
        if (!content) {
            // If content is undefined, remove the tag if it exists
            const element = document.head.querySelector(`meta[${attr}="${key}"]`);
            if (element) {
                element.remove();
            }
            return;
        }
        let element = document.head.querySelector(`meta[${attr}="${key}"]`);
        if (!element) {
            element = document.createElement('meta');
            element.setAttribute(attr, key);
            document.head.appendChild(element);
        }
        element.setAttribute('content', content);
    };

    setMeta('name', 'description', description);
    setMeta('name', 'keywords', keywords);
    
    if (noIndex) {
        setMeta('name', 'robots', 'noindex, nofollow');
    } else {
        const robotsTag = document.head.querySelector('meta[name="robots"]');
        if (robotsTag) {
            robotsTag.remove();
        }
    }
    
    // Open Graph / Social Media
    setMeta('property', 'og:title', title);
    setMeta('property', 'og:description', description);
    setMeta('property', 'og:type', 'website');
    setMeta('property', 'og:image', image || config.LOGO_URL);

  }, [title, description, keywords, noIndex, image, config.LOGO_URL]);

  return null; // This component does not render anything
};

export default SEO;
