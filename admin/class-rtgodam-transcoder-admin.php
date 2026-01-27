<?php
/**
 * The admin-specific functionality of the plugin.
 *
 * @since      1.0.0
 *
 * @package GoDAM
 * @subpackage GoDAM/Admin
 */

defined( 'ABSPATH' ) || exit;

/**
 * The admin-specific functionality of the plugin.
 *
 * @since       1.0.0
 *
 * @package    GoDAM
 * @subpackage GoDAM/Admin
 */
class RTGODAM_Transcoder_Admin {

	/**
	 * Initialize the class and set its properties.
	 *
	 * @since    1.0.0
	 */
	public function __construct() {

		include_once RTGODAM_PATH . 'admin/class-rtgodam-transcoder-handler.php'; // phpcs:ignore WordPressVIPMinimum.Files.IncludingFile.UsingCustomConstant
		include_once RTGODAM_PATH . 'admin/godam-transcoder-actions.php'; // phpcs:ignore WordPressVIPMinimum.Files.IncludingFile.UsingCustomConstant

		new RTGODAM_Transcoder_Handler();

		if ( is_admin() ) {
			if ( is_multisite() ) {
				add_action( 'network_admin_notices', array( $this, 'api_activation_admin_notice' ) );
			}
			add_action( 'admin_notices', array( $this, 'api_activation_admin_notice' ) );
			add_action( 'admin_notices', array( $this, 'dashboard_offer_banner' ) );
			add_action( 'admin_notices', array( $this, 'free_plan_admin_notice' ) );
			add_action( 'admin_notices', array( $this, 'usage_limit_notices' ) );
			add_action( 'admin_notices', array( $this, 'posthog_tracking_notice' ) );
			add_action( 'admin_init', array( $this, 'handle_posthog_tracking_action' ) );
			add_action( 'admin_init', array( $this, 'handle_clear_godam_cache' ) );
			add_action( 'wp_ajax_rtgodam_dismiss_free_plan_notice', array( $this, 'dismiss_free_plan_notice' ) );
		}
	}

