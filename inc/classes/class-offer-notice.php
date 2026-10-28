<?php
/**
 * Seasonal offer notice shown in wp-admin to free and trial sites.
 *
 * The current campaign is the Halloween 2026 offer: 50% off the first payment
 * with the code SPOOKY50, through November 9. The message names the
 * integrations the site already uses, so a LifterLMS site reads about course
 * videos and a WooCommerce store about shoppable video.
 *
 * @package GoDAM
 * @since   2.5.2
 */

namespace RTGODAM\Inc;

defined( 'ABSPATH' ) || exit;

/**
 * Class Offer_Notice
 *
 * @since 2.5.2
 */
class Offer_Notice {

	/**
	 * Option that stores the dismissal for this campaign only.
	 *
	 * A new key per campaign, so a site that dismissed an earlier offer still sees this one.
	 *
	 * @var string
	 */
	const DISMISS_OPTION = 'rtgodam_offer_halloween_2026_dismissed';

	/**
	 * Last moment the notice shows, in the site's time zone. Matches the offer on godam.io.
	 *
	 * @var string
	 */
	const END_TIME = '2026-11-09 23:59:59';

	/**
	 * Offer code.
	 *
	 * @var string
	 */
	const CODE = 'SPOOKY50';

	/**
	 * AJAX action and nonce action for dismissing the notice.
	 *
	 * @var string
	 */
	const DISMISS_ACTION = 'godam_dismiss_offer_notice';

	/**
	 * Whether the notice should show to the current user right now.
	 *
	 * Only site administrators of free or trial sites see it, never paid sites,
	 * and only until the campaign ends or an administrator dismisses it.
	 *
	 * @since 2.5.2
	 *
	 * @param \DateTimeInterface|null $now       The moment to check, now when null. Tests pass a fixed time.
	 * @param array|null              $user_data The site's GoDAM account data, read from rtgodam_get_user_data() when null.
	 *
	 * @return bool
	 */
	public static function should_show( $now = null, $user_data = null ) {
		if ( ! current_user_can( 'manage_options' ) ) {
			return false;
		}

		if ( get_option( self::DISMISS_OPTION, false ) ) {
			return false;
		}

		$timezone = wp_timezone();
		$now      = $now ? $now : new \DateTime( 'now', $timezone );
		$end_time = new \DateTime( self::END_TIME, $timezone );

		if ( $now > $end_time ) {
			return false;
		}

		return self::is_free_or_trial_site( $user_data );
	}

	/**
	 * Whether the site is on no plan (no valid API key) or on the free trial.
	 *
	 * The 60-day trial is a Free plan on GoDAM Central, so it is told apart by
	 * `active_plan` "Free" with an end date still ahead, the same test as the
	 * trial banner on GoDAM's own pages.
	 *
	 * @since 2.5.2
	 *
	 * @param array|null $user_data The site's GoDAM account data, read from rtgodam_get_user_data() when null.
	 *
	 * @return bool
	 */
	public static function is_free_or_trial_site( $user_data = null ) {
		$user_data = is_array( $user_data ) ? $user_data : rtgodam_get_user_data();

		if ( empty( $user_data['valid_api_key'] ) ) {
			return true;
		}

		$api_data = isset( $user_data['user_data'] ) && is_array( $user_data['user_data'] ) ? $user_data['user_data'] : array();
		$plan     = isset( $api_data['active_plan'] ) ? strtolower( (string) $api_data['active_plan'] ) : '';
		$end_date = isset( $api_data['end_date'] ) ? strtotime( (string) $api_data['end_date'] . ' UTC' ) : false;

		return 'free' === $plan && $end_date && $end_date > time();
	}

