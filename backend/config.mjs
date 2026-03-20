import dotenv from 'dotenv'
dotenv.config()
const PORT = process.env.PORT
const MONGO_URI = process.env.MONGO_URI
const JWT_SECRET = process.env.JWT_SECRET
const ACCESS_KEY = process.env.accessKey
const SECRET_ACCESS_KEY = process.env.secretAccessKey
const REGION = process.env.region
export { PORT, MONGO_URI, JWT_SECRET, ACCESS_KEY, SECRET_ACCESS_KEY, REGION }