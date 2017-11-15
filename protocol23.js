'use strict'

const { URL } = require('url')
const Promise = require('bluebird')
const moment = require('moment')
const crypto = require('crypto')
const xml = require('./xml')
const findService = require('./tools.js').findService

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
module.exports = function (app, config, req, res, next, loginCallback, isProtocol3) {

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
    /* uuid always here */
    let returnProfile = {
      uuid: user.uuid,
      CAS3attributes: {}
    }

    /* Step 1: Standard CAS3 Attributes */
    if (config.attributes && config.attributes.length != 0) {
      for (let att of config.attributes) {
        switch (att) {
          case 'authenticationDate':
            returnProfile.CAS3attributes.authenticationDate = moment(tgt.created).format("YYYY-MM-DDThh:mm:ss")
            break
          case 'longTermAuthenticationRequestTokenUsed':
            returnProfile.CAS3attributes.longTermAuthenticationRequestTokenUsed = false  //TODO: how to know?
            break
          case 'isFromNewLogin':
            returnProfile.CAS3attributes.isFromNewLogin=false  //TODO: how to know?
            break
          case 'memberOf':
            returnProfile.CAS3attributes.memberOf = yield getRolesNameFromUserId(app, user.id)
            break
        }
      }
    }

    /* Step 2: Specific attributes */
    // user.profile _is_ JSON
    let profile = {}
    try {
      if (user.profile) {
        profile = JSON.parse(user.profile)
      }

      /* userId is the user's unique number for all applications */
      profile.userId = user.uuid;
      /* uuid always here */
      profile.uuid = user.uuid;

      /*
        Normalized profile information conforms to the
        [contact schema](https://tools.ietf.org/html/draft-smarr-vcarddav-portable-contacts-00)
        established by [Joseph Smarr][schema-author].

        We use it for specific useful key like firstname and lastname.
      */

      if (config.attributes && config.attributes.length != 0) {
        returnProfile.attributes = {}

        for (let att of config.attributes) {
          switch (att.toLowerCase()) {
            case "email":
              // email is a specific case
              returnProfile.attributes.email = user.email
              break
            case "firstname":
              returnProfile.attributes.firstname = profile.name.givenName
              break
            case "lastname":
              returnProfile.attributes.lastname = profile.name.familyName
              break
            default:
              if ( (att != 'authenticationDate') &&
                  (att != 'longTermAuthenticationRequestTokenUsed') &&
                  (att != 'isFromNewLogin') &&
                  (att != 'memberOf') ) {
                if (typeof profile[att] == 'object') {
                  returnProfile.attributes[att] = JSON.stringify(profile[att])
                } else {
                  returnProfile.attributes[att] = profile[att]
                }
              }
          }
        }
      }

    } catch (e) {
      debug("ERROR: %s", e)
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

  let URLserviceUrl
  let URLorigin

  res.type('text/xml')

  try {
    URLserviceUrl = new URL(serviceUrl)
    URLorigin = URLserviceUrl.origin
  } catch (error) {
    if (serviceUrl !== undefined)
      debug('Malformed service? ',serviceUrl)
    delete serviceUrl
    URLorigin = 'http://malformed.nowhere'
  }

  if (!ticket || !serviceUrl) {
    debug('Not all of the required request parameters were present.')
    return res.send(xmlinvalid.renderToString({
      code: errorCodes.INVALID_REQUEST,
      message: 'Not all of the required request parameters were present',
      responseid: responseID,
      issueinstant: moment().toISOString(),
      audience: URLorigin
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
        audience: URLorigin
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
          audience: URLorigin
        }))
      }

      // validate service
      findService(app, serviceUrl, function(err, service) {
        if (err || !service) {
          debug('service '+ serviceUrl + ' not recognized')
          return res.send(xmlinvalid.renderToString({
            code: errorCodes.INVALID_SERVICE,
            message: `service ${serviceUrl} was not recognized`,
            responseid: responseID,
            issueinstant: moment().toISOString(),
            audience: URLorigin
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
            audience: URLorigin
          }))
        }

        if (isProtocol3) {
          // TODO: record in database (TGT, service) for Single Logout (SLO)
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
              audience: URLorigin
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
                audience: URLorigin
              }))
            }
            getAttributes(app, config, user, tgt).then(function(returnProfile){
              let casversion = isProtocol3?'3':'2'
              debug('CAS%d validate (email:%s, service: %s)', casversion, user.email, service.name)
              loginCallback(req, service, user);

              /* 'TARGET' in req.query ? -> SAML */
              if (req.query['TARGET']) {
                returnProfile.issueinstant = moment().toISOString()
                returnProfile.audience = URLorigin
                returnProfile.responseid = responseID
//                debug('returnProfile: ', JSON.stringify(returnData))
              }
//              debug('rendering: ', xmlvalid.renderToString({profile: returnProfile}))
              return res.send(xmlvalid.renderToString(returnProfile))
            })
          })
        })
      })
    })
  })
}
