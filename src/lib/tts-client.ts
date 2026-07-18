/**
 * 客户端 Edge TTS — 浏览器直接连接微软免费 TTS
 * 绕过 Vercel serverless 的 WebSocket 限制
 */

const TTS_URL =
  "wss://speech.platform.bing.com/consumer/speech/synthesize/readaloud/edge/v1?TrustedClientToken=6A5AA1D4EAFF4E9FB37E23D68491D6F4"

const VOICE_XIAOMING = "zh-CN-YunyangNeural"
const VOICE_XIAOHONG = "zh-CN-XiaoxiaoNeural"

function buildSsml(text: string, voiceName: string, rate = 5): string {
  return (
    `X-RequestId:${crypto.randomUUID()}\r\n` +
    `Content-Type:application/ssml+xml\r\n` +
    `X-Timestamp:${new Date().toISOString()}Z\r\n` +
    `Path:ssml\r\n\r\n` +
    `<speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' ` +
    `xmlns:mstts='https://www.w3.org/2001/mstts' xml:lang='zh-CN'>` +
    `<voice name='${voiceName}'><prosody rate='${rate >= 0 ? "+" : ""}${rate}%' pitch='+0Hz'>` +
    text +
    `</prosody></voice></speak>`
  )
}

/**
 * 单段文字转 ArrayBuffer（浏览器端，直接连微软 WebSocket）
 */
export async function textToAudioBuffer(
  text: string,
  speaker: "xiaoming" | "xiaohong" = "xiaoming"
): Promise<ArrayBuffer> {
  const voiceName = speaker === "xiaohong" ? VOICE_XIAOHONG : VOICE_XIAOMING
  const ws = new WebSocket(TTS_URL)
  const chunks: Uint8Array[] = []

  const result = await new Promise<ArrayBuffer>((resolve, reject) => {
    const timeout = setTimeout(() => { ws.close(); reject(new Error("TTS 超时")) }, 15000)

    ws.onopen = () => ws.send(buildSsml(text, voiceName))

    ws.onmessage = (event) => {
      if (typeof event.data === "string") {
        if (event.data.includes("Path:turn.end")) {
          clearTimeout(timeout)
          ws.close()
          const totalLen = chunks.reduce((s, c) => s + c.length, 0)
          const merged = new Uint8Array(totalLen)
          let offset = 0
          for (const c of chunks) { merged.set(c, offset); offset += c.length }
          resolve(merged.buffer)
        }
        return
      }
      if (event.data instanceof ArrayBuffer) {
        chunks.push(new Uint8Array(event.data))
      } else if (event.data instanceof Blob) {
        event.data.arrayBuffer().then((ab) => chunks.push(new Uint8Array(ab)))
      }
    }

    ws.onerror = () => { clearTimeout(timeout); ws.close(); reject(new Error("TTS 连接失败")) }

    ws.onclose = () => {
      if (chunks.length > 0) {
        clearTimeout(timeout)
        const totalLen = chunks.reduce((s, c) => s + c.length, 0)
        const merged = new Uint8Array(totalLen)
        let offset = 0
        for (const c of chunks) { merged.set(c, offset); offset += c.length }
        resolve(merged.buffer)
      }
    }
  })

  return result
}

/**
 * 朗读文本（浏览器端播放，使用微软 Edge 神经网络语音）
 * 比 speechSynthesis 自然得多
 */
export async function speakText(
  text: string,
  speaker: "xiaoming" | "xiaohong" = "xiaoming",
  onStart?: () => void,
  onEnd?: () => void
): Promise<void> {
  try {
    const audioBuf = await textToAudioBuffer(text, speaker)
    const audioCtx = new AudioContext()
    const source = audioCtx.createBufferSource()
    const audioBuffer = await audioCtx.decodeAudioData(audioBuf.slice(0))
    source.buffer = audioBuffer
    source.connect(audioCtx.destination)
    source.onended = () => {
      audioCtx.close()
      onEnd?.()
    }
    source.start()
    onStart?.()
  } catch (err) {
    console.warn("Edge TTS 播放失败，回退到浏览器 TTS:", err)
    // 回退到浏览器内置 TTS
    fallbackSpeak(text, onStart, onEnd)
  }
}

function fallbackSpeak(text: string, onStart?: () => void, onEnd?: () => void): void {
  const synth = window.speechSynthesis
  if (!synth) {
    onEnd?.()
    return
  }
  const u = new SpeechSynthesisUtterance(text)
  u.lang = "zh-CN"
  u.rate = 1.1
  u.onstart = () => onStart?.()
  u.onend = () => onEnd?.()
  synth.speak(u)
}

/**
 * 将播客所有片段合成一个完整 Blob URL
 */
export async function synthesizePodcastClient(
  segments: { speaker: string; text: string }[],
  onProgress?: (idx: number, total: number) => void
): Promise<string> {
  const audioChunks: Uint8Array[] = []

  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i]
    if (!seg.text.trim()) continue
    onProgress?.(i, segments.length)
    const speaker = seg.speaker === "小红" ? "xiaohong" as const : "xiaoming" as const
    try {
      const buf = await textToAudioBuffer(seg.text, speaker)
      audioChunks.push(new Uint8Array(buf))
    } catch (err) {
      console.warn(`Segment ${i} TTS failed:`, err)
      // 继续下一段
    }
  }

  if (audioChunks.length === 0) throw new Error("所有片段 TTS 均失败")

  const totalLen = audioChunks.reduce((s, c) => s + c.length, 0)
  const merged = new Uint8Array(totalLen)
  let offset = 0
  for (const c of audioChunks) { merged.set(c, offset); offset += c.length }

  const blob = new Blob([merged], { type: "audio/mp3" })
  return URL.createObjectURL(blob)
}
