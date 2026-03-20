import jwt from 'jsonwebtoken'
import { JWT_SECRET } from '../../config.mjs'
const authenticate = (req, res, next) => {
    try {
        const token = req.headers.authorization.split(' ')[1]
        if(!token) {
            return res.status(401).send({ message: 'Unauthorized' })
        }
        const decoded = jwt.verify(token, JWT_SECRET,(err,decodedToken)=>{
            if(err) {
                return res.status(401).send({ message: 'Please login to access this resource' })
            }
            return decodedToken;
        })
        req.user = decoded
        next()
    } catch (error) {
        return res.status(500).send({ message: 'Please login to access this resource' })
    }
}
const authorisation = (req, res, next) => {
    try {
        const userId = req.params.userId
        const username = req.params.username
        if(userId !== req.user.id || username !== req.user.username) {
            return res.status(401).send({ message: 'Unauthorized' })
        }
        next()
    } catch (error) {
        return res.status(500).send({ message: 'Internal server error' })
    }
}
export { authenticate, authorisation }