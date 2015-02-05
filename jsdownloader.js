/*
 * Javascript file downloader, which supports multiple files and folders.
 * It will download file directly if only one file exists and will download as a zip file when multiple files choosed.
 * @author github.com/miller
 */

var JSDownloader = (function(){

	var xhrQueue = [];
	var taskQueue = [];
	var fn = function(){};
	var zip;

	var Downloader = {
		/**
		 * @property maxRequests
		 * Maximum count of simutaneous request, default to 1
		 */
		maxRequests: 1,

		/**
		 * @method task
		 * Add download target to task
		 * @param fileSrc {string} target's server url
		 * @param fileName {string} target's file name
		 * @param fileFolder {string} OPTIONAL only valid on downloading multiple files, then files will be zipped and place the file in specified folder.
		 * @param fileContentType {string} OPTIONAL mimetype of the target, JSDownloader will use xhr's getResponseHeader to get the type when ignored.
		 * @param isCORS {boolean} OPTIONAL if the file is addressed on the different domain from the one the request sent, you should set it TRUE.
		 * @return [object] instance of TASK
		 */
		task: function(fileSrc, fileName, fileFolder, fileContentType, isCORS) {
			var task = new Task(fileSrc, fileName, fileFolder, fileContentType, isCORS);
			taskQueue.push(task);

			return task;
		},

		/**
		 * @method process
		 * Manually call this method after all files have been pushed into task.
		 *
		 */
		process: function() {
			var allDone = true;
			var batch = taskQueue.length > 1;

			taskQueue.forEach(function(task){
				if (task.state === 'ready') {
					allDone = false;
					zip = null;

					if (xhrQueue.length < Downloader.maxRequests) {
						download(task, batch);
					}
				}
				else if (task.state === 'loading') {
					allDone = false;
				}
				else if (task.state === 'loaded' && batch) {
					zip = zip || new JSZip();

					if (task.folder) {
						zip.folder(task.folder).file(task.name, task.buffer);
					}
					else {
						zip.file(task.name, task.buffer);
					}
				}
			});

			if (allDone && taskQueue.length) {
				if (!batch) {
					saveAs(taskQueue[0].blob, taskQueue[0].name);
				}
				else if (batch && zip) {
					saveAs(zip.generate({type:'blob'}) ,'agroup.zip');
				}

				this.clear();
			}
		},

		/**
		 * @method clear
		 * Clear all queues.
		 *
		 */
		clear: function() {
			xhrQueue = [];
			taskQueue = [];
			zip = null;
		}
	};

	var TASK_ID = 0;

	function Task (fileSrc, fileName, fileFolder, fileContentType, isCORS) {
		this.src = fileSrc;
		this.folder = fileFolder || '';
		this.name = fileName || '';
		this.contentType = fileContentType || '';
		this.cors = (typeof isCORS === 'undefined' ? false : isCORS);
		this.id = ++TASK_ID;
		this.state = 'ready';
		this.zipped = false;

		var me = this;

		//Events
		//onprogress onstart oncomplete onsuccess onerror
		var events = ['start', 'progress', 'success', 'error', 'complete'];
		events.forEach(function(evt){
			me['on' + evt] = fn;
		});
	}

	function createXHR(method, url, cors) {
		var xhr = new XMLHttpRequest();

		if ('withCredentials' in xhr || cors === false) {
			// XHR for Chrome/Firefox/Opera/Safari.
			xhr.open(method, url, true);
		} else if (typeof XDomainRequest != 'undefined') {
			// XDomainRequest for IE.
			xhr = new XDomainRequest();
			xhr.open(method, url);
		} else {
			// CORS not supported.
			xhr = null;
		}
		return xhr;
	}

	function download(task, batch) {
		var xhr = createXHR('GET', task.src, task.cors);
		xhrQueue.push(xhr);
		xhr.responseType = batch ? 'arraybuffer' : 'blob';

		xhr.onload = function(e) {

		  if (this.status == 200) {

		  	var contentType = task.contentType || xhr.getResponseHeader('Content-Type');
		    
		    if (!batch) {
		    	var blob = new Blob([this.response], {type: contentType});
		    	task.blob = blob;
		    }
		    else {
		    	var uInt8Array = new Uint8Array(this.response);
		    	task.buffer = uInt8Array;
		    }

		    task.state = 'loaded';
		    task.onsuccess(xhr);
		    task.oncomplete();

		    xhrQueue.splice(xhrQueue.indexOf(xhr), 1);
		    Downloader.process();
		  }
		  else if(this.status >= 400) {
		  	xhr.onerror(e);
		  }
		};

		xhr.onerror = function(e) {
			task.state = 'error';
			task.onerror(e);
			task.oncomplete();

			xhrQueue.splice(xhrQueue.indexOf(xhr), 1);
			Downloader.process();
		};

		xhr.onprogress = function(e) {
			task.onprogress(e);
			task.oncomplete();
		};

		xhr.send();
		task.state = 'loading';
		task.onstart();
	}


	return Downloader;
})();


// `self` is undefined in Firefox for Android content script context
// while `this` is nsIContentFrameMessageManager
// with an attribute `content` that corresponds to the window

if (typeof module !== "undefined" && module.exports) {
  module.exports.JSDownloader = JSDownloader;
} else if ((typeof define !== "undefined" && define !== null) && (define.amd != null)) {
  define([], function() {
    return JSDownloader;
  });
}