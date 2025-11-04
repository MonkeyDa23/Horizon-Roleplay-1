// src/components/CosmicBackground.tsx
import React from 'react';

const CosmicBackground: React.FC = () => {
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

        @function multiple-box-shadow($n) {
          $value: '#{random(2000)}px #{random(2000)}px #FFF';
          @for $i from 2 through $n {
            $value: '#{$value} , #{random(2000)}px #{random(2000)}px #FFF';
          }
          @return $value;
        }

        $shadows-small: multiple-box-shadow(700);
        $shadows-medium: multiple-box-shadow(200);
        $shadows-big: multiple-box-shadow(100);

        #stars {
          width: 1px;
          height: 1px;
          background: transparent;
          box-shadow: ${" ".repeat(700).replace(/ /g, () => `${Math.random() * 2000}px ${Math.random() * 2000}px #FFF, `).slice(0, -2)};
          animation: animStar 50s linear infinite;
        }
        #stars:after {
          content: " ";
          position: absolute;
          top: 2000px;
          width: 1px;
          height: 1px;
          background: transparent;
          box-shadow: ${" ".repeat(700).replace(/ /g, () => `${Math.random() * 2000}px ${Math.random() * 2000}px #FFF, `).slice(0, -2)};
        }

        #stars2 {
          width: 2px;
          height: 2px;
          background: transparent;
          box-shadow: ${" ".repeat(200).replace(/ /g, () => `${Math.random() * 2000}px ${Math.random() * 2000}px #FFF, `).slice(0, -2)};
          animation: animStar 100s linear infinite;
        }
        #stars2:after {
          content: " ";
          position: absolute;
          top: 2000px;
          width: 2px;
          height: 2px;
          background: transparent;
          box-shadow: ${" ".repeat(200).replace(/ /g, () => `${Math.random() * 2000}px ${Math.random() * 2000}px #FFF, `).slice(0, -2)};
        }

        #stars3 {
          width: 3px;
          height: 3px;
          background: transparent;
          box-shadow: ${" ".repeat(100).replace(/ /g, () => `${Math.random() * 2000}px ${Math.random() * 2000}px #FFF, `).slice(0, -2)};
          animation: animStar 150s linear infinite;
        }
        #stars3:after {
          content: " ";
          position: absolute;
          top: 2000px;
          width: 3px;
          height: 3px;
          background: transparent;
          box-shadow: ${" ".repeat(100).replace(/ /g, () => `${Math.random() * 2000}px ${Math.random() * 2000}px #FFF, `).slice(0, -2)};
        }
        
        @keyframes animStar {
          from { transform: translateY(0px); }
          to { transform: translateY(-2000px); }
        }
      `}</style>
    </div>
  );
};

export default CosmicBackground;