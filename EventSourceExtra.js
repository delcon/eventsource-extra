
/*
 credits: https://github.com/mpetazzoni/sse.js
*/



/**
 * EventSource replacement with some extra functionality
 */
class EventSourceExtra {

   /**
    * Creates a new instance of the SSE browser
    * @param {string} url url to fetch
    * @param {object} options fetch options
    * @param {object} options.method fetch method GET | POST | DELETE | PATCH
    * @param {*} options.payload payload to send
    * @param {object} options.headers header to apply
    * @param {boolean} options.withCredentials if credentials should be included in CORS requests default false
    * @param {boolean} options.debug debug logging
    */

   constructor(url, options = {}) {

      this.INITIALIZING = -1;
      this.CONNECTING = 0;
      this.OPEN = 1;
      this.CLOSED = 2;

      this.url = url;

      this.headers = options.headers || {};
      this.payload = options.payload !== undefined ? options.payload : '';
      this.method = options.method || (this.payload && 'POST' || 'GET');
      this.withCredentials = !!options.withCredentials;
      this.debug = options.debug || false; // debug logging

      this.FIELD_SEPARATOR = ':';
      this.listeners = {};
      this.dataListeners = {};

      this.xhr = null;
      this.readyState = this.INITIALIZING;
      this.progress = 0;
      this.chunk = '';
      this.retry = null;

   }

   addEventListener(type, listener) {
      if (this.listeners[type] === undefined) {
         this.listeners[type] = [];
      }

      if (this.listeners[type].indexOf(listener) === -1) {
         this.listeners[type].push(listener);
      }
   }

   removeEventListener(type, listener) {
      if (this.listeners[type] === undefined) {
         return;
      }

      var filtered = [];
      this.listeners[type].forEach(function (element) {
         if (element !== listener) {
            filtered.push(element);
         }
      });
      if (filtered.length === 0) {
         delete this.listeners[type];
      } else {
         this.listeners[type] = filtered;
      }
   }

   /**
    * Event listener that emits data field only
    * JSON data is parsed 
    * use addEventListener for complete event
    * @param {string} type event name
    * @param {function} listener event function to execute
    */
   on(type, listener) {
      if (this.dataListeners[type] === undefined) {
         this.dataListeners[type] = [];
      }

      if (this.dataListeners[type].indexOf(listener) === -1) {
         this.dataListeners[type].push(listener);
      }
   }

   /**
    * Removes E
    * @param {string} type event name
    * @param {function | undefined} listener listener function to remove, if undefined removes all listeners
    */
   off(type, listener) {
      if (!type) return;
      if (this.dataListeners[type] === undefined) return;

      // delete all
      if (!listener) {
         delete this.dataListeners[type];
      }

      // remove
      let idx = this.dataListeners[type].indexOf(element => {
         return element !== listener
      });
      if (idx > -1) this.dataListeners[type].splice(idx, 1)
      // cleanup
      if (this.dataListeners[type].length === 0) {
         delete this.dataListeners[type];
      }
   }

   _dispatchEvent(e) {
      if (!e) return
      e.source = this;

      if (this.debug) {
         console.log(e)
      }

      // retry handler
      if (typeof e.retry !== 'undefined') {
         this.retry = e.retry
      }

      // filter empty data messages
      if (e.type == 'message' && e.data == '') return

      // onhandler
      var onHandler = 'on' + e.type;
      if (this[onHandler]) {
         this[onHandler].call(this, e);
      }
      // message => data emit
      if (e.type == 'message' && this.ondata) {
         this['ondata'].call(this, e);
      }

      // emit event
      if (this.listeners[e.type]) {
         // addEventListener bindings
         this.listeners[e.type].forEach(listener => {
            listener(e)
         })
      }
      if (this.dataListeners[e.type]) {
         // on(eventname) bindings emit data only
         this.dataListeners[e.type].forEach(listener => {
            let data
            try {
               data = JSON.parse(e.data)
            } catch (error) {
               data = e.data
            }
            listener(data || e.message)
         })
      }
      // message => data emit
      if (e.type == 'message' && this.listeners.data) {
         // addEventListener bindings
         this.listeners['data'].forEach(listener => {
            listener(e)
         })

      }
      if (e.type == 'message' && this.dataListeners.data) {
         // on(eventname) bindings emit data only
         this.dataListeners['data'].forEach(listener => {
            let data
            try {
               data = JSON.parse(e.data)
            } catch (error) {
               data = e.data
            }
            listener(data || e.message)
         })
      }

      return true;
   }

   _setReadyState(state) {

      var event = new CustomEvent('readystatechange');
      event.readyState = state;
      this.readyState = state;
      this._dispatchEvent(event);
   }

