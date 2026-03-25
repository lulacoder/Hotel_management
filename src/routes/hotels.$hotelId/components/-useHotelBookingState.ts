import { useEffect, useMemo, useState } from 'react'

import type { Id } from '../../../../convex/_generated/dataModel'

interface ResumeBookingState {
  checkIn: string
  checkOut: string
  roomId: Id<'rooms'>
  status: string
}

interface UseHotelBookingStateOptions {
  hasResumeBookingSearch: boolean
  onClearResumeBooking: () => void
  resumeBooking: ResumeBookingState | null | undefined
}

export function useHotelBookingState({
  hasResumeBookingSearch,
  onClearResumeBooking,
  resumeBooking,
}: UseHotelBookingStateOptions) {
  const [selectedDates, setSelectedDates] = useState({
    checkIn: '',
    checkOut: '',
  })
  const [showBookingModal, setShowBookingModal] = useState<Id<'rooms'> | null>(
    null,
  )

  useEffect(() => {
    if (!resumeBooking) {
      return
    }

    if (!['held', 'pending_payment'].includes(resumeBooking.status)) {
      return
    }

    setSelectedDates((current) => {
      if (
        current.checkIn === resumeBooking.checkIn &&
        current.checkOut === resumeBooking.checkOut
      ) {
        return current
      }

      return {
        checkIn: resumeBooking.checkIn,
        checkOut: resumeBooking.checkOut,
      }
    })
    setShowBookingModal(resumeBooking.roomId)
  }, [resumeBooking])

  const nights = useMemo(() => {
    if (!selectedDates.checkIn || !selectedDates.checkOut) {
      return 0
    }

    const checkIn = new Date(selectedDates.checkIn)
    const checkOut = new Date(selectedDates.checkOut)
    const diff = checkOut.getTime() - checkIn.getTime()

    return Math.ceil(diff / (1000 * 60 * 60 * 24))
  }, [selectedDates.checkIn, selectedDates.checkOut])

  const closeBookingModal = () => {
    setShowBookingModal(null)

    if (hasResumeBookingSearch) {
      onClearResumeBooking()
    }
  }

  return {
    closeBookingModal,
    nights,
    selectedDates,
    setSelectedDates,
    setShowBookingModal,
    showBookingModal,
  }
}
