import Handlebars from "https://jspm.dev/handlebars"
import marked from "https://jspm.dev/marked"
import matter from "https://jspm.dev/gray-matter"
export class Builder {
  constructor(o) {
    this.config = o.config
    this.fs = o.fs
    this.git = o.git
  }
  // build a single post
  async buildPost (filename) {
    let md = await this.fs.promises.readFile(`${this.config.settings.SRC}/${filename}`, "utf8")
    let { content, data } = matter(md)
    data.permalink = filename
    let html = marked(content, { baseUrl: "../../" }) 
    await this.plugins("onsave", { content, html, data, filename })
    return { html, data }
  }
  // run a root level build before publishing
  async build () {
    let src = await this.fs.promises.readdir(this.config.settings.SRC)
    let items = await Promise.all(src.filter((key) => { return key !== "assets" }).map((key) => {
      return new Promise(async (resolve, reject) => {
        let md = await this.fs.promises.readFile(`${this.config.settings.SRC}/${key}`, "utf8")
        let { content, data } = matter(md)
        resolve({ key, data, content })
      })
    }))
    let publicItems = []
    let privateItems = []
    for(let item of items) {
      if (item.data.draft) privateItems.push(item)
      else publicItems.push(item)
    }
    for(let item of privateItems) {
      await this.fs.promises.unlink(`${this.config.settings.DEST}/post/${item.key}/index.html`)
    }
    publicItems.sort((a, b) => {
      return parseInt(b.data.updated) - parseInt(a.data.updated);
    })
    for(let item of publicItems) {
      await this.buildPost(item.key)
    }
    await this.plugins("onpublish", publicItems)
  }
  async plugins (event, o) {
    let libs = await Promise.all(this.config.trigger[event].map((mod) => {
      return import(".." + mod)
    }))
    for(let lib of libs) {
      let res = await lib.default(o, this.config, {
        fs: this.fs, git: this.git
      })
      if (res)  o = res
    }
  }
}
