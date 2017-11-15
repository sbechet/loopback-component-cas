# loopback-component-cas

This component provides a loopback native implementation of a [CAS Protocol Specification](https://apereo.github.io/cas/5.0.x/protocol/CAS-Protocol-Specification.html).

Use it with [loopback](https://github.com/strongloop/loopback)

* [SAML](https://en.wikipedia.org/wiki/Security_Assertion_Markup_Language)
* [SAML v1.1](https://en.wikipedia.org/wiki/SAML_1.1)

DONE : CASv1, CASv2, CASv3, SAMLv1.1

TODO : SLO logout, SAMLv2, Regression Test

## Installation

* `npm i loopback-component-cas`
* Don't forget to add `express-xml-bodyparser` to your project

## Configuration

### Application Model

You MUST use `application` model to store RegExp url field.

### User Model

User model MUST have a `profile` entry with user JSON profile AND `uuid` for each user.

Example in `common/models/account.json`:

```json
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

### AccessToken model

In `model-config.json`, add appId field and modify belongsTo relation to use Account.

```json
"AccessToken": {
  ...
  "relations": {
    "application": {
      "type": "belongsTo",
      "model": "Application",
      "foreignKey": "appId"
    },
    "user": {
      "type": "belongsTo",
      "model": "Account",
      "foreignKey": "userId"
    }
  }
}
```

### login and logout WEB Pages

CAS redirect on theses pages if necessary.

#### login Page parameter

* `redirect` [OPTIONAL] - the full URL-encoded cas login service as described in section 2.2 of RFC 3986 (ex. ${CASServerUrl}/cas/login?service=serviceUrl)

#### logout Page parameter

* `redirect` [OPTIONAL] - the full URL-encoded service URL as described in section 2.2 of RFC 3986

### `token` and `express-xml-bodyparser`

In `server/middleware.json`, add token in request and express-xml-bodyparser

```json
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
}
```

## Component configuration

In `server/component-config.json`

```json
"./components/loopback-component-cas": {
  "serviceTicketTTL": 60000,
  "loginPage": "/account/signin",
  "logoutPage": "/account/signout",
  "userModel": "User",
  "attributes": [
    "authenticationDate",
    "longTermAuthenticationRequestTokenUsed",
    "isFromNewLogin",
    "memberOf",
    "email",
    "displayName",
    "firstname",
    "lastname",
    "languages",
    "userId",
    "uuid"
  ],
  "loginCallback": "loginCallback"
}
```

`${userModel}.uuid` is always injected

Attributes may comply with [contact schema](https://tools.ietf.org/html/draft-smarr-vcarddav-portable-contacts-00)
established by [Joseph Smarr][schema-author].

Attributes can be any key from `${userModel}.profile`.

If optional `loginCallback(req, service, user)` exist, `loopback-component-cas` call it when login occure.

### Specific case

* `email` come from model `${userModel}.email`
* `firstname` come from  `${userModel}.profile.name.givenName`
* `lastname`  come from  `${userModel}.profile.name.familyName`
