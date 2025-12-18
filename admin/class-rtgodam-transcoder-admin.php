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

		// If more than 3 days have passed and no api key is activated, show scheduled notice.
		if ( empty( $api_key ) && $days_since_activation >= 3 ) {
			$this->scheduled_admin_notice();
			return;
		}

		// Otherwise, show regular admin notice.
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
	 * Display the scheduled admin notice for activating the API key.
	 */
	public function scheduled_admin_notice() {
		$logo_url = plugins_url( 'assets/src/images/godam-logo.png', __DIR__ );

		?>
		<div class="notice notice-warning is-dismissible rt-transcoder-api-key-notice">
			<div class="godam-notice-header">
				<img src="<?php echo esc_url( $logo_url ); ?>" alt="<?php esc_attr_e( 'GoDAM Logo', 'godam' ); ?>" class="godam-logo" />
				<div>
					<p><strong><?php echo esc_html__( 'Hey, you’re missing out on our advanced features!', 'godam' ); ?></strong></p>
					<p><?php echo esc_html__( 'Unlock high-speed transcoding, advanced analytics, adaptive streaming, and more by activating your API key.', 'godam' ); ?></p>
					<p>
						<a href="<?php echo esc_url( admin_url( 'admin.php?page=rtgodam_settings#video-settings' ) ); ?>" class="button button-primary">
							<?php echo esc_html__( 'Activate API Key', 'godam' ); ?>
						</a>
						<a href="https://godam.io/adaptive-bitrate-streaming/" class="button button-secondary" target="_blank">
							<?php echo esc_html__( 'Learn More', 'godam' ); ?>
						</a>
					</p>
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
				esc_url( RTGODAM_IO_API_BASE . '/pricing?utm_campaign=bfcm-offer&utm_source=' . $host . '&utm_medium=plugin&utm_content=dashboard-banner' ),
				esc_attr__( 'Claim the GoDAM Black Friday & Cyber Monday offer', 'godam' ),
				esc_url( $banner_image ),
				esc_attr__( 'Black Friday & Cyber Monday offer from GoDAM', 'godam' ),
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
	 * Check if the current screen is the dashboard.
	 *
	 * @return bool
	 */
	public function is_dashboard_screen() {
		$current_screen = get_current_screen();
		return isset( $current_screen->id ) && 'dashboard' === $current_screen->id;
	}
}
