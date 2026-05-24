import { auth } from "@/lib/auth"
import { Timetable } from "@/components/schedule/timetable"

export default async function SchedulePage() {
  const session = await auth()
  if (!session?.user?.id) return null

  return <Timetable />
}
