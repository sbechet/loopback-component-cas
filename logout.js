'use strict'

const re_weburl = require('./regex-weburl.js')

/* logout */
module.exports = function (app, config, req, res, next) {
  let serviceUrl = req.query['service']

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

  // if != production "http://localhost" allowed
  if (process.env.NODE_ENV === 'production') {
    // SQL injection prevention
    if (!re_weburl.test(serviceUrl)) {
      return res.redirect(config.logoutPage)
    }
  }

  // validate service
  app.models.Application.findOne({ where: { url: serviceUrl } },function(err, service) {
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
