// 微信测试号推送服务
// 使用微信测试号: https://mp.weixin.qq.com/debug/cgi-bin/sandbox?t=sandbox/login
// 环境变量: WECHAT_APPID, WECHAT_SECRET, WECHAT_TEMPLATE_ID, WECHAT_OPENID

const WECHAT_API = "https://api.weixin.qq.com/cgi-bin"

interface TokenCache {
  token: string
  expiresAt: number
}

let tokenCache: TokenCache | null = null

async function getAccessToken(): Promise<string> {
  if (tokenCache && Date.now() < tokenCache.expiresAt) return tokenCache.token

  const appId = process.env.WECHAT_APPID
  const secret = process.env.WECHAT_SECRET
  if (!appId || !secret) throw new Error("WECHAT_APPID or WECHAT_SECRET not configured")

  const res = await fetch(`${WECHAT_API}/token?grant_type=client_credential&appid=${appId}&secret=${secret}`)
  const data = await res.json()
  if (data.errcode) throw new Error(`WeChat token error: ${data.errmsg}`)

  tokenCache = { token: data.access_token, expiresAt: Date.now() + (data.expires_in - 300) * 1000 }
  return tokenCache.token
}

// ============================================================
// 发送模板消息
// ============================================================

interface TemplateData {
  [key: string]: { value: string; color?: string }
}

export async function sendTemplateMessage(params: {
  openId: string
  templateId: string
  url?: string
  data: TemplateData
}): Promise<boolean> {
  try {
    const token = await getAccessToken()
    const body = { touser: params.openId, template_id: params.templateId, url: params.url, data: params.data }
    const res = await fetch(`${WECHAT_API}/message/template/send?access_token=${token}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
    const data = await res.json()
    if (data.errcode !== 0) { console.error("WeChat template error:", data.errmsg); return false }
    return true
  } catch (error) {
    console.error("sendTemplateMessage error:", error)
    return false
  }
}

// ============================================================
// 发送客服消息（更灵活，不需要模板ID）
// ============================================================

export async function sendCustomMessage(params: {
  openId: string
  content: string
}): Promise<boolean> {
  try {
    const token = await getAccessToken()
    const body = { touser: params.openId, msgtype: "text", text: { content: params.content } }
    const res = await fetch(`${WECHAT_API}/message/custom/send?access_token=${token}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
    const data = await res.json()
    if (data.errcode !== 0) { console.error("WeChat custom message error:", data.errmsg); return false }
    return true
  } catch (error) {
    console.error("sendCustomMessage error:", error)
    return false
  }
}

// ============================================================
// 获取用户信息
// ============================================================

export async function getUserInfo(openId: string): Promise<{ subscribe: number; nickname: string } | null> {
  try {
    const token = await getAccessToken()
    const res = await fetch(`${WECHAT_API}/user/info?access_token=${token}&openid=${openId}&lang=zh_CN`)
    const data = await res.json()
    if (data.errcode) return null
    return { subscribe: data.subscribe, nickname: data.nickname }
  } catch { return null }
}

// ============================================================
// 配置检查
// ============================================================

export function isWeChatConfigured(): boolean {
  return !!(process.env.WECHAT_APPID && process.env.WECHAT_SECRET && process.env.WECHAT_OPENID)
}
