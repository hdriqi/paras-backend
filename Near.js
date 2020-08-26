const { Contract, KeyPair, connect, Account } = require('near-api-js')
const { join } = require('path')
const { InMemoryKeyStore, MergeKeyStore } = require('near-api-js').keyStores
const { parseNearAmount } = require('near-api-js').utils.format

const config = require('./config')(process.env.NODE_ENV || 'development')

const contractConfig = {
  viewMethods: [
    'getUserById',
    'getMementoById',
    'name',
    'symbol',
    'decimals',
    'balanceOf',
    'allowance',
    'getBalance'
  ],
  // Change methods can modify the state, but you don't receive the returned value when called
  changeMethods: [
    'createMemento',
    'updateMemento',
    'archiveMemento',
    'unarchiveMemento',
    'deleteMemento',
    'createPost',
    'transmitPost',
    'updatePost',
    'deletePost',
    'redactPost',
    'toggleFollow',
    'createUser',
    'updateUser',
    'createComment',
    'deleteComment',
    'init',
    'transfer',
    'approve',
    'transferFrom',
    'piecePost'
  ],
}

class Near {
  constructor() {
    this.ctx = null
    this.masterAccount = null
    this.accountsMap = new Map()
  }

  async init() {
    if (!process.env.ROOT_ACCOUNT) {
      throw "[env] ROOT_ACCOUNT not found"
    }
    if (!process.env.CONTRACT_ACCOUNT) {
      throw "[env] CONTRACT_ACCOUNT not found"
    }
    const rootAccount = JSON.parse(process.env.ROOT_ACCOUNT)
    const contractAccount = JSON.parse(process.env.CONTRACT_ACCOUNT)
    const keyStore = new InMemoryKeyStore()

    const rootKeyPair = KeyPair.fromString(rootAccount.secret_key || rootAccount.private_key)
    await keyStore.setKey(config.networkId, rootAccount.account_id, rootKeyPair)

    const contractKeyPair = KeyPair.fromString(contractAccount.secret_key || contractAccount.private_key)
    await keyStore.setKey(config.networkId, contractAccount.account_id, contractKeyPair)

    const near = await connect({
      deps: {
        keyStore: keyStore
      },
      ...config
    })
    this.ctx = near
    this.masterAccount = await near.account(rootAccount.account_id)
    this.contractAccount = await near.account(contractAccount.account_id)
    this.contract = new Contract(this.masterAccount, this.contractAccount.accountId, contractConfig)
    this.keyStore = keyStore
  }

  async checkAccount(accountId) {
    return new Promise(async (resolve) => {
      let account = null
      try {
        account = await this.ctx.account(accountId)
      } catch (err) {
        // console.log(err)
      }
      resolve(account)
    })
  }

  async loadAccount({ userId, secretKey }) {
    const accId = userId
    const accExist = await this.checkAccount(accId)
    if (!accExist) {
      throw new Error(`Account ${accId} not exist`)
    }
    const loaded = this.accountsMap.get(accId)
    if (loaded) {
      return true
    }
    const keyPair = KeyPair.fromString(secretKey)
    await this.keyStore.setKey(config.networkId, accId, keyPair)
    new Account()
    const contract = new Contract(accExist, this.contractAccount.accountId, contractConfig)

    this.accountsMap.set(accId, {
      publicKey: keyPair.getPublicKey().toString(),
      account: new Account(config, accId),
      contract: contract
    })

    return true
  }

  async getKeyPair({ privateKey }) {
    const secretKey = `ed25519:${privateKey}`
    const keyPair = KeyPair.fromString(secretKey)
    return {
      secretKey: secretKey,
      publicKey: keyPair.getPublicKey().toString()
    }
  }

  async createAccount({ userId, secretKey }) {
    const newAccId = userId
    const accExist = await this.checkAccount(newAccId)
    if (accExist) {
      throw new Error(`Account ${newAccId} already exist`)
    }
    const keyPair = KeyPair.fromString(secretKey)
    const newAccount = await this.masterAccount.createAccount(newAccId, keyPair.publicKey.toString(), parseNearAmount('1'))
    await this.loadAccount({ userId, secretKey })
    return newAccount
  }

  // async getAccountBalance({ userId }) {
  //   await this.masterAccount.sendMoney(userId, parseNearAmount(value))
  //   await getAccountBalance
  // }

  async deployContract() {
    console.log('Setting up and deploying contract')
    const contractPath = join(process.cwd(), 'out/main.wasm')
    await this.contractAccount.deployContract(require('fs').readFileSync(contractPath))
    try {
      await this.contract.init({
        initialOwner: this.masterAccount.accountId
      })
    } catch (err) {
      console.log(err)
    }
    console.log(`Contract ${this.contractAccount.accountId} deployed`)
  }
}

module.exports = Near