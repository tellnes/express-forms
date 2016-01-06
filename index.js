
var express = require('express')
  , path = require('path')
  , querystring = require('querystring')
var urlencoded = require('body-parser').urlencoded
var methodOverride = require('method-override')
var xtend = require('xtend')

module.exports = function (options) {
  var app = express()
    , form = options.form
    , fields = {}
    , defaultItem = options.defaultItem || {}

  if (!form)
    throw new Error('options.form must be defined.')

  Object.keys(form.fields).forEach(function (name) {
    field = form.fields[name]
    if (field.list === true || (field.widget.type !== 'hidden' && field.list !== false)) {
      fields[name] = field.labelText(name)
    }
  })


  app.set('views', options.views || path.resolve(__dirname, 'views'))
  app.set('view engine', 'jade')

  app.locals.form = form

  app.use(urlencoded({ extended: true }))
  app.use(methodOverride(function(req) {
    if (req.body && typeof req.body === 'object' && '_method' in req.body) {
      var method = req.body._method
      delete req.body._method
      return method
    }
  }))

  app.use(function (req, res, next) {
    var p = app.path()
    if (p[p.length - 1] !== '/') p += '/'
    res.locals.path = p
    next()
  })

  function renderForm(view, item, form, req, res, next) {
    if (options.beforeRenderForm) {
      options.beforeRenderForm( { view: view
                                , item: item
                                , form: form
                                , req: req
                                , res: res
                                , next: next
                                }
                              , then
                              )
    } else {
      then()
    }

    function then(err) {
      if (err) return next(err)

      res.render( view
                , { item: item || {}
                  , form: form
                  , fields: fields
                  }
                )
    }
  }


  function handleForm(req, res, next) {
    var item = req._express_forms_item
      , view = item ? 'edit' : 'create'
    form.handle(req, {
      success: function (form) {
        if (options.validate) {
          options.validate(
              { view: view
              , item: item
              , form: form
              , data: form.data
              , req: req
              , res: res
              , next: next
              }
            , validated
            )
        } else {
          validated(null, true)
        }

        function validated(err, valid, reason) {
          if (err) return next(err)

          if (!valid) {
            res.format(
              { html: function () {
                  renderForm(view, item, form, req, res, next)
                }
              , json: function () {
                  res.send({ error: 'validation error', reason: reason })
                }
              })
            return
          }

          if (item) {
            options.update(item, form.data, finish)
          } else {
            options.create(form.data, finish)
          }
        }

        function finish(err, item) {
          if (err) return next(err)
          res.format({
            html: function () {
              res.redirect(res.locals.path + item.id)
            },
            json: function () {
              res.send({ok: true})
            }
          })
        }
      },
      error: function (form) {
        res.format({
          html: function () {
            renderForm(view, item, form, req, res, next)
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
              renderForm(view, item, form.bind(item), req, res, next)
            } else {
              renderForm(view, null, form.bind(defaultItem), req, res, next)
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
    options.list(req.query, function (err, list) {
      if (err) return next(err)
      res.format({
        html: function () {
          res.locals.list = list
          res.locals.fields = fields
          res.locals.query = req.query
          res.locals.qs = function(obj) {
            return querystring.stringify(xtend(req.query, obj))
          }
          res.locals.link = function link(obj) {
            return res.locals.path + '?' + res.locals.qs(obj)
          }

          res.render('list')
        },
        json: function () {
          res.send(list)
        }
      })
    })
  })

  app.get('/create', function (req, res, next) {
    renderForm('create', null, form.bind(defaultItem), req, res, next)
  })

  app.post('/', handleForm)

  function findItem(req, res, next) {
    options.get(req.params.item_id, function (err, item) {
      if (err) return next(err)
      if (!item) return next('route')
      req._express_forms_item = item
      next()
    })
  }

  app.get('/:item_id', findItem, function (req, res, next) {
    var item = req._express_forms_item
    res.format({
      'html': function () {
        renderForm('view', item, form.bind(item), req, res, next)
      },
      'json': function () {
        res.send(item)
      }
    })
  })

  app.get('/:item_id/edit', findItem, function (req, res, next) {
    var item = req._express_forms_item
    renderForm('edit', item, form.bind(item), req, res, next)
  })

  app.put('/:item_id', findItem, handleForm)

  app.get('/:item_id/delete', findItem, function (req, res, next) {
    res.render('delete', { item: req._express_forms_item })
  })

  app.delete('/:item_id', findItem, function (req, res, next) {
    var item = req._express_forms_item
    ;(options.delete || options.del)(item, function (err) {
      if (err) return next(err)
      res.format({
        html: function () {
          res.redirect(res.locals.path)
        },
        json: function () {
          res.send({ok: true})
        }
      })
    })
  })

  return app
}
