import OpenAI from "openai"

const doubaoBaseURL = "https://ark.cn-beijing.volces.com/api/v3"

const client = new OpenAI({
  baseURL: doubaoBaseURL,
  apiKey: process.env.DOUBAO_API_KEY ?? "placeholder",
})

const defaultModel = "doubao-1-5-pro-32k-250115"

interface ChatParams {
  messages: { role: "user" | "assistant" | "system"; content: string }[]
  model?: string
  maxTokens?: number
  temperature?: number
  topP?: number
  stream?: boolean
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  extra?: Record<string, any>
}

export async function chatCompletion(params: ChatParams) {
  const useStream = params.stream ?? true
  const response = await client.chat.completions.create({
    model: params.model ?? defaultModel,
    messages: params.messages,
    stream: useStream,
    max_tokens: params.maxTokens ?? 4096,
    temperature: params.temperature ?? 0.7,
    top_p: params.topP,
    ...(params.extra ?? {}),
  })

  if (!useStream) {
    const completion = response as OpenAI.Chat.Completions.ChatCompletion
    return completion
  }

  let fullContent = ""
  for await (const chunk of response as AsyncIterable<OpenAI.Chat.Completions.ChatCompletionChunk>) {
    fullContent += chunk.choices?.[0]?.delta?.content ?? ""
  }

  return {
    id: "stream-collected",
    object: "chat.completion",
    created: Math.floor(Date.now() / 1000),
    model: params.model ?? defaultModel,
    choices: [{ index: 0, message: { role: "assistant", content: fullContent }, finish_reason: "stop" as const }],
    usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
  } as OpenAI.Chat.Completions.ChatCompletion
}

export async function chatCompletionStream(params: ChatParams) {
  const result = await client.chat.completions.create({
    model: params.model ?? defaultModel,
    messages: params.messages,
    stream: true,
    max_tokens: params.maxTokens ?? 4096,
    temperature: params.temperature ?? 0.7,
  })
  return result as AsyncIterable<OpenAI.Chat.Completions.ChatCompletionChunk>
}
