const JSBI = require('jsbi')
const shortid = require('shortid')

class Balance {
  constructor(storage, near) {
    this.storage = storage
    this.near = near
  }

  async get(userId) {
    try {
      const balance = await this.storage.db.collection('balance').findOne({
        owner: userId
      })
      if (!balance) {
        return '0'
      }
      return balance.value
    } catch (err) {
      console.log(err)
      throw err
    }
  }

  async piece(userId, postId, value) {
    const loadedAccount = this.near.accountsMap.get(userId)
    const latestBalance = await loadedAccount.contract.piecePost({
      postId: postId,
      value: value
    })
    return latestBalance
  }

  async transfer(userId, receiverId, value, msg = '') {
    const fromBalance = JSBI.BigInt(await this.get(userId))
    const toBalance = JSBI.BigInt(await this.get(receiverId))
    const tokens = JSBI.BigInt(value)
    console.log(fromBalance.toString())
    if (!JSBI.greaterThanOrEqual(fromBalance, tokens)) {
      throw new Error('Not enough tokens on account')
    }

    await this.storage.db.collection('balance').findOneAndUpdate({
      owner: userId
    }, {
      $set: {
        value: JSBI.subtract(fromBalance, tokens).toString()
      }
    }, {
      upsert: true
    })
    await this.storage.db.collection('balance').findOneAndUpdate({
      owner: receiverId
    }, {
      $set: {
        value: JSBI.add(toBalance, tokens).toString()
      }
    }, {
      upsert: true
    })
    await this.storage.db.collection('transaction').insertOne({
      id: shortid.generate(),
      from: userId,
      to: receiverId,
      value: value,
      msg: msg
    })
    const latestBalance = this.get(userId)
    return latestBalance
  }

  async transferNear(userId, receiverId, value) {
    const loadedAccount = this.near.accountsMap.get(userId)
    await loadedAccount.contract.account.sendMoney(receiverId, value)
    return true
  }
}

module.exports = Balance