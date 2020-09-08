const { DEFAULT_MEMENTO_IMG } = require('../utils/constants')

class Memento {
  constructor(storage, near) {
    this.storage = storage
    this.near = near
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
      
      newMementoData.user = user
      return newMementoData
    } catch (err) {
      console.log(err)
      throw err
    }
  }

  async update(userId, payload) {
    const newMementoData = {
      id: payload.mementoId,
      img: payload.img,
      desc: payload.desc
    }
    const loadedAccount = this.near.accountsMap.get(userId)
    const updatedMementoData = await loadedAccount.contract.updateMemento(newMementoData)
    return updatedMementoData
  }

  async delete(userId, payload) {
    const loadedAccount = this.near.accountsMap.get(userId)
    const deletedMemento = await loadedAccount.contract.deleteMemento({
      id: payload.mementoId
    })
    return deletedMemento
  }

  async archieve(userId, payload) {
    const loadedAccount = this.near.accountsMap.get(userId)
    const memento = await loadedAccount.contract.archiveMemento({
      id: payload.mementoId
    })
    return memento
  }

  async unarchieve(userId, payload) {
    const loadedAccount = this.near.accountsMap.get(userId)
    const memento = await loadedAccount.contract.unarchiveMemento({
      id: payload.mementoId
    })
    return memento
  }

}

module.exports = Memento