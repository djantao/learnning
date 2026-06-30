import OpenAI from "openai"

// ============================================================
// Multi-provider AI client
//   DeepSeek — cheap (~¥2/mo), excellent Chinese, for chat/coach/eval
//   Groq     — free, fast (LPU), for structured generation tasks
//
// Add  GROQ_API_KEY  to .env to enable automatic task routing.
// Without it, everything falls back to DeepSeek.
// ============================================================

// ---- Provider registry ----------------------------------------
const PROVIDER_CONFIG = {
  deepseek: {
    baseURL: "https://api.deepseek.com",
    apiKey: () => process.env.DEEPSEEK_API_KEY ?? "",
    defaultModel: "deepseek-chat",
  },
  groq: {
    baseURL: "https://api.groq.com/openai/v1",
    apiKey: () => process.env.GROQ_API_KEY ?? "",
    defaultModel: "llama-3.3-70b-versatile",
  },
} as const

type ProviderKey = keyof typeof PROVIDER_CONFIG

const clientCache = new Map<ProviderKey, OpenAI>()

function getClient(provider: ProviderKey): OpenAI {
  const cached = clientCache.get(provider)
  if (cached) return cached

  const config = PROVIDER_CONFIG[provider]
  const apiKey = config.apiKey()
  if (!apiKey && provider === "groq") return getClient("deepseek") // silent fallback
  if (!apiKey) throw new Error(`No API key for provider: ${provider}`)

  const c = new OpenAI({ baseURL: config.baseURL, apiKey })
  clientCache.set(provider, c)
  return c
}

// ---- Task → Provider routing ----------------------------------
/**
 * Task categories for automatic provider selection.
 *
 *   "conversation"  → DeepSeek (Chinese quality matters)
 *   "evaluation"    → DeepSeek (needs nuance)
 *   "structured"    → Groq if available, else DeepSeek
 */
export type AITask =
  | "chat" | "coach"
  | "generate_content" | "generate_flashcards" | "generate_questions"
  | "generate_mindmap" | "generate_podcast" | "generate_diagram"
  | "generate_article" | "generate_pretest" | "generate_book_outline"
  | "summarize" | "evaluate_answers" | "detect_blindspots"
  | "compare_recall" | "estimate_times" | "detect_versions"

export function routeProvider(task: AITask): ProviderKey {
  switch (task) {
    case "chat":
    case "coach":
    case "evaluate_answers":
    case "detect_blindspots":
      return "deepseek"
    default:
      return process.env.GROQ_API_KEY ? "groq" : "deepseek"
  }
}

// ---- Chat params & helpers ------------------------------------
interface ChatParams {
  messages: { role: "user" | "assistant" | "system"; content: string }[]
  model?: string
  maxTokens?: number
  temperature?: number
  topP?: number
  stream?: boolean
  /** Explicit provider override (takes precedence over task routing) */
  provider?: ProviderKey
  /** Task type — auto-selects provider via routeProvider() */
  task?: AITask
}

function resolve(params: ChatParams): { client: OpenAI; model: string } {
  const provider = params.provider ?? (params.task ? routeProvider(params.task) : "deepseek")
  return {
    client: getClient(provider),
    model: params.model ?? PROVIDER_CONFIG[provider].defaultModel,
  }
}

// ---- Public API -----------------------------------------------
export async function chatCompletion(params: ChatParams) {
  const { client, model } = resolve(params)
  const useStream = params.stream ?? true

  const response = await client.chat.completions.create({
    model,
    messages: params.messages,
    stream: useStream,
    max_tokens: params.maxTokens ?? 4096,
    temperature: params.temperature ?? 0.7,
    top_p: params.topP,
  })

  if (!useStream) {
    return response as OpenAI.Chat.Completions.ChatCompletion
  }

  let fullContent = ""
  for await (const chunk of response as AsyncIterable<OpenAI.Chat.Completions.ChatCompletionChunk>) {
    fullContent += chunk.choices?.[0]?.delta?.content ?? ""
  }

  return {
    id: "stream-collected",
    object: "chat.completion",
    created: Math.floor(Date.now() / 1000),
    model,
    choices: [{ index: 0, message: { role: "assistant", content: fullContent }, finish_reason: "stop" }],
    usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
  } as OpenAI.Chat.Completions.ChatCompletion
}

export async function chatCompletionStream(params: ChatParams) {
  const { client, model } = resolve(params)
  return client.chat.completions.create({
    model,
    messages: params.messages,
    stream: true,
    max_tokens: params.maxTokens ?? 4096,
    temperature: params.temperature ?? 0.7,
  }) as unknown as AsyncIterable<OpenAI.Chat.Completions.ChatCompletionChunk>
}
