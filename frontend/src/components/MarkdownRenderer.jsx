import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import CopyButton from './CopyButton';

/**
 * Renders AI-generated markdown content with proper styling.
 * Handles code blocks, tables, headers, lists, bold/italic.
 */
export default function MarkdownRenderer({ content, className = '' }) {
  return (
    <div className={`md-content text-sm leading-relaxed ${className}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          // Code block with copy button
          pre({ children, ...props }) {
            const codeEl = children?.props;
            const codeText = codeEl?.children || '';
            return (
              <div className="relative group my-3">
                <pre {...props}>{children}</pre>
                {codeText && (
                  <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <CopyButton text={typeof codeText === 'string' ? codeText : String(codeText)} />
                  </div>
                )}
              </div>
            );
          },
          // External links open in new tab
          a({ href, children }) {
            return (
              <a href={href} target="_blank" rel="noopener noreferrer">
                {children}
              </a>
            );
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
