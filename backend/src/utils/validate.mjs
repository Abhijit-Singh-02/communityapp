import mongoose from 'mongoose'

const isNonEmptyString = (value) => typeof value === 'string' && value.trim().length > 0

const normalizeString = (value = '') => (typeof value === 'string' ? value.trim() : '')

const validateRequiredFields = (payload = {}, fields = []) => {
    const missing = fields.filter((field) => !isNonEmptyString(payload[field]))
    return {
        valid: missing.length === 0,
        missing,
    }
}

const validateObjectId = (id) => mongoose.Types.ObjectId.isValid(id)

const sanitizeStringArray = (value) => {
    if (Array.isArray(value)) {
        return value
            .map((item) => normalizeString(item))
            .filter(Boolean)
    }
    if (typeof value === 'string') {
        return value
            .split(',')
            .map((item) => normalizeString(item))
            .filter(Boolean)
    }
    return []
}

const normalizePagination = ({ page = 1, limit = 20 } = {}) => {
    const parsedPage = Number.parseInt(page, 10)
    const parsedLimit = Number.parseInt(limit, 10)
    const safePage = Number.isFinite(parsedPage) && parsedPage > 0 ? parsedPage : 1
    const safeLimit = Number.isFinite(parsedLimit) && parsedLimit > 0 ? Math.min(parsedLimit, 50) : 20
    return { page: safePage, limit: safeLimit, skip: (safePage - 1) * safeLimit }
}

const validatePostPayload = (payload = {}) => {
    const content = normalizeString(payload.content)
    const media = normalizeString(payload.media)
    const mediaType = normalizeString(payload.mediaType).toLowerCase()

    if (!content && !media) {
        return { valid: false, message: 'Post content or media is required' }
    }

    if (content.length > 3000) {
        return { valid: false, message: 'Post content cannot exceed 3000 characters' }
    }

    if (mediaType && !['image', 'video', 'text', 'carousel'].includes(mediaType)) {
        return { valid: false, message: 'Invalid mediaType' }
    }

    const hashtags = sanitizeStringArray(payload.hashtags).map((tag) =>
        tag.startsWith('#') ? tag : `#${tag}`
    )

    return {
        valid: true,
        data: {
            content,
            media,
            mediaType,
            visibility: normalizeString(payload.visibility).toLowerCase() || 'public',
            location: normalizeString(payload.location),
            hashtags,
            mentions: sanitizeStringArray(payload.mentions),
        },
    }
}

export {
    isNonEmptyString,
    normalizeString,
    normalizePagination,
    sanitizeStringArray,
    validateObjectId,
    validatePostPayload,
    validateRequiredFields,
}
