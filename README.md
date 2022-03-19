# EventSourceExtra.js

`EventSourceExtra.js` is a Javascript `EventSource` replacement designed
to consume Server-Sent Events (SSE) streams with more options than the standard `EventSource`.  
The main limitation of
`EventSource` are: 
- does not support POST DELETE PATCH requests
- no payload can be added to the request
- custom headers can not be added to requests


This package is designed to provide a usable replacement to
`EventSource` that makes all of this possible: `EventSourceExtra`. It is a fully
compatible `EventSource` polyfill so you should be able to:

```js
EventSource = EventSourceExtra;
```

## Basic usage

Installation:
```shell
npm install eventsource-extra
# or
git clone https://github.com/delcon/eventsource-extra .
```
 
The most simple way to use `EventSourceExtra` is to use it as documented as an `EventSource` replacement.

Create the `EventSourceExtra` object, attach
one or more listeners, and activate the stream:

```js
var source = new EventSourceExtra(url);

// subscribe by addEventListener:
source.addEventListener('message', function(e) {
  console.log(e);
});

source.stream();
```
For Documentation refer to: , documented here:  
https://developer.mozilla.org/en-US/docs/Web/API/EventSource
  
## Extra API
In addition to the standard API you have the following functions and apis:
  
### Events

`EventSourceExtra` implements the `EventTarget` interface (just like `EventSource`)
and emits fully constructed `Event` objects. The type of the event
corresponds to the Server-Sent Event's _name_.

The sse events have the following fields:

- `event`: the event type, default is `message`
- `id`: the event ID, if present; `null` otherwise
- `data`: the event data, unparsed

In addition to Server-Sent Events`EventSourceExtra`, will emit the following events:

- `open`, when the first block of data is received from the event stream;
- `error`, if an error occurs while making the request;
- `readystatechange`, to notify of a change in the ready state of the
  event source.
  
Additional Extra Event Features by EventSourceExtra:
- Subscribe by `source.on('eventname', function(data){ ... })` to receive data only instead of the whole event
- Subscribe by `source.on('data', function(data){ ... })` to receive all default events / messages
- If you subscribe by `source.on(<eventname>, ... )` the data will be JSON - parsed if sent as JSON.
- Debug events by providing `options.debug = true` to see all Server-Sent and `EventSourceExtra` events logged to `console`. This is very useful for development. 


### Example: listening for specific event types

```js
var source = new EventSourceExtra(url);

// subscribe by addEventListener:
source.addEventListener('status', function(e) {
  console.log('System status is now: ' + e.data);
});

// subscribe by on<eventname>:
source.onstatus = function(e) { 
  console.log('System status is now: ' + e.data);
};

// subscribe to data only (parsed):
source.on('status', function(data){
  console.log('System status is now: ' + data);
});

source.stream();
```
## Sendig request
There are different ways to send requests:
- use the `EventSource` api: `const sse = new EventSourceExtra(url, options ); sse.stram()`
- use the added extra fetch api: `const sse = new EventSourceExtra(); sse.fetch(url, options )`


### Request options
The `options` used in the constructor `new EventSourceExtra(url, options )`or used by calling `sse.fetch(url, 'options')` behave the same. 

```js
const options = {
  method: 'POST', // optional, GET POST PATCH DELETE, default is GET
  headers: {'Authorization': 'Bearer secret-key'}}, // optional
  payload: '{ "foo" : "bar" }', // optional, String, FromData, Buffer ...
  withCredentials: true // default is false
}
```

### Options reference

| Name              | Description |
| ----------------- | ----------- |
| `headers`         | A map of additional headers to use on the HTTP request |
| `method`          | Override HTTP method (defaults to `GET`, unless a payload is given, in which case it defaults to `POST`) |
| `payload`         | An optional request payload to sent with the request |
| `withCredentials` | If set to `true`, CORS requests will be set to include credentials |

## Examples
- cd to `examples`, `npm install` then `node server` to run express

## Credits

Credits to https://github.com/mpetazzoni/sse.js, this work is an extension and partially rewrite of his library.
