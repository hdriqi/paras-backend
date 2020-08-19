module.exports = ({ auth }) => {
  return async (req, res, next) => {
    try {
      const authHeader = req.headers.authorization
      if (!authHeader) {
        throw new Error('Invalid authorization header')
      }

      const [head, token] = authHeader.split(' ')

      if (head !== 'Bearer') {
        throw new Error('Invalid authorization header')
      }

      const { userId, secretKey } = await auth.verifyToken({
        token: token
      })

      req.userId = userId
      req.userSecretKey = secretKey
      next()
    } catch (err) {
      return res.status(401).json({
        success: 0,
        message: err.message
      })
    }
  }
}