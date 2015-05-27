$(document).ready(function() {
	
	var apiBaseUrl = "https://www.la1tv.co.uk/api/v1";
	
	$(".container").each(function() {
		
		var self = this;
		
		var apiKey = $(this).attr("data-api-key");
		var playlistId = parseInt($(this).attr("data-playlist-id"));
		var qualityIds = $.map($(this).attr("data-quality-ids").split(","), function(a){return parseInt(a);});
		var randomise = $(this).attr("data-randomise") === "1"
		
		var lastCandidate = null;
		var $iframe = null;
		var playingCheckTimerId = null;
		var apiUpdateTriggerTimerId = null;
		var playing = false;
		
		initialise();

		function initialise() {
			request("permissions", function(data) {
				// no special permissions needed
				console.log("Initialised!");
				loadNextVideo();
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
		
		
		// figure out what to do do next and do it
		function loadNextVideo() {
			request("playlists/"+playlistId+"/mediaItems", function(data) {
				var mediaItems = data.data;

				// to contain all media items which are supported in form {mediaItem, chosenQualityId}
				var candidates = [];
				
				for (var i=0; i<mediaItems.length; i++) {
					var mediaItem = mediaItems[i];
					if (mediaItem.vod === null || !mediaItem.vod.available) {
						continue;
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
						continue;
					}
					candidates.push({
						mediaItem: mediaItem,
						chosenQualityId: chosenQualityId
					});
				}
				
				// now pick a candidate
				var chosenCandidate = null;
				if (!randomise) {
					// pick the next one
					var found = chosenCandidate !== null;
					for (var j=0; j<2 && chosenCandidate === null; j++) {
						for (var i=0; i<candidates.length; i++) {
							var candidate = candidates[i];
							if (found) {
								chosenCandidate = candidate;
								break;
							}
							if (lastCandidate !== null && candidate.mediaItem.id === lastCandidate.mediaItem.id) {
								found = true;
							}
						}
						found = true;
					}
				}
				else {
					// pick a random item
					if (candidates.length > 0) {
						chosenCandidate = candidates[Math.floor(Math.random() * candidates.length)];
					}
				}
				
				if (chosenCandidate === null) {
					console.log("Can't find something to change to.");
					// try again in a bit
					setTimeout(loadNextVideo, 10000);
					return;
				}
				lastCandidate = chosenCandidate;
				loadMediaItem(chosenCandidate.mediaItem, chosenCandidate.chosenQualityId);
			});
		}
		
		function loadMediaItem(mediaItem, qualityId) {
			console.log("Loading media item.", mediaItem);
			var iframeSrc = mediaItem.embed.iframeUrl+"?kiosk=1"; // get the player in kiosk mode
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
			}, 1000);
			playingCheckTimerId = setTimeout(checkPlaying, 8000);
			
			function checkPlaying() {
				if (playingCheckTimerId === null) {
					return;
				}
				if (!playing) {
					onVideoEnded();
				}
				setTimeout(checkPlaying, 1000);
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
			loadNextVideo();
		}
	
	});
	
});
