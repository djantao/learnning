export function renderMarkdown(md: string): string {
  if (!md) return ""

  let html = md
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")

  // Code blocks (```...```)
  html = html.replace(/```(\w+)?\n([\s\S]*?)```/g, (_, lang, code) => {
    const langLabel = lang ? `<div class="text-[10px] text-muted-foreground mb-1">${lang}</div>` : ""
    return `<div class="my-2 rounded-md bg-muted/80 p-3 overflow-x-auto">${langLabel}<pre class="text-xs font-mono whitespace-pre"><code>${code.trim()}</code></pre></div>`
  })

  html = html
    .replace(/^#### (.+)$/gm, "<h4 class='text-base font-semibold mt-4 mb-2'>$1</h4>")
    .replace(/^### (.+)$/gm, "<h3 class='text-lg font-semibold mt-4 mb-2'>$1</h3>")
    .replace(/^## (.+)$/gm, "<h2 class='text-xl font-bold mt-6 mb-3'>$1</h2>")
    .replace(/^# (.+)$/gm, "<h1 class='text-2xl font-bold mt-6 mb-3'>$1</h1>")
    .replace(/^---$/gm, "<hr class='my-4 border-border'/>")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/`([^`]+)`/g, "<code class='bg-muted px-1 rounded text-sm'>$1</code>")
    .replace(/\n- (.+)/g, "\n<li class='ml-4 list-disc'>$1</li>")
    .replace(/\n\n/g, "</p><p class='my-2'>")
    .replace(/\n/g, "<br/>")

  return `<p class='my-2'>${html}</p>`
}
