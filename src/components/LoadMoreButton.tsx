import { Loader2, Plus } from 'lucide-react'

import { Button } from './ui/button'

interface LoadMoreButtonProps {
  loadMore: (numItems: number) => void
  pageSize?: number
  status: 'LoadingFirstPage' | 'CanLoadMore' | 'LoadingMore' | 'Exhausted'
}

// Shared pagination footer for Convex-backed lists.
export function LoadMoreButton({
  loadMore,
  pageSize = 20,
  status,
}: LoadMoreButtonProps) {
  if (status === 'Exhausted' || status === 'LoadingFirstPage') {
    return null
  }

  const isLoading = status === 'LoadingMore'

  return (
    <div className="flex justify-center pt-4">
      <Button
        type="button"
        variant="outline"
        size="lg"
        onClick={() => loadMore(pageSize)}
        disabled={isLoading}
        className="gap-2 px-5"
      >
        {isLoading ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <Plus className="size-4" />
        )}
        {isLoading ? 'Loading' : 'Load more'}
      </Button>
    </div>
  )
}
