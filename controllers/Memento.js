const { DEFAULT_MEMENTO_IMG } = require('../utils/constants')

class Memento {
  constructor(storage, near, ctl) {
    this.storage = storage
    this.near = near
    this.ctl = ctl
  }

  async get(query) {
    try {
      const mementoList = await this.storage.get('memento', query, [{
        col: 'user',
        key: 'owner',
        targetCol: 'user',
        targetKey: 'id'
      }])

      return mementoList
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
      throw new Error('Memento can only be updated by owner')
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
      throw new Error('Memento can only be updated by owner')
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

}

module.exports = Memento