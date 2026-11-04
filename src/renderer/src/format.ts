export const formatBytes = (bytes: number): string => {
  if (!bytes) return '0 B'
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), 4)
  return `${(bytes / 1024 ** index).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} ${['B', 'KB', 'MB', 'GB', 'TB'][index]}`
}

export const formatDuration = (seconds: number): string => {
  const total = Math.floor(seconds)
  const minutes = Math.floor(total / 60)
  return `${minutes}:${String(total % 60).padStart(2, '0')}`
}

export const thumbnailUrl = (id: string): string => `media://thumbnail/${id}`
