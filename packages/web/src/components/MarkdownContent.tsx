import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

export function MarkdownContent({ markdown }: { markdown: string }) {
  if (!markdown.trim()) {
    return <p style={{ color: "var(--text-dim)" }}>Nothing here yet.</p>;
  }

  return (
    <div className="vb-markdown">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{markdown}</ReactMarkdown>
    </div>
  );
}
