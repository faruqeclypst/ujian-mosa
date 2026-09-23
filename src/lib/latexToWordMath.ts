import katex from 'katex';
// @ts-ignore
import { mml2omml } from './mathml2omml';

export function latexToOmml(latex: string): string {
  if (!latex || !latex.trim()) return "";
  try {
    const clean = latex.trim()
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&amp;/g, '&')
      .replace(/\u2026/g, '\\ldots')
      .replace(/\.\.\./g, '\\ldots');

    const mathml = katex.renderToString(clean, { output: 'mathml', throwOnError: false });
    const match = mathml.match(/<math[\s\S]*?<\/math>/);
    const rawMath = match ? match[0] : mathml;
    let omml = mml2omml(rawMath);
    if (!omml) return "";
    
    // Convert to Word HTML OMML namespace so Word recognises it as native oMath
    omml = omml.replace(/http:\/\/schemas\.openxmlformats\.org\/officeDocument\/2006\/math/g, 'http://schemas.microsoft.com/office/2004/12/omml');
    return omml;
  } catch (err) {
    console.warn("Failed to convert latex to OMML:", latex, err);
    return "";
  }
}
