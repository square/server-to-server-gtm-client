/*
Copyright 2021 Square Inc.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

/* eslint-disable eslint-comments/disable-enable-pair */
/* eslint-disable prefer-template */
/* eslint-disable object-shorthand */
/* global data */


const JSON = require('JSON');
const runContainer = require('runContainer');
const claimRequest = require('claimRequest');
const returnResponse = require('returnResponse');
const logToConsole = require('logToConsole');
const getRequestBody = require('getRequestBody');
const getRequestHeader = require('getRequestHeader');
const getContainerVersion = require('getContainerVersion');
const addEventCallback = require('addEventCallback');
const setResponseBody = require('setResponseBody');
const setResponseStatus = require('setResponseStatus');

const containerVersion = getContainerVersion();
const previewMode = containerVersion.previewMode;
const containerId = containerVersion.containerId;

const auth = getRequestHeader('Authorization');
const prodAuthCondition = !data.useBearerToken || auth === 'Bearer ' + data.bearerToken;
const previewAuthCondition = !data.usePreviewBearerToken || auth === 'Bearer ' + data.previewBearerToken;

let numSchemaErr = 0;
const invalidSchemaEvents = [];
const fullyFailedTagEvents = [];
const partialFailedTagEvents = [];
const failedTags = [];

/** **** Code execution starts here ******/

// IIFE to take advantage of return statement to end execution
(function runClient(){

  const validAuth = prodAuthCondition || (previewAuthCondition && previewMode);

  if (!validAuth) {

    if (data.rejectUnauthorized && typeof auth === 'string') {
      claimRequest();
      const error = formatAndLogErrorMessage('ERR_AUTH');
      respond(401, error);
    }

    return;
  }

  claimRequest();

  const bodyStr = getRequestBody();
  if (!bodyStr) {
    const error = formatAndLogErrorMessage('ERR_BODY_NO_JSON');
    respond(400, error);
    return;
  }

  const events = JSON.parse(bodyStr);
  if (!events || !isArray(events)) {
    const error = formatAndLogErrorMessage('ERR_BODY_ARR', { actualType: typeof events });
    respond(422, error);
    return;
  }

  // edge case for if events in payload are empty
  // unlikely to occur, but this is considered a success
  if (events.length === 0) {
    respond(200);
    return;
  }

  processEvents(
    events,
    function finishProcessing(
      totalTags,
      tagSuccess,
      tagFailure,
      eventSchemaSuccess,
      eventSchemaFailure
    ) {
      if (tagFailure === 0 && eventSchemaFailure === 0) {
        respond(200);
        return;
      }

      if (eventSchemaSuccess === 0) {
        const error = formatAndLogErrorMessage('ERR_EVENT_SCHEMA');
        respond(422, error);
        return;
      }

      if (tagSuccess === 0 && totalTags > 0) {
        const error = formatAndLogErrorMessage('ERR_TAG', { numTriggered: totalTags, failedTags: failedTags });
        respond(500, error);
        return;
      }

      const error = formatAndLogErrorMessage(
        'ERR_PARTIAL_CONTENT',
        {
          totalTags: totalTags,
          tagSuccess: tagSuccess,
          tagFailure: tagFailure,
          failedTags: failedTags,
          eventSchemaSuccess: eventSchemaSuccess,
          eventSchemaFailure: eventSchemaFailure,
        }
      );
      respond(206, error);
    }
  );
})();


/** ********* Helper methods  ***********/

function respond(statusCode, errorMessage) {
  const body = JSON.stringify({
    status: statusCode,
    error: errorMessage || '',
    invalidSchemaEvents: invalidSchemaEvents,
    fullyFailedTagEvents: fullyFailedTagEvents,
    partialFailedTagEvents: partialFailedTagEvents,
    failedTags: failedTags,
  });

  setResponseStatus(statusCode);
  setResponseBody(body);
  returnResponse();
}

