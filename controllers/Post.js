const shortid = require('shortid')

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
      const memento = await this.storage.db.collection('memento').findOne({
        id: payload.mementoId
      })

      if (!memento) {
        throw new Error('Memento not exist')
      }
      if (memento.isArchive) {
        throw new Error('Cannot write to archived Memento')
      }
      if (!(memento.type == 'public' || memento.type == 'personal' && memento.owner == userId)) {
        throw new Error('Sender does not have access to write to this memento')
      }

      const id = shortid.generate()
      const newPostData = {
        id: id,
        originalId: id,
        contentList: payload.contentList,
        mementoId: payload.mementoId,
        owner: userId,
        createdAt: new Date().getTime(),
      }
      const newData = await this.storage.db.collection('post').insertOne(newPostData)
      const newPost = newData.ops[0]

      const user = await this.storage.db.collection('user').findOne({
        id: userId
      })
      newPost.user = user
      newPost.memento = memento

      return newPost
    } catch (err) {
      console.log(err)
      throw err
    }
  }

  async update(userId, payload) {
    const memento = await this.storage.db.collection('memento').findOne({
      id: payload.mementoId
    })
    const post = await this.storage.db.collection('post').findOne({
      id: payload.postId
    })

    if (!memento) {
      throw new Error('Memento not exist')
    }
    if (memento.isArchive) {
      throw new Error('Cannot write to archived Memento')
    }
    if (!(memento.type == 'public' || memento.type == 'personal' && memento.owner == userId)) {
      throw new Error('Sender does not have access to write to this memento')
    }
    if (!post) {
      throw new Error('Post not exist')
    }
    if (post.owner !== userId) {
      throw new Error('Post can only be updated by owner')
    }
    const newPostData = {
      contentList: payload.contentList,
      mementoId: payload.mementoId,
      updatedAt: new Date().getTime(),
    }
    const { value: updatedPostData } = await this.storage.db.collection('post').findOneAndUpdate({
      id: payload.postId
    }, {
      $set: newPostData
    }, {
      returnOriginal: false
    })

    const user = await this.storage.db.collection('user').findOne({
      id: userId
    })
    updatedPostData.user = user
    updatedPostData.memento = memento

    return updatedPostData
  }

  async delete(userId, payload) {
    const post = await this.storage.db.collection('post').findOne({
      id: payload.postId
    })

    if (!post) {
      throw new Error('Post not exist')
    }
    if (post.owner !== userId) {
      throw new Error('Post can only be deleted by owner')
    }
    await this.storage.db.collection('post').deleteOne({
      id: payload.postId
    })

    return post
  }

  async redact(userId, payload) {
    const post = await this.storage.db.collection('post').findOne({
      id: payload.postId
    })
    if (!post) {
      throw new Error('Post not exist')
    }
    if (post.owner !== userId) {
      throw new Error('Post can only be updated by owner')
    }

    const memento = await this.storage.db.collection('memento').findOne({
      id: post.mementoId
    })

    if (!memento) {
      throw new Error('Memento not exist')
    }
    if (memento.isArchive) {
      throw new Error('Cannot write to archived Memento')
    }
    if (memento.owner !== userId) {
      throw new Error('Post can only be redacted by memento owner')
    }
    const { value: updatedPostData } = await this.storage.db.collection('post').findOneAndUpdate({
      id: payload.postId
    }, {
      $set: {
        mementoId: null
      }
    }, {
      returnOriginal: false
    })

    const user = await this.storage.db.collection('user').findOne({
      id: userId
    })
    updatedPostData.user = user
    updatedPostData.memento = null

    return updatedPostData
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