	/**
	 * The integrations GoDAM supports that are active on this site, in message order.
	 *
	 * @since 2.5.2
	 *
	 * @return array List of arrays with `key`, `name` and, for form plugins, `recorder`.
	 */
	public static function get_active_integrations() {
		if ( ! function_exists( 'is_plugin_active' ) ) {
			require_once ABSPATH . 'wp-admin/includes/plugin.php';
		}

		$checks = array(
			array( 'lifterlms', 'LifterLMS', is_plugin_active( 'lifterlms/lifterlms.php' ), false ),
			array( 'woocommerce', 'WooCommerce', class_exists( 'WooCommerce' ), false ),
			array( 'elementor', 'Elementor', class_exists( '\Elementor\Plugin' ), false ),
			array( 'wpbakery', 'WPBakery', is_plugin_active( 'js_composer/js_composer.php' ), false ),
			array( 'forms', 'Gravity Forms', is_plugin_active( 'gravityforms/gravityforms.php' ), true ),
			array( 'forms', 'WPForms', is_plugin_active( 'wpforms/wpforms.php' ) || is_plugin_active( 'wpforms-lite/wpforms.php' ), true ),
			array( 'forms', 'Fluent Forms', is_plugin_active( 'fluentform/fluentform.php' ), true ),
			array( 'forms', 'Ninja Forms', is_plugin_active( 'ninja-forms/ninja-forms.php' ), true ),
			array( 'forms', 'SureForms', is_plugin_active( 'sureforms/sureforms.php' ), true ),
			array( 'forms', 'Everest Forms', is_plugin_active( 'everest-forms/everest-forms.php' ), true ),
			array( 'forms', 'Contact Form 7', is_plugin_active( 'contact-form-7/wp-contact-form-7.php' ), false ),
			array( 'forms', 'Forminator', is_plugin_active( 'forminator/forminator.php' ), false ),
			array( 'forms', 'MetForm', is_plugin_active( 'metform/metform.php' ), false ),
			array( 'forms', 'Jetpack Forms', class_exists( 'Automattic\Jetpack\Forms\ContactForm\Contact_Form' ), false ),
		);

		$active = array();
		foreach ( $checks as $check ) {
			if ( $check[2] ) {
				$active[] = array(
					'key'      => $check[0],
					'name'     => $check[1],
					'recorder' => $check[3],
				);
			}
		}

		return $active;
	}

	/**
	 * The message line for the first matching integration, and its key for the link's utm_content.
	 *
	 * Order: LifterLMS, WooCommerce, Elementor, WPBakery, form plugins, then a general line.
	 *
	 * @since 2.5.2
	 *
	 * @param array $integrations Output of get_active_integrations().
	 *
	 * @return array `key` and `message`.
	 */
	public static function get_message( $integrations ) {
		$first = empty( $integrations ) ? 'general' : $integrations[0]['key'];

		switch ( $first ) {
			case 'lifterlms':
				$message = __( 'Host your LifterLMS course videos on GoDAM, with adaptive streaming and video analytics. We move up to 100 of your videos for free.', 'godam' );
				break;

			case 'woocommerce':
				$message = __( 'Add product hotspots and shoppable video to your WooCommerce store with the GoDAM for Woo add-on, with the order value each video brings in.', 'godam' );
				break;

			case 'elementor':
			case 'wpbakery':
				$message = sprintf(
					/* translators: %s: page builder name, Elementor or WPBakery. */
					__( 'Add GoDAM videos, galleries and audio to your %s pages, with adaptive streaming on every paid plan.', 'godam' ),
					$integrations[0]['name']
				);
				break;

			case 'forms':
				$forms    = array_values( array_filter( $integrations, static fn( $item ) => 'forms' === $item['key'] ) );
				$names    = array_column( array_slice( $forms, 0, 2 ), 'name' );
				$recorder = in_array( true, array_column( $forms, 'recorder' ), true );
				$list     = 2 === count( $names )
					/* translators: 1: first form plugin name, 2: second form plugin name. */
					? sprintf( __( '%1$s and %2$s', 'godam' ), $names[0], $names[1] )
					: $names[0];

				$message = $recorder
					/* translators: %s: one or two form plugin names. */
					? sprintf( __( 'Show your %s forms inside your videos, and collect video and audio answers with the GoDAM recorder field.', 'godam' ), $list )
					/* translators: %s: one or two form plugin names. */
					: sprintf( __( 'Show your %s forms inside your videos, so viewers can sign up without leaving the video.', 'godam' ), $list );
				break;

			default:
				$first   = 'general';
				$message = __( 'Video hosting, transcoding and analytics for your WordPress media, with interactive layers and a custom player.', 'godam' );
		}

		return array(
			'key'     => $first,
			'message' => $message,
		);
	}