	/**
	 * Display admin notice for activating the api key and handle dismissal.
	 *
	 * @since 1.0.0
	 */
	public function api_activation_admin_notice() {
		if ( ! $this->is_dashboard_screen() ) {
			return;
		}

		// Get the api key key from the site options.
		$api_key = get_option( 'rtgodam-api-key', '' );

		// Admin URL to the video editor settings page.
		$video_editor_settings_url = admin_url( 'admin.php?page=rtgodam_settings#video-settings' );

		// Get plugin activation time.
		$activation_time       = get_option( 'rtgodam_plugin_activation_time', 0 );
		$days_since_activation = ( time() - $activation_time ) / DAY_IN_SECONDS;

		// Show regular admin notice.
		if ( empty( $api_key ) ) {
			return;
		}

		// Get stored usage data.
		$usage_data = get_option( 'rtgodam-usage', array() );
		$usage_data = isset( $usage_data[ $api_key ] ) ? (array) $usage_data[ $api_key ] : null;

		if ( empty( $usage_data ) ) {
			$this->render_admin_notice(
				sprintf(
					// translators: %s is the URL to the plugin settings page where the API key can be activated.
					__( 'Enjoy using our <strong>DAM and Video Editor</strong> features for free! To unlock transcoding and other features, <a href="%s">please activate your api key.</a>', 'godam' ),
					esc_url( $video_editor_settings_url )
				),
				'warning',
				true,
				false
			);
			return;
		}

		$status              = $usage_data['status'] ?? '';
		$subscription_status = $usage_data['subscription_status'] ?? '';
		$subscription_end    = isset( $usage_data['end_date'] ) ? strtotime( $usage_data['end_date'] ) : null;
		$trial_end           = isset( $usage_data['trial_end_date'] ) ? strtotime( $usage_data['trial_end_date'] ) : null;
		$current_time        = time();
		$grace_period_days   = 30;

		// If the user is in trial mode, show trial expiry notice.
		if ( 'Trialling' === $subscription_status && $trial_end ) {
			$days_until_trial_end = ceil( ( $trial_end - $current_time ) / DAY_IN_SECONDS );

			if ( $days_until_trial_end > 0 ) {
				$this->render_admin_notice(
					sprintf(
						/* translators: %d: Number of days until trial ends */
						__( 'Your product is under trial. You will be charged after <strong>%d days</strong>. If you wish to cancel, please visit <a href="https://app.godam.io/subscription/my-account" target="_blank">your subscription settings</a>.', 'godam' ),
						$days_until_trial_end
					),
					'warning',
					false,
					false
				);
				return;
			}
		}

		// If the API key is Active, no need to show any notice.
		if ( 'Active' === $status ) {
			return;
		}

		// Check subscription expiry and display appropriate messages.
		if ( $subscription_end ) {
			$days_until_deletion = floor( ( $subscription_end + ( $grace_period_days * DAY_IN_SECONDS ) - $current_time ) / DAY_IN_SECONDS );

			if ( $days_until_deletion > 0 ) {
				$this->render_admin_notice(
					sprintf(
						/* translators: %d: Number of days until transcoded videos are deleted after subscription ends */
						__( 'Your subscription has ended. No further transcoding can be done. Transcoded videos will be removed after <strong>%d days</strong>, and advanced video layers will not be accessible. After the 30-day grace period, already transcoded videos will no longer be served from the CDN. Renew your subscription to keep it up and running.', 'godam' ),
						$days_until_deletion
					),
					'error',
					true,
					false,
					'activate'
				);
				return;
			} else {
				$this->render_admin_notice(
					sprintf(
						// translators: %s is the URL to the plugin settings page where the API key can be activated.
						__( 'Enjoy using our <strong>DAM and Video Editor</strong> features for free! To unlock transcoding and other features, <a href="%s">please activate your api key.</a>', 'godam' ),
						esc_url( $video_editor_settings_url )
					),
					'error',
					true,
					false
				);
				return;
			}
		}

		// Default fallback notice (if none of the above conditions are met).
		$this->render_admin_notice(
			sprintf(
				// translators: %s is the URL to the plugin settings page where the API key can be activated.
				__( 'Enjoy using our <strong>DAM and Video Editor</strong> features for free! To unlock transcoding and other features, <a href="%s">please activate your api key.</a>', 'godam' ),
				esc_url( $video_editor_settings_url )
			),
			'warning',
			true,
			false
		);
	}

	/**
	 * Render an admin notice for API key activation or expiry warnings.
	 *
	 * @param string $message The message to display.
	 * @param string $notice_type Type of notice (warning, error, etc.).
	 * @param bool   $include_buttons Whether to include action buttons (default: false).
	 * @param bool   $show_godam_message Whether to show the GoDAM update message (default: false).
	 * @param string $button_type The type of button to display (default: 'editor').
	 */
	private function render_admin_notice( $message, $notice_type = 'warning', $include_buttons = false, $show_godam_message = false, $button_type = 'editor' ) {
		// Get the GoDAM logo URL.
		$logo_url = plugins_url( 'assets/src/images/godam-logo.png', __DIR__ );

		$button_label = ( 'activate' === $button_type ) ? esc_html__( 'Activate API Key', 'godam' ) : esc_html__( 'Use Video Editor', 'godam' );
		$button_link  = ( 'activate' === $button_type ) ? admin_url( 'admin.php?page=rtgodam_settings' ) : admin_url( 'admin.php?page=rtgodam_video_editor' );

		?>
		<div class="notice notice-<?php echo esc_attr( $notice_type ); ?> is-dismissible rt-transcoder-api-key-notice">

		<div class="godam-notice-header">
			<img src="<?php echo esc_url( $logo_url ); ?>" alt="GoDAM Logo" class="godam-logo">
			<div>
				<?php if ( $show_godam_message ) : ?>
					<p>
						<?php esc_html_e( 'Welcome to GoDAM! Thank you for using our product.', 'godam' ); ?>
					</p>
				<?php endif; ?>

				<p>
				<?php
				echo wp_kses(
					$message,
					array(
						'strong' => array(),
						'a'      => array(
							'href'   => array(),
							'target' => array(),
						),
					)
				);
				?>
					</p>

				<?php if ( $include_buttons ) : ?>
					<p>
						<a href="<?php echo esc_url( $button_link ); ?>" class="button button-primary">
							<?php echo esc_html( $button_label ); ?>
						</a>
						<a href="https://godam.io/" class="button button-secondary" target="_blank">
							<?php esc_html_e( 'Learn More', 'godam' ); ?>
						</a>
					</p>
				<?php endif; ?>
			</div>
		</div>
		</div>
		<?php
	}

