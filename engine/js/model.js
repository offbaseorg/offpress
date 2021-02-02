import uslug from "https://jspm.dev/uslug"
import matter from "https://jspm.dev/gray-matter"
import Swal from "https://jspm.dev/sweetalert2"
import { Builder } from "./builder.js"
export class Model {
  constructor(o) {
    this.fs = o.fs
    this.git = o.git
    this.config = o.config
    this.src = o.src
    this.builder = new Builder(o)
    this.init()
  }
  async init() {
    await this.fs.promises.mkdir(this.config.settings.SRC).catch((e) => {})
    await this.fs.promises.mkdir(this.config.settings.DEST).catch((e) => {})
    await this.fs.promises.mkdir(`${this.config.settings.SRC}/assets`).catch((e) => {})
    await this.fs.promises.mkdir(`${this.config.settings.DEST}/assets`).catch((e) => {})
  }
  async updated () {
    const FILE = 0, HEAD = 1, WORKDIR = 2, STAGE = 3
    let matrix = await this.git.statusMatrix({ fs: this.fs, dir: "/home" })
    return matrix.filter((row) => { return !(row[HEAD] === 1 && row[WORKDIR] === 1 && row[STAGE] === 1) }).map(row => row[FILE])
  }
  async deleted () {
    const FILE = 0, HEAD = 1, WORKDIR = 2, STAGE = 3
    let matrix = await this.git.statusMatrix({ fs: this.fs, dir: "/home" })
    return matrix.filter((row) => { return row[WORKDIR] === 0 })
  }
  async build () {
    await this.builder.build()
  }
  async buildPost(filename) {
    await this.builder.buildPost(filename)
  }
  async load(path) {
    let raw = await this.fs.promises.readFile(path, "utf8")
    let { data, content } = matter(raw)
    return { data, content, raw }
  }
  async unpublish({ content, data }) {
    data.draft = true
    let updatedContent = matter.stringify(content, data)
    await this.fs.promises.writeFile(this.src, updatedContent)
  }
  async publish({ content, data }) {
    data.draft = false;
    let updatedContent = matter.stringify(content, data)
    await this.fs.promises.writeFile(this.src, updatedContent)
    let updated = await this.updated()
    if (updated.length === 0) {
      console.log("no update")
      alert("no update")
      return false;
    }
    await this.builder.build()
    return true;
  }
  async save( { content, data, raw }) {
    let matches = raw.matchAll(/!\[.*?\]\((.*?)\)/g)
    let images = []
    for(let match of matches) {
      images.push(match[1])
    }
    let imageTags = images.map((image, i) => {
      return (i === 0 ? `<img class='selected' src='${image}'>` : `<img src='${image}'>`)
    }).join("")
    let desc = (data.description ? data.description : document.querySelector(".tui-editor-contents").textContent.trim().replace(/(\r\n|\n|\r)/gm,"").slice(0, 300))
    let {title, description, image} = await Swal.fire({
      title: 'Save',
      html: `<form class='publish-form'>
  <input class='title' type='text' placeholder='enter title' value='${data.title ? data.title : ""}'>
  <textarea class='description'>${desc}</textarea>
  <div class='images'>${imageTags}</div>
  </form>`,
      confirmButtonText: 'Save',
      didOpen: (el) => {
        el.querySelector(".images").addEventListener("click", (e) => {
          document.querySelectorAll(".images img").forEach((el2) => {
            el2.classList.remove("selected")
          })
          if (e.target.getAttribute("src")) e.target.classList.toggle("selected")
        })
      },
      preConfirm: async () => {
        let image = document.querySelector(".publish-form .images img.selected")
        let title = document.querySelector(".publish-form .title").value
        if (!title || title.length === 0) {
          alert("please enter title")
          return false;
        }
        if (!this.src) {
          let f = await this.fs.promises.stat(`${this.config.settings.SRC}/${uslug(title)}`).catch((e) => {})
          if (f) {
            alert("the file already exists")
            return false;
          }
        }
        return [
          document.querySelector(".publish-form .title").value,
          document.querySelector(".publish-form .description").value,
          (image ? image.getAttribute("src") : null)
        ]
      }
    }).then((res) => {
      return {
        title: res.value[0],
        description: res.value[1],
        image: res.value[2]
      }
    })
    let name
    let status
    if (this.src) {
      name = this.src.split("/")[3]
      status = "updated"
    } else {
      name = uslug(title)
      status = "created"
      this.src = `${this.config.settings.SRC}/${name}`
    }
    data.permalink = name;
    data.title = title
    data.description = description
    data.image = image
    data.updated = Date.now()
    let updatedContent = matter.stringify(content, data)
    await this.fs.promises.writeFile(`${this.config.settings.SRC}/${data.permalink}`, updatedContent)
    await this.builder.buildPost(data.permalink)
    return { status, path: this.src }
  }
  // Remove the current file from the file system, and then remove from git
  async destroy() {
    let name = this.src.split("/")[3]
    await this.fs.promises.unlink(`${this.config.settings.SRC}/${name}`).catch((e) => {})
    await this.fs.promises.unlink(`${this.config.settings.DEST}/post/${name}/index.html`).catch((e) => { })
    await this.fs.promises.rmdir(`${this.config.settings.DEST}/post/${name}`).catch((e) => { })
  }
  async saveImage(blob, callback) {
    let ab = await blob.arrayBuffer()
    let bytes = new Uint8Array(ab)
    const hashBuffer = await crypto.subtle.digest('SHA-256', bytes)
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    await this.fs.promises.writeFile(`${this.config.settings.SRC}/assets/${hash}`, bytes).catch((e) => { console.log("error", e) })
    callback("assets/" + hash, hash)
  }
}
