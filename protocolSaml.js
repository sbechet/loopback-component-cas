'use strict'

const Promise = require('bluebird')
const moment = require('moment')
const p23Validate = require('./protocol23.js')
const xml = require('./xml')

const debug = require('debug')('loopback:component:cas')


/* samlValidate */
module.exports = function (app, config, req, res, next, loginCallback) {
  let MajorVersion = req.body['SOAP-ENV:Envelope']['SOAP-ENV:Body']['samlp:Request']['$']['MajorVersion']
  //let MinorVersion = req.body['SOAP-ENV:Envelope']['SOAP-ENV:Body']['samlp:Request']['$']['MinorVersion']
  // RequestID like '_192.168.16.51.1024506224022'
  let RequestID = req.body['SOAP-ENV:Envelope']['SOAP-ENV:Body']['samlp:Request']['$']['RequestID']
  // IssueInstant like '2002-06-19T17:03:44.022Z'
  let IssueInstant = req.body['SOAP-ENV:Envelope']['SOAP-ENV:Body']['samlp:Request']['$']['IssueInstant']

  /* SAML 1.0 or 1.1 for now */
  if (MajorVersion == 1) {
    // The TARGET variable will be the indication of the SAML protcol
    req.query['service'] = req.query['TARGET']
    req.query['ticket'] = req.body['SOAP-ENV:Envelope']['SOAP-ENV:Body']['samlp:Request']['samlp:AssertionArtifact']
    p23Validate(app, config, req, res, next, loginCallback, true)
  } else {
    debug('TODO:samlValidate:protocol>1.1')
    return res.send(xml.invalidSTSaml.renderToString({
      issueinstant: moment().toISOString(),
      audience: service.url
    }))
  }
}
