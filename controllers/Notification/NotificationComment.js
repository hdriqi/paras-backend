class NotificationComment {
  constructor(storage) {
    this.storage = storage
  }

  async create(data, send) {
    if (data.postId) {
      // console.log('add notification')
      const post = await this.storage.db.collection('post').findOne({
        id: data.postId
      })
      const payload = {
        screen: 'comment',
        id: data.postId
      }
      const newNotification = {
        payload: payload,
        message: `${data.owner} commented on your post`,
        userId: post.owner,
        createdAt: new Date().getTime().toString()
      }
      await this.storage.db.collection('notification').insertOne(newNotification)
      send(post.owner, payload, {
        title: 'Paras',
        icon: 'ic_launcher',
        body: `${data.owner} commented on your post`
      })

      const splitRegex = /(@\[@.+?\]\(.+?\))/
      const captureRegex = /@\[@(.+)?\]\(.+?\)/
      const trim = data.body.toString().replace(/(\r\n|\r|\n){2,}/g, '$1\n')
      const bodyBlocks = trim.split(splitRegex)
      // do not send notification if mentioned user is:
      // post owner
      // already mentioned
      const mentionedUsers = bodyBlocks.map(block => {
        const match = block.match(captureRegex)
        if (match) {
          return match[1]
        }
        return null
      }).filter(userId => {
        if (userId === post.owner) {
          return null
        }
        return userId
      })
      const distinctUsers = [...new Set(mentionedUsers)]
      // create new notification
      for await (const user of distinctUsers) {
        const payload = {
          screen: 'comment',
          id: data.postId
        }
        const newNotification = {
          payload: payload,
          message: `${data.owner} mentioned you in a comment`,
          userId: user,
          createdAt: new Date().getTime().toString()
        }
        await this.storage.db.collection('notification').insertOne(newNotification)
        send(user, payload, {
          title: 'Paras',
          icon: 'ic_launcher',
          body: `${data.owner} mentioned you in a comment`
        })
      }
    }
  }
}

module.exports = NotificationComment