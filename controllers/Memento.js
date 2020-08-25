const { DEFAULT_MEMENTO_IMG } = require('../utils/constants')

class Memento {
  constructor(storage, near) {
    this.storage = storage
    this.near = near
  }

  async create(userId, payload) {
    try {
      const mementoImg = DEFAULT_MEMENTO_IMG[0]
      const newMementoData = {
        name: payload.name,
        category: payload.category,
        img: mementoImg,
        desc: '',
        type: payload.type
      }
      const loadedAccount = this.near.accountsMap.get(userId)
      const newMemento = await loadedAccount.contract.createMemento(newMementoData)
      return newMemento
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