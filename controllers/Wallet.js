const JSBI = require('jsbi')
const shortid = require('shortid')
const { groupBy, logBase } = require('../utils/common')

class Wallet {
  constructor(storage, near, ctl) {
    this.storage = storage
    this.near = near
    this.ctl = ctl
  }

  async mint(receiverId, value) {
    const totalSupply = await this.totalSupply()
    const biValue = JSBI.BigInt(value)
    const biTotalSupply = JSBI.BigInt(totalSupply)
    const newTotalSupply = JSBI.add(biValue, biTotalSupply)
    await this.storage.db.collection('kv').findOneAndUpdate({
      key: 'totalSupply'
    }, {
      $set: {
        value: newTotalSupply.toString()
      }
    }, {
      upsert: true
    })
    const balance = await this.get(receiverId)
    const biBalance = JSBI.BigInt(balance)

    await this.storage.db.collection('balance').findOneAndUpdate({
      owner: receiverId
    }, {
      $set: {
        value: JSBI.add(biBalance, biValue).toString()
      }
    }, {
      upsert: true
    })

    return newTotalSupply.toString()
  }

  async totalSupply() {
    const totalSupply = await this.storage.db.collection('kv').findOne({
      key: 'totalSupply'
    })
    if (!totalSupply) {
      return '0'
    }
    return totalSupply.value
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
    if (postList.length === 0) {
      throw new Error('Post not exist')
    }

    const post = postList[0]
    // get transfer with certain message
    const supporterList = await this.ctl().transaction.get({
      msg: `System::Piece::${postId}`
    })
    const tokens = JSBI.BigInt(value)
    let tokensForPostOwner = supporterList.length > 0 ? this._percent(value, '80', '100') : tokens
    const tokensForSupporter = JSBI.subtract(tokens, tokensForPostOwner)
    if (JSBI.greaterThan(tokensForSupporter, JSBI.BigInt('0'))) {
      const distributeTokens = tokensForSupporter
      const groupBySupporterId = groupBy(supporterList, 'from')
      let totalPiece = JSBI.BigInt('0')
      const supporterIds = Object.keys(groupBySupporterId).map(userId => {
        const totalUserPiece = groupBySupporterId[userId].reduce((a, b) => {
          return JSBI.add(JSBI.BigInt(a), JSBI.BigInt(b.value))
        }, 0)
        totalPiece = JSBI.add(totalPiece, totalUserPiece)
        return {
          userId: userId,
          totalPiece: totalUserPiece
        }
      })
      let remainder = distributeTokens
      await Promise.all(supporterIds.map((sup) => {
        return new Promise(async (resolve, reject) => {
          const tokens = JSBI.divide(JSBI.multiply(sup.totalPiece, distributeTokens), totalPiece)
          console.log(`${sup.userId} ${sup.totalPiece.toString()} -> ${tokens.toString()}`)
          remainder = JSBI.subtract(remainder, tokens)
          await self.internalTransfer(userId, sup.userId, tokens.toString(), `System::PieceSupporter::${postId}`)
          resolve()
        })
      }))
      if (JSBI.greaterThan(remainder, JSBI.BigInt('0'))) {
        tokensForPostOwner = JSBI.add(tokensForPostOwner, remainder)
      }
    }
    await self.internalTransfer(userId, post.owner, tokensForPostOwner.toString(), `System::Piece::${postId}`)
    console.log(`${post.owner} -> ${tokensForPostOwner.toString()}`)

    const postScore = await this.storage.db.collection('postScore').findOne({
      postId: post.id
    })
    const newTotalPieceScore = postScore ? JSBI.add(JSBI.BigInt(postScore.totalPiece), JSBI.BigInt(value)) : JSBI.BigInt(value)

    // calculate new score
    supporterList.push({
      from: userId
    })
    const nOfPiece = supporterList.length > 0 ? Object.keys(groupBy(supporterList, 'from')).length : 1
    const x = 144000 * logBase(newTotalPieceScore.toString() / (10 ** 18), 5) * logBase(nOfPiece, 10)
    const threshold = JSBI.BigInt((Math.round(x)))
    if (JSBI.greaterThan(threshold, JSBI.BigInt('0'))) {
      const a = JSBI.multiply(threshold, JSBI.BigInt(1))
      const b = JSBI.BigInt(post.createdAt)
      const newScore = JSBI.add(a, b)
      console.log(a.toString())
      await this.storage.db.collection('postScore').findOneAndUpdate({
        postId: post.id,
      }, {
        $set: {
          totalPiece: newTotalPieceScore.toString(),
          score: newScore.toString()
        }
      }, {
        upsert: true
      })
    }

    return true
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
    const newData = await this.storage.db.collection('transaction').insertOne({
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
    const newTx = newData.ops[0]

    const latestBalance = this.get(userId)
    // notify users
    this.ctl().notification.processEvent('transferWallet', newTx)
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