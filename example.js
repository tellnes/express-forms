var expressForms = require('./')
  , forms = require('forms')
  , app = require('express')()


var primary = 0
  , list = []


var form = forms.create({
  title: forms.fields.string({required: true}),
  body: forms.fields.string({required: true, widget: forms.widgets.textarea(), list: false })
})

app.use(expressForms( { form: form
                      , list: function (cb) {
                          cb(null, list)
                        }
                      , one: function (id, cb) {
                          for(var i = 0, len = list.length; i < len; i++) {
                            if (list[i].id == id) {
                              cb(null, list[i])
                              return
                            }
                          }
                          cb(null, null)
                        }
                      , create: function (data, cb) {
                          data.id = ++primary
                          list.push(data)
                          cb(null)
                        }
                      , update: function (item, data, cb) {
                          Object.keys(data).forEach(function (key) {
                            item[key] = data[key]
                          })
                          cb(null)
                        }
                      , delete: function (item, cb) {
                          list.splice(list.indexOf(item), 1)
                          cb(null)
                        }
                      }
                    )
        )

app.listen(1337)
