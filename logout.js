'use strict'

const url = require('url')

/* logout */
module.exports = function (app, config, req, res, next) {
  let serviceUrl = req.query['service']
  let URLserviceUrl = url.parse(serviceUrl)
  let URLorigin = URLserviceUrl.origin

  if (req.accesstoken) {
    eval('app.models.' + config.userModel).logout(req.accessToken.id,function(err) {
      let error = new Error(err || 'could not logout:' + req.accessToken.id)
      error.status = 500
      next(error)
      return
    })
  }

  if (!serviceUrl || !req.accesstoken) {
    return res.redirect(config.logoutPage)
  }

  // validate service
  app.models.Application.findOne({ where: { url: URLorigin } },function(err, service) {
    if (err) {
      let error = new Error(err)
      error.status = 500
      next(error)
      return
    } else if (service === null) {
      let error = new Error('could not validate CAS service : ' + serviceUrl)
      error.status = 400
      next(error)
      return
    }

    // TODO : Single Logout (SLO): Send here SAML messages to deconnect (TGT, service)

    res.redirect(config.logoutPage + "?redirect=" + encodeURIComponent(serviceUrl))
  })

}
