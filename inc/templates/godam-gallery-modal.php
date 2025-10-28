<?php
/**
 * Gallery Modal Template.
 *
 * Renders GoDAM video in a minimal page for iframe modal display.
 *
 * @package GoDAM
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

$attachment_id = absint( get_query_var( 'id' ) );
$attachment    = get_post( $attachment_id );

if ( ! $attachment ) {
	status_header( 404 );
	exit;
}

// Get video title and date.
$video_title = get_the_title( $attachment_id );
$video_date  = get_the_date( 'F j, Y', $attachment_id );

// Enqueue necessary assets.
wp_enqueue_script( 'godam-player-frontend-script' );
wp_enqueue_script( 'godam-player-analytics-script' );
wp_enqueue_style( 'godam-player-frontend-style' );
wp_enqueue_style( 'godam-player-style' );

// Get video sources for the shortcode.
$transcoded_url     = strval( rtgodam_get_transcoded_url_from_attachment( $attachment_id ) );
$hls_transcoded_url = strval( rtgodam_get_hls_transcoded_url_from_attachment( $attachment_id ) );
$video_src          = strval( wp_get_attachment_url( $attachment_id ) );
$video_src_type     = strval( get_post_mime_type( $attachment_id ) );
$sources            = array();

if ( ! empty( $transcoded_url ) ) {
	$sources[] = array(
		'src'  => $transcoded_url,
		'type' => 'application/dash+xml',
	);
}

if ( ! empty( $hls_transcoded_url ) ) {
	$sources[] = array(
		'src'  => $hls_transcoded_url,
		'type' => 'application/x-mpegURL',
	);
}

$sources[] = array(
	'src'  => $video_src,
	'type' => 'video/quicktime' === $video_src_type ? 'video/mp4' : $video_src_type,
);

// Convert JSON to use custom placeholders instead of square brackets.
$sources_json              = wp_json_encode( $sources );
$sources_with_placeholders = str_replace( array( '[', ']' ), array( '__rtgob__', '__rtgcb__' ), $sources_json );

// Hide redundant admin bar for iframe to avoid duplication.
// phpcs:ignore WordPressVIPMinimum.UserExperience.AdminBarRemoval.RemovalDetected
add_filter( 'show_admin_bar', '__return_false' );

?>
<!DOCTYPE html>
<html <?php language_attributes(); ?>>
<head>
	<meta charset="<?php bloginfo( 'charset' ); ?>">
	<meta name="viewport" content="width=device-width, initial-scale=1">
	<title><?php echo esc_html( $video_title ); ?> - <?php bloginfo( 'name' ); ?></title>
	<?php wp_head(); ?>
	<style>
		body {
			margin: 0;
			padding: 0;
			background: #000;
			font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
			height: auto;
			overflow: hidden;
		}
		.godam-modal-container {
			max-width: 100%;
			margin: 0 auto;
			height: auto;
		}
		.godam-modal-video {
			width: 100%;
			max-width: 100%;
			position: relative;
			height: auto;
		}
		/* Ensure video.js player is responsive. */
		.video-js {
			width: 100% !important;
			height: auto !important;
			aspect-ratio: 16/9;
		}
		.video-js .vjs-tech {
			width: 100%;
			height: 100%;
		}
		/* Prevent overflow issues. */
		.easydam-video-container {
			overflow: hidden;
			height: auto;
		}

		html {
			margin-top: 0 !important;
		}

		body.admin-bar {
			padding-top: 0 !important;
		}

		/* Hide Query Monitor */
		#query-monitor-main,
		#qm,
		[class*="query-monitor"],
		[id*="query-monitor"],
		[data-qm],
		.qm {
			display: none !important;
			visibility: hidden !important;
			opacity: 0 !important;
		}
	</style>
