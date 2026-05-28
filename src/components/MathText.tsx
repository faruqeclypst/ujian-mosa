import React, { useEffect, useRef, useMemo, useState } from "react";
import katex from "katex";
import renderMathInElement from "katex/dist/contrib/auto-render";
import "katex/dist/katex.min.css";
import "katex/dist/contrib/mhchem";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { vscDarkPlus, ghcolors } from "react-syntax-highlighter/dist/esm/styles/prism";
import { Terminal, Check, Copy } from "lucide-react";
import { useTheme } from "../context/ThemeContext";

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

  // 🔍 Processor for KaTeX
  const runKatex = (el: HTMLElement) => {
    try {
      renderMathInElement(el, {
        delimiters: [
          { left: "$$", right: "$$", display: true },
          { left: "$", right: "$", display: false },
          { left: "\\(", right: "\\)", display: false },
          { left: "\\[", right: "\\]", display: true },
        ],
        throwOnError: false,
        preProcess: (math) => {
          let processed = math.trim();
          
          // Skip processing jika sudah jelas formula valid (ada backslash command)
          if (processed.match(/\\[a-zA-Z]/)) {
            return processed;
          }
          
          // Auto-fix: kata-kata math yang lupa backslash (hanya jika BELUM ada backslash di depannya)
          const fixList = ['int', 'sum', 'sqrt', 'pi', 'alpha', 'beta', 'gamma', 'theta', 'sigma', 'infty', 'lim', 'log', 'ln', 'sin', 'cos', 'tan', 'cot', 'sec', 'csc', 'frac', 'left', 'right', 'vec', 'hat', 'bar', 'dot', 'times', 'div', 'pm', 'mp', 'leq', 'geq', 'neq', 'approx', 'equiv', 'cdot', 'ldots', 'cdots', 'forall', 'exists', 'partial', 'nabla', 'Delta', 'Omega'];
          fixList.forEach(word => {
            const regex = new RegExp(`(?<!\\\\)\\b${word}\\b`, 'g');
            processed = processed.replace(regex, `\\${word}`);
          });
          
          // Jika setelah fix masih tidak ada command math sama sekali, 
          // dan panjang > 2, dan tidak mengandung operator/angka math, wrap sebagai teks
          const hasAnyMath = processed.match(/[\\^_{}]/) || processed.match(/[+\-*/=<>]/) || processed.match(/\d/);
          if (!hasAnyMath && processed.length > 2) {
            processed = `\\text{${processed}}`;
          }
          
          return processed;
        }
      });
    } catch (error) {
      console.error("KaTeX rendering error:", error);
    }
  };

  const [zoomedImage, setZoomedImage] = useState<string | null>(null);

  // Close lightbox on Android back button
  useEffect(() => {
    if (!zoomedImage) return;
    const handleBack = (e: PopStateEvent) => {
      e.preventDefault();
      setZoomedImage(null);
    };
    window.history.pushState(null, '', window.location.href);
    window.addEventListener('popstate', handleBack);
    return () => window.removeEventListener('popstate', handleBack);
  }, [zoomedImage]);

  useEffect(() => {
    if (containerRef.current) {
      // Run KaTeX on all HTML segments
      const segments = containerRef.current.querySelectorAll('.html-segment');
      segments.forEach(seg => runKatex(seg as HTMLElement));

      // Add click-to-zoom on images
      const imgs = containerRef.current.querySelectorAll('.html-segment img, .math-content img');
      imgs.forEach(img => {
        (img as HTMLElement).style.cursor = 'zoom-in';
        img.addEventListener('click', (e) => {
          const src = (e.target as HTMLImageElement).src;
          if (src) setZoomedImage(src);
        });
      });
    }
  }, [content]);

  /**
   * 🧩 Content Splitter
   * Detects <pre class="ql-syntax"> blocks from Quill and separates them
   */
  const parsedContent = useMemo(() => {
    if (!content) return [];
    
    let processedContent = content;

    const parts: Array<{ type: 'html' | 'code'; value: string; language?: string }> = [];
    // Regex matches <pre class="ql-syntax" ...>content</pre>
    const regex = /<pre[^>]*class="[^"]*ql-syntax[^"]*"[^>]*>(.*?)<\/pre>/gs;
    
    let lastIndex = 0;
    let match;

    while ((match = regex.exec(processedContent)) !== null) {
      // Add HTML before the code block
      if (match.index > lastIndex) {
        let htmlVal = processedContent.substring(lastIndex, match.index);
        // Clean trailing empty paragraphs before code block
        htmlVal = htmlVal.replace(/(<p><br><\/p>\s*)+$/i, '');
        // Only push if not completely empty after trim
        if (htmlVal.trim() || htmlVal.includes('<img')) {
          parts.push({ type: 'html', value: htmlVal });
        }
      }

      // Clean HTML entities inside code block
      const code = match[1]
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&amp;/g, '&')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'");

      // Extract language if specified or auto-detect based on simple heuristics
      let language = '';
      const langMatch = match[0].match(/data-language="([^"]*)"/);
      
      if (langMatch && langMatch[1] && langMatch[1] !== 'auto' && langMatch[1] !== 'undefined') {
        language = langMatch[1];
      } else {
        // Simple heuristics detection
        if (/<\?php/i.test(code)) language = 'php';
        else if (/\b(cout|cin|#include\s*<[a-z.]+>|std::)\b/.test(code)) language = 'cpp';
        else if (/\b(public\s+class|System\.out\.println|public\s+static\s+void)\b/.test(code)) language = 'java';
        else if (/\b(def\s+\w+\(|import\s+[a-z_]+|print\s*\(|from\s+[a-z_]+\s+import|elif\b|input\s*\(|len\s*\(|range\s*\(|self\.|__init__|lambda\s|True|False|None)\b/.test(code) && !code.includes('{')) language = 'python';
        else if (/<\/?html|<\/?head|<\/?body|<\/?div|<\/?span|<\/?p|</i.test(code) && !code.includes('<?')) language = 'html';
        else if (/\b(SELECT|INSERT|UPDATE|DELETE|CREATE TABLE)\b/i.test(code)) language = 'sql';
        else if (/\b(func\s+\w+|fmt\.|package\s+main)\b/.test(code)) language = 'go';
        else language = 'javascript'; // Default fallback
      }

      parts.push({ 
        type: 'code', 
        value: code,
        language
      });

      lastIndex = regex.lastIndex;
    }

    // Add remaining HTML
    if (lastIndex < processedContent.length) {
      let htmlVal = processedContent.substring(lastIndex);
      // Clean leading empty paragraphs after code block
      htmlVal = htmlVal.replace(/^(<p><br><\/p>\s*)+/i, '');
      if (htmlVal.trim() || htmlVal.includes('<img')) {
        parts.push({ type: 'html', value: htmlVal });
      }
    }

    return parts;
  }, [content]);

  const processHtml = (html: string) => {
    if (!html) return "";
    let processed = html;

    // 0. Strip leading whitespace/nbsp from paragraph content
    processed = processed.replace(/<p([^>]*)>((?:&nbsp;|\s|\u00A0)+)/gi, '<p$1>');
    // Also strip leading nbsp from bare text (not in <p>)
    processed = processed.replace(/^((?:&nbsp;|\u00A0)+)/, '');
    
    // 1. Convert HTML fractions to LaTeX (e.g. <sup>3</sup>&frasl;<sub>2</sub> → $\frac{3}{2}$)
    processed = processed.replace(
      /<sup>([^<]+)<\/sup>\s*(?:&frasl;|\/)\s*<sub>([^<]+)<\/sub>/gi,
      (_, num, den) => "$\\frac{" + num.trim() + "}{" + den.trim() + "}$"
    );
    
    // 2. Convert HTML log with base (e.g. <sup>2</sup>log → ${}^{2}\log$)
    processed = processed.replace(
      /<sup>([^<]+)<\/sup>\s*log/gi,
      (_, base) => "${}^{" + base.trim() + "}\\!\\log$"
    );

    // 3. Convert standalone <sup>x</sup><sub>y</sub> patterns that look like fractions
    processed = processed.replace(
      /<sup>([^<]+)<\/sup>\s*<sub>([^<]+)<\/sub>/gi,
      (_, num, den) => "$\\frac{" + num.trim() + "}{" + den.trim() + "}$"
    );
    
    // 2. Arabic Detection & Styling (Premium Quranic Look)
    // Skip if content already has dir="rtl" (AI already formatted it)
    if (processed.includes('dir="rtl"')) {
      // Just ensure proper styling on existing RTL elements
      processed = processed.replace(
        /<p\s+dir="rtl"([^>]*)>/g, 
        `<p dir="rtl" style="font-family:'Amiri','Noto Sans Arabic',serif;font-size:145%;line-height:2.4;text-align:right;direction:rtl;unicode-bidi:isolate;padding:12px 0;"$1>`
      );
      processed = processed.replace(
        /<span\s+dir="rtl"([^>]*)>/g,
        `<span dir="rtl" style="font-family:'Amiri','Noto Sans Arabic',serif;font-size:145%;line-height:2;direction:rtl;unicode-bidi:isolate;"$1>`
      );
      return processed;
    }
    
    // Auto-detect Arabic text and style it
    const arabicRegex = /((?:["'«:(]\s*)?[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF\u0660-\u0669]+(?:[\s\u060C\u061B\u061F\u06D4]+[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF\u0660-\u0669]+)*(?:\s*["'»):.])?)/g;
    
    processed = processed.replace(arabicRegex, (match) => {
      const cleanMatch = match.trim();
      if (cleanMatch.length < 2 && !/[\u0621-\u064A]/.test(cleanMatch)) return match;
      
      // Jika teks Arab cukup panjang (ayat/kalimat), buatkan blok khusus rata kanan
      const isVerse = cleanMatch.length > 20;
      
      if (isVerse) {
        return `<span dir="rtl" class="arabic-text arabic-verse" style="
          font-family: 'Amiri', 'Noto Sans Arabic', serif; 
          font-size: 145%; 
          line-height: 2.4; 
          display: block; 
          padding: 12px 0; 
          text-align: right;
          direction: rtl;
          unicode-bidi: isolate;
        ">${match}</span>`;
      }
      
      return `<span dir="rtl" class="arabic-text" style="
        font-family: 'Amiri', 'Noto Sans Arabic', serif; 
        font-size: 130%; 
        line-height: 2; 
        display: inline-block; 
        padding: 0 4px; 
        direction: rtl;
        unicode-bidi: isolate;
      ">${match}</span>`;
    });

    return processed;
  };

  return (
    <>
      <div ref={containerRef} className={`math-content premium-math ${className}`}>
        {parsedContent.length === 0 ? (
          <div 
            className="html-segment" 
            dangerouslySetInnerHTML={{ __html: processHtml(content) }} 
          />
        ) : (
          parsedContent.map((part, i) => (
            part.type === 'code' ? (
              <CodeSegment key={i} value={part.value} language={part.language} />
            ) : (
              <div 
                key={i} 
                className="html-segment" 
                dangerouslySetInnerHTML={{ __html: processHtml(part.value) }} 
              />
            )
          ))
        )}
      </div>
      {/* Image Lightbox */}
      {zoomedImage && (
        <div 
          className="fixed inset-0 z-[9999] backdrop-blur-sm bg-black/50 flex items-center justify-center p-4 animate-in fade-in duration-200"
          onTouchStart={(e) => { e.preventDefault(); setZoomedImage(null); }}
          onClick={() => setZoomedImage(null)}
        >
          <img 
            src={zoomedImage} 
            alt="Zoom" 
            className="max-w-[90vw] max-h-[85vh] object-contain rounded-2xl shadow-2xl pointer-events-none"
          />
        </div>
      )}
    </>
  );
};

/**
 * 🎨 Specialized Code Segment for MathText
 * Includes Copy Feedback & Premium Visuals
 */
const CodeSegment: React.FC<{ value: string; language?: string }> = ({ value, language }) => {
  const { actualTheme } = useTheme();
  const [copied, setCopied] = useState(false);
  const isDark = actualTheme === 'dark';

  const handleCopy = () => {
    navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className={`group rounded-2xl overflow-hidden my-1 border transition-all duration-300 ${
      isDark 
      ? "bg-[#1e1e1e] border-slate-800 hover:border-indigo-500/30" 
      : "bg-white border-slate-200 hover:border-indigo-500/20"
    }`}>
      {/* Header Snippet Bar */}
      <div className={`px-4 py-2 flex items-center justify-between border-b ${
        isDark ? "bg-slate-950 border-white/5" : "bg-slate-50 border-slate-200"
      }`}>
        <div className="flex items-center gap-2.5">
          <div className="flex gap-1.5 mr-2">
            <div className={`w-2.5 h-2.5 rounded-full ${isDark ? "bg-rose-500/80" : "bg-rose-400"}`} />
            <div className={`w-2.5 h-2.5 rounded-full ${isDark ? "bg-amber-500/80" : "bg-amber-400"}`} />
            <div className={`w-2.5 h-2.5 rounded-full ${isDark ? "bg-emerald-500/80" : "bg-emerald-400"}`} />
          </div>
          <div className={`flex items-center gap-2 px-2.5 py-0.5 rounded-lg border ${
            isDark ? "bg-white/5 border-white/10" : "bg-white border-slate-200"
          }`}>
            <Terminal className={`h-2.5 w-2.5 ${isDark ? "text-indigo-400" : "text-indigo-600"}`} />
            <span className={`text-[10px] font-black uppercase tracking-widest ${isDark ? "text-slate-400" : "text-slate-500"}`}>
              {(() => {
                const l = (language || '').toLowerCase();
                if (!l || l === 'auto' || l === 'code') return 'CODE';
                if (l === 'js' || l === 'javascript') return 'JAVASCRIPT';
                if (l === 'py' || l === 'python') return 'PYTHON';
                if (l === 'cpp' || l === 'c++') return 'C++';
                if (l === 'cs' || l === 'csharp') return 'C#';
                if (l === 'html') return 'HTML';
                if (l === 'css') return 'CSS';
                if (l === 'ts' || l === 'typescript') return 'TYPESCRIPT';
                return l.toUpperCase();
              })()}
            </span>
          </div>
        </div>
        
        <button 
          onClick={handleCopy}
          className={`flex items-center gap-1.5 px-3 py-1 rounded-xl text-[10px] font-black transition-all active:scale-95 ${
            copied 
            ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30" 
            : isDark 
              ? "bg-white/5 text-slate-300 hover:bg-white/10 border border-white/10 hover:text-white"
              : "bg-white text-slate-600 hover:bg-slate-50 border border-slate-200"
          }`}
        >
          {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
          {copied ? "COPIED!" : "COPY"}
        </button>
      </div>
      
      <div className={isDark ? "bg-[#1e1e1e]" : "bg-white"}>
        <SyntaxHighlighter
          language={language || 'javascript'}
          style={isDark ? vscDarkPlus : ghcolors}
          showLineNumbers={true}
          lineNumberStyle={{
            minWidth: '2em',
            paddingRight: '0.5rem',
            marginRight: '0.5rem',
            textAlign: 'right',
            color: isDark ? '#6e7681' : '#94a3b8',
            fontSize: '0.75rem',
            borderRight: isDark ? '1px solid rgba(255,255,255,0.05)' : '1px solid rgba(0,0,0,0.05)'
          }}
          customStyle={{
            margin: 0,
            padding: '0 0 0.25rem 0', // Zero top padding to pull line 1 up
            fontSize: '0.825rem',
            lineHeight: '1.4',
            background: 'transparent',
            border: 'none',
            boxShadow: 'none',
          }}
          codeTagProps={{
            style: {
              fontFamily: '"JetBrains Mono", "Fira Code", monospace',
              WebkitFontSmoothing: 'antialiased',
              background: 'transparent',
              border: 'none',
              padding: 0,
            }
          }}
        >
          {value.trim()}
        </SyntaxHighlighter>
      </div>
    </div>
  );
};

export default MathText;
