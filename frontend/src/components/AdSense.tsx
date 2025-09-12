import React, { useEffect, useRef, useState } from "react";

interface AdSenseProps {
  adSlot: string;
  adFormat?: string;
  fullWidthResponsive?: boolean;
  style?: React.CSSProperties;
  className?: string;
}

const AdSense: React.FC<AdSenseProps> = ({
  adSlot,
  adFormat = "auto",
  fullWidthResponsive = true,
  style = {},
  className = "",
}) => {
  const adElementRef = useRef<HTMLElement>(null);
  const [adKey, setAdKey] = useState(Math.random()); // Force re-render on key change
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    // Reset loaded state when component mounts or adSlot changes
    setIsLoaded(false);
    
    let interval: NodeJS.Timeout;

    const loadAd = () => {
      try {
        const element = adElementRef.current;
        if (element && !element.hasAttribute('data-adsbygoogle-status') && !isLoaded) {
          if (window.adsbygoogle) {
            // @ts-ignore
            (window.adsbygoogle = window.adsbygoogle || []).push({});
            setIsLoaded(true);
            clearInterval(interval);
          }
        }
      } catch (e) {
        console.error("AdSense load error:", e);
        clearInterval(interval);
      }
    };

    // Use interval to wait for adsbygoogle to be ready
    interval = setInterval(() => {
      if (window.adsbygoogle && adElementRef.current && !isLoaded) {
        loadAd();
      }
    }, 300);

    // Cleanup interval after 10 seconds
    const timeout = setTimeout(() => {
      clearInterval(interval);
    }, 10000);

    return () => {
      clearInterval(interval);
      clearTimeout(timeout);
    };
  }, [adSlot, isLoaded]); // Dependencies include adSlot to reload when slot changes

  return (
    <div className={`adsense-container ${className}`} style={style}>
      <ins
        key={adKey} // Force React to recreate element on key change
        ref={adElementRef}
        className="adsbygoogle"
        style={{ display: "block", ...style }}
        data-ad-client="ca-pub-9361284018070883"
        data-ad-slot={adSlot}
        data-ad-format={adFormat}
        data-full-width-responsive={fullWidthResponsive}
      />
    </div>
  );
};

export default AdSense;