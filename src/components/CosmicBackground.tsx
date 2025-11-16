// src/components/CosmicBackground.tsx
import React from 'react';

const CosmicBackground: React.FC = () => {
  return (
    <div className="fixed top-0 left-0 w-full h-screen overflow-hidden z-0 bg-background-dark">
      <div id="nebula" className="absolute top-1/2 left-1/2 w-[250vw] h-[250vh] bg-radial-gradient animate-nebula-pan"></div>
      <div id="stars" className="absolute top-0 left-0 w-full h-full bg-stars-sm opacity-80 animate-pan"></div>
      <div id="stars2" className="absolute top-0 left-0 w-full h-full bg-stars-md opacity-60 animate-pan-slow"></div>
      <div id="stars3" className="absolute top-0 left-0 w-full h-full bg-stars-lg opacity-40 animate-pan-slower"></div>
      <style>{`
        @keyframes pan {
          0% { transform: translateY(0); }
          100% { transform: translateY(-1000px); }
        }
        @keyframes pan-slow {
          0% { transform: translateY(0); }
          100% { transform: translateY(-800px); }
        }
        @keyframes pan-slower {
          0% { transform: translateY(0); }
          100% { transform: translateY(-500px); }
        }
        
        .animate-pan { animation: pan 150s linear infinite; }
        .animate-pan-slow { animation: pan-slow 200s linear infinite; }
        .animate-pan-slower { animation: pan-slower 250s linear infinite; }
        
        .bg-radial-gradient {
          background: radial-gradient(ellipse at center, rgba(0, 169, 255, 0.08) 0%, rgba(0, 169, 255, 0) 60%);
        }
        
        .bg-stars-sm {
          background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1000 2000'%3E%3Cdefs%3E%3Cstyle%3E.cls-1%7Bfill:%23fff%3B%7D%3C/style%3E%3C/defs%3E%3Ccircle class='cls-1' cx='500' cy='500' r='1'/%3E%3Ccircle class='cls-1' cx='100' cy='200' r='0.5'/%3E%3Ccircle class='cls-1' cx='800' cy='900' r='0.8'/%3E%3Ccircle class='cls-1' cx='300' cy='1500' r='1'/%3E%3Ccircle class='cls-1' cx='900' cy='1200' r='0.5'/%3E%3Ccircle class='cls-1' cx='600' cy='1800' r='0.8'/%3E%3C/svg%3E"), url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1000 2000'%3E%3Cdefs%3E%3Cstyle%3E.cls-1%7Bfill:%23fff%3B%7D%3C/style%3E%3C/defs%3E%3Ccircle class='cls-1' cx='500' cy='1500' r='1'/%3E%3Ccircle class='cls-1' cx='100' cy='1200' r='0.5'/%3E%3Ccircle class='cls-1' cx='800' cy='1900' r='0.8'/%3E%3Ccircle class='cls-1' cx='300' cy='500' r='1'/%3E%3Ccircle class='cls-1' cx='900' cy='200' r='0.5'/%3E%3Ccircle class='cls-1' cx='600' cy='800' r='0.8'/%3E%3C/svg%3E");
          background-repeat: repeat;
          background-size: 1000px 1000px;
          height: 200%;
        }
        
        .bg-stars-md {
          background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1000 2000'%3E%3Cdefs%3E%3Cstyle%3E.cls-1%7Bfill:%23fff%3B%7D%3C/style%3E%3C/defs%3E%3Ccircle class='cls-1' cx='400' cy='600' r='1.5'/%3E%3Ccircle class='cls-1' cx='850' cy='100' r='1.2'/%3E%3Ccircle class='cls-1' cx='150' cy='1400' r='1.8'/%3E%3C/svg%3E"), url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1000 2000'%3E%3Cdefs%3E%3Cstyle%3E.cls-1%7Bfill:%23fff%3B%7D%3C/style%3E%3C/defs%3E%3Ccircle class='cls-1' cx='400' cy='1600' r='1.5'/%3E%3Ccircle class='cls-1' cx='850' cy='1100' r='1.2'/%3E%3Ccircle class='cls-1' cx='150' cy='400' r='1.8'/%3E%3C/svg%3E");
          background-repeat: repeat;
          background-size: 1000px 1000px;
          height: 200%;
        }
        
        .bg-stars-lg {
          background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1000 2000'%3E%3Cdefs%3E%3Cstyle%3E.cls-1%7Bfill:%23fff%3B%7D%3C/style%3E%3C/defs%3E%3Ccircle class='cls-1' cx='700' cy='800' r='2.5'/%3E%3Ccircle class='cls-1' cx='200' cy='300' r='2.2'/%3E%3C/svg%3E"), url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1000 2000'%3E%3Cdefs%3E%3Cstyle%3E.cls-1%7Bfill:%23fff%3B%7D%3C/style%3E%3C/defs%3E%3Ccircle class='cls-1' cx='700' cy='1800' r='2.5'/%3E%3Ccircle class='cls-1' cx='200' cy='1300' r='2.2'/%3E%3C/svg%3E");
          background-repeat: repeat;
          background-size: 1000px 1000px;
          height: 200%;
        }
      `}</style>
    </div>
  );
};

export default CosmicBackground;
