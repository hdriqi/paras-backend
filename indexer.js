require('dotenv').config()

const State = require('./State')
const Storage = require('./Storage')

const main = async () => {
  const storage = new Storage()
  const state = new State(storage)
  
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