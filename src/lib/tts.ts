/**
 * Edge TTS — 直接调用微软 Edge 免费 TTS WebSocket API
 * 无需 API Key，零依赖（Node.js 24 原生 WebSocket）
 *
 * 参考: https://github.com/rany2/edge-tts (Python 实现)
 */

const TTS_URL =
  "wss://speech.platform.bing.com/consumer/speech/synthesize/readaloud/edge/v1?TrustedClientToken=6A5AA1D4EAFF4E9FB37E23D68491D6F4"

const VOICES: Record<string, string> = {
  xiaoming: "zh-CN-YunyangNeural", // 男声 — 云扬
  xiaohong: "zh-CN-XiaoxiaoNeural", // 女声 — 晓晓
}

function buildSsml(text: string, voiceName: string, rate: number): string {
  return `X-RequestId:${crypto.randomUUID()}\r\nContent-Type:application/ssml+xml\r\nX-Timestamp:${new Date().toISOString()}Z\r\nPath:ssml\r\n\r\n` +
    `<speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xmlns:mstts='https://www.w3.org/2001/mstts' xml:lang='zh-CN'>` +
    `<voice name='${voiceName}'><prosody rate='${rate >= 0 ? "+" : ""}${rate}%' pitch='+0Hz'>${text}</prosody></voice></speak>`
}

/**
 * 单段文字转 MP3 Buffer
 */
async function textToSpeechBuffer(
  text: string,
  voiceName: string,
  rate = 5
): Promise<Buffer> {
  const ws = new WebSocket(TTS_URL)

  const chunks: Buffer[] = []
  let done = false

  const result = await new Promise<Buffer>((resolve, reject) => {
    const timeout = setTimeout(() => {
      if (!done) {
        done = true
        ws.close()
        reject(new Error("TTS timeout after 15s"))
      }
    }, 15000)

    ws.onopen = () => {
      const msg = buildSsml(text, voiceName, rate)
      ws.send(msg)
    }

    ws.onmessage = (event) => {
      const data = event.data
      if (typeof data === "string") {
        // 检查是否包含结束标记
        if (data.includes("Path:turn.end")) {
          done = true
          clearTimeout(timeout)
          ws.close()
          resolve(Buffer.concat(chunks))
        }
        return
      }
      // 二进制音频数据
      if (Buffer.isBuffer(data)) {
        chunks.push(data)
      } else if (data instanceof ArrayBuffer) {
        chunks.push(Buffer.from(data))
      } else if (ArrayBuffer.isView(data)) {
        chunks.push(Buffer.from(data.buffer, data.byteOffset, data.byteLength))
      }
    }

    ws.onerror = (err) => {
      if (!done) {
        done = true
        clearTimeout(timeout)
        ws.close()
        reject(new Error(`TTS WebSocket error`))
      }
    }

    ws.onclose = () => {
      if (!done) {
        done = true
        clearTimeout(timeout)
        // 有时连接在没有 turn.end 消息的情况下关闭
        resolve(Buffer.concat(chunks))
      }
    }
  })

  return result
}

/**
 * 将文字转为 MP3 Buffer
 */
export async function textToSpeech(
  text: string,
  speaker: keyof typeof VOICES = "xiaoming"
): Promise<Buffer> {
  const voiceName = VOICES[speaker]
  return textToSpeechBuffer(text, voiceName)
}

/**
 * 将播客对话片段列表合成为完整 MP3
 */
export async function synthesizePodcast(
  segments: { speaker: string; text: string }[]
): Promise<Buffer> {
  const audioChunks: Buffer[] = []

  for (const seg of segments) {
    if (!seg.text.trim()) continue
    const voiceName = VOICES[seg.speaker === "小红" ? "xiaohong" : "xiaoming"]
    const audio = await textToSpeechBuffer(seg.text, voiceName)
    audioChunks.push(audio)
  }

  return Buffer.concat(audioChunks)
}
