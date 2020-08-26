class Post {
  constructor(storage, near) {
    this.storage = storage
    this.near = near
  }

  async get(query) {
    try {
      const postList = await this.storage.get('post', query, [{
        col: 'memento',
        key: 'mementoId',
        targetCol: 'memento',
        targetKey: 'id'
      }, {
        col: 'user',
        key: 'owner',
        targetCol: 'user',
        targetKey: 'id'
      }])

      return postList
    } catch (err) {
      console.log(err)
      throw err
    }
  }

  async create(userId, payload) {
    try {
      const newPostData = {
        contentList: payload.contentList,
        mementoId: payload.mementoId,
      }
      const loadedAccount = this.near.accountsMap.get(userId)
      const newPost = await loadedAccount.contract.createPost(newPostData)
      return newPost
    } catch (err) {
      console.log(err)
      throw err
    }
  }

  async update(userId, payload) {
    const newPostData = {
      id: payload.postId,
      contentList: payload.contentList,
      mementoId: payload.mementoId
    }
    const loadedAccount = this.near.accountsMap.get(userId)
    const updatedPostData = await loadedAccount.contract.updatePost(newPostData)
    return updatedPostData
  }

  async delete(userId, payload) {
    const loadedAccount = this.near.accountsMap.get(userId)
    const deletedMemento = await loadedAccount.contract.deletePost({
      id: payload.postId
    })
    return deletedMemento
  }

  async redact(userId, payload) {
    const loadedAccount = this.near.accountsMap.get(userId)
    const post = await loadedAccount.contract.redactPost({
      id: payload.postId
    })
    return post
  }

  async transmit(userId, payload) {
    const loadedAccount = this.near.accountsMap.get(userId)
    const post = await loadedAccount.contract.transmitPost({
      id: payload.postId,
      mementoId: payload.mementoId
    })
    return post
  }
}

module.exports = Post