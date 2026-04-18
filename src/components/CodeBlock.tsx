import React, { useState } from 'react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus, ghcolors } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { Check, Copy, Terminal } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';

interface CodeBlockProps {
  language?: string;
  value: string;
}

const CodeBlock: React.FC<CodeBlockProps> = ({ language = 'javascript', value }) => {
  const { actualTheme } = useTheme();
  const [copied, setCopied] = useState(false);
  const isDark = actualTheme === 'dark';

  const handleCopy = () => {
    navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className={`group rounded-2xl overflow-hidden my-6 border transition-all duration-300 ${
      isDark 
      ? "bg-[#1e1e1e] border-slate-800 shadow-xl shadow-indigo-500/10 hover:border-indigo-500/30" 
      : "bg-white border-slate-200 shadow-sm hover:border-indigo-500/20"
    }`}>
      {/* Header Snippet Bar */}
      <div className={`px-4 py-2.5 flex items-center justify-between border-b ${
        isDark ? "bg-slate-950 border-white/5" : "bg-slate-50 border-slate-200"
      }`}>
        <div className="flex items-center gap-2.5">
          <div className="flex gap-1.5 mr-2">
            <div className={`w-2.5 h-2.5 rounded-full shadow-sm ${isDark ? "bg-rose-500/80" : "bg-rose-400"}`} />
            <div className={`w-2.5 h-2.5 rounded-full shadow-sm ${isDark ? "bg-amber-500/80" : "bg-amber-400"}`} />
            <div className={`w-2.5 h-2.5 rounded-full shadow-sm ${isDark ? "bg-emerald-500/80" : "bg-emerald-400"}`} />
          </div>
          <div className={`flex items-center gap-2 px-2.5 py-1 rounded-lg border shadow-inner ${
            isDark ? "bg-white/5 border-white/10" : "bg-white border-slate-200"
          }`}>
            <Terminal className={`h-3 w-3 ${isDark ? "text-indigo-400" : "text-indigo-600"}`} />
            <span className={`text-[10px] font-black uppercase tracking-widest ${isDark ? "text-slate-400" : "text-slate-500"}`}>
              {language}
            </span>
          </div>
        </div>
        
        <button 
          onClick={handleCopy}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-black transition-all active:scale-95 ${
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
          language={language}
          style={isDark ? vscDarkPlus : ghcolors}
          showLineNumbers={true}
          lineNumberStyle={{
            minWidth: '2.5em',
            paddingRight: '1.5em',
            marginRight: '1em',
            textAlign: 'right',
            color: isDark ? '#6e7681' : '#94a3b8',
            fontSize: '0.75rem',
            borderRight: isDark ? '1px solid rgba(255,255,255,0.05)' : '1px solid rgba(0,0,0,0.05)'
          }}
          customStyle={{
            margin: 0,
            padding: '1.5rem 1rem',
            fontSize: '0.825rem',
            lineHeight: '1.7',
            background: 'transparent',
          }}
          codeTagProps={{
            style: {
              fontFamily: '"JetBrains Mono", "Fira Code", monospace',
              WebkitFontSmoothing: 'antialiased'
            }
          }}
        >
          {value}
        </SyntaxHighlighter>
        
        {/* Subtle Bottom Glow */}
        <div className="absolute bottom-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-indigo-500/20 to-transparent" />
      </div>
    </div>
  );
};

export default CodeBlock;