	/**
	 * Display New Year Sale offer banner on the WordPress dashboard.
	 *
	 * @return void
	 */
	public function dashboard_offer_banner() {
		if ( ! $this->is_dashboard_screen() ) {
			return;
		}

		$show_offer_banner = get_option( 'rtgodam-offer-banner', 1 );
		$timezone          = wp_timezone();
		$current_time      = new \DateTime( 'now', $timezone );
		$end_time          = new \DateTime( '2026-01-20 23:59:59', $timezone );
		
		if ( $current_time <= $end_time && $show_offer_banner ) {
			$host = wp_parse_url( home_url(), PHP_URL_HOST );

			$banner_image = RTGODAM_URL . 'assets/src/images/new-year-sale-2026.webp';

			$banner_html = sprintf(
				'<div class="notice annual-plan-offer-banner">
					<a
						href="%1$s"
						class="annual-plan-offer-banner__link"
						target="_blank"
						rel="noopener noreferrer"
						aria-label="%2$s"
					>
						<img
							src="%3$s"
							class="annual-plan-offer-banner__image"
							alt="%4$s"
							loading="lazy"
						/>
					</a>
					<button
						type="button"
						class="annual-plan-offer-banner__dismiss"
						aria-label="%5$s"
					>
						&times;
					</button>
				</div>',
				esc_url( RTGODAM_IO_API_BASE . '/pricing?utm_campaign=new-year-sale-2026&utm_source=' . $host . '&utm_medium=plugin&utm_content=dashboard-banner' ),
				esc_attr__( 'Claim the GoDAM New Year Sale 2026 offer', 'godam' ),
				esc_url( $banner_image ),
				esc_attr__( 'New Year Sale 2026 offer from GoDAM', 'godam' ),
				esc_html__( 'Dismiss banner', 'godam' )
			);

			echo wp_kses(
				$banner_html,
				array(
					'div'    => array( 'class' => array() ),
					'a'      => array(
						'href'       => array(),
						'class'      => array(),
						'target'     => array(),
						'rel'        => array(),
						'aria-label' => array(),
					),
					'img'    => array(
						'src'     => array(),
						'alt'     => array(),
						'class'   => array(),
						'loading' => array(),
					),
					'button' => array(
						'type'       => array(),
						'class'      => array(),
						'aria-label' => array(),
					),
				)
			);
		}
	}

