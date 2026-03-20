import express from 'express'
import mongoose from 'mongoose'
import cors from 'cors'
import { PORT, MONGO_URI } from './config.mjs'
import routes from './src/routes.mjs'
const app = express()
app.use(cors({ exposedHeaders: ['authorization'] }))
app.use(express.json())
app.use(express.urlencoded({ extended: true }))
mongoose.connect(MONGO_URI).then(() => {
    console.log('Connected to MongoDB')
}).catch((err) => {
    console.log(err)
})
app.use('/', routes);
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`)
})