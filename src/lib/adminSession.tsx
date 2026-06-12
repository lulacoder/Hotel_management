import { createContext, useContext } from 'react'

import type { Doc } from '../../convex/_generated/dataModel'
import type { ReactNode } from 'react'

export interface AdminSession {
  displayName: string
  profile: Doc<'users'>
  hotelAssignment: Doc<'hotelStaff'> | null
  hotelAssignmentRole: Doc<'hotelStaff'>['role'] | null
  isRoomAdmin: boolean
}

interface AdminSessionProviderProps {
  children: ReactNode
  value: AdminSession
}

const AdminSessionContext = createContext<AdminSession | null>(null)

// Shares the admin identity loaded by the shell with nested admin pages.
export function AdminSessionProvider({
  children,
  value,
}: AdminSessionProviderProps) {
  return (
    <AdminSessionContext.Provider value={value}>
      {children}
    </AdminSessionContext.Provider>
  )
}

export function useAdminSession(): AdminSession {
  const session = useContext(AdminSessionContext)

  if (!session) {
    throw new Error('useAdminSession must be used inside AdminSessionProvider')
  }

  return session
}
