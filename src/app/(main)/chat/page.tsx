import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { ChatPanel } from "@/components/chat/chat-panel"

export default async function ChatPage() {
  const session = await auth()
  if (!session?.user?.id) return null

  const conversations = await prisma.conversation.findMany({
    where: { userId: session.user.id },
    orderBy: { updatedAt: "desc" },
    take: 20,
  })

  return <ChatPanel conversations={JSON.parse(JSON.stringify(conversations))} />
}
