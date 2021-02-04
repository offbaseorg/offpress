import matter from "https://jspm.dev/gray-matter"
import Editor from "https://jspm.dev/@toast-ui/editor"
import Swal from "https://jspm.dev/sweetalert2"
export class View {
  constructor (o) {
    this.config = o.config
    this.model = o.model
    this.editor = new Editor({
      frontMatter: true,
      el: document.querySelector('#editor'),
      height: '100%',
      initialEditType: 'markdown',
      usageStatistics: false,
      previewStyle: 'vertical',
      events: {
        change: () => {
          if (this.loaded) {
            document.querySelector("#save").classList.add("enabled")
          } else {
            this.loaded = true;
          }
        }
      },
      hooks: {
        addImageBlobHook: async (blob, callback) => {
          await this.model.saveImage(blob, callback)
          return false;
        }
      }
    });
    this.editor.eventManager.addEventType('full-expand')
    this.editor.eventManager.addEventType('medium-expand')
    this.editor.eventManager.listen('full-expand', () => {
      const textObj = this.editor.getTextObject();
      textObj.replaceContent(`<div class='full'>\n\n${textObj.getTextContent()}\n\n</div>`);
    });
    this.editor.eventManager.listen('medium-expand', () => {
      const textObj = this.editor.getTextObject();
      textObj.replaceContent(`<div class='medium'>\n\n${textObj.getTextContent()}\n\n</div>`);
    });

    const toolbar = this.editor.getUI().getToolbar();
    toolbar.insertItem(0, {
      type: 'button',
      options: {
        el: (() => {
          const button = document.createElement('button');
          button.className = 'full-expand';
          button.innerHTML = "((( )))"
          return button;
        })(),
        event: 'full-expand',
        tooltip: 'make full width',
      }
    });
    toolbar.insertItem(0, {
      type: 'button',
      options: {
        el: (() => {
          const button = document.createElement('button');
          button.className = 'medium-expand';
          button.innerHTML = "(( ))"
          return button;
        })(),
        event: 'medium-expand',
        tooltip: 'make medium width',
      }
    });
    if (this.model.src) this.fill(this.model.src)
    document.querySelector("#delete").addEventListener("click", async (e) => {
      if (!this.model.src) return;
      let sure = await this.confirm("are you sure?", "yes", "no")
      if (sure) {
        await this.model.destroy()
        let now = await this.confirm("publish the deletion now? (otherwise your deletion will stay local until you publish later)", "yes", "no")
        if (now) {
          location.href = "/upload"
        } else {
          location.href = "."
        }
      }
    })
    document.querySelector("#preview").addEventListener("click", async (e) => {
      if (this.model.src) {
        window.open("./blog/post/" + decodeURIComponent(this.model.src.split("/")[3]), "_blank")
      }
    })
    document.querySelector("#unpublish").addEventListener("click", async (e) => {
      await this.model.unpublish(this.content())
      let now = await this.confirm("upload the unpublish action now? (this post will stay public on your site until you upload the unpublish action)", "yes", "no")
      if (now) {
        await this.model.build()
        location.href = "/upload"
      } else {
        location.href = "."
      }
    })
    document.querySelector("#publish").addEventListener("click", async (e) => {
      let updated = await this.model.publish(this.content())
      if (updated) {
        location.href = "/upload"
      }
    })
    document.querySelector("#save").addEventListener("click", async (e) => {
      let c = this.content()
      let { status, path } = await this.model.save(c)
      if (status === "created") {
        location.href = "./editor?src=" + path;
      } else {
        document.querySelector("#save").classList.remove("enabled")
        this.editor.setMarkdown(c.raw)
      }
    });
  }
  async fill (path) {
    let { content, data, raw }  = await this.model.load(path)
    this.editor.setMarkdown(raw)
    if (data.draft) {
      document.querySelector("#unpublish").classList.add("hidden")
      document.querySelector(".draft").classList.remove("hidden")
    }
  }
  confirm(title, c, d) {
    return Swal.fire({
      title: title,
      showDenyButton: true,
      confirmButtonText: c,
      denyButtonText: d
    }).then((result) => {
      return result.isConfirmed
    })
  }
  content() {
    let raw = this.editor.getMarkdown()
    let { content, data } = matter(raw)
    return { content, data, raw }
  }
};
