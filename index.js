require('dotenv').config()

const express = require('express')
const cors = require('cors')
const bodyParser = require('body-parser')
const rateLimit = require("express-rate-limit")

const authenticate = require('./middleware/authenticate')
const admin = require('./middleware/admin')
const multer = require('./middleware/multer')

const State = require('./State')
const Storage = require('./Storage')
const Mail = require('./Mail')
const Cron = require('./Cron')
const Near = require('./Near')

const Feed = require('./controllers/Feed')
const Transaction = require('./controllers/Transaction')
const Verification = require('./controllers/Verification')
const Explore = require('./controllers/Explore')
const Wallet = require('./controllers/Wallet')
const Auth = require('./controllers/Auth')
const Comment = require('./controllers/Comment')
const Metascraper = require('./controllers/Metascraper')
const Memento = require('./controllers/Memento')

const PORT = 9090
const server = express()

const main = async () => {
  const storage = new Storage()
  const mail = new Mail()
  const state = new State(storage)
  // const cron = new Cron(storage, mail)
  const near = new Near()
  try {
    await storage.init()
    await mail.init()
    await state.init()
    // await cron.init()
    await near.init()
  } catch (err) {
    console.log(err)
    process.exit(1)
  }

  const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100
  })

  const feed = new Feed(state, storage)
  const transaction = new Transaction(state, storage)
  const verification = new Verification(state, storage, mail)
  const explore = new Explore(state, storage)
  const wallet = new Wallet(storage, near)
  const auth = new Auth(state, storage, mail, near)
  const comment = new Comment(storage, near)
  const memento = new Memento(storage, near)
  const metascraper = new Metascraper(storage)

  if (process.env.NODE_ENV === 'production') {
    server.set('trust proxy', 1)
    server.use(limiter)
  }
  server.use(cors())
  server.use(bodyParser.urlencoded({ extended: true }))
  server.use(bodyParser.json())

  server.get('/', (req, res) => {
    return res.json({
      success: 1
    })
  })

  server.get('/metaget', async (req, res) => {
    const metadata = await metascraper.get(req.query.link)
    return res.json({
      success: 1,
      data: metadata
    })
  })

  server.post('/upload', multer.single('file'), async (req, res) => {
    try {
      const ipfsObj = await storage.upload(req.file)
      return res.json({
        success: 1,
        data: ipfsObj
      })
    } catch (err) {
      console.log(err)
      return res.status(400).json({
        success: 0,
        message: err.message
      })
    }
  })

  server.post('/register', async (req, res) => {
    const payload = {
      email: req.body.email,
      username: req.body.username,
    }
    try {
      const result = await auth.register(payload)
      return res.json({
        success: 1,
        data: result
      })
    } catch (err) {
      console.log(err)
      return res.status(400).json({
        success: 0,
        message: err.message
      })
    }
  })

  server.post('/register/confirm', async (req, res) => {
    const payload = {
      email: req.body.email,
      pin: req.body.pin
    }
    try {
      const result = await auth.verifyRegister(payload)
      return res.json({
        success: 1,
        data: result
      })
    } catch (err) {
      console.log(err)
      return res.status(400).json({
        success: 0,
        message: err.message
      })
    }
  })

  server.post('/login', async (req, res) => {
    const payload = {
      userId: req.body.userId,
      seed: req.body.seed,
      privateKey: req.body.privateKey
    }
    try {
      const result = await auth.login(payload)
      return res.json({
        success: 1,
        data: result
      })
    } catch (err) {
      console.log(err)
      return res.status(400).json({
        success: 0,
        message: err.message
      })
    }
  })

  server.post('/verify', async (req, res) => {
    try {
      const result = await auth.verifyToken({
        token: req.headers.authorization.split(' ')[1]
      })
      return res.json({
        success: 1,
        data: result
      })
    } catch (err) {
      console.log(err)
      return res.status(400).json({
        success: 0,
        message: err.message
      })
    }
  })

  server.get('/mementos', async (req, res) => {
    const mementoList = await storage.get('memento', req.query, [{
      col: 'user',
      key: 'owner',
      targetCol: 'user',
      targetKey: 'id'
    }])
    return res.json({
      success: 1,
      data: mementoList
    })
  })

  server.post('/mementos', authenticate({ auth: auth }), async (req, res) => {
    try {
      const userId = req.userId
      console.log(userId)
      if (!(userId && req.body.name && req.body.category && req.body.type)) {
        throw new Error('Required [body:name, body:category, body:type]')
      }
      const newMemento = await memento.create(userId, {
        name: req.body.name,
        category: req.body.category,
        type: req.body.type
      })
      return res.json({
        success: 1,
        data: newMemento
      })
    } catch (err) {
      return res.status(400).json({
        success: 0,
        message: err.message
      })
    }
  })

  server.delete('/mementos/:mementoId', authenticate({ auth: auth }), async (req, res) => {
    try {
      const userId = req.userId
      const mementoId = req.params.mementoId
      if (!(userId && mementoId)) {
        throw new Error('Required [params:mementoId]')
      }
      const delMemento = await memento.delete(userId, {
        mementoId: mementoId
      })
      return res.json({
        success: 1,
        data: delMemento
      })
    } catch (err) {
      return res.status(400).json({
        success: 0,
        message: err.message
      })
    }
  })

  server.get('/posts', async (req, res) => {
    const postList = await storage.get('post', req.query, [{
      col: 'memento',
      key: 'mementoId',
      targetCol: 'memento',
      targetKey: 'id'
    }, {
      col: 'user',
      key: 'owner',
      targetCol: 'user',
      targetKey: 'id'
    }])
    return res.json({
      success: 1,
      data: postList
    })
  })

  server.get('/transactions', async (req, res) => {
    const txList = await transaction.getById(req.query.id, req.query.__skip, req.query.__limit)
    return res.json({
      success: 1,
      data: txList
    })
  })

  server.get('/search', async (req, res) => {
    const itemList = await explore.search(req.query)
    return res.json({
      success: 1,
      data: itemList
    })
  })

  server.get('/users', async (req, res) => {
    const userList = await storage.get('user', req.query)
    return res.json({
      success: 1,
      data: userList
    })
  })

  server.get('/explore', async (req, res) => {
    const postList = await explore.getPost()
    return res.json({
      success: 1,
      data: postList
    })
  })

  server.get('/grants', async (req, res) => {
    const grantList = await storage.get('grant', req.query, [{
      col: 'memento',
      key: 'mementoId',
      targetCol: 'memento',
      targetKey: 'id'
    }])
    return res.json({
      success: 1,
      data: grantList
    })
  })

  server.post('/wallet/transfer', authenticate({ auth: auth }), async (req, res) => {
    try {
      const userId = req.userId
      if (!(userId && req.body.targetUserId && req.body.value)) {
        throw new Error('Required [body:targetUserId, body:value]')
      }
      const accountBalance = await wallet.transfer(userId, req.body.targetUserId, req.body.value, req.body.msg)
      return res.json({
        success: 1,
        data: accountBalance
      })
    } catch (err) {
      console.log(err)
      if (err.panic_msg) {
        if (err.panic_msg.includes('not enough tokens on account'))
          return res.status(400).json({
            success: 0,
            message: 'Not enough tokens on account'
          })
      }
      return res.status(400).json({
        success: 0,
        message: err.message
      })
    }
  })

  server.post('/wallet/piece', authenticate({ auth: auth }), async (req, res) => {
    try {
      const userId = req.userId
      if (!(userId && req.body.postId && req.body.value)) {
        throw new Error('Required [body:postId, body:value]')
      }
      const accountBalance = await wallet.piece(userId, req.body.postId, req.body.value)
      return res.json({
        success: 1,
        data: accountBalance
      })
    } catch (err) {
      if (err.panic_msg) {
        if (err.panic_msg.includes('not enough tokens on account'))
          return res.status(400).json({
            success: 0,
            message: 'Not enough tokens on account'
          })
      }
      return res.status(400).json({
        success: 0,
        message: err.message
      })
    }
  })

  server.get('/balances/:id', async (req, res) => {
    try {
      const accountBalance = await wallet.get(req.params.id)
      return res.json({
        success: 1,
        data: accountBalance
      })
    } catch (err) {
      return res.status(400).json({
        success: 0,
        message: err.message
      })
    }
  })

  server.get('/comments', async (req, res) => {
    const commentList = await comment.get(req.query)
    return res.json({
      success: 1,
      data: commentList
    })
  })

  server.post('/comments', authenticate({ auth: auth }), async (req, res) => {
    try {
      const userId = req.userId
      if (!(userId && req.body.postId && req.body.body)) {
        throw new Error('Required [body:postId, body:body]')
      }
      const commentList = await comment.create(userId, req.body.postId, req.body.body)
      return res.json({
        success: 1,
        data: commentList
      })
    } catch (err) {
      return res.status(400).json({
        success: 0,
        message: err.message
      })
    }
  })

  server.delete('/comments/:commentId', authenticate({ auth: auth }), async (req, res) => {
    try {
      const userId = req.userId
      const commentId = req.params.commentId
      // MF8UCMVL95h
      if (!(userId && commentId)) {
        throw new Error('Required [params:commentId]')
      }
      const commentList = await comment.delete(userId, commentId)
      return res.json({
        success: 1,
        data: commentList
      })
    } catch (err) {
      return res.status(400).json({
        success: 0,
        message: err.message
      })
    }
  })

  server.get('/feeds', authenticate({ auth: auth }), async (req, res) => {
    const {
      __skip,
      __limit
    } = req.query

    try {
      const result = await feed.get(req.userId, __skip, __limit)
      return res.json({
        success: 1,
        data: result
      })
    } catch (err) {
      console.log(err)
      return res.json({
        success: 0,
        message: err
      })
    }
  })

  server.get('/timelines', async (req, res) => {
    try {
      const result = await feed.getTimelines(req.query)
      return res.json({
        success: 1,
        data: result
      })
    } catch (err) {
      console.log(err)
      return res.json({
        success: 0,
        message: err
      })
    }
  })

  server.post('/timelines', admin, async (req, res) => {
    try {
      const result = await feed.addToTimelines(req.body.feedId, req.body.postId)
      return res.json({
        success: 1,
        data: result
      })
    } catch (err) {
      return res.json({
        success: 0,
        message: err
      })
    }
  })

  server.delete('/timelines', admin, async (req, res) => {
    try {
      const result = await feed.removeFromTimelines(req.body.feedId, req.body.postId)
      return res.json({
        success: 1,
        data: result
      })
    } catch (err) {
      return res.json({
        success: 0,
        message: err
      })
    }
  })

  server.get('/follow', authenticate({ auth: auth }), async (req, res) => {
    try {
      const result = await feed.getFollowing(req.userId, req.query.__skip, req.query.__limit)
      return res.json({
        success: 1,
        data: result
      })
    } catch (err) {
      return res.json({
        success: 0,
        message: err
      })
    }
  })

  server.post('/follow', authenticate({ auth: auth }), async (req, res) => {
    const {
      targetId,
      targetType
    } = req.body

    try {
      await feed.follow(req.userId, targetId, targetType)
      return res.json({
        success: 1,
        data: true
      })
    } catch (err) {
      return res.status(400).json({
        success: 0,
        message: err
      })
    }
  })

  server.post('/unfollow', authenticate({ auth: auth }), async (req, res) => {
    const {
      targetId,
      targetType
    } = req.body

    try {
      await feed.unfollow(req.userId, targetId, targetType)
      return res.json({
        success: 1,
        data: true
      })
    } catch (err) {
      return res.status(400).json({
        success: 0,
        message: err
      })
    }
  })

  server.get('/register', authenticate({ auth: auth }), async (req, res) => {
    try {
      const user = await verification.checkRegister(req.userId)
      return res.json({
        success: 1,
        data: user
      })
    } catch (err) {
      console.log(err)
      return res.status(400).json({
        success: 0,
        message: err
      })
    }
  })

  server.post('/register', authenticate({ auth: auth }), async (req, res) => {
    const {
      email,
      fullName,
      referral,
    } = req.body

    try {
      await verification.register(req.userId, email, fullName, referral)
      return res.json({
        success: 1,
        data: true
      })
    } catch (err) {
      return res.status(400).json({
        success: 0,
        message: err
      })
    }
  })

  server.post('/confirm', async (req, res) => {
    const {
      token
    } = req.body

    try {
      await verification.confirmEmail(token)
      return res.json({
        success: 1,
        data: true
      })
    } catch (err) {
      return res.status(400).json({
        success: 0,
        message: err
      })
    }
  })

  server.listen(PORT, () => {
    console.log(`indexer running on PORT ${PORT}`)
  })
}

main()