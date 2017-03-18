import { makeAccount, makeAccountType } from './account.js'
import { UsernameError } from './error.js'
import {fixUsername} from './io/loginStore.js'
import { createLogin, usernameAvailable } from './login/create.js'
import * as loginEdge from './login/edge.js'
import * as loginPassword from './login/password.js'
import * as loginPin2 from './login/pin2.js'
import * as loginRecovery2 from './login/recovery2.js'
import {nodeify} from './util/decorators.js'
import { base58 } from './util/encoding.js'

/**
 * @param opts An object containing optional arguments.
 */
export function Context (io, opts) {
  this.io = io
  this.appId = opts.appId != null
    ? opts.appId
    : opts.accountType != null
      ? opts.accountType.replace(/^account.repo:/, '')
      : ''
}

Context.prototype.usernameList = function () {
  return this.io.loginStore.listUsernames()
}
Context.prototype.listUsernames = Context.prototype.usernameList

Context.prototype.fixUsername = fixUsername

Context.prototype.removeUsername = function (username) {
  this.io.loginStore.remove(username)
}

Context.prototype.usernameAvailable = nodeify(function (username) {
  // TODO: We should change the API to expect a bool, rather than throwing:
  return usernameAvailable(this.io, username).then(bool => {
    if (!bool) {
      throw new UsernameError()
    }
    return bool
  })
})

/**
 * Creates a login, then creates and attaches an account to it.
 */
Context.prototype.createAccount = nodeify(function (username, password, pin) {
  return createLogin(this.io, username, { password, pin }).then(login => {
    return makeAccount(this, login, 'newAccount')
  })
})

Context.prototype.loginWithPassword = nodeify(function (username, password, otp, opts) {
  return loginPassword.login(this.io, username, password).then(login => {
    return makeAccount(this, login, 'passwordLogin')
  })
})

Context.prototype.pinExists = function (username) {
  const loginStash = this.io.loginStore.loadSync(username)
  return loginPin2.getKey(loginStash, this.appId) != null
}
Context.prototype.pinLoginEnabled = Context.prototype.pinExists

Context.prototype.loginWithPIN = nodeify(function (username, pin) {
  return loginPin2.login(this.io, this.appId, username, pin).then(login => {
    return makeAccount(this, login, 'pinLogin')
  })
})

Context.prototype.getRecovery2Key = nodeify(function (username) {
  const loginStash = this.io.loginStore.loadSync(username)
  const recovery2Key = loginRecovery2.getKey(loginStash)
  if (recovery2Key == null) {
    return Promise.reject(new Error('No recovery key stored locally.'))
  }
  return Promise.resolve(base58.stringify(recovery2Key))
})

Context.prototype.loginWithRecovery2 = nodeify(function (recovery2Key, username, answers, otp, options) {
  recovery2Key = base58.parse(recovery2Key)
  return loginRecovery2.login(this.io, recovery2Key, username, answers).then(login => {
    return makeAccount(this, login, 'recoveryLogin')
  })
})

Context.prototype.fetchRecovery2Questions = nodeify(function (recovery2Key, username) {
  recovery2Key = base58.parse(recovery2Key)
  return loginRecovery2.questions(this.io, recovery2Key, username)
})

Context.prototype.checkPasswordRules = function (password) {
  const tooShort = password.length < 10
  const noNumber = password.match(/\d/) == null
  const noUpperCase = password.match(/[A-Z]/) == null
  const noLowerCase = password.match(/[a-z]/) == null
  const extraLong = password.length >= 16

  return {
    'tooShort': tooShort,
    'noNumber': noNumber,
    'noUpperCase': noUpperCase,
    'noLowerCase': noLowerCase,
    'passed': extraLong || !(tooShort || noNumber || noUpperCase || noLowerCase)
  }
}

Context.prototype.requestEdgeLogin = nodeify(function (opts) {
  const onLogin = opts.onLogin
  opts.onLogin = (err, login) => {
    if (err) return onLogin(err)
    makeAccount(this, login, 'edgeLogin').then(
      account => onLogin(null, account),
      err => onLogin(err)
    )
  }
  opts.type = opts.type || makeAccountType(this.appId)
  return loginEdge.create(this.io, opts)
})

Context.prototype.listRecoveryQuestionChoices = nodeify(function () {
  return loginRecovery2.listRecoveryQuestionChoices(this.io)
})
