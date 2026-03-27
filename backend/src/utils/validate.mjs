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

const validateCommentPayload = (payload = {}) => {
    const text = normalizeString(payload.text)
    if (!text) {
        return { valid: false, message: 'Comment text is required' }
    }
    if (text.length > 1000) {
        return { valid: false, message: 'Comment cannot exceed 1000 characters' }
    }
    const rawParent = payload.parentCommentId ?? payload.parentId
    const parentCommentId = rawParent ? normalizeString(String(rawParent)) : ''
    if (parentCommentId && !mongoose.Types.ObjectId.isValid(parentCommentId)) {
        return { valid: false, message: 'Invalid parent comment id' }
    }
    return {
        valid: true,
        data: {
            text,
            parentCommentId: parentCommentId || undefined,
        },
    }
}

const validatePostPayload = (payload = {}) => {
    const content = normalizeString(payload.content)
    const media = normalizeString(payload.media)
    const mediaType = normalizeString(payload.mediaType).toLowerCase()

    if (!content && !media) {
        return { valid: false, message: 'Post content or media is required' }
    }

    if (content.length > 8000) {
        return { valid: false, message: 'Post content cannot exceed 8000 characters' }
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

const validateJobPayload = (payload = {}) => {
    const title = normalizeString(payload.jobTitle ?? payload.title)
    const company = normalizeString(payload.company)
    const location = normalizeString(payload.jobLocation ?? payload.location)
    const employmentType = normalizeString(payload.employmentType ?? payload.jobType)
    const content = normalizeString(payload.content)

    if (!title) return { valid: false, message: 'Job title is required' }
    if (!content) return { valid: false, message: 'Job description is required' }

    if (title.length > 140) return { valid: false, message: 'Job title is too long' }
    if (company.length > 140) return { valid: false, message: 'Company is too long' }
    if (location.length > 140) return { valid: false, message: 'Location is too long' }
    if (employmentType.length > 40) return { valid: false, message: 'Employment type is too long' }
    if (content.length > 8000) return { valid: false, message: 'Job description cannot exceed 8000 characters' }

    return {
        valid: true,
        data: {
            title,
            company,
            location,
            employmentType,
            content,
        },
    }
}

export {
    isNonEmptyString,
    normalizeString,
    normalizePagination,
    sanitizeStringArray,
    validateObjectId,
    validateCommentPayload,
    validatePostPayload,
    validateJobPayload,
    validateRequiredFields,
}
