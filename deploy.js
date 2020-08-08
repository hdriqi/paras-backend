require('dotenv').config()

const Near = require('./Near')

const main = async () => {
  const near = new Near()
  await near.init()

  await near.deployContract()
}

main()