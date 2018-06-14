'use strict'

/*

Application.url field can now contains regexp.
So you can answer regexp applications like https?://*.dom.ain.*

 */
module.exports.findService = function findService(app, serviceUrl, cb) {
  app.models.Application.find({fields: {id: true, name: true, url: true}, where: { authenticationEnabled: true } }, function(err, services) {
    if (err) {
      return cb(err)
    }
    for (let service of services) {
      let r = new RegExp(service.url)
      if (r.test(serviceUrl)) {
        return cb(null, service)
      }
    }
    let error = new Error('Could not find service for ' + serviceUrl)
    error.status = 401
    return cb(error)
  })
}
