import React from 'react';

const VideoBackground: React.FC = () => {
  // A high-quality, seamless loop video related to tech/abstract visuals
  const videoSource = "https://videos.pexels.com/video-files/3209828/3209828-hd_1920_1080_25fps.mp4";

  return (
    <div className="fixed top-0 left-0 w-full h-full -z-10 overflow-hidden bg-brand-dark">
      <video
        autoPlay
        loop
        muted
        playsInline
        className="w-full h-full object-cover"
        src={videoSource}
      />
      <div className="absolute inset-0 bg-black/50"></div>
    </div>
  );
};

export default VideoBackground;
