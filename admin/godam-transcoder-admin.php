<?php
/**
 * The admin-specific functionality of the plugin.
 *
 * @since      1.0.0
 *
 * @package    Transcoder
 * @subpackage Transcoder/Admin
 */

defined( 'ABSPATH' ) || exit;

/**
 * The admin-specific functionality of the plugin.
 *
 * @since       1.0.0
 *
 * @package     Transcoder
 * @subpackage  Transcoder/Admin
 */
class RTGODAM_Transcoder_Admin {

	/**
	 * Initialize the class and set its properties.
	 *
	 * @since    1.0.0
	 */
	public function __construct() {

		include_once RTGODAM_PATH . 'admin/godam-transcoder-handler.php'; // phpcs:ignore WordPressVIPMinimum.Files.IncludingFile.UsingCustomConstant
		include_once RTGODAM_PATH . 'admin/godam-transcoder-actions.php'; // phpcs:ignore WordPressVIPMinimum.Files.IncludingFile.UsingCustomConstant

		new RTGODAM_Transcoder_Handler();

		if ( is_admin() ) {
			if ( is_multisite() ) {
				add_action( 'network_admin_notices', array( $this, 'license_activation_admin_notice' ) );
			}
			add_action( 'admin_notices', array( $this, 'license_activation_admin_notice' ) );
		}
	}

	/**
	 * Display admin notice for activating the license and handle dismissal.
	 *
	 * @since 1.0.0
	 */
	public function license_activation_admin_notice() {

		// Get the license key from the site options.
		$license_key = get_site_option( 'rtgodam-api-key', '' );

		// Get plugin activation time.
		$activation_time       = get_site_option( 'rtgodam_plugin_activation_time', 0 );
		$days_since_activation = ( time() - $activation_time ) / DAY_IN_SECONDS;

		// If more than 3 days have passed and no license is activated, show scheduled notice.
		if ( empty( $license_key ) && $days_since_activation >= 3 ) {
			$this->scheduled_admin_notice();
			return;
		}

		// Otherwise, show regular admin notice.
		if ( empty( $license_key ) ) {
			$this->render_admin_notice(
				esc_html__( 'Enjoy using our DAM and Video Editor features for free! To unlock transcoding and other features, please activate your license.', 'godam' ),
				'warning',
				true,
				true
			);
			return;
		}

		// Get stored usage data.
		$usage_data = get_site_option( 'rtgodam-usage', array() );
		$usage_data = isset( $usage_data[ $license_key ] ) ? (array) $usage_data[ $license_key ] : null;

		if ( empty( $usage_data ) ) {
			$this->render_admin_notice(
				'Enjoy using our <strong>DAM and Video Editor</strong> features for free! To unlock transcoding and other features, please activate your license',
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
						'Your product is under trial. You will be charged after <strong>%d days</strong>. 
						If you wish to cancel, please visit <a href="https://app.godam.io/subscription/my-account" target="_blank">your subscription settings</a>.',
						$days_until_trial_end
					),
					'warning',
					false,
					false
				);
				return;
			}
		}

		// If the license is Active, no need to show any notice.
		if ( 'Active' === $status ) {
			return;
		}

		// Check subscription expiry and display appropriate messages.
		if ( $subscription_end ) {
			$days_until_deletion = floor( ( $subscription_end + ( $grace_period_days * DAY_IN_SECONDS ) - $current_time ) / DAY_IN_SECONDS );

			if ( $days_until_deletion > 0 ) {
				$this->render_admin_notice(
					sprintf(
						'Your subscription has ended. No further transcoding can be done. 
						Transcoded videos will be removed after <strong>%d days</strong>, and advanced video layers will not be accessible. 
						After the 30-day grace period, already transcoded videos will no longer be served from the CDN. 
						Renew your subscription to keep it up and running.',
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
					'Enjoy using our <strong>DAM and Video Editor</strong> features for free! To unlock transcoding and other features, please activate your license',
					'error',
					true,
					false
				);
				return;
			}
		}

		// Default fallback notice (if none of the above conditions are met).
		$this->render_admin_notice(
			'Enjoy using our <strong>DAM and Video Editor</strong> features for free! To unlock transcoding and other features, please activate your license',
			'warning',
			true,
			false
		);
	}

	/**
	 * Render an admin notice for license activation or expiry warnings.
	 *
	 * @param string $message The message to display.
	 * @param string $notice_type Type of notice (warning, error, etc.).
	 * @param bool   $include_buttons Whether to include action buttons (default: false).
	 * @param bool   $show_godam_message Whether to show the GoDAM update message (default: false).
	 */
	private function render_admin_notice( $message, $notice_type = 'warning', $include_buttons = false, $show_godam_message = false, $button_type = 'editor' ) {
		// Get the GoDAM logo URL.
		$logo_url = plugins_url( 'assets/src/images/godam-logo.png', __DIR__ );

		$button_label = ( $button_type === 'activate' ) ? esc_html__( 'Activate License', 'godam' ) : esc_html__( 'Use Video Editor', 'godam' );
		$button_link  = ( $button_type === 'activate' ) ? admin_url( 'admin.php?page=rtgodam' ) : admin_url( 'admin.php?rtgodam_video_editor' );

		?>
		<div class="notice notice-<?php echo esc_attr( $notice_type ); ?> is-dismissible rt-transcoder-license-notice">

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
	 * Display the scheduled admin notice for activating the license.
	 */
	public function scheduled_admin_notice() {
		$logo_url = plugins_url( 'assets/src/images/godam-logo.png', __DIR__ );

		?>
		<div class="notice notice-warning is-dismissible rt-transcoder-license-notice">
			<div class="godam-notice-header">
				<img src="<?php echo esc_url( $logo_url ); ?>" alt="<?php esc_attr_e( 'GoDAM Logo', 'godam' ); ?>" class="godam-logo" />
				<div>
					<p><strong><?php echo esc_html__( 'Hey, you’re missing out on our advanced features!', 'godam' ); ?></strong></p>
					<p><?php echo esc_html__( 'Unlock high-speed transcoding, advanced analytics, adaptive streaming, and more by activating your license.', 'godam' ); ?></p>
					<p>
						<a href="<?php echo esc_url( admin_url( 'admin.php?page=rtgodam' ) ); ?>" class="button button-primary">
							<?php echo esc_html__( 'Activate License', 'godam' ); ?>
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
}
