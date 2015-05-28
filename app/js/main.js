$(document).ready(function() {
	
	var apiBaseUrl = "https://www.la1tv.co.uk/api/v1";
	
	$(".container").each(function() {
		
		var self = this;
		
		var apiKey = $(this).attr("data-api-key");
		var playlistId = $(this).attr("data-playlist-id") !== "" ? parseInt($(this).attr("data-playlist-id")) : null;
		var qualityIds = $.map($(this).attr("data-quality-ids").split(","), function(a){return parseInt(a);});
		var randomise = $(this).attr("data-randomise") === "1"
	
		var $iframe = null;
		var playingCheckTimerId = null;
		var apiUpdateTriggerTimerId = null;
		var playing = false;
		
		// array of {mediaItem, chosenQualityId}
		// items at the front of the array are popped off and played
		var queue = [];
		
		initialise();

		function initialise() {
			request("permissions", function(data) {
				// no special permissions needed
				console.log("Initialised!");
				loadNextItem();
			});
		}
		
		function request(url, callback) {
			console.log("Making api request.", url);
			$.ajax({
				url: apiBaseUrl+"/"+url,
				timeout: 30000,
				dataType: "json",
				headers: {
					"X-Api-Key": apiKey
				},
				cache: false,
				type: "GET"
			}).done(function(data, textStatus, jqXHR) {
				console.log("Api request completed.");
				callback(data);
			}).fail(function() {
				console.log("Error making request to api. Retrying shortly.");
				setTimeout(function() {
					request(url, callback);
				}, 5000);
			});
		}
		
		// populate the queue with items
		function refillQueue(callback) {
			var requestUrl = playlistId !== null ? "playlists/"+playlistId+"/mediaItems" : "mediaItems?sortMode=SCHEDULED_PUBLISH_TIME&sortDirection=DESC&vodIncludeSetting=HAS_AVAILABLE_VOD&limit=25";
			request(requestUrl, function(data) {
				var mediaItems = playlistId !== null ? data.data : data.data.mediaItems;

				// to contain all media items which are supported in form {mediaItem, chosenQualityId}
				var candidates = [];
				for (var i=0; i<mediaItems.length; i++) {
					var mediaItem = mediaItems[i];
					var candidate = createCandidateFromMediaItem(mediaItem);
					
					if (candidate !== null) {
						candidates.push(candidate);
					}
				}
				if (randomise) {
					shuffle(candidates);
				}
				queue = candidates;
				newMediaItemIds = [];
				if (callback) {
					callback();
				}
			});
		}
		
		function isMediaItemValid(mediaItem) {
			return mediaItem.vod !== null && mediaItem.vod.available;
		}
		
		function createCandidateFromMediaItem(mediaItem) {
			if (!isMediaItemValid(mediaItem)) {
				return null;
			}
			var availableQualityIds = [];
			for (var j=0; j<mediaItem.vod.qualities.length; j++) {
				availableQualityIds.push(mediaItem.vod.qualities[j].id);
			}
			var chosenQualityId = null;
			for (var j=0; j<qualityIds.length && chosenQualityId === null; j++) {
				var proposedQualityId = qualityIds[j];
				if ($.inArray(proposedQualityId, availableQualityIds) !== -1) {
					chosenQualityId = proposedQualityId;
				}
			}
			if (chosenQualityId === null) {
				// doesn't have a quality that is needed
				return null;
			}
			
			return {
				mediaItem: mediaItem,
				chosenQualityId: chosenQualityId
			};
		}
		
		function fillQueueIfNecessary(callback) {
			if (queue.length > 0) {
				callback();
			}
			else {
				console.log("Queue empty. Refilling...");
				refillQueue(callback);
			}
		}
		
		// get the next item off the queue and play it
		function loadNextItem() {
			console.log("Loading next item...");
			fillQueueIfNecessary(function() {
				if (queue.length === 0) {
					console.log("Nothing to switch to, queue is empty. Trying again shortly.");
					setTimeout(function() {
						loadNextItem();
					}, 5000);
					return;
				}
				candidate = queue.shift();
				
				// check this candidate is still available and valid
				var requestUrl = playlistId !== null ? "playlists/"+playlistId+"/mediaItems/"+candidate.mediaItem.id : "mediaItems/"+candidate.mediaItem.id;
				request(requestUrl, function(data) {
					console.log("Checking next item is still a valid option.");
					var mediaItem = playlistId !== null ? data.data : data.data.mediaItem;
					if (!isMediaItemValid(mediaItem)) {
						console.log("Item no longer valid. Skipping...");
						loadNextItem();
					}
					else {
						console.log("Item valid.");
						loadMediaItem(candidate.mediaItem, candidate.chosenQualityId);
					}
				});
			});
		}
		
		function loadMediaItem(mediaItem, qualityId) {
			console.log("Loading media item.", mediaItem);
			var iframeSrc = mediaItem.embed.iframeUrl+"?kiosk=1&vodQualityId="+qualityId; // get the player in kiosk mode
			$iframe = $("<iframe />").attr("frameborder", 0).attr("allowfullscreen", true).attr("webkitallowfullscreen", true).attr("mozallowfullscreen", true).attr("src", iframeSrc);
			$(self).append($iframe);
			
			window.onmessage = function(event) {
				var data = null;
				try {
					data = JSON.parse(event.data);
				} catch(ex){}
				
				if (data == null) {
					return;
				}
				
				if (typeof data.playerApi === "object") {
					// this is an event from the embeddable player
					var eventId = data.playerApi.eventId;
					var state = data.playerApi.state;
					console.log("Embeddable player event:", eventId, state);
					playing = state.playing;
					
					if (eventId === "ended" || eventId === "typeChanged") {
						onVideoEnded();
					}
					else if (eventId === "pause") {
						onVideoEnded();
					}
				}
			};
			apiUpdateTriggerTimerId = setInterval(function() {
				var data = {
					playerApi: {
						action: "STATE_UPDATE"
					}
				};
				$iframe[0].contentWindow.postMessage(JSON.stringify(data), "*");
			}, 7000);
			playingCheckTimerId = setTimeout(checkPlaying, 8000);
			
			function checkPlaying() {
				if (playingCheckTimerId === null) {
					return;
				}
				if (!playing) {
					onVideoEnded();
				}
				else {
					playingCheckTimerId = setTimeout(checkPlaying, 1000);
				}
			}
		}
		
		function onVideoEnded() {
			console.log("Video ended. Moving on.");
			$iframe.remove();
			$iframe = null;
			window.onmessage = null;
			clearTimeout(playingCheckTimerId);
			playingCheckTimerId = null;
			clearTimeout(apiUpdateTriggerTimerId);
			apiUpdateTriggerTimerId = null;
			playing = false;
			loadNextItem();
		}
	
	});
	
});



function shuffle(array) {
  var currentIndex = array.length, temporaryValue, randomIndex ;

  // While there remain elements to shuffle...
  while (0 !== currentIndex) {

    // Pick a remaining element...
    randomIndex = Math.floor(Math.random() * currentIndex);
    currentIndex -= 1;

    // And swap it with the current element.
    temporaryValue = array[currentIndex];
    array[currentIndex] = array[randomIndex];
    array[randomIndex] = temporaryValue;
  }

  return array;
}