	/**
	 * Display free plan admin notice for users without API key.
	 *
	 * @return void
	 */
	public function free_plan_admin_notice() {
		if ( ! $this->is_dashboard_screen() ) {
			return;
		}

		// Only show to users without an API key.
		if ( rtgodam_is_api_key_valid() ) {
			return;
		}

		// Check if user has dismissed this notice recently (within 7 days).
		$dismissed_timestamp = get_option( 'rtgodam_free_plan_notice_dismissed_timestamp', false );
		if ( $dismissed_timestamp && ( time() - $dismissed_timestamp ) < ( 7 * DAY_IN_SECONDS ) ) {
			return;
		}

		// Get the GoDAM logo URL.
		$logo_url = plugins_url( 'assets/src/images/godam-logo.png', __DIR__ );

		?>
		<div class="notice notice-info is-dismissible rtgodam-free-plan-notice">
			<div class="godam-notice-header">
				<img src="<?php echo esc_url( $logo_url ); ?>" alt="<?php esc_attr_e( 'GoDAM Logo', 'godam' ); ?>" class="godam-logo" />
				<div>
					<p style="font-size: 16px; font-weight: 600; margin-bottom: 15px;">
						<?php esc_html_e( 'Try GoDAM free for 60 days with all features, unlimited sites and users.', 'godam' ); ?>
					</p>
					<div style="display: flex; gap: 10px; margin-top: 10px; margin-bottom: 15px;">
						<a href="<?php echo esc_url( RTGODAM_IO_API_BASE . '/pricing?utm_campaign=free-plan-notice&utm_source=plugin&utm_medium=admin-notice&utm_content=dashboard' ); ?>" target="_blank" rel="noopener noreferrer" class="button button-primary">
							<?php esc_html_e( 'Get your Free Plan', 'godam' ); ?>
						</a>
						<a href="<?php echo esc_url( admin_url( 'admin.php?page=rtgodam_settings#video-settings' ) ); ?>" class="button button-secondary">
							<?php esc_html_e( 'Activate API Key', 'godam' ); ?>
						</a>
					</div>
				</div>
			</div>
		</div>
		<script>
			jQuery(document).ready(function($) {
				// Use event delegation to handle the click even if the button is added dynamically
				$(document).on('click', '.rtgodam-free-plan-notice .notice-dismiss', function() {
					var $notice = $(this).closest('.rtgodam-free-plan-notice');

					// Hide the notice immediately when clicked
					$notice.fadeOut();

					// Store dismissal timestamp via AJAX
					var url = (typeof ajaxurl !== 'undefined') ? ajaxurl : 'admin-ajax.php';
					$.post(url, {
						action: 'rtgodam_dismiss_free_plan_notice',
						nonce: '<?php echo esc_js( wp_create_nonce( 'dismiss_free_plan_notice' ) ); ?>'
					});
				});
			});
		</script>
		<?php
	}

	/**
	 * Dismiss the free plan notice.
	 *
	 * @return void
	 */
	public function dismiss_free_plan_notice() {
		check_ajax_referer( 'dismiss_free_plan_notice', 'nonce' );

		// Store timestamp for 7-day temporary dismissal.
		update_option( 'rtgodam_free_plan_notice_dismissed_timestamp', time() );

		wp_die();
	}

	/**
	 * Check if the current screen is the dashboard.
	 *
	 * @return bool
	 */
	public function is_dashboard_screen() {
		$current_screen = get_current_screen();
		return isset( $current_screen->id ) && 'dashboard' === $current_screen->id;
	}

	/**
	 * Handle the cache clearing request for GoDAM usage data.
	 * This runs on admin_init to ensure headers haven't been sent yet.
	 *
	 * @since 1.5.0
	 */
	public function handle_clear_godam_cache() {
		// phpcs:ignore WordPress.Security.NonceVerification.Recommended -- Nonce is verified below.
		if ( ! isset( $_GET['clear_godam_cache'] ) ) {
			return;
		}

		// Verify user capabilities.
		if ( ! current_user_can( 'manage_options' ) ) {
			return;
		}

		// Verify nonce.
		if ( ! isset( $_GET['_wpnonce'] ) || ! wp_verify_nonce( sanitize_text_field( wp_unslash( $_GET['_wpnonce'] ) ), 'clear_godam_cache' ) ) {
			return;
		}

		// Clear the cache.
		delete_option( 'rtgodam_user_data' );

		// Build redirect URL safely.
		$current_url = remove_query_arg( array( 'clear_godam_cache', '_wpnonce' ) );

		// Perform the redirect with error handling.
		if ( ! headers_sent() ) {
			wp_safe_redirect( $current_url );
			exit;
		}
	}

