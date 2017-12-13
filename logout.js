'use strict'

/* logout */
module.exports = function (app, config, req, res, next) {
  let serviceUrl = req.query['service']

  if (req.accessToken) {
    eval('app.models.' + config.userModel).logout(req.accessToken.id,function(err) {
      let error = new Error(err || 'could not logout:' + req.accessToken.id)
      error.status = 500
      next(error)
      return
    })

    // TODO here : Single Logout (SLO): Send here SAML messages to deconnect (TGT, service)

  }

  if (!serviceUrl) {
    return res.redirect(config.logoutPage)
  } else {
    return res.redirect(serviceUrl)
  }
}
