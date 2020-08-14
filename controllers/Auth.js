const nearSeedPhrase = require('near-seed-phrase')
const Cryptr = require('cryptr')

class Auth {
  constructor(state, storage, mail, near) {
    this.state = state
    this.storage = storage
    this.mail = mail
    this.near = near
    this.cryptr = new Cryptr(process.env.TOKEN_SECRET)
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
      throw new Error('PIN invalid')
    }
    const currentTime = new Date().getTime()
    if (currentTime > authExist.expiredAt) {
      throw new Error('PIN already expired')
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

      this.mail.send({
        from: `"Paras Team" <hello@paras.id>`,
        to: email,
        subject: `[Paras] Seed Password Recovery`,
        text: `Your seed password is ${seedPhrase}`
      })

      const token = await this.login({
        userId: authExist.userId,
        seed: seedPhrase
      })

      return {
        seedPassword: seedPhrase,
        token: token
      }
    } catch (err) {
      console.log(err)
      return err
    }
  }

  async login({ userId, seed }) {
    const { secretKey, publicKey } = nearSeedPhrase.parseSeedPhrase(seed)

    const accExist = await this.storage.db.collection('credential').findOne({
      userId: userId,
      publicKey: publicKey,
    })

    if (!accExist) {
      throw new Error('Invalid username/seed')
    }
    await this.near.loadAccount({
      userId,
      secretKey
    })
    const token = this.cryptr.encrypt(secretKey)

    return token
  }

  async verifyToken({ token }) {
    try {
      this.cryptr.decrypt(token)
      return true
    } catch (err) {
      throw new Error('Invalid token')
    }
  }
}

module.exports = Auth