	/**
	 * Display usage limit notices when bandwidth/storage usage is high.
	 */
	public function usage_limit_notices() {
		// Only show on admin pages.
		if ( ! is_admin() || wp_doing_ajax() ) {
			return;
		}

		// Only show to users who can manage options.
		if ( ! current_user_can( 'manage_options' ) ) {
			return;
		}

		// Don't show usage notices if no API key is configured.
		$api_key = get_option( 'rtgodam-api-key', '' );
		if ( empty( $api_key ) ) {
			return;
		}

		// Get user data with usage information.
		$user_data = rtgodam_get_user_data( true );

		// Check if we have valid usage data.
		if ( empty( $user_data ) || ! isset( $user_data['bandwidthUsed'] ) || ! isset( $user_data['totalBandwidth'] ) ||
			! isset( $user_data['storageUsed'] ) || ! isset( $user_data['totalStorage'] ) ) {
			return;
		}

		// Calculate usage percentages.
		$bandwidth_used  = floatval( $user_data['bandwidthUsed'] );
		$bandwidth_total = floatval( $user_data['totalBandwidth'] );
		$storage_used    = floatval( $user_data['storageUsed'] );
		$storage_total   = floatval( $user_data['totalStorage'] );

		$bandwidth_percentage = $bandwidth_total > 0 ? ( $bandwidth_used / $bandwidth_total ) * 100 : 0;
		$storage_percentage   = $storage_total > 0 ? ( $storage_used / $storage_total ) * 100 : 0;

		// Check for exceeded limits (highest priority) - only storage blocks transcoding.
		$bandwidth_exceeded = $bandwidth_used > $bandwidth_total;
		$storage_exceeded   = $storage_used > $storage_total;

		if ( $storage_exceeded ) {
			$this->display_limit_exceeded_notice( $bandwidth_exceeded, $storage_exceeded, $bandwidth_percentage, $storage_percentage );
			return; // Don't show warning notice if storage limits are exceeded.
		}

		// Check for bandwidth exceeded (warning but transcoding still works).
		if ( $bandwidth_exceeded ) {
			$this->display_bandwidth_exceeded_notice( $bandwidth_percentage );
			return; // Don't show regular warning notice if bandwidth is exceeded.
		}

		// Check for 80% warning level.
		$bandwidth_warning = $bandwidth_percentage >= 80;
		$storage_warning   = $storage_percentage >= 80;

		if ( $bandwidth_warning || $storage_warning ) {
			$this->display_limit_warning_notice( $bandwidth_warning, $storage_warning, $bandwidth_percentage, $storage_percentage );
		}
	}

	/**
	 * Display notice when usage limits are exceeded.
	 *
	 * @param bool  $bandwidth_exceeded Whether bandwidth limit is exceeded.
	 * @param bool  $storage_exceeded Whether storage limit is exceeded.
	 * @param float $bandwidth_percentage Current bandwidth usage percentage.
	 * @param float $storage_percentage Current storage usage percentage.
	 */
	private function display_limit_exceeded_notice( $bandwidth_exceeded, $storage_exceeded, $bandwidth_percentage, $storage_percentage ) {
		$message_parts = array();

		if ( $bandwidth_exceeded && $storage_exceeded ) {
			$message_parts[] = sprintf(
				/* translators: %1$s: bandwidth percentage, %2$s: storage percentage */
				__( 'Your bandwidth (%1$s%%) and storage (%2$s%%) usage have exceeded your plan limits.', 'godam' ),
				'<strong>' . number_format( $bandwidth_percentage, 1 ) . '</strong>',
				'<strong>' . number_format( $storage_percentage, 1 ) . '</strong>'
			);
		} elseif ( $bandwidth_exceeded ) {
			$message_parts[] = sprintf(
				/* translators: %s: bandwidth percentage */
				__( 'Your bandwidth usage (%s%%) has exceeded your plan limit.', 'godam' ),
				'<strong>' . number_format( $bandwidth_percentage, 1 ) . '</strong>'
			);
		} elseif ( $storage_exceeded ) {
			$message_parts[] = sprintf(
				/* translators: %s: storage percentage */
				__( 'Your storage usage (%s%%) has exceeded your plan limit.', 'godam' ),
				'<strong>' . number_format( $storage_percentage, 1 ) . '</strong>'
			);
		}

		$message_parts[] = __( 'Transcoding requests may be blocked until you upgrade your plan.', 'godam' );

		$message = implode( ' ', $message_parts );

		// Get the GoDAM logo URL.
		$logo_url = plugins_url( 'assets/src/images/godam-logo.png', __DIR__ );

		?>
		<div class="notice notice-error is-dismissible">
			<div class="godam-notice-header">
				<img src="<?php echo esc_url( $logo_url ); ?>" alt="GoDAM Logo" class="godam-logo">
				<div>
					<p><strong><?php esc_html_e( 'GoDAM Usage Limit Exceeded', 'godam' ); ?></strong></p>
					<p><?php echo wp_kses( $message, array( 'strong' => array() ) ); ?></p>
					<p>
						<a href="https://app.godam.io/web/billing?tab=Plans" target="_blank" rel="noopener noreferrer" class="button button-primary">
							<?php esc_html_e( 'Upgrade Your Plan', 'godam' ); ?>
						</a>
						<a href="https://godam.io/docs/troubleshooting/bandwidth-storage?utm_source=wordpress-plugin&utm_medium=admin-notice&utm_campaign=limit-exceeded&utm_content=learn-more-button" target="_blank" rel="noopener noreferrer" class="button button-secondary">
							<?php esc_html_e( 'Learn More', 'godam' ); ?>
						</a>
						<a href="<?php echo esc_url( wp_nonce_url( add_query_arg( 'clear_godam_cache', '1' ), 'clear_godam_cache' ) ); ?>" class="button button-secondary">
							<?php esc_html_e( 'Refresh Status', 'godam' ); ?>
						</a>
					</p>
				</div>
			</div>
		</div>
		<?php
	}