// Async process method
function processEvents(events, finishProcessing) {
  const numEvents = events.length;
  let eventsCompleted = 0;
  let countTagSuccess = 0;
  let countTagFailure = 0;
  let countTotalTags = 0;
  let countEventSchemaSuccess = 0;
  let countEventSchemaFailure = 0;

  events.forEach((event, eventIndex) => {
    if (eventMatchesSchema(event, eventIndex)) {
      countEventSchemaSuccess++;
    } else {
      countEventSchemaFailure++;
      invalidSchemaEvents.push(eventIndex);

      eventsCompleted++;
      if (numEvents === eventsCompleted) {
        finishProcessing(
          countTotalTags,
          countTagSuccess,
          countTagFailure,
          countEventSchemaSuccess,
          countEventSchemaFailure
        );
      }

      return;
    }

    runContainer(event, /* onComplete= */ (bindToEvent) => {
      bindToEvent(addEventCallback)((containerId, eventData) => {
        let tagFailForEvent = 0;

        eventData.tags.forEach(tag => {
          countTotalTags++;
          if (tag.status === 'success') {
            countTagSuccess++;
          } else if (tag.status === 'failure') {
            failedTags.push({
              tagInfo: tag,
              eventIndex: eventIndex,
            });
            countTagFailure++;
            tagFailForEvent++;
          }
        });

        if (eventData.tags.length > 0) {
          // if tags fail, put event in the appropriate bucket
          if (tagFailForEvent === eventData.tags.length) {
            fullyFailedTagEvents.push(eventIndex);
            logToConsole('All ' + tagFailForEvent + ' tags failed for the ' + event.event_name + ' event');
          } else if (tagFailForEvent > 0) {
            partialFailedTagEvents.push(eventIndex);
            logToConsole(tagFailForEvent + ' / ' + eventData.tags.length + ' tags failed for the "' + event.event_name + '" event');
          }
        }

        eventsCompleted++;
        logPreview('"' + event.event_name + '" event successfully processed');
        logPreview(eventsCompleted + ' / ' + numEvents + ' events processed');

        if (numEvents === eventsCompleted) {
          finishProcessing(
            countTotalTags,
            countTagSuccess,
            countTagFailure,
            countEventSchemaSuccess,
            countEventSchemaFailure
          );
        }
      });
    });
  });
}


/** ******* Schema Definition *********/

function eventMatchesSchema(value, eventIndex) {
  const eventSchema = {
    type: 'object',
    required: 'true',
    value: {
      client_id: { type: 'string', required: false },
      event_name: { type: 'string', required: true },
      ip_override: { type: 'string', required: false },
      language: { type: 'string', required: false },
      page_encoding: { type: 'string', required: false },
      page_hostname: { type: 'string', required: false },
      page_location: { type: 'string', required: false },
      page_path: { type: 'string', required: false },
      page_referrer: { type: 'string', required: false },
      page_title: { type: 'string', required: false },
      screen_resolution: { type: 'string', required: false },
      user_agent: { type: 'string', required: false },
      user_data: {
        type: 'object',
        required: false,
        value: {
          email_address: { type: 'string', required: false },
          phone_number: { type: 'string', required: false },
          first_name: { type: 'string', required: false },
          last_name: { type: 'string', required: false },
          street: { type: 'string', required: false },
          city: { type: 'string', required: false },
          region: { type: 'string', required: false },
          postal_code: { type: 'string', required: false },
          country: { type: 'string', required: false },
        }
      },
      user_id: { type: 'string', required: false },
      viewport_size: { type: 'string', required: false },
    }
  };

  if (isArray(data.primitiveTypes)) {
    data.primitiveTypes.forEach(field => {
      eventSchema.value[field.field] = { type: field.type, required: field.required };
    });
  }

  if (data.structuralTypes) {
    const fields = JSON.parse(data.structuralTypes);
    if (fields) {
      for (const key in fields) {
        eventSchema.value[key] = fields[key];
      }
    }
  }

  return validate(value, eventSchema, 'events[' + eventIndex + ']');
}


/** ****** Schematizing methods  *******/

function validate(inputVal, schema, path) {
  const expectedType = schema.type;
  const required = schema.required;
  const schemaVal = schema.value;

  const actualType = typeof inputVal;

  if (isNullOrUndef(inputVal)) {
    if (required) {
      formatAndLogErrorMessage('ERR_MISSING', { value: inputVal, name: path });
      return false;
    } else {
      return true;
    }
  }

  if (isArray(inputVal) && expectedType === 'array') {
    const results = inputVal.map((ele, i) => {
      return validate(ele, schemaVal, path + '[' + i + ']');
    });
    return allValid(results);
  }

  if (actualType !== expectedType) {
    formatAndLogErrorMessage('ERR_SCHEMA', {
      value: inputVal,
      expectedType: expectedType,
      actualType: isArray(inputVal) ? 'array' : actualType,
      name: path,
      required: required
    });
    return false;
  }

  if (expectedType === 'object') {
    const results = [];
    for (const keyName in schemaVal) {
      results.push(validate(inputVal[keyName], schemaVal[keyName], path + '.' + keyName));
    }
    return allValid(results);
  }

  return true;
}

