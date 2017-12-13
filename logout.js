'use strict'

/* logout */
module.exports = function (app, config, req, res, next) {
  let serviceUrl = req.query['service']

  if (req.accessToken) {
    eval('app.models.' +config.userModel).logout(req.accessToken.id, next)
    // TODO here : Single Logout (SLO): Send here SAML messages to deconnect (TGT, service)
  }

  if (!serviceUrl) {
    return res.redirect(config.logoutPage)
  } else {
    return res.redirect(serviceUrl)
  }
}