	/**
	 * Print the notice.
	 *
	 * @since 2.5.2
	 *
	 * @param string $placement Where it shows, for the link's tracking: `dashboard` or `media-library`.
	 *
	 * @return void
	 */
	public static function render( $placement ) {
		if ( ! self::should_show() ) {
			return;
		}

		$integrations = self::get_active_integrations();
		$message      = self::get_message( $integrations );
		$chips        = array_slice( array_unique( array_column( $integrations, 'name' ) ), 0, 3 );
		$host         = wp_parse_url( home_url(), PHP_URL_HOST );
		$claim_url    = add_query_arg(
			array(
				'utm_campaign' => 'halloween-2026',
				'utm_source'   => $host,
				'utm_medium'   => 'plugin',
				'utm_content'  => $placement . '-' . $message['key'],
			),
			RTGODAM_IO_API_BASE . '/pricing/'
		);
		?>
		<div class="notice rtgodam-offer-notice" data-nonce="<?php echo esc_attr( wp_create_nonce( self::DISMISS_ACTION ) ); ?>">
			<svg class="rtgodam-offer-notice__art" viewBox="0 0 92 104" aria-hidden="true" focusable="false">
				<g stroke="#b9aee8" stroke-width="1" fill="none">
					<path d="M0 0 L80 0"/><path d="M0 0 L70 40"/><path d="M0 0 L40 72"/><path d="M0 0 L0 90"/>
					<path d="M18 0 Q20 12 12 14 Q6 18 0 18"/><path d="M38 0 Q42 22 28 30 Q14 36 0 38"/><path d="M58 0 Q62 32 42 46 Q22 56 0 58"/>
				</g>
				<line x1="62" y1="14" x2="62" y2="62" stroke="#787c82" stroke-width="1"/>
				<g fill="#2b1a66"><ellipse cx="62" cy="70" rx="6.5" ry="7.5"/><circle cx="62" cy="60" r="4.5"/></g>
				<g stroke="#2b1a66" stroke-width="1.5" fill="none" stroke-linecap="round"><path d="M57 65 l-7 -5 M56 70 l-8 0 M57 75 l-7 6 M67 65 l7 -5 M68 70 l8 0 M67 75 l7 6"/></g>
				<circle cx="60.5" cy="59" r="1" fill="#fff"/><circle cx="63.5" cy="59" r="1" fill="#fff"/>
			</svg>
			<div class="rtgodam-offer-notice__body">
				<p class="rtgodam-offer-notice__title"><?php esc_html_e( 'No tricks, just treats: 50% off your first GoDAM payment', 'godam' ); ?></p>
				<p class="rtgodam-offer-notice__text"><?php echo esc_html( $message['message'] ); ?></p>
				<?php if ( ! empty( $chips ) ) : ?>
					<p class="rtgodam-offer-notice__chips">
						<?php foreach ( $chips as $chip ) : ?>
							<span class="rtgodam-offer-notice__chip">
								<?php
								/* translators: %s: plugin name, for example LifterLMS. */
								echo esc_html( sprintf( __( 'Works with %s', 'godam' ), $chip ) );
								?>
							</span>
						<?php endforeach; ?>
					</p>
				<?php endif; ?>
				<p class="rtgodam-offer-notice__actions">
					<a class="button button-primary" href="<?php echo esc_url( $claim_url ); ?>" target="_blank" rel="noopener noreferrer"><?php esc_html_e( 'Claim 50% off', 'godam' ); ?></a>
					<?php
					/* translators: %s: offer code. */
					$copy_label = sprintf( __( 'Copy the code %s', 'godam' ), self::CODE );
					?>
					<button type="button" class="button button-secondary rtgodam-offer-notice__copy" data-code="<?php echo esc_attr( self::CODE ); ?>" data-copied="<?php esc_attr_e( 'Copied', 'godam' ); ?>" aria-label="<?php echo esc_attr( $copy_label ); ?>"><?php esc_html_e( 'Copy code', 'godam' ); ?></button>
					<span class="screen-reader-text rtgodam-offer-notice__status" role="status" aria-live="polite" data-message="<?php esc_attr_e( 'Code copied', 'godam' ); ?>"></span>
					<span class="rtgodam-offer-notice__code">
						<?php
						echo wp_kses(
							sprintf(
								/* translators: 1: offer code, 2: last day of the offer. */
								esc_html__( 'Code %1$s, through %2$s', 'godam' ),
								'<code>' . esc_html( self::CODE ) . '</code>',
								esc_html__( 'November 9', 'godam' )
							),
							array( 'code' => array() )
						);
						?>
					</span>
				</p>
			</div>
			<button type="button" class="notice-dismiss rtgodam-offer-notice__dismiss"><span class="screen-reader-text"><?php esc_html_e( 'Dismiss this offer', 'godam' ); ?></span></button>
		</div>
		<?php
	}

	/**
	 * Save the dismissal for the whole site.
	 *
	 * @since 2.5.2
	 *
	 * @return void
	 */
	public static function dismiss() {
		check_ajax_referer( self::DISMISS_ACTION, 'nonce' );

		if ( ! current_user_can( 'manage_options' ) ) {
			wp_send_json_error( array( 'message' => __( 'You are not allowed to dismiss this offer.', 'godam' ) ), 403 );
		}

		update_option( self::DISMISS_OPTION, time(), false );

		wp_send_json_success();
	}
}
