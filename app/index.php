<?php
	$apiKey = $_GET['apiKey'];
	$playlistId = $_GET['playlistId'];
	$qualityId = isset($_GET['qualityId']) ? $_GET['qualityId'] : 2;
	$randomise = isset($_GET['random']);
	
	function e($a) {
		return htmlentities($a);
	}
?>
<!doctype html>
<html class="no-js" lang="">
    <head>
        <meta charset="utf-8">
        <meta http-equiv="X-UA-Compatible" content="IE=edge,chrome=1">
        <title></title>
        <meta name="description" content="">
        <meta name="viewport" content="width=device-width, initial-scale=1">

        <link rel="stylesheet" href="css/normalize.min.css">
        <link rel="stylesheet" href="video-js/video-js.min.css">
        <link rel="stylesheet" href="css/main.css">
		
		<script src="js/vendor/jquery-1.11.2.min.js"></script>
		<script src="video-js/video.js"></script>
        <script src="js/main.js"></script>

        <!--[if lt IE 9]>
			<script src="js/vendor/html5shiv.js"></script>
        <![endif]-->
    </head>
    <body>
		<div class="container" data-api-key="<?=e($apiKey);?>" data-playlist-id="<?=e($playlistId);?>" data-quality-id="<?=e($qualityId);?>" data-randomise="<?=$randomise?"1":"0"?>"></div>
    </body>
</html>
