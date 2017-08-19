#!/usr/bin/env node
require('./babel')

if (process.env.NODE_ENV === 'development') {
  if (!require('piping')({
      hook: true,
      ignore: /(\/\.|~$|\.json|\.scss$)/i
    })) {
    return
  }
}

require('./lib/core')
