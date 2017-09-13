'use strict'

const Promise = require('bluebird')
const moment = require('moment')
const crypto = require('crypto')
const xml = require('./xml')

const debug = require('debug')('loopback:component:cas')

const errorCodes = {
  INVALID_REQUEST: 'INVALID_REQUEST',
  INVALID_TICKET_SPEC: 'INVALID_TICKET_SPEC',
  UNAUTHORIZED_SERVICE_PROXY: 'UNAUTHORIZED_SERVICE_PROXY',
  INVALID_PROXY_CALLBACK: 'INVALID_PROXY_CALLBACK',
  INVALID_TICKET: 'INVALID_TICKET',
  INVALID_SERVICE: 'INVALID_SERVICE',
  INTERNAL_ERROR: 'INTERNAL_ERROR'
}

/* p23Validate */
module.exports = function (app, config, req, res, next, isProtocol3) {

  let getRolesNameFromUserId = function(app, userid) {
    return new Promise(function(resolve) {
      app.models.Role.getRoles({ principalType: app.models.RoleMapping.USER, principalId: userid}).then(function(roles) {
        // suppress dynamic roles
        let roles2 = []
        for (let i in roles) {
          if (typeof roles[i] === 'number') {
            roles2.push(roles[i])
          }
        }
        app.models.Role.find({ where: { id: { inq: roles2 } }, fields: ['name'] }).then(function(rolenames) {
          let rn = []
          for (let el of rolenames) {
            rn.push(el.name)
          }
          resolve(rn)
        })
      })
    })
  }
  let getAttributes = Promise.coroutine(function* (app, config, user, tgt) {
    let returnProfile = {
      uuid: user.uuid
    }

    if (config.attributes) {
      returnProfile.attributes = {}
      if (config.attributes.standardAttributes)
        returnProfile.attributes.standardAttributes = {}
      if (config.attributes.extraAttributes)
        returnProfile.attributes.extraAttributes = {}
    }

    for (let att of config.attributes.standardAttributes) {
      if (att === "authenticationDate") {
        returnProfile.attributes.standardAttributes.authenticationDate = moment(tgt.created).format("YYYY-MM-DDThh:mm:ss")
      } else if (att === "longTermAuthenticationRequestTokenUsed") {
        //TODO: how to know?
        returnProfile.attributes.standardAttributes.longTermAuthenticationRequestTokenUsed = false
      } else if (att === "isFromNewLogin") {
        //TODO: how to know?
        returnProfile.attributes.standardAttributes.isFromNewLogin=false
      } else if (att === "memberOf") {
        returnProfile.attributes.standardAttributes.memberOf = yield getRolesNameFromUserId(app, user.id)
      }
    }

    if (user.profile) {
      let profile
      // user.profile _is_ JSON
      try {
        profile = JSON.parse(user.profile)

        for (let att of config.attributes.extraAttributes) {
          // email is a specific case
          if (att.toLowerCase() === "email") {
            returnProfile.attributes.extraAttributes.email = user.email
          } else if (profile[att]) {
            returnProfile.attributes.extraAttributes[att] = profile[att]
          }
        }

      } catch (e) {
        debug("ERROR: %s", e)
      }
    }

    return returnProfile
  })

  /* main() */

  /* 'TARGET' in req.query ? -> SAML */
  let xmlinvalid = req.query['TARGET']?xml.invalidSTSaml:xml.invalidST
  let xmlvalid = req.query['TARGET']?xml.validSTSaml:xml.validST
  let responseID = '_' + crypto.randomBytes(16).toString('hex')

  let serviceUrl = req.query['service']
  let ticket = req.query['ticket']


  res.type('text/xml')

  if (!ticket || !serviceUrl) {
    debug('Not all of the required request parameters were present.')
    return res.send(xmlinvalid.renderToString({
      code: errorCodes.INVALID_REQUEST,
      message: 'Not all of the required request parameters were present',
      responseid: responseID,
      issueinstant: moment().toISOString(),
      audience: service.url
    }))
  }

  // TODO one day
  const pgtUrl = req.query['pgtUrl']
  const renew = req.query['renew']

  // validate ST
  app.models.AccessToken.findForRequest(req, { params: ['ticket'], searchDefaultTokenKeys: false},function(err, st_token) {
    if (err || !st_token) {
      debug('invalid service ticket')
      if (err) {
        debug(err)
      }
      return res.send(xmlinvalid.renderToString({
        code: errorCodes.INVALID_TICKET,
        message: `ticket ${ticket} was not recognized`,
        responseid: responseID,
        issueinstant: moment().toISOString(),
        audience: service.url
      }))
    }

    // remove ST
    st_token.destroy(function(err) {
      if (err) {
        debug('could not invalidate service ticket')
        return res.send(xmlinvalid.renderToString({
          code: errorCodes.INTERNAL_ERROR,
          message: `service ticket ${ticket} could not be invalidated`,
          responseid: responseID,
          issueinstant: moment().toISOString(),
          audience: service.url
        }))
      }

      // if != production "http://localhost" allowed
      if (process.env.NODE_ENV === 'production') {
        // SQL injection prevention
        if (!re_weburl.test(serviceUrl)) {
          return res.send(xmlinvalid.renderToString({
            code: errorCodes.INVALID_SERVICE,
            message: `service ${serviceUrl} was not recognized`,
            responseid: responseID,
            issueinstant: moment().toISOString(),
            audience: service.url
          }))
        }
      }
      // validate service
      app.models.Application.findOne({ where: { url: serviceUrl } },function(err, service) {
        if (err || !service) {
          debug('service '+ serviceUrl + ' not recognized')
          return res.send(xmlinvalid.renderToString({
            code: errorCodes.INVALID_SERVICE,
            message: `service ${serviceUrl} was not recognized`,
            responseid: responseID,
            issueinstant: moment().toISOString(),
            audience: service.url
          }))
        }

        // check application
        if (st_token.appId !== service.id) {
          debug('CAS /serviceValidate ! (appId)')
          debug('service:' + JSON.stringify(service) )
          debug('ST:' + JSON.stringify(st_token))
          return res.send(xmlinvalid.renderToString({
            code: errorCodes.INVALID_SERVICE,
            message: `service ${serviceUrl} was not recognized`,
            responseid: responseID,
            issueinstant: moment().toISOString(),
            audience: service.url
          }))
        }

        if (isProtocol3) {
          // TODO: record here (TGT, service) for Single Logout (SLO)
          // See 2.3.3. The CAS Server MAY support Single Logout (SLO)
        }

        eval('app.models.' + config.userModel).findOne({ where: { id: st_token.userId } },function(err, user) {
          if (err || !user) {
            debug('Internal Error.')
            return res.send(xmlinvalid.renderToString({
              code: errorCodes.INTERNAL_ERROR,
              message: 'Internal Error',
              responseid: responseID,
              issueinstant: moment().toISOString(),
              audience: service.url
            }))
          }

          app.models.AccessToken.findOne({ where: { and: [ { userId: st_token.userId }, { appId: null} ]}},function(err, tgt) {
            if (err || ! tgt) {
              debug('Internal Error.')
              return res.send(xmlinvalid.renderToString({
                code: errorCodes.INTERNAL_ERROR,
                message: 'Internal Error',
                responseid: responseID,
                issueinstant: moment().toISOString(),
                audience: service.url
              }))
            }
            getAttributes(app, config, user, tgt).then(function(returnProfile){
              let casversion = isProtocol3?'3':'2'
              debug('CAS%d validate (email:%s, service: %s)', casversion, user.email, service.name)

              /* 'TARGET' in req.query ? -> SAML */
              if (req.query['TARGET']) {
                returnProfile.issueinstant = moment().toISOString()
                returnProfile.audience = service.url
                returnProfile.responseid = responseID
//                debug('returnProfile: ', JSON.stringify(returnData))
              }
//              debug('rendering: ', xmlvalid.renderToString(returnProfile))
              return res.send(xmlvalid.renderToString(returnProfile))
            })
          })
        })
      })
    })
  })
}
