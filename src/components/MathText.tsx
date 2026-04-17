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
            // Fixes "sin" to "\sin", "cos" to "\cos", etc. 
            // Running this FIRST ensures they are recognized as formulas by Fix 0.
            const fixList = ['int', 'sum', 'sqrt', 'pi', 'alpha', 'beta', 'gamma', 'theta', 'sigma', 'infty', 'lim', 'log', 'ln', 'sin', 'cos', 'tan', 'cot', 'sec', 'csc', 'frac'];
            fixList.forEach(word => {
              // use lookahead to ensure we don't match partially (e.g. "intercept")
              // but allow it to be followed by _, ^, or spaces
              const regex = new RegExp(`(?<!\\\\)\\b${word}(?![a-zA-Z])`, 'g');
              processed = processed.replace(regex, `\\${word} `);
            });
            
            // Fix 0: Smart Text-in-Math Detection
            // If the math block is just words and spaces (even with \,), it should be regular text font
            // CRITICAL: If there is a backslash, caret, or underscore, it's a real formula, so DON'T wrap in \text
            const hasFormulaCommands = processed.replace(/\\,/g, '').match(/[\\^_]/);
            if (!hasFormulaCommands && processed.trim().length > 2) {
                processed = `\\text{${processed}}`;
            }

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
      dangerouslySetInnerHTML={{ 
        __html: content
          // 🔧 Heuristic Fixer: Automatically wrap content in \( ... \) if it looks like math
          // Updated to support 1-level of nested parentheses for things like sin(x)
          .replace(/\(\s*((?:[^\n()]|\([^\n()]*\))*?(\\|[\\^_]|int|sum|sqrt|sin|cos|tan|cot|sec|csc|lim|log|ln|pi|alpha|beta|gamma|theta|sigma|infty|frac)(?:[^\n()]|\([^\n()]*\))*?)\)/g, '\\( $1 \\)')
      }}
    />
  );
};

export default MathText;
