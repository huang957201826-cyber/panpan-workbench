import { useEffect, useState } from 'react'
import { ImageOff } from 'lucide-react'
import { ensureImageCached, getCachedImage } from '../../lib/imageCache'
import { Skeleton } from '../../ui'

interface ArtboardThumbProps {
  imageId?: string
  imageUrl?: string
  alt?: string
  className?: string
}

/** 卡片图片按需加载：只读取当前挂载卡片的输出图，避免任务多时一次性加载全部图片 */
export function ArtboardThumb({ imageId = '', imageUrl = '', alt = '', className = '' }: ArtboardThumbProps) {
  const [url, setUrl] = useState(() => imageUrl || (imageId ? getCachedImage(imageId) ?? '' : ''))
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    setFailed(false)
    if (!imageId) return
    if (imageUrl) {
      setUrl((prev) => prev || imageUrl)
      return
    }
    if (url) return
    let cancelled = false
    void ensureImageCached(imageId).then((next) => {
      if (!cancelled && next) setUrl(next)
    })
    return () => {
      cancelled = true
    }
  }, [imageId, imageUrl, url])

  // 加载中与读取失败是两件事：前者给微光骨架，后者给明确原因，别再共用一块灰
  if (failed) {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center gap-1.5 bg-surface-2 text-ink-3">
        <ImageOff size={18} strokeWidth={1.4} />
        <span className="text-caption">图片读取失败</span>
      </div>
    )
  }
  if (!url) {
    return (
      <div role="status" aria-label="图片加载中" className="h-full w-full">
        <Skeleton className="h-full w-full" rounded="rounded-none" />
      </div>
    )
  }
  return (
    <img
      src={url}
      alt={alt}
      className={className}
      loading="lazy"
      decoding="async"
      onError={() => setFailed(true)}
    />
  )
}
