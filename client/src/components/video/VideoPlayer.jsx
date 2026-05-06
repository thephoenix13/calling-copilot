export default function VideoPlayer({ src, className = '' }) {
  if (!src) return null;
  return (
    <video
      className={`vi-player ${className}`}
      src={src}
      controls
      playsInline
      preload="metadata"
    />
  );
}
