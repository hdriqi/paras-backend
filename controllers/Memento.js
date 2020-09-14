const { DEFAULT_MEMENTO_IMG } = require('../utils/constants')
const JSBI = require('jsbi')

class Memento {
  constructor(storage, near, ctl) {
    this.storage = storage
    this.near = near
    this.ctl = ctl
  }

  async get(query) {
    const walletCtl = this.ctl().wallet
    try {
      const mementoList = await this.storage.get('memento', query, [{
        col: 'user',
        key: 'owner',
        targetCol: 'user',
        targetKey: 'id'
      }])

      const mementoWithStakeList = await Promise.all(mementoList.map(m => {
        return new Promise(async (resolve, reject) => {
          try {
            m.stakeList = await walletCtl.getStake({
              mementoId: m.id
            })
            resolve(m)
          } catch (err) {
            reject(err)
          }
        })
      }))

      return mementoWithStakeList
    } catch (err) {
      console.log(err)
      throw err
    }
  }

  async create(userId, payload) {
    try {
      if (!(payload.type === 'public' || payload.type === 'personal')) {
        throw new Error('Memento type must be public or personal')
      }
      const tail = payload.type == 'personal' ? userId.split('.')[0] : payload.category
      const mementoId = payload.name.concat('.').concat(tail)
      const exist = await this.get({
        id: mementoId
      })

      if (exist.length > 0) {
        throw new Error('Memento id already taken')
      }
      const mementoImg = DEFAULT_MEMENTO_IMG[0]
      const newMementoData = {
        id: mementoId,
        name: payload.name,
        category: payload.category,
        img: mementoImg,
        desc: '',
        type: payload.type,
        owner: userId,
        isArchive: false,
        createdAt: new Date().getTime(),
      }
      const user = await this.storage.db.collection('user').findOne({
        id: userId
      })
      await this.storage.db.collection('memento').insertOne(newMementoData)
      await this.ctl().feed.follow(userId, mementoId, 'memento')

      await this.ctl().activityPoint.add(userId, {
        action: 'createMemento'
      })

      newMementoData.user = user
      return newMementoData
    } catch (err) {
      console.log(err)
      throw err
    }
  }

  async update(userId, payload) {
    const exist = await this.get({
      id: payload.mementoId
    })

    if (exist.length === 0) {
      throw new Error('Memento not exist')
    }

    if (exist[0].owner !== userId) {
      throw new Error('Memento can only be updated by owner')
    }

    const { value: updatedMementoData } = await this.storage.db.collection('memento').findOneAndUpdate({
      id: payload.mementoId,
      owner: userId
    }, {
      $set: {
        img: payload.img,
        desc: payload.desc,
        updatedAt: new Date().getTime()
      }
    }, {
      returnOriginal: false
    })

    const user = await this.storage.db.collection('user').findOne({
      id: userId
    })
    updatedMementoData.user = user
    return updatedMementoData
  }

  async delete(userId, payload) {
    const exist = await this.get({
      id: payload.mementoId
    })

    if (exist.length === 0) {
      throw new Error('Memento not exist')
    }

    if (exist[0].owner !== userId) {
      throw new Error('Memento can only be deleted by owner')
    }

    await this.storage.db.collection('memento').deleteOne({
      id: payload.mementoId
    })

    await this.storage.db.collection('post').deleteMany({
      mementoId: payload.mementoId
    })

    return exist[0]
  }

  async archieve(userId, payload) {
    const exist = await this.get({
      id: payload.mementoId
    })

    if (exist.length === 0) {
      throw new Error('Memento not exist')
    }

    if (exist[0].owner !== userId) {
      throw new Error('Memento can only be archived by owner')
    }

    const { value: updatedMementoData } = await this.storage.db.collection('memento').findOneAndUpdate({
      id: payload.mementoId,
      owner: userId
    }, {
      $set: {
        isArchive: true,
        updatedAt: new Date().getTime()
      }
    }, {
      returnOriginal: false
    })

    const user = await this.storage.db.collection('user').findOne({
      id: userId
    })
    updatedMementoData.user = user
    return updatedMementoData
  }

  async unarchieve(userId, payload) {
    const exist = await this.get({
      id: payload.mementoId
    })

    if (exist.length === 0) {
      throw new Error('Memento not exist')
    }

    if (exist[0].owner !== userId) {
      throw new Error('Memento can only be unarchived by owner')
    }

    const { value: updatedMementoData } = await this.storage.db.collection('memento').findOneAndUpdate({
      id: payload.mementoId,
      owner: userId
    }, {
      $set: {
        isArchive: false,
        updatedAt: new Date().getTime()
      }
    }, {
      returnOriginal: false
    })

    const user = await this.storage.db.collection('user').findOne({
      id: userId
    })
    updatedMementoData.user = user
    return updatedMementoData
  }

  async deposit(userId, payload) {
    const userBalance = await this.ctl().wallet.get(userId)
    const fromBalance = JSBI.BigInt(userBalance)
    const tokens = JSBI.BigInt(payload.value)
    const fee = JSBI.divide(JSBI.multiply(JSBI.BigInt('10'), JSBI.BigInt(payload.value)), JSBI.BigInt('100'))

    if (!JSBI.greaterThanOrEqual(fromBalance, JSBI.add(tokens, fee))) {
      throw new Error('Not enough tokens on account')
    }

    const memento = await this.get({
      id: payload.mementoId
    })

    const lockedMementoId = `paras::locked::${payload.mementoId}`
    await this.ctl().wallet.internalTransfer(userId, lockedMementoId, payload.value, `DepositMemento::${payload.value}`)
    await this.ctl().wallet.distributeIncome(userId, memento[0], fee.toString(), `DepositMemento::DividendMemento::${payload.mementoId}`)

    const userStakeExist = await this.storage.db.collection('stake').findOne({
      mementoId: payload.mementoId,
      userId: userId
    })
    const newTotalStake = userStakeExist ? JSBI.add(JSBI.BigInt(userStakeExist.value), JSBI.BigInt(payload.value)).toString() : payload.value

    const { value: updatedUserStake } = await this.storage.db.collection('stake').findOneAndUpdate({
      mementoId: payload.mementoId,
      userId: userId
    }, {
      $set: {
        value: newTotalStake
      }
    }, {
      returnOriginal: false,
      upsert: true
    })

    await this.ctl().activityPoint.add(userId, {
      action: 'depositMemento'
    })

    return updatedUserStake
  }

  async withdraw(userId, payload) {
    const lockedMementoId = `paras::locked::${payload.mementoId}`
    
    const userStakeExist = await this.storage.db.collection('stake').findOne({
      mementoId: payload.mementoId,
      userId: userId
    })
    if (JSBI.lessThan(JSBI.BigInt(userStakeExist.value), JSBI.BigInt(payload.value))) {
      throw new Error('Not enough tokens on stake')
    }
    await this.ctl().wallet.internalTransfer(lockedMementoId, userId, payload.value, `WithdrawMemento::${payload.value}`)
    
    const newTotalStake = userStakeExist ? JSBI.subtract(JSBI.BigInt(userStakeExist.value), JSBI.BigInt(payload.value)).toString() : '0'
    
    const { value: updatedUserStake } = await this.storage.db.collection('stake').findOneAndUpdate({
      mementoId: payload.mementoId,
      userId: userId
    }, {
      $set: {
        value: newTotalStake
      }
    }, {
      returnOriginal: false,
      upsert: true
    })

    return updatedUserStake
  }
}

module.exports = Memento