</head>
<body>
	<div class="godam-modal-container">
		<div class="godam-modal-video">
			<?php
			// Render the video using the godam_video shortcode.
			$shortcode = "[godam_video id='{$attachment_id}' engagements=show sources='{$sources_with_placeholders}']";
			echo do_shortcode( $shortcode );
			?>
		</div>
	</div>

	<script>
		// Notify parent window when content is ready.
		document.addEventListener( 'DOMContentLoaded', function() {
			console.log( 'GoDAM Modal: DOM loaded, preparing to send message' );
			
			// Wait a bit for video player to initialize.
			setTimeout( function() {
				const data = {
					type: 'rtgodam:modal-ready',
					title: '<?php echo esc_js( $video_title ); ?>',
					date: '<?php echo esc_js( $video_date ); ?>',
					height: document.body.scrollHeight,
					attachmentId: <?php echo intval( $attachment_id ); ?>
				};
				
				console.log( 'GoDAM Modal: Sending message to parent:', data );
				
				if ( window.parent && window.parent !== window ) {
					window.parent.postMessage( data, '*' );
					console.log( 'GoDAM Modal: Message sent successfully' );
				} else {
					console.warn( 'GoDAM Modal: No parent window found' );
				}
			}, 500 );
		} );

		// Handle window resize to notify parent of height changes.
		let resizeTimeout;
		window.addEventListener( 'resize', function() {
			clearTimeout( resizeTimeout );
			resizeTimeout = setTimeout( function() {
				const data = {
					type: 'rtgodam:modal-resize',
					height: document.body.scrollHeight
				};
				
				if ( window.parent && window.parent !== window ) {
					window.parent.postMessage( data, '*' );
				}
			}, 250 );
		} );

		// Scroll/swipe detection within iframe to change videos acting on parent scroll logic
		( function() {
			const SCROLL_COOLDOWN = 1000; // milliseconds
			let lastScrollTime = 0;
			let scrollTimeout;

			// Desktop: wheel event
			const handleWheel = function( event ) {
				// Handle scroll within iframe to change videos
				event.preventDefault();
				event.stopPropagation();

				clearTimeout( scrollTimeout );
				scrollTimeout = setTimeout( function() {
					const currentTime = Date.now();
					if ( currentTime - lastScrollTime < SCROLL_COOLDOWN ) {
						return;
					}

					lastScrollTime = currentTime;

					// Send message to parent to change video
					if ( window.parent && window.parent !== window ) {
						const direction = event.deltaY > 0 ? 'next' : 'previous';
						window.parent.postMessage( {
							type: 'rtgodam:change-video',
							direction: direction
						}, '*' );
					}
				}, 150 );
			};

			// Mobile: touch events
			let touchStartY = 0;
			let touchEndY = 0;

			const handleTouchStart = function( event ) {
				touchStartY = event.touches[ 0 ].clientY;
			};

			const handleTouchMove = function( event ) {
				event.preventDefault();
				event.stopPropagation();
			};

			const handleTouchEnd = function( event ) {
				// Handle swipe within iframe to change videos
				touchEndY = event.changedTouches[ 0 ].clientY;
				const touchDiff = touchStartY - touchEndY;

				// Minimum swipe distance
				if ( Math.abs( touchDiff ) < 30 ) {
					return;
				}

				clearTimeout( scrollTimeout );
				scrollTimeout = setTimeout( function() {
					const currentTime = Date.now();
					if ( currentTime - lastScrollTime < SCROLL_COOLDOWN ) {
						return;
					}

					lastScrollTime = currentTime;

					// Send message to parent to change video
					if ( window.parent && window.parent !== window ) {
						const direction = touchDiff > 0 ? 'next' : 'previous';
						window.parent.postMessage( {
							type: 'rtgodam:change-video',
							direction: direction
						}, '*' );
					}
				}, 150 );
			};

			// Attach event listeners
			document.body.addEventListener( 'wheel', handleWheel, { passive: false } );
			document.body.addEventListener( 'touchstart', handleTouchStart, { passive: false } );
			document.body.addEventListener( 'touchmove', handleTouchMove, { passive: false } );
			document.body.addEventListener( 'touchend', handleTouchEnd, { passive: false } );
		} )();
	</script>

	<?php wp_footer(); ?>
</body>
</html>