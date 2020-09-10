require('dotenv').config()

const cron = require('node-cron')

const State = require('./State')
const Storage = require('./Storage')
const Mail = require('./Mail')
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
const Post = require('./controllers/Post')
const Notification = require('./controllers/Notification')
const ActivityPoint = require('./controllers/ActivityPoint')
const Reward = require('./controllers/Reward')

const main = async () => {
  const storage = new Storage()
  const mail = new Mail()
  const state = new State(storage)
  const near = new Near()
  try {
    await storage.init()
    await mail.init()
    await state.init()
    await near.init()
  } catch (err) {
    console.log(err)
    process.exit(1)
  }

  const ctl = () => {
    return svc
  }

  const feed = new Feed(state, storage)
  const transaction = new Transaction(state, storage)
  const verification = new Verification(state, storage, mail)
  const explore = new Explore(state, storage)
  const wallet = new Wallet(storage, near, ctl)
  const comment = new Comment(storage, near, ctl)
  const activityPoint = new ActivityPoint(storage, near)
  const memento = new Memento(storage, near, ctl)
  const post = new Post(storage, near, ctl)
  const reward = new Reward(storage, near, ctl)
  const metascraper = new Metascraper(storage)
  const notification = new Notification(storage)
  const auth = new Auth(state, storage, mail, near, ctl)

  const svc = {
    feed: feed,
    transaction: transaction,
    verification: verification,
    explore: explore,
    wallet: wallet,
    comment: comment,
    activityPoint: activityPoint,
    memento: memento,
    post: post,
    reward: reward,
    metascraper: metascraper,
    notification: notification,
    auth: auth
  }

  cron.schedule('0 0 * * *', async () => {
    console.log(`cron::reward.disburse`)
    await reward.disburse()
  }, {
    scheduled: true,
    timezone: 'Etc/UTC'
  })
}

main()