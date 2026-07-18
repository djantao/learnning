/**
 * 语音识别 (ASR) 客户端 — 服务端使用
 *
 * 支持多种提供商，按优先级自动选择：
 *   1. 火山引擎 ASR（豆包同款，中文识别最精准）
 *   2. OpenAI Whisper（通用备选）
 *
 * 配置方式：
 *   火山引擎: VOLC_ASR_APP_ID + VOLC_ASR_ACCESS_TOKEN
 *   OpenAI:   OPENAI_API_KEY（已有）或 WHISPER_API_KEY
 */

// ---- 火山引擎 ASR（非流式）----------------------------------------
interface VolcAsrConfig {
  appId: string
  accessToken: string
}

function getVolcConfig(): VolcAsrConfig | null {
  const appId = process.env.VOLC_ASR_APP_ID
  const accessToken = process.env.VOLC_ASR_ACCESS_TOKEN
  if (!appId || !accessToken) return null
  return { appId, accessToken }
}

async function volcAsrTranscribe(audioBuffer: Buffer): Promise<string> {
  const config = getVolcConfig()
  if (!config) throw new Error("火山引擎 ASR 未配置")

  // 火山引擎 ASR 非流式 API
  const url = "https://openspeech.bytedance.com/api/v1/asr"

  const formData = new FormData()
  const audioBlob = new Blob([audioBuffer], { type: "audio/webm" })
  formData.append("audio", audioBlob, "recording.webm")

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "X-Api-App-Key": config.appId,
      "X-Api-Access-Key": config.accessToken,
      "X-Api-Resource-Id": "volc.bigasr.sauc.duration",
      "X-Api-Connect-Timeout": "10000",
    },
    body: formData,
  })

  if (!res.ok) {
    const errText = await res.text()
    throw new Error(`火山引擎 ASR 请求失败 (${res.status}): ${errText}`)
  }

  const data = await res.json()
  // 火山引擎返回格式: { result: { text: "..." }, ... }
  if (data.result?.text) return data.result.text
  if (data.text) return data.text
  throw new Error("火山引擎 ASR 返回格式异常: " + JSON.stringify(data))
}

// ---- OpenAI Whisper -----------------------------------------------
function getWhisperConfig(): { apiKey: string; baseUrl?: string } | null {
  const apiKey = process.env.WHISPER_API_KEY ?? process.env.OPENAI_API_KEY
  if (!apiKey) return null
  return {
    apiKey,
    baseUrl: process.env.OPENAI_BASE_URL,
  }
}

async function whisperTranscribe(audioBuffer: Buffer): Promise<string> {
  const config = getWhisperConfig()
  if (!config) throw new Error("OpenAI / Whisper API Key 未配置")

  const baseUrl = config.baseUrl
    ? config.baseUrl.replace(/\/+$/, "")
    : "https://api.openai.com"

  const whisperUrl = `${baseUrl}/v1/audio/transcriptions`

  const formData = new FormData()
  const audioBlob = new Blob([audioBuffer], { type: "audio/webm" })
  formData.append("file", audioBlob, "recording.webm")
  formData.append("model", "whisper-1")
  formData.append("language", "zh")

  const res = await fetch(whisperUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
    },
    body: formData,
  })

  if (!res.ok) {
    const errText = await res.text()
    throw new Error(`Whisper 请求失败 (${res.status}): ${errText}`)
  }

  const data = await res.json()
  if (data.text) return data.text
  throw new Error("Whisper 返回格式异常: " + JSON.stringify(data))
}

// ---- 统一入口 -----------------------------------------------------
export type AsrProvider = "volcengine" | "whisper" | "auto"

export async function transcribeAudio(
  audioBuffer: Buffer,
  provider: AsrProvider = "auto"
): Promise<string> {
  // 自动选择: 火山引擎 > Whisper
  if (provider === "auto") {
    if (getVolcConfig()) return volcAsrTranscribe(audioBuffer)
    if (getWhisperConfig()) return whisperTranscribe(audioBuffer)
    throw new Error("未配置任何 ASR 提供商。请设置 VOLC_ASR_APP_ID + VOLC_ASR_ACCESS_TOKEN 或 WHISPER_API_KEY / OPENAI_API_KEY")
  }

  if (provider === "volcengine") return volcAsrTranscribe(audioBuffer)
  if (provider === "whisper") return whisperTranscribe(audioBuffer)
  throw new Error(`不支持的 ASR 提供商: ${provider}`)
}