// Server酱 微信推送 (https://sct.ftqq.com/)
// 环境变量: SERVERCHAN_SENDKEY

export async function serverChanPush(params: {
  title: string
  content: string
}): Promise<boolean> {
  const sendkey = process.env.SERVERCHAN_SENDKEY
  if (!sendkey) return false

  try {
    const res = await fetch(`https://sctapi.ftqq.com/${sendkey}.send`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: params.title, desp: params.content }),
    })
    const data = await res.json()
    if (data.code === 0) return true
    console.error("Server酱推送失败:", data)
    return false
  } catch (error) {
    console.error("Server酱推送错误:", error)
    return false
  }
}
