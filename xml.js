'use strict'

const path = require('path')
const marko = require('marko')
require('marko/compiler').defaultOptions.writeToDisk = false

function getTemplate (name) {
  return marko.load(path.join(__dirname, 'xmlTemplates', `${name}.marko`))
}

const validST = getTemplate('validST')
const invalidST = getTemplate('invalidST')

const validSTSaml = getTemplate('validSTSaml')
const invalidSTSaml = getTemplate('invalidSTSaml')

module.exports = {
  validST,
  invalidST,
  validSTSaml,
  invalidSTSaml
}
