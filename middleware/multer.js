const path = require('path')
const multer = require('multer')

module.exports = multer({
  storage: multer.diskStorage({
    destination(req, file, cb) {
      cb(null, path.join(process.cwd(), 'temp'))
    },
    filename(req, file, cb) {
      cb(null, `${Date.now()}_${file.originalname}`)
    }
  })
})