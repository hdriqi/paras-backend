const gcm = require('node-gcm')
const NotificationComment = require('./NotificationComment')
const NotificationPost = require('./NotificationPost')

class Notification {
  constructor(storage) {
    this.storage = storage
    this.sender = new gcm.Sender(process.env.GCM_SENDER_KEY)
    this.notifyComment = new NotificationComment(storage)
    this.notifyPost = new NotificationPost(storage)

    this.send = this.send.bind(this)
  }

  async register(userId, payload) {
    const newDevice = await this.storage.db.collection('device').insertOne({
      userId: userId,
      id: payload.deviceId,
      type: payload.type,
      createdAt: new Date().getTime().toString(),
      updatedAt: new Date().getTime().toString()
    })

    return newDevice
  }

  async send(userId, data, notification) {
    // get deviceIds
    const devicesPtr = await this.storage.db.collection('device').find({
      userId: userId
    })
    const devices = await devicesPtr.toArray()
    const deviceIds = devices.filter(dev => dev.type === 'android').map(dev => dev.id)
    this.sendPushNotification(deviceIds, data, notification)
  }

  sendPushNotification(deviceIds, data, notification) {
    let message = new gcm.Message({
      priority: 'high',
      dryRun: true,
      contentAvailable: true,
      data: data,
      notification: notification
      // data: {
      //   screen: 'message1',
      //   id: 'message2'
      // },
      // notification: {
      //   title: "Hello, World",
      //   icon: "ic_launcher",
      //   body: "This is a notification that will be displayed if your app is in the background."
      // }
    })

    this.sender.send(message, {
      registrationTokens: deviceIds
    }, function (err, response) {
      console.log('gcm')
      if (err) {
        console.error(err)
      } else {
        console.log(response)
        const inactiveDeviceIds = deviceIds.filter((token, i) => response[i].error != null)
        console.log('These tokens are no longer ok:', inactiveDeviceIds)
      }
    })
  }

  async processEvent(type, collection, action, params, data) {
    if (type === 'create') {
      if (collection === 'comment') {
        this.notifyComment.create(data, this.send)
      }
      if (collection === 'post') {
        this.notifyPost.create(data, this.send)
      }
    }
    if (type === 'update') {
      if (collection === 'post') {
        this.notifyPost.update(data, this.send, params)
      }
    }
  }
}

module.exports = Notification