	/**
	 * Display warning notice when usage reaches 80%.
	 *
	 * @param bool  $bandwidth_warning Whether bandwidth is at warning level.
	 * @param bool  $storage_warning Whether storage is at warning level.
	 * @param float $bandwidth_percentage Current bandwidth usage percentage.
	 * @param float $storage_percentage Current storage usage percentage.
	 */
	private function display_limit_warning_notice( $bandwidth_warning, $storage_warning, $bandwidth_percentage, $storage_percentage ) {
		$message_parts = array();

		if ( $bandwidth_warning && $storage_warning ) {
			$message_parts[] = sprintf(
				/* translators: %1$s: bandwidth percentage, %2$s: storage percentage */
				__( 'Your bandwidth (%1$s%%) and storage (%2$s%%) usage are approaching your plan limits.', 'godam' ),
				'<strong>' . number_format( $bandwidth_percentage, 1 ) . '</strong>',
				'<strong>' . number_format( $storage_percentage, 1 ) . '</strong>'
			);
		} elseif ( $bandwidth_warning ) {
			$message_parts[] = sprintf(
				/* translators: %s: bandwidth percentage */
				__( 'Your bandwidth usage (%s%%) is approaching your plan limit.', 'godam' ),
				'<strong>' . number_format( $bandwidth_percentage, 1 ) . '</strong>'
			);
		} elseif ( $storage_warning ) {
			$message_parts[] = sprintf(
				/* translators: %s: storage percentage */
				__( 'Your storage usage (%s%%) is approaching your plan limit.', 'godam' ),
				'<strong>' . number_format( $storage_percentage, 1 ) . '</strong>'
			);
		}

		$message_parts[] = __( 'Consider upgrading your plan to avoid service interruptions.', 'godam' );

		$message = implode( ' ', $message_parts );

		// Get the GoDAM logo URL.
		$logo_url = plugins_url( 'assets/src/images/godam-logo.png', __DIR__ );

		?>
		<div class="notice notice-warning is-dismissible">
			<div class="godam-notice-header">
				<img src="<?php echo esc_url( $logo_url ); ?>" alt="GoDAM Logo" class="godam-logo">
				<div>
					<p><strong><?php esc_html_e( 'GoDAM Usage Warning', 'godam' ); ?></strong></p>
					<p><?php echo wp_kses( $message, array( 'strong' => array() ) ); ?></p>
					<p>
						<a href="https://app.godam.io/web/billing?tab=Plans" target="_blank" rel="noopener noreferrer" class="button button-primary">
							<?php esc_html_e( 'View Plans', 'godam' ); ?>
						</a>
						<a href="https://godam.io/docs/troubleshooting/bandwidth-storage?utm_source=wordpress-plugin&utm_medium=admin-notice&utm_campaign=usage-warning&utm_content=learn-more-button" target="_blank" rel="noopener noreferrer" class="button button-secondary">
							<?php esc_html_e( 'Learn More', 'godam' ); ?>
						</a>
						<a href="<?php echo esc_url( wp_nonce_url( add_query_arg( 'clear_godam_cache', '1' ), 'clear_godam_cache' ) ); ?>" class="button button-secondary">
							<?php esc_html_e( 'Refresh Status', 'godam' ); ?>
						</a>
					</p>
				</div>
			</div>
		</div>
		<?php
	}