   _onStreamFailure(e) {

      let event = new CustomEvent('error')
      event.cause = e.type
      event.message = 'stream failure'
      event.retry = this.retry || false;
      this._dispatchEvent(event);

      if (this.retry) {
         setTimeout(() => {
            this.stream()
         }, this.retry)
      } else {
         this.close();
      }
   }

   _onStreamAbort(e) {

      let event = new CustomEvent('error')
      event.message = 'stream abort'
      event.retry = this.retry || false;
      this._dispatchEvent(event);

      this.close();
   }

   _onStreamProgress(e) {
      if (!this.xhr) {
         return;
      }

      if (this.xhr.status !== 200) {
         this._onStreamFailure(e);
         return;
      }

      if (this.readyState == this.CONNECTING) {
         this._dispatchEvent(new CustomEvent('open'));
         this._setReadyState(this.OPEN);
      }

      var data = this.xhr.responseText.substring(this.progress);

      this.progress += data.length;
      data.split(/(\r\n|\r|\n){2}/g).forEach(function (part) {
         if (part.trim().length === 0) {
            this._dispatchEvent(this._parseEventChunk(this.chunk.trim()));
            this.chunk = '';
         } else {
            this.chunk += part;
         }
      }.bind(this));
   }

   _onStreamLoaded(e) {
      this._onStreamProgress(e);

      // Parse the last chunk.
      this._dispatchEvent(this._parseEventChunk(this.chunk));
      this.chunk = '';
   }

   /**
    * Parse a received SSE event chunk into a constructed event object.
    */
   _parseEventChunk(chunk) {
      if (!chunk || chunk.length === 0) {
         return null;
      }

      var e = { 'id': null, 'retry': undefined, 'data': '', 'event': 'message' };
      chunk.split(/\n|\r\n|\r/).forEach(function (line) {
         line = line.trimRight();
         var index = line.indexOf(this.FIELD_SEPARATOR);
         if (index <= 0) {
            // Line was either empty, or started with a separator and is a comment.
            // Either way, ignore.
            return;
         }

         var field = line.substring(0, index);
         if (!(field in e)) {
            return;
         }

         var value = line.substring(index + 1).trimLeft();
         if (field === 'data') {
            e[field] += value;
         } else {
            e[field] = value;
         }
      }.bind(this));

      var event = new CustomEvent(e.event);
      event.data = e.data;
      event.id = e.id;
      if (e.retry !== undefined) {
         event.retry = isNaN(e.retry) ? null : parseInt(e.retry);
      }

      return event;
   }

   _checkStreamClosed() {
      if (!this.xhr) {
         return;
      }

      if (this.xhr.readyState === XMLHttpRequest.DONE) {
         this._setReadyState(this.CLOSED);
      }
   }

   /**
    * 
    * @param {string} url url to fetch
    * @param {object} options fetch options
    * @param {object} options.method fetch method GET | POST | DELETE | PATCH
    * @param {*} options.payload payload to send
    * @param {object} options.headers header to apply
    * @param {boolean} options.withCredentials if credentials should be included in CORS requests default false
    * @param {boolean} options.debug debug logging
    */
   fetch(url, options = {}) {
      if (this.readyState === this.CONNECTING || this.readyState === this.OPEN) {
         throw new Error('Connection in use, wait for close, or close before new fetch')
      }

      this.headers = options.headers || {};
      this.withCredentials = options.withCredentials || false;
      this.method = options.method || 'GET';
      this.payload = options.payload || '';
      this.debug = options.debug || this.debug || false;
      this.url = url;

      this.stream()
   }

   stream() {
      if (this.readyState === this.CONNECTING || this.readyState === this.OPEN) {
         throw new Error('Connection in use, wait for close, or close before new stream')
      }
      this._setReadyState(this.CONNECTING);

      this.xhr = new XMLHttpRequest();
      this.xhr.addEventListener('progress', this._onStreamProgress.bind(this));
      this.xhr.addEventListener('load', this._onStreamLoaded.bind(this));
      this.xhr.addEventListener('readystatechange', this._checkStreamClosed.bind(this));
      this.xhr.addEventListener('error', this._onStreamFailure.bind(this));
      this.xhr.addEventListener('abort', this._onStreamAbort.bind(this));
      this.xhr.open(this.method, this.url);
      for (var header in this.headers) {
         this.xhr.setRequestHeader(header, this.headers[header]);
      }
      this.xhr.withCredentials = this.withCredentials;
      this.xhr.send(this.payload);

   }

   close() {
      if (this.readyState === this.CLOSED) {
         return;
      }

      this.xhr.abort();
      this.xhr = null;
      this._setReadyState(this.CLOSED);
   }

}