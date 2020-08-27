const gcm = require('node-gcm')
const NotificationComment = require('./NotificationComment')

class Notification {
  constructor(storage) {
    this.storage = storage
    this.sender = new gcm.sender(process.env.GCM_SENDER_KEY)
    this.notifyComment = new NotificationComment(storage)
  }

  async register(userId, deviceId, type) {
    const newDevice = await this.storage.db.collection('device').insertOne({
      id: deviceId,
      userId: userId,
      type: type,
      createdAt: new Date().getTime(),
      updatedAt: new Date().getTime()
    })

    return newDevice
  }

  async send(userId, data, notification) {
    // get deviceIds
    const devicesPtr = await this.storage.db.collection('device').find({
      userId: userId
    })
    const devices = await devicesPtr.toArray()
    const androidDeviceIds = devices.filter(dev => dev.type === 'android').map(dev => dev.id)
    this.sendAndroid(androidDeviceIds, data, notification)

    // const iOSDevices = devices.filter(dev => dev.type === 'ios').map(dev => dev.id)
    // this.sendIos(iOSDevices)
  }

  sendAndroid(deviceIds, data, notification) {
    let message = new gcm.Message({
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
      if (err) {
        console.error(err)
      } else {
        console.log(response)
        const inactiveDeviceIds = deviceIds.filter((token, i) => response[i].error != null)
        console.log('These tokens are no longer ok:', inactiveDeviceIds)
      }
    })
  }

  sendIos(deviceIds) {

  }

  processEvent(type, collection, data) {
    if (type === 'create') {
      if (collection === 'comment') {
        this.notifyComment.create(data, this.send)
      }
    }
  }
}

module.exports = Notification