	/**
	 * Display notice when bandwidth limit is exceeded (but transcoding still works).
	 *
	 * @param float $bandwidth_percentage Current bandwidth usage percentage.
	 */
	private function display_bandwidth_exceeded_notice( $bandwidth_percentage ) {
		$message = sprintf(
			/* translators: %s: bandwidth percentage */
			__( 'Your bandwidth usage (%s%%) has exceeded your plan limit. Videos might not be served from CDN on frontend.', 'godam' ),
			'<strong>' . number_format( $bandwidth_percentage, 1 ) . '</strong>'
		);

		// Get the GoDAM logo URL.
		$logo_url = plugins_url( 'assets/src/images/godam-logo.png', __DIR__ );

		?>
		<div class="notice notice-error is-dismissible">
			<div class="godam-notice-header">
				<img src="<?php echo esc_url( $logo_url ); ?>" alt="GoDAM Logo" class="godam-logo">
				<div>
					<p><strong><?php esc_html_e( 'GoDAM Bandwidth Exceeded', 'godam' ); ?></strong></p>
					<p><?php echo wp_kses( $message, array( 'strong' => array() ) ); ?> <?php esc_html_e( 'Transcoding will continue to work.', 'godam' ); ?></p>
					<p>
						<a href="https://app.godam.io/web/billing?tab=Plans" target="_blank" rel="noopener noreferrer" class="button button-primary">
							<?php esc_html_e( 'Upgrade Your Plan', 'godam' ); ?>
						</a>
						<a href="https://godam.io/docs/troubleshooting/bandwidth-storage?utm_source=wordpress-plugin&utm_medium=admin-notice&utm_campaign=bandwidth-exceeded&utm_content=learn-more-button" target="_blank" rel="noopener noreferrer" class="button button-secondary">
							<?php esc_html_e( 'Learn More', 'godam' ); ?>
						</a>
						<a href="<?php echo esc_url( wp_nonce_url( add_query_arg( 'clear_godam_cache', '1' ), 'clear_godam_cache' ) ); ?>" class="button button-secondary">
							<?php esc_html_e( 'Refresh Status', 'godam' ); ?>
						</a>
					</p>
				</div>
			</div>
		</div>
		<?php
	}

