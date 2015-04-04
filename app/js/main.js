$(document).ready(function() {
	videojs.options.flash.swf = "video-js.swf";
	
	var apiBaseUrl = "https://www.la1tv.co.uk/api/v1";
	
	$(".container").each(function() {
		
		var self = this;
		
		var apiKey = $(this).attr("data-api-key");
		var playlistId = parseInt($(this).attr("data-playlist-id"));
		var qualityId = parseInt($(this).attr("data-quality-id"));
		
		var currentMediaItemId = null;
		var $video = null;
		var videoJsPlayer = null;
		
		initialise();

		function initialise() {
			request("permissions", function(data) {
				var permissions = data.data;
				if (!permissions.vodUris) {
					onError("Do not have \"vodUris\" permission.");
					return;
				}
				console.log("Initialised!");
				doSomething();
			});
		}
		
		function request(url, callback) {
			$.ajax({
				url: apiBaseUrl+"/"+url,
				timeout: 5000,
				dataType: "json",
				headers: {
					"X-Api-Key": apiKey
				},
				cache: false,
				type: "GET"
			}).done(function(data, textStatus, jqXHR) {
				callback(data);
			}).fail(function() {
				onError("Error making request to api. URL: "+url);
			});
		}
		
		
		// figure out what to do do next and do it
		function doSomething() {
			request("playlists/"+playlistId+"/mediaItems", function(data) {
				var mediaItems = data.data;
				var found = currentMediaItemId === null;
				var url = null;
				for (var j=0; j<2 && url === null; j++) {
					for (var i=0; i<mediaItems.length; i++) {
						var mediaItem = mediaItems[i];
						if (mediaItem.vod === null || !mediaItem.vod.available) {
							continue;
						}
						
						if (found) {
							if (mediaItem.vod.urlData !== null) {
								for (var k=0; k<mediaItem.vod.urlData.length; k++) {
									var urlsAndQualities = mediaItem.vod.urlData[k];
									if (urlsAndQualities.quality.id === qualityId) {
										for (var l=0; l<urlsAndQualities.urls.length; l++) {
											var urlAndType = urlsAndQualities.urls[l];
											if (urlAndType.type === "video/mp4") {
												url = urlAndType.url;
												currentMediaItemId = mediaItem.id;
												break;
											}
										}
									}
									if (url !== null) {
										break;
									}
								}
							}
							if (url !== null) {
								break;
							}
						}
						
						if (mediaItem.id === currentMediaItemId) {
							found = true;
						}
					}
					found = true;
				}
				
				if (url === null) {
					console.log("Can't find something to change to.");
					// try again in a bit
					setTimeout(doSomething, 10000);
					return;
				}
				playVideo(url);
			});
		}
		
		function playVideo(url) {
			console.log("Playing: "+url);
			$video = $("<video />").addClass("video-js vjs-default-skin");
			$video.append($("<source />").attr("type", "video/mp4").attr("src", url));
			// disable browser context menu on video
			$video.on('contextmenu', function(e) {
				e.preventDefault();
			});
			$(self).append($video);
		
			videoJsPlayer = videojs($video[0], {
				width: "100%",
				height: "100%",
				controls: false,
				techOrder: ["html5", "flash"],
				autoPlay: false,
				loop: false
			}, function() {
				// called when player loaded.
				setTimeout(function() {
					// in timeout as needs videoJsPlayer needs to have been set
					videoJsPlayer.play();
				}, 0);
			});
			
			videoJsPlayer.on("error", function() {
				onError("VideoJS error.");
			});
			
			videoJsPlayer.on("ended", function() {
				onVideoEnded();
			});
		}
		
		function onVideoEnded() {
			console.log("Video ended. Moving on.");
			videoJsPlayer.dispose();
			$video.remove();
			$video = videoJsPlayer = null;
			doSomething();
		}
		
		function onError(msg) {
			console.log(msg);
			setTimeout(function() {
				location.reload(true);
			}, 10000);
		}
	
	});
	
});