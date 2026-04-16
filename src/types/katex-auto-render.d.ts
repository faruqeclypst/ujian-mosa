declare module 'katex/dist/contrib/auto-render' {
    import { KatexOptions } from 'katex';

    export default function renderMathInElement(
        element: HTMLElement,
        options?: KatexOptions & {
            delimiters?: Array<{
                left: string;
                right: string;
                display: boolean;
            }>;
            ignoredTags?: string[];
            ignoredClasses?: string[];
            errorCallback?: (msg: string, err: Error) => void;
            preProcess?: (math: string) => string;
        }
    ): void;
}
