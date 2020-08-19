const nearSeedPhrase = require('near-seed-phrase')
const Cryptr = require('cryptr')
const { DEFAULT_AVATAR, DEFAULT_MEMENTO_IMG } = require('../utils/constants')
const axios = require('axios')

class Auth {
  constructor(state, storage, mail, near) {
    this.state = state
    this.storage = storage
    this.mail = mail
    this.near = near
    this.cryptr = new Cryptr(process.env.TOKEN_SECRET)
    this.usersMap = new Map()
  }

  async register({ email, username }) {
    const accId = `${username}.${this.near.masterAccount.accountId}`
    const accExist = await this.near.checkAccount(accId)
    if (accExist) {
      throw new Error('Username already taken')
    }

    const credExist = await this.storage.db.collection('credential').findOne({
      email: email
    })
    if (credExist) {
      throw new Error('Email already taken')
    }

    const verifyPin = Math.floor(100000 + Math.random() * 900000)
    const MS_15M = 900000

    const doc = {
      token: `${email}_${verifyPin}`,
      userId: accId,
      expiredAt: new Date().getTime() + MS_15M,
      createdAt: new Date().getTime(),
      updatedAt: new Date().getTime()
    }
    await this.storage.db.collection('token').insertOne(doc)

    // send email
    try {
      this.mail.send({
        from: `"Paras Team" <hello@paras.id>`,
        to: email,
        subject: `[Paras] Email Verification`,
        text: `Your verification code is ${verifyPin} and available for 15 minutes`
      })
    } catch (err) {
      console.log(err)
    }

    return true
  }

  async verifyRegister({ email, pin }) {
    const authExist = await this.storage.db.collection('token').findOne({
      token: `${email}_${pin}`
    })
    if (!authExist) {
      throw new Error('Invalid PIN/Email')
    }
    const currentTime = new Date().getTime()
    if (currentTime > authExist.expiredAt) {
      throw new Error('Expired PIN')
    }

    const { seedPhrase, secretKey, publicKey } = nearSeedPhrase.generateSeedPhrase()
    console.log(seedPhrase, secretKey)

    try {
      await this.near.createAccount({
        userId: authExist.userId,
        secretKey: secretKey
      })

      await this.storage.db.collection('credential').insertOne({
        userId: authExist.userId,
        publicKey: publicKey,
        email: email,
        createdAt: new Date().getTime(),
        updatedAt: new Date().getTime()
      })

      const token = await this.login({
        userId: authExist.userId,
        seed: seedPhrase
      })

      // create account on smart contract
      const avatar = DEFAULT_AVATAR[Math.floor(Math.random() * DEFAULT_AVATAR.length)]

      const loadedAccount = this.near.accountsMap.get(authExist.userId)
      const profile = await loadedAccount.contract.createUser({
        imgAvatar: avatar,
        bio: ''
      })

      // create personal memento for account
      const mementoImg = DEFAULT_MEMENTO_IMG[0]
      const newMementoData = {
        name: 'timeline',
        category: 'info',
        img: mementoImg,
        desc: 'My Timeline',
        type: 'personal'
      }
      await loadedAccount.contract.createMemento(newMementoData)

      this.mail.send({
        from: `"Paras Team" <hello@paras.id>`,
        to: email,
        subject: `[Paras] Seed Password Recovery`,
        text: `Your seed password is ${seedPhrase}`
      })

      return {
        seedPassword: seedPhrase,
        token: token,
        profile: profile
      }
    } catch (err) {
      console.log(err)
      throw new Error(err)
    }
  }

  async login({ userId, seed }) {
    try {
      const { secretKey, publicKey } = nearSeedPhrase.parseSeedPhrase(seed)

      const response = await axios.post(`https://rpc.testnet.near.org`, {
        jsonrpc: '2.0',
        id: 'dontcare',
        method: 'query',
        params: {
          request_type: 'view_access_key',
          finality: 'final',
          account_id: userId,
          public_key: publicKey
        }
      })
      if (response.data.result && response.data.result.error) {
        throw new Error('Invalid username/seed')
      }

      const token = this.cryptr.encrypt(JSON.stringify({
        userId: userId,
        secretKey: secretKey
      }))

      return token
    } catch (err) {
      console.log(err)
      throw err
    }

  }

  async verifyToken({ token }) {
    try {
      const decrypt = this.cryptr.decrypt(token)

      return JSON.parse(decrypt)
    } catch (err) {
      throw new Error('Invalid token')
    }
  }
}

module.exports = Auth