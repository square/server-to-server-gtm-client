# Server to Server GTM Client

![logo](https://github.com/square/server-to-server-gtm-client/blob/main/img/logo-96.png)

A Server-Side Google Tag Manager client template which accepts HTTP POST requests and parses the request body into events. Useful when sending data to sGTM from another server such as your customer data platform.

## Recommendations

- When sending data to sGTM using this client, format your event structure to match Google's [Common Event Data](https://developers.google.com/tag-manager/serverside/common-event-data). This event API is used by most tags.

- When configuring tags in sGTM, Always include tag name under **Advanced Settings** in the tag configuration. This will aid in the tag error logging that this client supports.

![tag metadata form](https://github.com/square/server-to-server-gtm-client/blob/main/img/metadata.png)

- If also using a standard client from Google Marketing Platform, we recommend setting the Server-to-Server as a higher priority and requiring an authorization header. This will ensure requests intended for the Server-To-Server client are appropriately claimed and requests without an authorization header are then passed on to the next client to be evaluated. Be sure to check **Reject unauthorized requests** to ensure any requests that include an incorrect authorization header are still claimed and rejected by the Server-to-Server client.

![client priority](https://github.com/square/server-to-server-gtm-client/blob/main/img/priority.png)

![recommended auth settings](https://github.com/square/server-to-server-gtm-client/blob/main/img/require-token.png)



## Request Body Structure

Requests accepted by this client must have a JSON body that parses into an array of objects. Each object represents an event. Even if you are only sending a single event object, it must be contained in an array. Note that if you are sending multiple events, ensure your request payload size is smaller than 1mb. Any larger and Server-Side Google Tag Manager will return a 413 error.

Here is an example of a valid minimum request body.
```json
[
  {
    "event_name": "purchase"
  }
]
```

Another example with more fields and multiple events.
```json
[
  {
    "event_name": "purchase",
    "ip_override": "1.2.3.4",
    "language": "en_us"
  },
  {
    "event_name": "add_to_cart",
    "currency": "USD",
    "value": 7.77,
    "language": "en_es"
  },
  {
    "event_name": "login",
    "user_id": "FI4L21234",
    "viewport_size": "725x345",
    "user_data": {
      "email_address": "foo@example.com",
      "phone_number": "+15551234567",
      "first_name": "Jane",
      "last_name": "Doe"
    }
  }
]
```

Once the client is set up, you can test sending an event with cURL

```bash
curl -X POST https://sgtm.appspot.com \
  -H 'Content-Type: application/json' \
  -d '[{ "event_name": "purchase" }]'
```


## Authorization

This client template provides the option of requiring an authorization header for requests. This is an option for regular requests as well as preview requests. Add a bearer token in the client configuration UI. 

![client config](https://github.com/square/server-to-server-gtm-client/blob/main/img/authorization.png)

Then, include an authorization header in your requests:

### Production

```bash
curl -X POST https://sgtm.appspot.com \
  -H 'Authorization: Bearer prod-token' \
  -H 'Content-Type: application/json' \
  -d '[{ "event_name": "purchase" }]'
```


### Preview

If requiring an authorization header in preview mode, Be sure to also include the `X-Gtm-Server-Preview HTTP header` obtained from the preview UI by clicking **Send Requests Manually**.

![preview ui](https://github.com/square/server-to-server-gtm-client/blob/main/img/preview-ui.png)


```bash
curl -X POST https://sgtm.appspot.com \
  -H 'Authorization: Bearer preview-token' \
  -H 'x-gtm-server-preview: PASTE_PREVIEW_HEADER_HERE' \
  -H 'Content-Type: application/json' \
  -d '[{ "event_name": "purchase" }]'
```

## Type Checking

By default, this client type checks all [Common Event Data](https://developers.google.com/tag-manager/serverside/common-event-data) fields in each event. `event_name` is a required field, but all others are optional. Additional fields can be added or existing fields' types or required status can be overwritten in the **Type Checking** section of the client configuration UI.

## Primitive Types

If only adding checking for types `string`, `number`, or `boolean`, use the primitive type checking table. 

![primitive types table](https://github.com/square/server-to-server-gtm-client/blob/main/img/primitive.png)

## Structural Types

If type checking arrays or objects, use the structural types input. Enter a JSON string which will be added to the schema. The client configuration UI will not indicate if your JSON is valid or not; ensure this before entering a value.

See the examples below for how to add type checking.

![structural types table](https://github.com/square/server-to-server-gtm-client/blob/main/img/structural.png)


### Objects

The `value` field below contains the schema of the `locale` object. Any fields in the locale object can also be of type `array` or `object` and contain further nested schema.

```json
{
  "locale": {
    "type": "object",
    "required": false,
    "value": {
      "countryCode": { "type": "string", "required": false },
      "language": { "type": "string", "required": false },
    }
  }
}
```

### Array of primitives

The `value` field below contains the schema of the `categories` array. In this case, `categories` is an array of strings. Note that all elements in an array must be of the same type.

```json
{
  "categories": {
    "type": "array",
    "required": false,
    "value": {
      "type": "string",
      "required": false
    }
  }
}
```

### Array of objects

The `value` field below contains the schema of the `people` object. The `people` object has it's own schema specified in its `value` field.  Note that all objects in an array must be of the same schema.

```json
{
  "people": {
    "type": "array",
    "required": false,
    "value": {
      "type": "object",
      "required": false,
      "value": {
        "name": { "type": "string", "required": false },
        "height": { "type": "string", "required": false },
        "age": { "type": "number", "required": false }
      }
    }
  }
}
```

### Primitives

You can also use this input box to enter type checking for primitives, though it is easier to use the table above. Primitives do not require a `value` field, as there is no further nested type checking.

```json
{
  "timestamp": { "type": "string", "required": "true" }
}
```


## Client Response

This client will claim a request if it includes the correct authorization (or no authorization if none is required). If a request is accepted, the client will return one of the following responses.

### Response Codes

| Response Code | Error | Client Action |
|-|-|-|
| 200 | No error | claim request, respond success |
| 206 | A few tags or events fail but others succeed | claim request, respond partial success | 
| 400 | Invalid body, not json | claim request, respond error |
| 401 | Invalid authorization header | claim request, respond error |
| 422 | Type errors | claim request, respond error |
| 500 | Events fit the schema but all tags fail | claim request, respond error |


### Response Body

In addition, the client will include the following JSON response body

|Key|Type|Description|
|-|-|-|
|`status`|Integer|The status code|
|`error`|String|Error message. If the status of the response is 200, this field will be an empty string.|
|`invalidSchemaEvents`|Array of Integers|The list of events with an invalid schema. The integers point to the index of the event which failed. The order of the events is the same in the request and the response.|
|`fullyFailedTagEvents`|Array of Integers|The list of events where all tags that were triggered by the event failed. The integers point to the index of the event which failed. The order of the events is the same in the request and the response.|
|`partialFailedTagEvents`|Array of Integers|The list of events where some but not all tags that were triggered by the event failed. The integers point to the index of the event which failed. The order of the events is the same in the request and the response.|
|`failedTags`|Array of Objects|A list of objects where each object has two properties. `tagInfo`, the information about the tag that failed and `eventIndex`, the index of the event which failed.|


#### Example JSON

```json
{
  "status": 206,
  "error": "[GTM-XXXXXX][Server-to-Server Client][Error] - Partial Success: At least one event had the correct schema and at least one tag executed successfully. However, some failed.",
  "invalidSchemaEvents": [ 1, 3 ],
  "fullyFailedTagEvents": [ 0, 2 ],
  "partialFailedTagEvents": [ 6, 10 ],
  "failedTags": [
    {
      "tagInfo": {
        "name": "GA4",
        "executionTime": 1231,
        "id": 34,
        "status": "failure"
      },
      "eventIndex": 0
    }
  ]
}
```


---

Copyright 2021 Square, Inc.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
