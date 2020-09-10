class NotificationPost {
  constructor(storage) {
    this.storage = storage
  }

  // id: string
  // originalId: string
  // contentList: Content[]
  // owner: string
  // mementoId: string
  // createdAt: u64
  // user: User | null
  // memento: Memento | null

  async create(data, send) {
    // if post.memento.owner && post.owner !== post.memento.owner
    if (data.mementoId) {

      const memento = data.memento || await this.storage.db.collection('memento').findOne({
        id: data.mementoId
      })
      if (memento && memento.owner !== data.owner) {
        const payload = {
          screen: 'post',
          id: data.id
        }
        const newNotification = {
          payload: payload,
          message: `${data.owner} create new post in ${memento.id}`,
          userId: memento.owner,
          createdAt: new Date().getTime()
        }
        await this.storage.db.collection('notification').insertOne(newNotification)
        console.log(`send notification to ${memento.owner} with message ${newNotification.message}`)
        try {
          send(memento.owner, payload, {
            title: 'Paras',
            icon: 'ic_launcher',
            body: newNotification.message
          })
        } catch (err) {
          console.log(err)
        }
      }
    }

    // check if the post is transmitted (if id !== originalId)
    if (data.id !== data.originalId) {
      // notify original owner if (new post.owner !== originalId.owner) 
      const originalPost = await this.storage.db.collection('post').findOne({
        id: data.originalId
      })
      if (originalPost && originalPost.owner !== data.owner) {
        const payload = {
          screen: 'post',
          id: data.id
        }
        const newNotification = {
          payload: payload,
          message: `${data.owner} transmitted your post`,
          userId: originalPost.owner,
          createdAt: new Date().getTime()
        }
        await this.storage.db.collection('notification').insertOne(newNotification)
        console.log(`send notification to ${originalPost.owner} with message ${newNotification.message}`)
        try {
          send(originalPost.owner, payload, {
            title: 'Paras',
            icon: 'ic_launcher',
            body: newNotification.message
          })
        } catch (err) {
          console.log(err)
        }
      }
    }

    // check users mention on contentList body
    const mentionedUsers = []
    const textContentList = data.contentList.filter(content => content.type === 'text')
    textContentList.forEach(content => {
      const splitRegex = /(@\[@.+?\]\(.+?\))/
      const captureRegex = /@\[@(.+)?\]\(.+?\)/
      const trim = content.body.toString().replace(/(\r\n|\r|\n){2,}/g, '$1\n')
      const bodyBlocks = trim.split(splitRegex)
      const currentMentionedUsers = bodyBlocks.map(block => {
        const match = block.match(captureRegex)
        if (match) {
          return match[1]
        }
        return null
      }).filter(userId => {
        if (userId === data.owner) {
          return null
        }
        return userId
      })
      mentionedUsers.push(...currentMentionedUsers)
    })
    const distinctUsers = [...new Set(mentionedUsers)]
    // create new notification
    for await (const user of distinctUsers) {
      const payload = {
        screen: 'post',
        id: data.postId
      }
      const newNotification = {
        payload: payload,
        message: `${data.owner} mentioned you in a post`,
        userId: user,
        createdAt: new Date().getTime()
      }
      await this.storage.db.collection('notification').insertOne(newNotification)
      send(user, payload, {
        title: 'Paras',
        icon: 'ic_launcher',
        body: `${data.owner} mentioned you in a post`
      })
    }
  }


  /**
   * @param {Object} param - post data.
   * @param {string} param.mementoId - post mementoId.
   * @param {string} param.owner - post owner.
   */
  async redact(data, send) {
    const memento = await this.storage.db.collection('memento').findOne({
      id: data.mementoId
    })
    if (memento && memento.owner !== data.owner) {
      const payload = {
        screen: 'post',
        id: data.postId
      }
      const newNotification = {
        payload: payload,
        message: `Your post has been redacted from ${data.mementoId}`,
        userId: data.owner,
        createdAt: new Date().getTime()
      }
      await this.storage.db.collection('notification').insertOne(newNotification)
      console.log(`send notification to ${data.owner} with message ${newNotification.message}`)
      try {
        send(data.owner, payload, {
          title: 'Paras',
          icon: 'ic_launcher',
          body: newNotification.message
        })
      } catch (err) {
        console.log(err)
      }
    }
  }
}

module.exports = NotificationPost