function allValid(arr) {
  return arr.reduce((acc, val) => acc && val, true);
}

function isNullOrUndef(value) {
  return value === undefined || value === null;
}

// built in Array.isArray method is not available in Sandboxed JS
function isArray(value) {
  return typeof value === 'object' && typeof value.length === 'number';
}


/** ********* Error handling and logging ***********/

function formatAndLogErrorMessage(errorCode, errorData) {
  const errorMessage = generateErrorMessage(errorCode, errorData);
  const fullErrorMessage = '[' + containerId + '][Server-to-Server Client][Error] - ' + errorMessage;
  logToConsole(fullErrorMessage);
  return fullErrorMessage;
}

function generateErrorMessage(name, errData) {
  const complexErrors = {
    ERR_TAG: formatTagError,
    ERR_SCHEMA: formatSchemaError,
    ERR_MISSING: formatMissingError,
    ERR_BODY_ARR: formatBodyError,
    ERR_PARTIAL_CONTENT: formatPartialContentError
  };

  if (complexErrors[name]) {
    return complexErrors[name](errData);
  }

  const simpleErrors = {
    ERR_AUTH: 'Authorization: The authorization is invalid. Ensure you are including the correct authorization header in your request.',
    ERR_BODY_NO_JSON: 'Body: The request body is missing. Verify your request body is valid JSON.',
    ERR_EVENT_SCHEMA: 'Events: No events in the request body fit the schema. Verify your request matches the common event data schema https://developers.google.com/tag-manager/serverside/common-event-data or the type checking schema you defined in the client configuration.'
  };

  if (!simpleErrors[name]) {
    return 'Error message is unspecified';
  }

  return simpleErrors[name];
}

function formatPartialContentError(errData) {
  return 'Partial Success: At least one event had the correct schema and at least one tag executed successfully. ' +
  'However, some failed:\n' +
  errData.eventSchemaSuccess + ' tag' + formatPlural(errData.eventSchemaSuccess) + 'matched the event schema.\n' +
  errData.eventSchemaFailure + ' tag' + formatPlural(errData.eventSchemaFailure) + 'did not match the event schema.\n' +
  errData.totalTags + ' tag' + formatPlural(errData.totalTags) + (errData.totalTags === 1 ? 'was ' : 'were ') + 'triggered in total.\n' +
  errData.tagSuccess + ' tag' + formatPlural(errData.tagSuccess) + 'succeeded in sending.\n' +
  errData.tagFailure + ' tag' + formatPlural(errData.tagFailure) + 'failed in sending.\n' +
  'Verify your request matches the common event data schema https://developers.google.com/tag-manager/serverside/common-event-data or the type checking schema you defined in the client configuration.\nFailed Tags Info: ' +
  JSON.stringify(errData.failedTags);
}

function formatTagError(errData) {
  return 'Tags: ' + errData.numTriggered + ' tag' + formatPlural(errData.numTriggered) +
  (errData.numTriggered === 1 ? 'was ' : 'were ') + 'triggered. ' +
  '0 tags succeeded. Check the logic in your tags to determine why they failed.\nFailed Tags Info: ' + JSON.stringify(errData.failedTags);
}

function formatBodyError(errData) {
  numSchemaErr++;

  return 'Body: The request body is not of type array. ' +
  'Instead received a type of "' + errData.actualType + '" ' +
  'The JSON may be invalid. The sGTM client expects an array of event objects.\n' +
  'Type error #' + numSchemaErr;
}

function formatSchemaError(errData) {
  numSchemaErr++;

  return 'Schema: The "' + errData.name + '" field was not of expected type "' + errData.expectedType + '". ' +
  'Instead received the value type "' + errData.actualType + '". ' +
  'This field is' + (errData.required ? ' ' : ' not ') + 'required.\n' +
  'The following value was received: ' + JSON.stringify(errData.value) + '\n' +
  'Type error #' + numSchemaErr;
}

function formatMissingError(errData) {
  numSchemaErr++;

  return 'Missing Field: The "' + errData.name + '" value is required but was not found. ' +
  'Instead received a value of "' + errData.value + '"\n Type error #' + numSchemaErr;
}

function formatPlural(num) {
  return num === 1 ? ' ' : 's ';
}

function logPreview(log) {
  if (previewMode) {
    logToConsole('[' + containerId + '][Server-to-Server Client][Info] - ' + log);
  }
}
