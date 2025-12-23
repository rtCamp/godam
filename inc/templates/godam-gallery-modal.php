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

// Prevent automatic page_load events in iframe - we'll handle them manually.
add_filter( 'godam_analytics_skip_auto_page_load', '__return_true' );

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
		/* Allow modal overflow for visibility */
		.easydam-video-container {
			overflow: visible;
			height: auto;
			position: relative;
		}

		/* Initially hide video player and engagement in gallery modal */
		.godam-modal-video .godam-video-wrapper,
		.godam-modal-video .rtgodam-video-engagement {
			opacity: 0 !important;
			pointer-events: none !important;
			transition: opacity 0.3s ease !important;
		}

		/* Show video player when comments modal is open */
		body.comments-modal-open .godam-modal-video .godam-video-wrapper,
		body.comments-modal-open .godam-modal-video .rtgodam-video-engagement {
			opacity: 1 !important;
			pointer-events: auto !important;
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

		/* Ensure form layers are scrollable when content overflows */
		.easydam-layer .form-container {
			overflow-y: auto;
			max-height: calc(100vh - 40px);
			-webkit-overflow-scrolling: touch;
			scrollbar-width: thin;
		}

		/* Ensure scrollbar is visible on mobile */
		.easydam-layer .form-container::-webkit-scrollbar {
			width: 8px;
		}

		.easydam-layer .form-container::-webkit-scrollbar-thumb {
			background-color: rgba(255, 255, 255, 0.5);
			border-radius: 4px;
		}
	</style>
</head>
<body>
	<div class="godam-modal-container">
		<div class="godam-modal-video">
			<?php
			// Render the video using the godam_video shortcode.
			$shortcode = "[godam_video id='{$attachment_id}' engagements=show auto_open_comments=\"true\" sources='{$sources_with_placeholders}']";
			echo do_shortcode( $shortcode );
			?>
		</div>
	</div>

	<script>
		// Skip automatic analytics page_load in iframe context
		window.godamAnalyticsSkipAutoPageLoad = true;

		// Handle comments modal visibility - show video when comments open
		window.addEventListener('rtgodam:comments-opened', function() {
			document.body.classList.add('comments-modal-open');
		});

		// Auto-open comments immediately to show video
		setTimeout(function() {
			const commentButton = document.querySelector('.rtgodam-video-engagement--comment-link');
			if (commentButton) {
				commentButton.click();
			}
		}, 100);

		// Notify parent window when content is ready.
		document.addEventListener( 'DOMContentLoaded', function() {
			// Wait for analytics to be ready before signaling modal ready
			const checkAnalyticsReady = function() {
				if ( window.analytics && window.analytics.trackVideoEvent ) {
					const data = {
						type: 'rtgodam:modal-ready',
						title: '<?php echo esc_js( $video_title ); ?>',
						date: '<?php echo esc_js( $video_date ); ?>',
						height: document.body.scrollHeight,
						attachmentId: <?php echo intval( $attachment_id ); ?>
					};

					if ( window.parent && window.parent !== window ) {
						window.parent.postMessage( data, '*' );
					}
				} else {
					setTimeout( checkAnalyticsReady, 100 );
				}
			};

			// Start checking after a short delay
			setTimeout( checkAnalyticsReady, 500 );
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

		// Listen for custom events from the engagement system
		let heightChangeTimeout;
		const notifyHeightChange = function() {
			clearTimeout( heightChangeTimeout );
			heightChangeTimeout = setTimeout( function() {
				const data = {
					type: 'rtgodam:modal-resize',
					height: document.body.scrollHeight
				};

				if ( window.parent && window.parent !== window ) {
					window.parent.postMessage( data, '*' );
				}
			}, 200 );
		};

		window.addEventListener( 'rtgodam:comments-opened', function() {
			// Request parent to set full-screen height for comments
			setTimeout( function() {
				const data = {
					type: 'rtgodam:comments-opened',
					action: 'expand-to-fullscreen'
				};

				if ( window.parent && window.parent !== window ) {
					window.parent.postMessage( data, '*' );
				}
			}, 300 );
		} );

		window.addEventListener( 'rtgodam:comments-closed', function() {
			// Revert to measured height when comments close
			notifyHeightChange();
		} );

		// Function to save current video ranges to sessionStorage
		function saveVideoRanges(videoId) {
			try {
				const videoEl = document.querySelector(`.easydam-player.video-js[data-id="${videoId}"]`);
				if (videoEl && videoEl.player) {
					const player = videoEl.player;
					const ranges = [];
					const played = player.played();
					if (played && typeof played.length === 'number') {
						for (let i = 0; i < played.length; i++) {
							ranges.push([played.start(i), played.end(i)]);
						}
					}
					if (ranges.length > 0) {
						const rangeData = {
							ranges: ranges,
							videoLength: Number(player.duration && player.duration()) || 0,
							timestamp: Date.now()
						};
						sessionStorage.setItem(`godam_video_ranges_${videoId}`, JSON.stringify(rangeData));
					}
				}
			} catch {
			}
		}

		// Auto-save ranges periodically and on video events
		setInterval(() => {
			const currentVideoId = <?php echo intval( $attachment_id ); ?>;
			if (currentVideoId) {
				saveVideoRanges(currentVideoId);
			}
		}, 5000); // Save every 5 seconds

		// Save ranges when page is about to unload
		window.addEventListener('beforeunload', () => {
			const currentVideoId = <?php echo intval( $attachment_id ); ?>;
			if (currentVideoId) {
				saveVideoRanges(currentVideoId);
			}
		});

		// Function to get stored video ranges from sessionStorage
		function getStoredVideoRanges(videoId) {
			try {
				const stored = sessionStorage.getItem(`godam_video_ranges_${videoId}`);
				if (stored) {
					const data = JSON.parse(stored);
					return data;
				}
			} catch {
			}
			return null;
		}

		// Listen for messages from parent window
		window.addEventListener( 'message', function( event ) {
			if ( event.data && event.data.type === 'rtgodam:save-ranges' ) {
				// Parent is asking us to save ranges for a video before iframe destruction
				const { videoId } = event.data;
				saveVideoRanges(videoId);
			} else if ( event.data && event.data.type === 'rtgodam:analytics-event' ) {
				const { analyticsType, videoId } = event.data;

				if ( analyticsType === 1 ) {
					// Type 1: Video Loaded/Page Load event
					if ( window.analytics && videoId ) {
						window.analytics.track( 'page_load', {
							type: 1,
							videoIds: [ parseInt( videoId, 10 ) ]
						} );
					}
				} else if ( analyticsType === 2 ) {
					// Type 2: Video Played/Heatmap event

					// First save current video ranges if it exists
					const currentVideoId = <?php echo intval( $attachment_id ); ?>;
					if (currentVideoId && currentVideoId !== videoId) {
						saveVideoRanges(currentVideoId);
					}

					if ( window.analytics && window.analytics.trackVideoEvent ) {
						// Check if we have stored ranges for this video in sessionStorage
						const storedData = getStoredVideoRanges(videoId);
						if (storedData) {
							window.analytics.trackVideoEvent( {
								type: 2,
								videoId: parseInt( videoId, 10 ),
								ranges: storedData.ranges,
								videoLength: storedData.videoLength,
								sendPageLoad: false // Don't send duplicate type 1
							} );
							// Clear stored data after sending to prevent duplicate sends
							sessionStorage.removeItem(`godam_video_ranges_${videoId}`);
						} else {
							// Try to get ranges from current player (for same video)
							window.analytics.trackVideoEvent( {
								type: 2,
								videoId: parseInt( videoId, 10 ),
								sendPageLoad: false // Don't send duplicate type 1
							} );
						}
					}
				}
			}
		} );

		// Scroll/swipe detection within iframe to change videos acting on parent scroll logic
		( function() {
			const SCROLL_COOLDOWN = 1000; // milliseconds
			let lastScrollTime = 0;
			let scrollTimeout;
			let touchStartElement = null;

			// Check if element is within form or modal that should allow normal scrolling
			const isScrollableElement = function( element ) {
				if ( ! element ) {
					return false;
				}

				// Check if element is within engagement forms or modals
				const scrollableSelectors = [
					'.rtgodam-video-engagement--comment-form',
					'.rtgodam-video-engagement--comment-modal',
					'.leave-comment-login-guest-form',
					'.easydam-layer', // Video editor form layers
					'.form-container', // Form container within video layers
					'input',
					'textarea',
					'select',
					'button',
					'[contenteditable="true"]'
				];

				return scrollableSelectors.some( selector => {
					return element.closest( selector );
				} );
			};

			// Desktop: wheel event
			const handleWheel = function( event ) {
				// Allow normal scrolling in form elements and modals
				if ( isScrollableElement( event.target ) ) {
					return;
				}

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
				touchStartElement = event.target;
			};

			const handleTouchMove = function( event ) {
				// Allow normal scrolling in form elements and modals
				if ( isScrollableElement( touchStartElement ) ) {
					return;
				}

				event.preventDefault();
				event.stopPropagation();
			};

			const handleTouchEnd = function( event ) {
				// Allow normal scrolling in form elements and modals
				if ( isScrollableElement( touchStartElement ) ) {
					touchStartElement = null;
					return;
				}

				// Handle swipe within iframe to change videos
				touchEndY = event.changedTouches[ 0 ].clientY;
				const touchDiff = touchStartY - touchEndY;

				// Minimum swipe distance
				if ( Math.abs( touchDiff ) < 30 ) {
					touchStartElement = null;
					return;
				}

				clearTimeout( scrollTimeout );
				scrollTimeout = setTimeout( function() {
					const currentTime = Date.now();
					if ( currentTime - lastScrollTime < SCROLL_COOLDOWN ) {
						touchStartElement = null;
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

				touchStartElement = null;
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