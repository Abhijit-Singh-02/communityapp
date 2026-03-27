## Project - Tech Community App

### Key points
- This repository is a monorepo with **frontend** (Vite + React) and **backend** (Express + MongoDB).
- Authentication uses **Authorization header** with **Bearer JWT** for protected routes.
- Media uploads (profile picture + post media) are stored in **AWS S3** and saved as public URLs.
- Realtime messaging uses **Socket.IO** on the same server as the REST API.

## Tech stack
- **Frontend:** React, Vite, React Router, Axios, Socket.IO client, CSS Modules, MUI Icons
- **Backend:** Express, MongoDB + Mongoose, JWT, Multer, AWS SDK (S3), Socket.IO

## Repository layout

```text
communityapp/
  frontend/
  backend/
```

## Setup

### Backend

```bash
cd backend
npm install
npm run test
```

Create `backend/.env`:

```env
PORT=8080
MONGO_URI=mongodb://...
JWT_SECRET=your-secret

accessKey=AWS_ACCESS_KEY_ID
secretAccessKey=AWS_SECRET_ACCESS_KEY
region=ap-south-1
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Create `frontend/.env`:

```env
VITE_BACKEND_URL=http://localhost:8080
```

## Response

### Successful Response structure
```yaml
{
  "message": "Success",
  "...": "endpoint-specific fields"
}
```

### Error Response structure
```yaml
{
  "message": "Error message"
}
```

> Notes:
> - Most endpoints return `{ message, ... }` and may include `user`, `post`, `comment`, etc.
> - Authentication failures return `401` with a message like `Unauthorized` or `Please login to access this resource`.

## FEATURE I - Authentication & Profile

### Models
- User (`backend/src/models/userModel.mjs`)
```yaml
{
  username: {string, required, unique},
  email: {string, required, unique},
  password: {string, required},
  phoneNumber: {string, required},
  profilePicture: {string},  # s3 url
  bio: {string},
  followers: {ObjectId[]},
  following: {ObjectId[]},
  notificationsLastSeenAt: {Date},
  createdAt: {timestamp},
  updatedAt: {timestamp}
}
```

### APIs
#### POST /signup
- Create a user.
- Body: `{ username, email, password, phoneNumber }`
- Response
  - On success (201):
```yaml
{
  "message": "User created successfully",
  "user": { "_id": "...", "username": "...", "email": "...", "phoneNumber": "...", "...": "..." }
}
```

#### POST /login
- Login with email + password.
- Body: `{ email, password }`
- Returns JWT in response header `authorization: Bearer <token>` and also in JSON body as `token`.
- Response
  - On success (200):
```yaml
{
  "message": "Login successful",
  "token": "jwt-token",
  "user": { "id": "userId", "username": "username" }
}
```

#### GET /profile (Authentication required)
- Returns profile fields.
- Includes: `followersCount`, `followingCount`, `followingIds`.
- Response
  - On success (200):
```yaml
{
  "message": "Profile fetched successfully",
  "user": {
    "_id": "...",
    "username": "...",
    "email": "...",
    "followersCount": 0,
    "followingCount": 0,
    "followingIds": ["..."]
  }
}
```

#### PUT /profile (Authentication required, multipart)
- Update profile.
- Multipart field: `profilePicture` (image)
- Response
  - On success (200):
```yaml
{
  "message": "Profile updated successfully",
  "updatedUser": { "_id": "...", "username": "...", "profilePicture": "https://..." }
}
```

## FEATURE II - Follow / Connect

### APIs
#### GET /users (Authentication required)
- List users for Connect + search.
- Query: `page`, `limit`, `q` (search by username)
- Returns `users[]` with `isFollowing`.
- Response
  - On success (200):
```yaml
{
  "message": "Users",
  "page": 1,
  "limit": 20,
  "total": 123,
  "users": [{ "_id": "...", "username": "...", "profilePicture": "https://...", "isFollowing": false }]
}
```

#### POST /follow (Authentication required)
- Body: `{ followingUserId }`
- Response
  - On success (200):
```yaml
{
  "message": "User followed successfully",
  "user": { "_id": "...", "...": "..." },
  "followingUser": { "_id": "...", "...": "..." },
  "followersCount": 10,
  "followingCount": 5
}
```

#### POST /unfollow (Authentication required)
- Body: `{ followingUserId }`
- Response
  - On success (200):
```yaml
{
  "message": "Unfollowed successfully",
  "user": { "_id": "...", "...": "..." },
  "followingUser": { "_id": "...", "...": "..." },
  "followersCount": 9,
  "followingCount": 4
}
```

#### GET /users/:userId (Authentication required)
- Public profile card:
  - `followersCount`, `followingCount`, `isFollowing`
- Response
  - On success (200):
```yaml
{
  "message": "User profile",
  "profile": { "_id": "...", "username": "...", "followersCount": 0, "followingCount": 0, "isFollowing": false }
}
```

#### GET /users/:userId/followers (Authentication required)
#### GET /users/:userId/following (Authentication required)
- Response
  - On success (200):
```yaml
{
  "message": "Followers|Following",
  "page": 1,
  "limit": 20,
  "total": 10,
  "users": [{ "_id": "...", "username": "...", "profilePicture": "https://..." }]
}
```

## FEATURE III - Posts / Reels

### Models
- Post (`backend/src/models/postModel.mjs`)
```yaml
{
  userId: {ObjectId, required},
  postType: {string, enum["post","job"]},
  content: {string, maxLen 8000},
  media: {string},           # s3 url
  mediaType: {string},       # text|image|video|carousel
  likes: {number},
  likedBy: {ObjectId[]},
  commentsCount: {number},
  sharesCount: {number},
  job: {                     # only when postType=job
    title: {string},
    company: {string},
    location: {string},
    employmentType: {string}
  },
  status: {string, enum["active","archived","deleted"]},
  createdAt: {timestamp},
  updatedAt: {timestamp}
}
```

### APIs
#### POST /posts (Authentication required, multipart)
- Create a normal post or a job post.
- Normal post:
  - `postType=post`, `content`, `mediaType`, optional file `mediaFile`
- Job post:
  - `postType=job`, `jobTitle`, `company`, `jobLocation`, `employmentType`, `content`
- Response
  - On success (201):
```yaml
{
  "message": "Post created successfully",
  "post": { "_id": "...", "postType": "post|job", "content": "...", "media": "https://...", "job": { "title": "..." } }
}
```

#### GET /posts (Authentication required)
- Feed
- Query: `page`, `limit`
- Response
  - On success (200):
```yaml
{
  "message": "Posts fetched successfully",
  "page": 1,
  "limit": 20,
  "count": 20,
  "posts": [{ "_id": "...", "userId": { "_id": "...", "username": "...", "profilePicture": "https://..." }, "content": "..." }]
}
```

#### GET /posts/:userId (Authentication required)
- Posts by user
- Response
  - On success (200):
```yaml
{
  "message": "Posts fetched successfully",
  "posts": [{ "_id": "...", "postType": "post|job", "content": "..." }]
}
```

#### DELETE /posts/:postId (Authentication required)
- Owner only; permanently deletes post + its comments.
- Response
  - On success (200):
```yaml
{ "message": "Post deleted permanently" }
```

#### POST /posts/:postId/like (Authentication required)
#### POST /posts/:postId/share (Authentication required)
- Response
  - Like success (200):
```yaml
{ "message": "Like updated", "post": { "_id": "...", "likes": 1, "likedBy": ["..."] } }
```
  - Share success (200):
```yaml
{ "message": "Share recorded", "post": { "_id": "...", "sharesCount": 1 } }
```

#### GET /reels (Authentication required)
- Returns video posts (used by Reels page).
- Response
  - On success (200):
```yaml
{
  "message": "Reels fetched successfully",
  "page": 1,
  "limit": 20,
  "count": 10,
  "reels": [{ "_id": "...", "mediaType": "video", "media": "https://..." }]
}
```

## FEATURE IV - Comments (Threaded)

### Models
- Comment (`backend/src/models/commentModel.mjs`)
```yaml
{
  postId: {ObjectId, required},
  userId: {ObjectId, required},
  parentCommentId: {ObjectId|null},
  text: {string, maxLen 1000},
  likes: {number},
  likedBy: {ObjectId[]},
  status: {string, enum["active","deleted"]},
  createdAt: {timestamp},
  updatedAt: {timestamp}
}
```

### APIs
#### GET /posts/:postId/comments (Authentication required)
- Query: `page`, `limit`, `parentId` (optional)
- Response
  - On success (200):
```yaml
{
  "message": "Comments fetched",
  "page": 1,
  "limit": 20,
  "total": 5,
  "comments": [{ "_id": "...", "text": "...", "userId": { "_id": "...", "username": "...", "profilePicture": "https://..." } }]
}
```

#### GET /posts/:postId/comments/:commentId/replies (Authentication required)
- Response
  - On success (200):
```yaml
{
  "message": "Replies fetched",
  "replies": [{ "_id": "...", "text": "...", "userId": { "_id": "...", "username": "..." } }]
}
```

#### POST /posts/:postId/comments (Authentication required)
- Body: `{ text, parentCommentId? }`
- Response
  - On success (201):
```yaml
{
  "message": "Comment added",
  "comment": { "_id": "...", "text": "...", "userId": { "_id": "...", "username": "..." } },
  "post": { "_id": "...", "commentsCount": 1 }
}
```

#### POST /comments/:commentId/like (Authentication required)
#### DELETE /comments/:commentId (Authentication required)
- Comment author or post owner; cascades to replies; returns `deletedIds[]`.
- Response
  - Like success (200):
```yaml
{ "message": "OK", "comment": { "_id": "...", "likes": 1, "likedBy": ["..."] } }
```
  - Delete success (200):
```yaml
{ "message": "Comment deleted", "post": { "_id": "...", "commentsCount": 0 }, "deletedIds": ["..."] }
```

## FEATURE V - Jobs

### APIs
#### GET /jobs (Authentication required)
- Returns only job posts (`postType=job`).
- Includes poster email (for apply button via `mailto:`).
- Response
  - On success (200):
```yaml
{
  "message": "Jobs fetched successfully",
  "page": 1,
  "limit": 20,
  "total": 3,
  "jobs": [{ "_id": "...", "job": { "title": "..." }, "userId": { "username": "...", "email": "..." } }]
}
```

## FEATURE VI - Notifications

### APIs
#### GET /notifications (Authentication required)
- New posts/jobs created by followed users since last seen.
- Response
  - On success (200):
```yaml
{
  "message": "Notifications",
  "since": "2026-01-01T00:00:00.000Z",
  "counts": { "all": 2, "posts": 1, "jobs": 1 },
  "items": [{ "_id": "...", "postType": "post|job", "createdAt": "..." }]
}
```

#### POST /notifications/seen (Authentication required)
- Mark all notifications as read.
- Response
  - On success (200):
```yaml
{ "message": "OK", "seenAt": "2026-01-01T00:00:00.000Z" }
```

## FEATURE VII - Messaging (LinkedIn-style)

### Models
- Conversation (`backend/src/models/conversationModel.mjs`)
- Message (`backend/src/models/messageModel.mjs`)

### REST APIs (Authentication required)
#### GET /conversations
#### POST /conversations
- Body: `{ otherUserId }`

#### GET /conversations/:conversationId/messages
#### POST /conversations/:conversationId/read

#### PATCH /messages/:messageId
- Edit own message
- Body: `{ text }`

#### DELETE /messages/:messageId
- Delete own message (soft delete)

### Response formats
#### GET /conversations
- On success (200):
```yaml
{
  "message": "Conversations",
  "conversations": [{
    "_id": "conversationId",
    "otherUser": { "_id": "...", "username": "...", "profilePicture": "https://..." },
    "lastMessageText": "Hello",
    "lastMessageAt": "2026-01-01T00:00:00.000Z",
    "unreadCount": 0
  }]
}
```

#### POST /conversations
- On success (201):
```yaml
{
  "message": "Conversation ready",
  "conversation": { "_id": "conversationId", "otherUser": { "_id": "...", "username": "..." } }
}
```

#### GET /conversations/:conversationId/messages
- On success (200):
```yaml
{
  "message": "Messages",
  "page": 1,
  "limit": 100,
  "messages": [{
    "_id": "messageId",
    "conversationId": "conversationId",
    "senderId": "userId",
    "text": "Message text",
    "isEdited": false,
    "editedAt": null,
    "createdAt": "2026-01-01T00:00:00.000Z"
  }]
}
```

#### POST /conversations/:conversationId/read
- On success (200):
```yaml
{ "message": "OK" }
```

#### PATCH /messages/:messageId
- On success (200):
```yaml
{
  "message": "Message edited",
  "messageDoc": { "_id": "messageId", "text": "new text", "isEdited": true, "editedAt": "..." }
}
```

#### DELETE /messages/:messageId
- On success (200):
```yaml
{ "message": "Message deleted", "messageId": "messageId" }
```

### Socket.IO
Client connection:
```js
io(serverUrl, { auth: { token } })
```

Events (client → server):
- `join_conversation` `{ conversationId }`
- `send_message` `{ conversationId, text }` (or `{ otherUserId, text }`)
- `typing` `{ conversationId, isTyping }`
- `read` `{ conversationId }`
- `edit_message` `{ messageId, text }`
- `delete_message` `{ messageId }`

Events (server → client):
- `message_new`
- `message_edited`
- `message_deleted`
- `typing`
- `read`
- `inbox_updated`

## Frontend routes

- `/` Home
- `/:userId/posts` Posts + Job composer
- `/:userId/reels` Reels
- `/:userId/connect` Connect
- `/:userId/jobs` Jobs
- `/:userId/notifications` Notifications
- `/:userId/messages` Messaging
- `/:userId/:username/profile` Profile

## Notes
- Restart the backend after adding models/routes (Socket.IO and schema changes).
- Vite env vars must start with `VITE_` and are read via `import.meta.env`.
- S3 upload helper: `backend/src/aws/uploadProfile.mjs`.

## Security
- Do not commit `.env` files.
- Rotate any credential if exposed.

## License
ISC
