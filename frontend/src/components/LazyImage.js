import React, { useState } from 'react';
import LazyLoad from 'react-lazyload';

const LazyImage = ({ 
    src, 
    alt, 
    className = "", 
    style = {}, 
    placeholder = "/thumbnail-placeholder.jpg",
    webpSrc = null,
    onError = null 
}) => {
    const [imageError, setImageError] = useState(false);
    const [isLoaded, setIsLoaded] = useState(false);

    const handleError = (e) => {
        setImageError(true);
        if (onError) onError(e);
        e.currentTarget.src = placeholder;
    };

    const handleLoad = () => {
        setIsLoaded(true);
    };

    return (
        <LazyLoad height={200} offset={100} once>
            <picture>
                {webpSrc && !imageError && (
                    <source type="image/webp" srcSet={webpSrc} />
                )}
                <img
                    src={imageError ? placeholder : src}
                    alt={alt}
                    className={`${className} ${isLoaded ? 'loaded' : 'loading'}`}
                    style={{
                        ...style,
                        opacity: isLoaded ? 1 : 0.7,
                        transition: 'opacity 0.3s ease'
                    }}
                    onError={handleError}
                    onLoad={handleLoad}
                    loading="lazy"
                />
            </picture>
        </LazyLoad>
    );
};

export default LazyImage;