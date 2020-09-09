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

  async piece(userId, postId, value) {
    const self = this
    const postCtl = this.ctl().post
    const postList = await postCtl.get({
      id: postId
    })
    const post = postList[0]
    if (post) {
      const tokensForPostOwner = this._percent(value, '70', '100')
      await self.transfer(userId, post.owner, tokensForPostOwner.toString(), `Piece`)
    }
    if (post && post.mementoId) {
      const tokensForMemento = this._percent(value, '30', '100')
      const stakeList = await this.getStake({
        mementoId: post.mementoId
      })
      if (stakeList.length > 0) {
        const tokensForMementoOwner = this._percent(tokensForMemento, '60', '100')
        await self.transfer(userId, post.memento.owner, tokensForMementoOwner.toString(), `Piece::DividendMemento::${post.mementoId}`)
        const tokensForMementoStake = JSBI.subtract(tokensForMemento, tokensForMementoOwner)
        const totalStake = await this.get(`paras::locked::${post.mementoId}`)
        await Promise.all(stakeList.map(stake => {
          return new Promise(async (resolve, reject) => {
            const stakePercentage = JSBI.divide(JSBI.multiply(JSBI.BigInt(stake.value), JSBI.BigInt('100')), JSBI.BigInt(totalStake))
            const tokensReceive = self._percent(tokensForMementoStake, stakePercentage, '100')
            await self.transfer(userId, stake.userId, tokensReceive.toString(), `Piece::DividendMemento::${post.mementoId}`)
            resolve()
          })
        }))
      }
      else {
        await self.transfer(userId, post.memento.owner, tokensForMemento.toString(), `Piece::DividendMemento::${post.mementoId}`)
      }
    }
    return 0
  }

  async transfer(userId, receiverId, value, msg = '') {
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
      msg: msg.replace(/::/g, ''),
      createdAt: new Date().getTime()
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

module.exports = Wallet