import Router from './router'

export default class Core {

  constructor(app) {

    this.Router = new Router(app)
  }

}
