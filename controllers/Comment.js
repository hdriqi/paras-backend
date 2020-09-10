const shortid = require('shortid')

class Comment {
  constructor(storage, near, ctl) {
    this.storage = storage
    this.near = near
    this.ctl = ctl
  }

  async get(query) {
    try {
      const commentList = await this.storage.get('comment', query, [{
        col: 'user',
        key: 'owner',
        targetCol: 'user',
        targetKey: 'id'
      }])

      return commentList
    } catch (err) {
      console.log(err)
      throw err
    }
  }

  async create(userId, postId, body) {
    const id = shortid.generate()
    const newCommentData = {
      id: id,
      postId: postId,
      body: body,
      owner: userId,
      createdAt: new Date().getTime()
    }
    const newData = await this.storage.db.collection('comment').insertOne(newCommentData)
    const newComment = newData.ops[0]

    await this.ctl().activityPoint.add(userId, {
      action: 'createComment'
    })

    
    const user = await this.storage.db.collection('user').findOne({
      id: userId
    })
    newComment.user = user
    await this.ctl().notification.processEvent('createComment', newComment)

    return newComment
  }

  async delete(userId, commentId) {
    const comment = await this.storage.db.collection('comment').findOne({
      id: commentId
    })
    if (!comment) {
      throw new Error('Comment not exist')
    }

    const post = await this.storage.db.collection('post').findOne({
      id: comment.postId
    })
    if ((comment.owner !== userId) || (post && post.owner !== userId)) {
      throw new Error('Comment can only be deleted by comment owner or post owner')
    }
    await this.storage.db.collection('comment').deleteOne({
      id: commentId
    })

    await this.ctl().activityPoint.slash(userId, {
      action: 'deleteComment'
    })

    return comment
  }
}

module.exports = Comment