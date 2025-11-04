// src/components/CosmicBackground.tsx
import React, { useMemo } from 'react';

const CosmicBackground: React.FC = () => {
  const starStyles = useMemo(() => {
    const generateShadows = (n: number) => {
      let shadows = '';
      for (let i = 0; i < n; i++) {
        shadows += `${Math.random() * 2000}px ${Math.random() * 2000}px #FFF, `;
      }
      return shadows.slice(0, -2);
    };

    return `
      #stars { box-shadow: ${generateShadows(700)}; }
      #stars:after { box-shadow: ${generateShadows(700)}; }
      #stars2 { box-shadow: ${generateShadows(200)}; }
      #stars2:after { box-shadow: ${generateShadows(200)}; }
      #stars3 { box-shadow: ${generateShadows(100)}; }
      #stars3:after { box-shadow: ${generateShadows(100)}; }
    `;
  }, []);

  return (
    <div id="cosmic-background">
      <div id="stars"></div>
      <div id="stars2"></div>
      <div id="stars3"></div>
      <style>{`
        #cosmic-background {
          position: fixed;
          top: 0;
          left: 0;
          width: 100%;
          height: 100vh;
          background: radial-gradient(ellipse at bottom, #101827 0%, #0a0f18 100%);
          overflow: hidden;
          z-index: 0;
        }

        #stars, #stars2, #stars3 {
          position: absolute;
          top: 0;
          left: 0;
          background: transparent;
        }

        #stars { width: 1px; height: 1px; animation: animStar 50s linear infinite; }
        #stars2 { width: 2px; height: 2px; animation: animStar 100s linear infinite; }
        #stars3 { width: 3px; height: 3px; animation: animStar 150s linear infinite; }
        
        #stars:after, #stars2:after, #stars3:after {
          content: " ";
          position: absolute;
          top: 2000px;
        }
        #stars:after { width: 1px; height: 1px; }
        #stars2:after { width: 2px; height: 2px; }
        #stars3:after { width: 3px; height: 3px; }

        @keyframes animStar {
          from { transform: translateY(0px); }
          to { transform: translateY(-2000px); }
        }
        
        ${starStyles}
      `}</style>
    </div>
  );
};

export default CosmicBackground;
