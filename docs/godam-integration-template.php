<?php
/**
 * GoDAM Player Integration Template
 * 
 * Copy this file to your theme directory as 'godam-integration.php' 
 * and customize it according to your needs.
 * 
 * File location: /wp-content/themes/your-theme/godam-integration.php
 * 
 * @since n.e.x.t
 */

// Prevent direct access
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Main GoDAM integration function
 * This function will be automatically called when GoDAM player loads
 */
add_action( 'godam_developer_script', 'your_custom_godam_integration' );

function your_custom_godam_integration() {
	?>
	<script>
	document.addEventListener('DOMContentLoaded', function() {
		// Wait for GoDAM API to be ready
		const waitForGodam = setInterval(function() {
			if (window.godam && window.godam.player) {
				clearInterval(waitForGodam);
				initializeCustomGoDAMFeatures();
			}
		}, 100);
		
		function initializeCustomGoDAMFeatures() {
			const api = window.godam.player;
			
			console.log('GoDAM API ready - setting up custom features');
			
			// ================================
			// YOUR CUSTOM CODE GOES HERE
			// ================================
			
			// Example 1: Add a skip video button
			addSkipVideoButton(api);
			
			// Example 2: Add a replay button  
			addReplayButton(api);
			
			// Example 3: Hide layers based on conditions
			setupConditionalLayerDisplay(api);
			
			// Example 4: Apply custom styling
			applyCustomStyling(api);
			
			// Example 5: Setup user preferences
			setupUserPreferences(api);
		}
		
		// ================================
		// CUSTOM FUNCTIONS
		// ================================
		
		/**
		 * Add a skip video button to all players
		 */
		function addSkipVideoButton(api) {
			api.addCustomButton({
				id: 'custom-skip-video',
				text: 'Skip Video',
				icon: 'fas fa-forward',
				position: 'bottom-right',
				className: 'theme-primary',
				onClick: function(playerEl, event) {
					// Get the player instance
					const instanceId = getPlayerInstanceId(playerEl);
					if (instanceId) {
						// Seek to end of video
						const stats = api.getPlayerStats(instanceId);
						api.seekTo(instanceId, stats.duration - 1);
						
						// Optional: Show a message
						showNotification('Video skipped!');
					}
				}
			});
		}
		
		/**
		 * Add a replay button to all players
		 */
		function addReplayButton(api) {
			api.addCustomButton({
				id: 'custom-replay-video',
				text: 'Replay',
				icon: 'fas fa-redo',
				position: 'bottom-left',
				onClick: function(playerEl, event) {
					const instanceId = getPlayerInstanceId(playerEl);
					if (instanceId) {
						// Reset to beginning and play
						api.seekTo(instanceId, 0);
						api.playVideo(instanceId);
						
						showNotification('Video restarted!');
					}
				}
			});
		}
		
		/**
		 * Setup conditional layer display
		 * Modify this function to implement your own conditions
		 */
		function setupConditionalLayerDisplay(api) {
			// Example: Hide CTA layers based on user location
			// Replace with your own geolocation service or logic
			
			/*
			fetch('https://ipapi.co/json/')
				.then(response => response.json())
				.then(data => {
					// Define countries where you want to hide CTA layers
					const restrictedCountries = ['DE', 'FR', 'IT', 'ES'];
					
					if (restrictedCountries.includes(data.country_code)) {
						api.addLayerHook({
							id: 'location-based-cta-hide',
							type: 'cta',
							description: 'Hide CTA layers for specific countries',
							condition: function(layer, player) {
								console.log('Hiding CTA layer for restricted country:', layer.id);
								return false; // Hide the layer
							}
						});
					}
				})
				.catch(error => {
					console.warn('Location detection failed:', error);
				});
			*/
			
			// Example: Hide layers during specific times
			api.addLayerHook({
				id: 'time-based-layer-control',
				description: 'Show layers only during business hours',
				condition: function(layer, player) {
					const now = new Date();
					const hour = now.getHours();
					
					// Show layers only between 9 AM and 5 PM
					if (hour < 9 || hour > 17) {
						return false; // Hide layer
					}
					
					return true; // Show layer
				}
			});
			
			// Example: Hide layers based on user preferences
			const hideAds = localStorage.getItem('hideAds') === 'true';
			if (hideAds) {
				api.addLayerHook({
					id: 'user-preference-ads',
					type: 'cta',
					description: 'Hide ads based on user preference',
					condition: function(layer, player) {
						return false; // Hide all CTA layers
					}
				});
			}
		}
		
		/**
		 * Apply custom styling to players
		 */
		function applyCustomStyling(api) {
			// Apply to all players
			api.addGlobalHook({
				id: 'custom-styling',
				description: 'Apply custom theme to all players',
				callback: function(api) {
					api.getAllPlayers().forEach(playerData => {
						api.addPlayerStyle(playerData.instanceId, {
							id: 'your-custom-theme',
							css: `
								/* Your custom CSS here */
								.easydam-player {
									border-radius: 10px;
									overflow: hidden;
									box-shadow: 0 5px 15px rgba(0,0,0,0.2);
								}
								
								.easydam-player .vjs-control-bar {
									background: rgba(0,0,0,0.8);
									backdrop-filter: blur(5px);
								}
								
								.easydam-layer {
									border-radius: 8px;
								}
								
								.godam-custom-overlay-button {
									background: linear-gradient(45deg, #007cba, #005a87);
									border-radius: 20px;
									font-weight: bold;
								}
							`,
							playerStyles: {
								// Direct player element styles
								// transition: 'all 0.3s ease'
							},
							layerStyles: {
								// Direct layer element styles
								// backgroundColor: 'rgba(255,255,255,0.95)'
							}
						});
					});
				}
			});
		}
		
		/**
		 * Setup user preferences
		 */
		function setupUserPreferences(api) {
			// Get stored user preferences
			const userPrefs = {
				volume: parseFloat(localStorage.getItem('godam_volume') || '1'),
				autoplay: localStorage.getItem('godam_autoplay') === 'true',
				showSkipButton: localStorage.getItem('godam_show_skip') !== 'false'
			};
			
			// Apply preferences to all players
			api.addGlobalHook({
				id: 'user-preferences',
				callback: function(api) {
					api.getAllPlayers().forEach(playerData => {
						const player = playerData.player;
						
						// Apply volume preference
						player.volume(userPrefs.volume);
						
						// Apply autoplay preference
						if (userPrefs.autoplay) {
							player.autoplay(true);
						}
					});
				}
			});
			
			// Conditionally show skip button based on preference
			if (!userPrefs.showSkipButton) {
				api.removeCustomButton('custom-skip-video');
			}
		}
		
		// ================================
		// UTILITY FUNCTIONS
		// ================================
		
		/**
		 * Get player instance ID from a DOM element
		 */
		function getPlayerInstanceId(element) {
			const playerContainer = element.closest('.easydam-video-container');
			if (!playerContainer) return null;
			
			const videoElement = playerContainer.querySelector('.easydam-player');
			return videoElement ? videoElement.dataset.instanceId : null;
		}
		
		/**
		 * Show a notification to the user
		 */
		function showNotification(message, duration = 3000) {
			// Create notification element
			const notification = document.createElement('div');
			notification.style.cssText = `
				position: fixed;
				top: 20px;
				right: 20px;
				background: rgba(0,0,0,0.8);
				color: white;
				padding: 10px 15px;
				border-radius: 5px;
				z-index: 9999;
				font-size: 14px;
				transition: all 0.3s ease;
			`;
			notification.textContent = message;
			
			document.body.appendChild(notification);
			
			// Remove after duration
			setTimeout(() => {
				notification.style.opacity = '0';
				setTimeout(() => {
					if (notification.parentNode) {
						notification.parentNode.removeChild(notification);
					}
				}, 300);
			}, duration);
		}
		
		/**
		 * Debounce function for performance
		 */
		function debounce(func, wait) {
			let timeout;
			return function executedFunction(...args) {
				const later = () => {
					clearTimeout(timeout);
					func(...args);
				};
				clearTimeout(timeout);
				timeout = setTimeout(later, wait);
			};
		}
		
		/**
		 * Check if user is on mobile device
		 */
		function isMobileDevice() {
			return window.innerWidth <= 768 || /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
		}
		
		/**
		 * Get user's country code (example using a free service)
		 * Replace with your preferred geolocation service
		 */
		function getUserCountry() {
			return fetch('https://ipapi.co/json/')
				.then(response => response.json())
				.then(data => data.country_code)
				.catch(error => {
					console.warn('Country detection failed:', error);
					return 'US'; // Default fallback
				});
		}
		
		// ================================
		// ADVANCED EXAMPLES
		// ================================
		
		/**
		 * Example: Dynamic button management based on screen size
		 */
		function setupResponsiveControls(api) {
			function updateControls() {
				const isMobile = isMobileDevice();
				
				// Remove existing responsive controls
				api.removeCustomButton('mobile-controls');
				api.removeCustomButton('desktop-controls');
				
				if (isMobile) {
					// Mobile-optimized controls
					api.addCustomButton({
						id: 'mobile-controls',
						icon: 'fas fa-ellipsis-h',
						position: 'bottom-right',
						styles: { padding: '8px', fontSize: '16px' },
						onClick: function(playerEl, event) {
							// Show mobile control menu
							showMobileControlMenu(playerEl);
						}
					});
				} else {
					// Desktop controls
					api.addCustomButton({
						id: 'desktop-controls',
						text: 'More Options',
						icon: 'fas fa-cog',
						position: 'bottom-right',
						onClick: function(playerEl, event) {
							// Show desktop control menu
							showDesktopControlMenu(playerEl);
						}
					});
				}
			}
			
			// Update on resize
			window.addEventListener('resize', debounce(updateControls, 300));
			updateControls(); // Initial setup
		}
		
		/**
		 * Example: A/B testing for different button configurations
		 */
		function setupABTesting(api) {
			// Simple A/B test - 50/50 split
			const isVariantA = Math.random() < 0.5;
			
			if (isVariantA) {
				// Variant A: Skip button on bottom-right
				api.addCustomButton({
					id: 'ab-test-skip-a',
					text: 'Skip →',
					position: 'bottom-right',
					className: 'theme-primary',
					onClick: function(playerEl, event) {
						// Track A/B test event
						trackEvent('skip_button_clicked', { variant: 'A' });
						skipVideo(playerEl);
					}
				});
			} else {
				// Variant B: Skip button on top-right
				api.addCustomButton({
					id: 'ab-test-skip-b',
					text: 'Skip Video',
					position: 'top-right',
					className: 'theme-secondary',
					onClick: function(playerEl, event) {
						// Track A/B test event
						trackEvent('skip_button_clicked', { variant: 'B' });
						skipVideo(playerEl);
					}
				});
			}
		}
		
		// Helper function for A/B testing
		function trackEvent(eventName, properties) {
			// Replace with your analytics tracking
			console.log('A/B Test Event:', eventName, properties);
			
			// Example: Google Analytics
			// gtag('event', eventName, properties);
			
			// Example: Custom analytics
			// analytics.track(eventName, properties);
		}
		
		function skipVideo(playerEl) {
			const instanceId = getPlayerInstanceId(playerEl);
			if (instanceId) {
				const api = window.godam.player;
				const stats = api.getPlayerStats(instanceId);
				api.seekTo(instanceId, stats.duration - 1);
			}
		}
	});
	</script>
	<?php
}

