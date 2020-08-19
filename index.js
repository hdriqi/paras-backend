require('dotenv').config()

const express = require('express')
const cors = require('cors')
const bodyParser = require('body-parser')

const authenticate = require('./middleware/authenticate')
const admin = require('./middleware/admin')

const State = require('./State')
const Storage = require('./Storage')
const Mail = require('./Mail')
const Cron = require('./Cron')
const Near = require('./Near')

const Feed = require('./controllers/Feed')
const Transaction = require('./controllers/Transaction')
const Verification = require('./controllers/Verification')
const Explore = require('./controllers/Explore')
const Balance = require('./controllers/Balance')
const Auth = require('./controllers/Auth')

const PORT = 9090
const server = express()

const main = async () => {
  const storage = new Storage()
  const mail = new Mail()
  const state = new State(storage)
  const cron = new Cron(storage, mail)
  const near = new Near()
  try {
    await storage.init()
    await mail.init()
    await state.init()
    await cron.init()
    await near.init()
  } catch (err) {
    console.log(err)
    process.exit(1)
  }

  const feed = new Feed(state, storage)
  const transaction = new Transaction(state, storage)
  const verification = new Verification(state, storage, mail)
  const explore = new Explore(state, storage)
  const balance = new Balance(state, storage)
  const auth = new Auth(state, storage, mail, near)

  server.use(cors())
  server.use(bodyParser.urlencoded({ extended: true }))
  server.use(bodyParser.json())

  server.get('/', (req, res) => {
    return res.json({
      success: 1
    })
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
      seed: req.body.seed
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

  server.get('/balances/:id', async (req, res) => {
    const accountBalance = await balance.get(req.params.id)
    return res.json({
      success: 1,
      data: accountBalance
    })
  })

  server.get('/comments', async (req, res) => {
    const commentList = await storage.get('comment', req.query, [{
      col: 'user',
      key: 'owner',
      targetCol: 'user',
      targetKey: 'id'
    }])
    return res.json({
      success: 1,
      data: commentList
    })
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