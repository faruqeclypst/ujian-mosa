import React, { useEffect, useRef } from "react";
import katex from "katex";
import renderMathInElement from "katex/dist/contrib/auto-render";
import "katex/dist/katex.min.css";

interface MathTextProps {
  content: string;
  className?: string;
}

/**
 * MathText Component
 * Renders HTML content and automatically scans for LaTeX math formulas
 * between delimiters like \( ... \), \[ ... \], $ ... $, and $$ ... $$
 */
export const MathText: React.FC<MathTextProps> = ({ content, className = "" }) => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (containerRef.current) {
      try {
        renderMathInElement(containerRef.current, {
          delimiters: [
            { left: "$$", right: "$$", display: true },
            { left: "$", right: "$", display: false },
            { left: "\\(", right: "\\)", display: false },
            { left: "\\[", right: "\\]", display: true },
          ],
          throwOnError: false,
          // 🏆 Smart Pre-processor for "Google Style" & Handwriting fixes
          preProcess: (math) => {
            let processed = math;
            
            // Fix 1: Missing backslash for common symbols (handwriting style)
            // Fixes "int" to "\int", "pi" to "\pi", etc. even if followed by _ or ^
            const fixList = ['int', 'sum', 'sqrt', 'pi', 'alpha', 'beta', 'gamma', 'theta', 'sigma', 'infty', 'lim', 'log', 'sin', 'cos', 'tan'];
            fixList.forEach(word => {
              // Regex: look for the word NOT preceded by \ and NOT followed by other letters
              const regex = new RegExp(`(?<!\\\\)${word}(?![a-zA-Z])`, 'g');
              processed = processed.replace(regex, `\\${word} `);
            });

            // Fix 3: Add thin space before dx, dy, dt, etc. (High-end Typography)
            processed = processed.replace(/(?<!\\)\b(dx|dy|dt|dz|du|dv|dw)\b/g, '\\, $1');

            // Fix 4: Add \displaystyle to ALL math for premium "Google Style" clarity
            if (!processed.includes('\\displaystyle')) {
              processed = '\\displaystyle ' + processed;
            }

            return processed;
          }
        });
      } catch (error) {
        console.error("KaTeX rendering error:", error);
      }
    }
  }, [content]);

  return (
    <div
      ref={containerRef}
      className={`math-content premium-math ${className}`}
      dangerouslySetInnerHTML={{ __html: content }}
    />
  );
};

export default MathText;
