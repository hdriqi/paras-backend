const JSBI = require('jsbi')
const shortid = require('shortid')

class Wallet {
  constructor(storage, near, ctl) {
    this.storage = storage
    this.near = near
    this.ctl = ctl
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

  async getStake(query) {
    try {
      const stakeList = await this.storage.get('stake', query)

      return stakeList
    } catch (err) {
      console.log(err)
      throw err
    }
  }

  _percent(value, a, b) {
    return JSBI.divide(JSBI.multiply(JSBI.BigInt(a.toString()), JSBI.BigInt(value.toString())), JSBI.BigInt(b.toString()))
  }

  async distributeIncome(userId, memento, value, msg) {
    const self = this
    const stakeList = await this.getStake({
      mementoId: memento.id
    })
    const tokensForMemento = JSBI.BigInt(value)
    if (stakeList.length > 0) {
      const tokensForMementoOwner = this._percent(tokensForMemento, '60', '100')
      await this.internalTransfer(userId, memento.owner, tokensForMementoOwner.toString(), msg)
      const tokensForMementoStake = JSBI.subtract(tokensForMemento, tokensForMementoOwner)
      const totalStake = await this.get(`paras::locked::${memento.id}`)
      await Promise.all(stakeList.map(stake => {
        return new Promise(async (resolve, reject) => {
          const stakePercentage = JSBI.divide(JSBI.multiply(JSBI.BigInt(stake.value), JSBI.BigInt('100')), JSBI.BigInt(totalStake))
          const tokensReceive = self._percent(tokensForMementoStake, stakePercentage, '100')
          await self.internalTransfer(userId, stake.userId, tokensReceive.toString(), msg)
          resolve()
        })
      }))
    }
    else {
      await this.internalTransfer(userId, memento.owner, tokensForMemento.toString(), msg)
    }
    return true
  }

  async piece(userId, postId, value) {
    const self = this
    const postCtl = this.ctl().post
    const postList = await postCtl.get({
      id: postId
    })
    const post = postList[0]
    console.log(post)

    if (post && !post.mementoId) {
      const tokensForPostOwner = this._percent(value, '100', '100')
      await self.transfer(userId, post.owner, tokensForPostOwner.toString(), `Piece`)
    }
    if (post && post.mementoId) {
      const tokensForPostOwner = this._percent(value, '80', '100')
      await self.transfer(userId, post.owner, tokensForPostOwner.toString(), `Piece`)
      const tokensForMemento = this._percent(value, '20', '100')
      await this.distributeIncome(userId, post.memento, tokensForMemento, `Piece::DividendMemento::${post.mementoId}`)
    }
    return 0
  }

  async internalTransfer(userId, receiverId, value, msg = '') {
    const fromBalance = JSBI.BigInt(await this.get(userId))
    const toBalance = JSBI.BigInt(await this.get(receiverId))
    const tokens = JSBI.BigInt(value)

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
      msg: msg,
      createdAt: new Date().getTime()
    })

    if (userId !== receiverId) {
      await this.ctl().activityPoint.add(userId, {
        action: 'transfer'
      })
    }

    const latestBalance = this.get(userId)
    return latestBalance
  }

  async transfer(userId, receiverId, value, msg = '') {
    const cleanMsg = msg.replace(/::/g, '')
    const latestBalance = await this.internalTransfer(userId, receiverId, value, cleanMsg)
    return latestBalance
  }

  async transferNear(userId, receiverId, value) {
    const loadedAccount = this.near.accountsMap.get(userId)
    await loadedAccount.contract.account.sendMoney(receiverId, value)
    return true
  }
}

module.exports = Wallet