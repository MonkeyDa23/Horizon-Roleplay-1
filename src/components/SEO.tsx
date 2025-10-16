import React, { useEffect } from 'react';

interface SEOProps {
  title: string;
  description: string;
  keywords?: string;
  noIndex?: boolean;
}

const SEO: React.FC<SEOProps> = ({ title, description, keywords, noIndex = false }) => {
  useEffect(() => {
    document.title = title;

    const updateMetaTag = (name: string, content: string) => {
      const element = document.querySelector(`meta[name="${name}"]`);
      if (element) {
        element.setAttribute('content', content);
      }
    };
    
    updateMetaTag('description', description);

    if (keywords) {
      updateMetaTag('keywords', keywords);
    }
    
    updateMetaTag('robots', noIndex ? 'noindex, nofollow' : 'index, follow');

  }, [title, description, keywords, noIndex]);

  return null; // This component doesn't render anything
};

export default SEO;
