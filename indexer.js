require('dotenv').config()

const State = require('./State')
const Storage = require('./Storage')
const Notification = require('./controllers/Notification')

const main = async () => {
  const storage = new Storage()
  const notification = new Notification(storage)
  const state = new State(storage, notification)
  
  try {
    await storage.init()
    await state.init()
    state.start()
  } catch (err) {
    console.log(err)
    process.exit(1)
  }
}

main()