	/**
	 * Display PostHog tracking notice.
	 *
	 * @since 1.5.0
	 */
	public function posthog_tracking_notice() {
		if ( ! current_user_can( 'manage_options' ) ) {
			return;
		}

		$settings = get_option( 'rtgodam-settings', array() );
		$api_key  = get_option( 'rtgodam-api-key', '' );

		// If API key is present, we don't show the notice (it's auto-enabled or already handled).
		if ( ! empty( $api_key ) ) {
			return;
		}

		// If posthog_initialized is true, it means the user has already made a choice or it was auto-enabled.
		if ( ! empty( $settings['general']['posthog_initialized'] ) ) {
			return;
		}

		$optin_url  = wp_nonce_url( add_query_arg( 'godam_tracker_optin', 'true' ), 'godam_tracker_action' );
		$optout_url = wp_nonce_url( add_query_arg( 'godam_tracker_optout', 'true' ), 'godam_tracker_action' );

		$notice = sprintf(
			__( 'Want to help make <strong>GoDAM</strong> even more awesome? Allow GoDAM to collect anonymous diagnostic data and usage information.', 'godam' )
		);

		$policy_url = 'https://posthog.com/privacy';

		echo '<div class="updated"><p>';
		echo wp_kses_post( $notice );
		echo ' (<a class="godam-insights-data-we-collect" href="#">' . esc_html__( 'what we collect', 'godam' ) . '</a>)';
		echo '<div class="description" style="display:none; margin-top: 10px; padding: 10px; background: #f9f9f9; border: 1px solid #e5e5e5; border-radius: 4px;">';
		echo '<p style="margin-top: 0;"><strong>' . esc_html__( 'Data we collect:', 'godam' ) . '</strong></p>';
		echo '<ul style="list-style: disc; margin-left: 20px;">';
		echo '<li>' . esc_html__( 'Server environment details (PHP, MySQL, Server, and WordPress versions)', 'godam' ) . '</li>';
		echo '<li>' . esc_html__( 'Site and user count (Language and number of users)', 'godam' ) . '</li>';
		echo '<li>' . esc_html__( 'Plugin details (Number of active and inactive plugins)', 'godam' ) . '</li>';
		echo '<li>' . esc_html__( 'Usage data (Interactions, navigation, session replays, heatmaps, and errors via PostHog)', 'godam' ) . '</li>';
		echo '</ul>';
		echo '<p style="margin-bottom: 0;">';
		printf(
			wp_kses(
				/* translators: %s: PostHog privacy policy URL */
				__( 'We are using PostHog to collect anonymous data. <a href="%s" target="_blank">Learn more</a>. This can be disabled from the settings on the Help page.', 'godam' ),
				array(
					'a' => array(
						'href'   => array(),
						'target' => array(),
					),
				)
			),
			esc_url( $policy_url )
		);
		echo '</p></div>';
		echo '</p><p class="submit">';
		echo '&nbsp;<a href="' . esc_url( $optin_url ) . '" class="button-primary button-large">' . esc_html__( 'Allow', 'godam' ) . '</a>';
		echo '&nbsp;<a href="' . esc_url( $optout_url ) . '" class="button-secondary button-large">' . esc_html__( 'No thanks', 'godam' ) . '</a>';
		echo '</p></div>';
	}

	/**
	 * Handle PostHog tracking action.
	 *
	 * @since 1.4.9
	 */
	public function handle_posthog_tracking_action() {
		if ( ! isset( $_GET['godam_tracker_optin'] ) && ! isset( $_GET['godam_tracker_optout'] ) ) {
			return;
		}

		$nonce = isset( $_GET['_wpnonce'] ) ? sanitize_text_field( wp_unslash( $_GET['_wpnonce'] ) ) : '';

		if ( ! wp_verify_nonce( $nonce, 'godam_tracker_action' ) ) {
			return;
		}

		if ( ! current_user_can( 'manage_options' ) ) {
			return;
		}

		$settings = get_option( 'rtgodam-settings', array() );

		if ( ! isset( $settings['general'] ) ) {
			$settings['general'] = array();
		}

		if ( isset( $_GET['godam_tracker_optin'] ) && 'true' === $_GET['godam_tracker_optin'] ) {
			$settings['general']['enable_posthog_tracking'] = true;
			$settings['general']['posthog_initialized']     = true;
		} elseif ( isset( $_GET['godam_tracker_optout'] ) && 'true' === $_GET['godam_tracker_optout'] ) {
			$settings['general']['enable_posthog_tracking'] = false;
			$settings['general']['posthog_initialized']     = true;
		}

		update_option( 'rtgodam-settings', $settings );

		wp_safe_redirect( esc_url_raw( remove_query_arg( array( 'godam_tracker_optin', 'godam_tracker_optout', '_wpnonce' ) ) ) );
		exit;
	}
}
