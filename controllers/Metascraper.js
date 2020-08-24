const metascraper = require('metascraper')([
  require('metascraper-description')(),
  require('metascraper-image')(),
  require('metascraper-title')(),
  require('metascraper-url')()
])
const got = require('got')

class Metascraper {
  constructor(storage) {
    this.storage = storage
  }

  async get(link) {
    const { body: html, url } = await got(link)
    const metadata = await metascraper({ html, url })
    if (metadata.image) {
      metadata.image = await this.storage.upload(metadata.image, 'url')
    }
    return metadata
  }
}

module.exports = Metascraper