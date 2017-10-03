'use strict'

const debug = require('debug')('loopback:component:cas')

/* p1Validate */
module.exports = function (app, config, req, res, next) {
  let serviceUrl = req.query['service']
  let URLserviceUrl = new URL(serviceUrl)
  let URLorigin = URLserviceUrl.origin
  let ticket = req.query['ticket']

  if (!ticket || !serviceUrl) {
    debug('ERROR: Not all of the required request parameters were present.')
    return res.send('no\n')
  }

  // validate ST
  app.models.AccessToken.findForRequest(req, { params: ['ticket'], searchDefaultTokenKeys: false},function(err, st_token) {
    if (err || !st_token) {
      return res.send('no\n')
    }
    // remove ST
    st_token.destroy(function(err) {
      if (err) {
        debug('ERROR: CAS : error removing ST')
        return res.send('no\n')
      }

      // validate service
      app.models.Application.findOne({ where: { url: URLorigin } },function(err, service) {
        if (err || !service) {
          return res.send('no\n')
        }
        // check application
        if (st_token.appId !== service.id) {
          debug('ERROR: CAS /validate ! appId:')
          debug('ERROR: service:' + JSON.stringify(req.service) )
          debug('ERROR: ST:' + JSON.stringify(st_token))
          return res.send('no\n')
        }

        eval('app.models.' + config.userModel).findOne({ where: { id: st_token.userId } },function(err, user) {
          if (err || !user) {
            debug('ERROR: Internal Error.')
            return res.send(xml.invalidST.renderToString({
              code: errorCodes.INTERNAL_ERROR,
              message: 'Internal Error'
            }))
          }
          debug('CAS1 validate (email: %s, service: %s)', user.email, service.name)
          return res.send('yes\n')
        })
      })
    })
  })
}
