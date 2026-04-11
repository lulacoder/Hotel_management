import type { Id } from '../../../../../../convex/_generated/dataModel'
import { HotelModal } from '../../../hotels/index/components/-HotelModal'

interface HotelEditModalProps {
  hotelId: Id<'hotels'>
  onClose: () => void
}

export function HotelEditModal({ hotelId, onClose }: HotelEditModalProps) {
  return <HotelModal hotelId={hotelId} onClose={onClose} />
}
