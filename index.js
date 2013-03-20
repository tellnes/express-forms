
var express = require('express')
  , path = require('path')

module.exports = function (options) {
  var app = express()
    , form = options.form
    , fields = {}

  if (!form)
    throw new Error('options.form must be defined.')

  Object.keys(form.fields).forEach(function (name) {
    field = form.fields[name]
    if (field.list !== false) {
      fields[name] = field.labelText(name)
    }
  })


  app.set('views', options.views || path.resolve(__dirname, 'views'))
  app.set('view engine', 'jade')

  app.use(express.bodyParser())
  app.use(express.methodOverride())

  app.use(function (req, res, next) {
    var p = app.path()
    if (p[p.length - 1] !== '/') p += '/'
    res.locals.path = p
    next()
  })

  function renderForm(item, form, res) {
    res.render( item ? 'edit' : 'create'
              , { item: item || {}
                , form: form
                }
              )
  }


  function handleForm(req, res, next) {
    var item = req._orm_forms_item
    form.handle(req, {
      success: function (form) {
        function finish(err) {
          if (err) return next(err)
          res.format({
            html: function () {
              res.redirect(app.path())
            },
            json: function () {
              res.send({ok: true})
            }
          })
        }
        if (item) {
          options.update(item, form.data, finish)
        } else {
          options.create(form.data, finish)
        }
      },
      error: function (form) {
        res.format({
          html: function () {
            renderForm(item, form, res)
          },
          json: function  () {
            res.send({ error: 'validation error' })
          }
        })
      },
      empty: function () {
        res.format({
          html: function () {
            if (item) {
              renderForm(item, form.bind(item), res)
            } else {
              renderForm(null, form, res)
            }
          },
          json: function () {
            res.send({ error: 'empty input' })
          }
        })
      }
    })
  }

  app.get('/', function (req, res, next) {
    options.list(function (err, list) {
      if (err) return next(err)
      res.format({
        html: function () {
          res.render('list', { list: list, fields: fields })
        },
        json: function () {
          res.send(list)
        }
      })
    })
  })

  app.get('/create', function (req, res, next) {
    renderForm(null, form, res)
  })

  app.post('/', handleForm)

  function findItem(req, res, next) {
    options.one(req.params.item_id, function (err, item) {
      if (err) return next(err)
      if (!item) return next('route')
      req._orm_forms_item = item
      next()
    })
  }

  app.get('/:item_id', findItem, function (req, res, next) {
    var item = req._orm_forms_item
    res.format({
      'html': function () {
        renderForm(item, form.bind(item), res)
      },
      'json': function () {
        res.send(item)
      }
    })
  })

  app.put('/:item_id', findItem, handleForm)

  app.get('/:item_id/delete', findItem, function (req, res, next) {
    res.render('delete', { item: req._orm_forms_item })
  })

  app.del('/:item_id', findItem, function (req, res, next) {
    var item = req._orm_forms_item
    ;(options.delete || options.del)(item, function (err) {
      if (err) return next(err)
      res.format({
        html: function () {
          res.redirect(app.path())
        },
        json: function () {
          res.send({ok: true})
        }
      })
    })
  })

  return app
}
