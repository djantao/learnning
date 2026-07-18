import { NextRequest, NextResponse } from "next/server"
import { transcribeAudio } from "@/lib/asr-client"

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const audioFile = formData.get("audio") as File | null

    if (!audioFile) {
      return NextResponse.json({ error: "缺少音频文件" }, { status: 400 })
    }

    const audioBuffer = Buffer.from(await audioFile.arrayBuffer())

    const text = await transcribeAudio(audioBuffer)

    return NextResponse.json({ text })
  } catch (err: any) {
    console.error("ASR 错误:", err)
    const message = err?.message ?? "语音识别失败"
    const status = message.includes("未配置") ? 503 : 500
    return NextResponse.json({ error: message }, { status })
  }
}