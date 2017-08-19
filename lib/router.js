import glob from 'glob'
import path from 'path'
import fs from 'fs'
import async from 'async'

function isType (key, type: String) {
  return typeof key === type
}


class Router {

  models: Object = {}
  middleware: Object = {}
  routes: Object
  ignoreDirs: Array

  methods = ['get', 'put', 'post', 'delete', 'all']

  constructor({ database: { models, type }, routes, ignoreDirs }) {
    this.ignoreDirs = ignoreDirs || []

    if (isType(routes, 'string')) {
      this.routes = routes
    } else {
      throw new Error('You must include the path to your routes')
    }

    if (!isType(database, 'undefined')) {
      glob.sync(path.join(models, '**')).forEach(modelFile => {
        const resolve = path.resolve(modelFile)

        if (fs.lstatSync(resolve).isDirectory()) {
          return false
        }

        const model = require(modelFile)

        if (type === 'mongoose') {
          this.models[model.name] = mongoose.model(model.name, model)
        } else if (type === 'sequelize' || type === 'knex') {
          this.models[model.name] = model
        }
      })
    } else {
      throw new Error('Must be an object containing the mongoose module and path to your models')
    }
  }

  use(name, middleware) {
    this.middleware[name] = middleware

    return this
  }

  run(app: Object) {
    const routes = glob.sync(path.join(this.routes, '**'))

    async.each(routes, (file, done) => {
      try {
        const resolve = path.resolve(file)

        if (fs.lstatSync(resolve).isDirectory()) {
          return done()
        }

        const removeDirFromPath = resolve.replace(this.routes, '')
        const convertToRoute = removeDirFromPath.split('\\').join('/')
        let route = convertToRoute.replace('.js', '')

        // ignore dirs
        this.ignoreDirs.forEach(dir => {
          if (resolve.includes(dir)) return done()
        })

        if (path.basename(file).includes('index')) {
          route = route.replace('/index', '')
        }

        const Controller = new (require(file))

        if (isType(Controller.params, 'undefined')) {
          Controller.params = ''
        }

        // If by default you have a page that takes in both a post and get request, you can simply create 2 different routes
        // and with one of them put the '-{method}' at the end before the file extension like so:
        // > root
        //  > Controllers
        //   > auth
        //    > login.js
        //    > login-post.js
        if (isType(Controller.method, 'undefined')) {
          const getMethod = route.split('-')[1]

          if (this.methods.includes(getMethod)) {
            route = route.replace(`-${getMethod}`, '')
            Controller.method = getMethod
          }
        }

        this.apply(app, route, Controller)
      } catch(err) {
        throw err
      }
    }, console.warn)
  }

  apply(app, route, Controller) {
    const { method, params, models, middleware } = Controller

    const routeMiddleware = []
    let routeModels = {}

    if (middleware instanceof Array) {
      middleware.forEach(name => {
        if (typeof this.middleware[name] === 'function') {
          routeMiddleware.push(this.middleware[name])
        } else {
          throw new Error(`${name} middleware isn't a function`)
        }
      })
    }

    if (models instanceof Array) {
      models.forEach(name => {
        if (typeof this.models[name] !== 'undefined') {
          routeModels[name] = this.models[name]
        } else {
          throw new Error(`${name} model doesn't exist`)
        }
      })
    }

    routeMiddleware.push((...args) => {
      return Controller.action(...args, config, routeModels)
    })

    new Function(
      'app',
      'middleware',
      `return app.${method}('${route}/${params}', ...middleware)`
    )(app, routeMiddleware)
  }
}
