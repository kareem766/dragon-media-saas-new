export const PLATFORM_OWNER_EMAIL = 'kalnoby0@gmail.com'

export function isPlatformOwnerEmail(email?: string | null) {
  return String(email || '').trim().toLowerCase() === PLATFORM_OWNER_EMAIL
}
