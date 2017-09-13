# loopback-component-cas

This component provides a loopback native implementation of a [CAS Protocol Specification](https://apereo.github.io/cas/5.0.x/protocol/CAS-Protocol-Specification.html).

Use it with [loopback](https://github.com/strongloop/loopback)

* [SAML](https://en.wikipedia.org/wiki/Security_Assertion_Markup_Language)
* [SAML v1.1](https://en.wikipedia.org/wiki/SAML_1.1)

DONE : CASv1, CASv2, CASv3, SAMLv1.1
TODO : SLO logout, SAMLv2

Note : some `xmlTemplates/` files coming from [https://github.com/jscas/cas-server](jscas).

## How to generate your own SSL certificate

```
  $ cd server/server/private
  $ openssl genrsa -out privatekey.pem 1024
  $ openssl req -new -key privatekey.pem -out certrequest.csr
  $ openssl x509 -req -in certrequest.csr -signkey privatekey.pem -out certificate.pem
```

## Installation

* `npm i loopback-component-cas`
* Don't forget to add `express-xml-bodyparser` to your project

## Configuration

### User Model

User model MUST have a `profile` entry with user JSON profile AND `uuid` for each user.

Example:

```
{
  "name": "Account",
  "base": "User",
  "idInjection": true,
  "options": {
    "validateUpsert": true
  },
  "properties": {
    "uuid": {
      "type": "string",
      "required": true
    },
    "profile": {
      "type": "string"
    }
  },
  "validations": [],
  "relations": {},
  "acls": [],
  "methods": {}
}
```

### login and logout WEB Pages

CAS redirect on theses pages if necessary.

#### login Page parameter

* redirect [OPTIONAL] - the full URL-encoded cas login service as described in section 2.2 of RFC 3986 (ex. ${CASServerUrl}/cas/login?service=serviceUrl)

#### logout Page parameter

* redirect [OPTIONAL] - the full URL-encoded service URL as described in section 2.2 of RFC 3986

### `token` and `express-xml-bodyparser`

In `server/middleware.json`, add token in request and express-xml-bodyparser

```
"auth": {
  "loopback#token": {}
},
"parse": {
  "express-xml-bodyparser": {
    "params": {
     "normalize": true,
     "normalizeTags": false,
     "explicitArray": false
    }
  }
},
```

## Component configuration

In `server/component-config.json`

```
"./components/loopback-component-cas": {
  "serviceTicketTTL": 60000,
  "loginPage": "/account/signin",
  "logoutPage": "/account/signout",
  "userModel": "User",
  "attributes": {
    "standardAttributes": [ "authenticationDate", "longTermAuthenticationRequestTokenUsed", "isFromNewLogin", "memberOf" ],
    "extraAttributes": ["Fullname", "email", ...]
  }
```

* extraAttributes can be any key from `${userModel}.profile`.
* `${userModel}.uuid` is always injected
