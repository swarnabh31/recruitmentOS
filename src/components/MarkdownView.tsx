import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface MarkdownViewProps {
  content: string;
  className?: string;
}

export const MarkdownView: React.FC<MarkdownViewProps> = ({ content, className = '' }) => {
  if (!content) return null;

  return (
    <div className={`space-y-1 ${className}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ children }) => (
            <h1 className="text-2xl font-bold text-white border-b border-slate-700 pb-2 mb-4 mt-6 first:mt-0">{children}</h1>
          ),
          h2: ({ children }) => (
            <h2 className="text-xl font-bold text-indigo-300 border-b border-slate-700 pb-1 mb-3 mt-5">{children}</h2>
          ),
          h3: ({ children }) => (
            <h3 className="text-lg font-semibold text-indigo-200 mb-2 mt-4">{children}</h3>
          ),
          p: ({ children }) => (
            <p className="text-slate-200 leading-relaxed mb-3">{children}</p>
          ),
          strong: ({ children }) => (
            <strong className="font-semibold text-white">{children}</strong>
          ),
          ul: ({ children }) => (
            <ul className="list-disc list-inside space-y-1 mb-3 pl-2 text-slate-200">{children}</ul>
          ),
          ol: ({ children }) => (
            <ol className="list-decimal list-inside space-y-1 mb-3 pl-2 text-slate-200">{children}</ol>
          ),
          li: ({ children }) => (
            <li className="text-slate-200">{children}</li>
          ),
          code: ({ className: cn, children, ...props }) => {
            const isInline = !cn;
            if (isInline) {
              return (
                <code className="bg-slate-800 text-emerald-300 px-1.5 py-0.5 rounded text-xs font-mono" {...props}>
                  {children}
                </code>
              );
            }
            return (
              <pre className="bg-slate-950 text-emerald-300 p-4 rounded-lg overflow-x-auto text-xs font-mono border border-slate-800 mb-3">
                <code className={cn} {...props}>{children}</code>
              </pre>
            );
          },
          pre: ({ children }) => <>{children}</>,
          table: ({ children }) => (
            <div className="overflow-x-auto mb-4">
              <table className="min-w-full border-collapse border border-slate-700 text-slate-200 text-xs">{children}</table>
            </div>
          ),
          thead: ({ children }) => (
            <thead className="bg-slate-800">{children}</thead>
          ),
          tbody: ({ children }) => (
            <tbody className="bg-slate-900/50">{children}</tbody>
          ),
          tr: ({ children }) => (
            <tr className="border-b border-slate-700 hover:bg-slate-800/50">{children}</tr>
          ),
          th: ({ children }) => (
            <th className="border border-slate-700 px-3 py-2 font-bold text-indigo-300 text-left">{children}</th>
          ),
          td: ({ children }) => (
            <td className="border border-slate-700 px-3 py-2 text-slate-200">{children}</td>
          ),
          hr: () => (
            <hr className="border-slate-700 my-6" />
          ),
          blockquote: ({ children }) => (
            <blockquote className="border-l-4 border-indigo-500 pl-4 py-1 my-3 bg-slate-900/50 rounded-r-lg text-slate-300 italic">
              {children}
            </blockquote>
          ),
          a: ({ href, children }) => (
            <a href={href} target="_blank" rel="noreferrer" className="text-indigo-400 hover:text-indigo-300 underline underline-offset-2">
              {children}
            </a>
          ),
          em: ({ children }) => (
            <em className="text-slate-300 italic">{children}</em>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
};