/**
 * Optional: Add custom CSS for your GoDAM integration
 * This CSS will be loaded when GoDAM players are present
 */
add_action( 'wp_head', 'your_custom_godam_styles' );

function your_custom_godam_styles() {
	// Only add CSS if GoDAM is active and players are present
	if ( ! function_exists( 'is_godam_active' ) || ! is_godam_active() ) {
		return;
	}
	
	?>
	<style>
	/* Your custom GoDAM styles here */
	
	/* Example: Custom button hover effects */
	.godam-custom-overlay-button:hover {
		transform: scale(1.1) !important;
		box-shadow: 0 5px 15px rgba(0,0,0,0.3) !important;
	}
	
	/* Example: Custom layer styling */
	.easydam-layer {
		backdrop-filter: blur(10px) !important;
	}
	
	/* Example: Mobile-specific adjustments */
	@media (max-width: 768px) {
		.godam-custom-overlay-button {
			padding: 6px 10px !important;
			font-size: 12px !important;
		}
	}
	</style>
	<?php
}

// ================================
// ADDITIONAL HELPER FUNCTIONS
// ================================

/**
 * Check if GoDAM plugin is active
 */
function is_godam_active() {
	return function_exists( 'godam_version' ) || class_exists( 'GoDAM_Plugin' );
}

/**
 * Add custom admin settings for your GoDAM integration
 */
function add_godam_integration_settings() {
	// Add settings page or options as needed
	// This is optional - only if you need admin controls
}

/**
 * Enqueue additional scripts/styles if needed
 */
function enqueue_godam_integration_assets() {
	// Only on pages with GoDAM players
	if ( has_godam_player() ) {
		// wp_enqueue_script('your-custom-script');
		// wp_enqueue_style('your-custom-style');
	}
}

/**
 * Check if current page has GoDAM players
 */
function has_godam_player() {
	// Implement your logic to detect GoDAM players on the page
	// This could check for shortcodes, blocks, or other indicators
	return has_shortcode( get_the_content(), 'godam_player' ) || 
			has_block( 'godam/player' );
}
