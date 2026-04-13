import React, { useState, useEffect } from "react";
import { Skeleton } from "./skeleton";
import { cn } from "../../lib/utils";

interface SmartImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  containerClassName?: string;
  fallbackText?: string;
  showSkeleton?: boolean;
}

export const SmartImage = ({ 
  src, 
  alt, 
  className, 
  containerClassName, 
  fallbackText = "Gagal memuat gambar",
  showSkeleton = true,
  ...props 
}: SmartImageProps) => {
  const [isLoaded, setIsLoaded] = useState(false);
  const [isError, setIsError] = useState(false);

  // Reset state if src changes
  useEffect(() => {
    setIsLoaded(false);
    setIsError(false);
  }, [src]);

  if (!src) return null;

  return (
    <div className={cn("relative overflow-hidden", containerClassName)}>
      {showSkeleton && !isLoaded && !isError && (
        <Skeleton className={cn("absolute inset-0 w-full h-full min-h-[100px]", className)} />
      )}
      
      {!isError ? (
        <img
          src={src}
          alt={alt || "Image"}
          loading="lazy"
          className={cn(
            "transition-opacity duration-500 will-change-opacity",
            isLoaded ? "opacity-100" : "opacity-0",
            className
          )}
          onLoad={() => setIsLoaded(true)}
          onError={() => {
            console.error("SmartImage load error for src:", src);
            setIsError(true);
          }}
          {...props}
        />
      ) : (
        <div className={cn(
          "bg-slate-100 dark:bg-slate-800 flex items-center justify-center p-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center",
          className
        )}>
          {fallbackText}
        </div>
      )}
    </div>
  );
};
