<?php
/**
 * The admin-specific functionality of the plugin.
 *
 * @since      1.0.0
 *
 * @package    Transcoder
 * @subpackage Transcoder/Admin
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * The admin-specific functionality of the plugin.
 *
 * @since       1.0.0
 *
 * @package     Transcoder
 * @subpackage  Transcoder/Admin
 */
class RT_Transcoder_Admin {

	/**
	 * The object of RT_Transcoder_Handler class.
	 *
	 * @since    1.0.0
	 * @access   private
	 * @var      object    $transcoder_handler    The object of RT_Transcoder_Handler class.
	 */
	private $transcoder_handler;

	/**
	 * The api key of transcoding service subscription.
	 *
	 * @since    1.0.0
	 * @access   private
	 * @var      string    $api_key    The api key of transcoding service subscription.
	 */
	private $api_key = false;

	/**
	 * The api key of transcoding service subscription.
	 *
	 * @since    1.0.0
	 * @access   private
	 * @var      string    $stored_api_key    The api key of transcoding service subscription.
	 */
	private $stored_api_key = false;

	/**
	 * Initialize the class and set its properties.
	 *
	 * @since    1.0.0
	 */
	public function __construct() {

		$this->api_key        = get_site_option( 'rt-transcoding-api-key' );
		$this->stored_api_key = get_site_option( 'rt-transcoding-api-key-stored' );

		$this->load_translation();

		if ( ! class_exists( 'RT_Progress' ) ) {
			include_once GODAM_PATH . 'admin/godam-transcoder-progressbar.php'; // phpcs:ignore WordPressVIPMinimum.Files.IncludingFile.UsingCustomConstant
		}

		include_once GODAM_PATH . 'admin/godam-transcoder-handler.php'; // phpcs:ignore WordPressVIPMinimum.Files.IncludingFile.UsingCustomConstant
		include_once GODAM_PATH . 'admin/godam-transcoder-actions.php'; // phpcs:ignore WordPressVIPMinimum.Files.IncludingFile.UsingCustomConstant

		add_action( 'admin_enqueue_scripts', array( $this, 'enqueue_scripts_styles' ) );

		/**
		 * Commented our this code as changing the thumbnail logic.
		 *
		 * Now the thumbnail will show below the video in the video attachment.
		 * The thumbnail setting and getting logic is moved to REST API.
		 */
		// add_filter( 'attachment_fields_to_edit', array( $this, 'edit_video_thumbnail' ), 11, 2 );
		// add_filter( 'attachment_fields_to_save', array( $this, 'save_video_thumbnail' ), 11, 1 );
		add_action( 'admin_notices', array( $this, 'add_settings_errors' ) );

		$this->transcoder_handler = new RT_Transcoder_Handler();

		if ( is_admin() ) {
			add_action( 'admin_init', array( $this, 'register_transcoder_settings' ) );
			if ( class_exists( 'RTMediaEncoding' ) ) {
				$old_rtmedia_encoding_key = get_site_option( 'rtmedia-encoding-api-key' );
				if ( ! empty( $old_rtmedia_encoding_key ) ) {
					update_site_option( 'rtmedia-encoding-api-key', '' );
				}
				add_action( 'init', array( $this, 'disable_encoding' ) );
			}
			if ( is_multisite() ) {
				add_action( 'network_admin_notices', array( $this, 'license_activation_admin_notice' ) );
			}
			add_action( 'admin_notices', array( $this, 'license_activation_admin_notice' ) );
		}

		if ( class_exists( 'RTMedia' ) ) {
			if ( ! function_exists( 'get_plugin_data' ) ) {
				include_once ABSPATH . 'wp-admin/includes/plugin.php';
			}
			$rtmedia_plugin_info = get_plugin_data( RTMEDIA_PATH . 'index.php' );

			// Show admin notice when Transcoder pluign active and user using rtMedia version 4.0.7.
			if ( version_compare( $rtmedia_plugin_info['Version'], '4.0.7', '<=' ) ) {
				if ( is_multisite() ) {
					add_action( 'network_admin_notices', array( $this, 'transcoder_admin_notice' ) );
				}
				add_action( 'admin_notices', array( $this, 'transcoder_admin_notice' ) );
				add_action( 'wp_ajax_transcoder_hide_admin_notice', array( $this, 'transcoder_hide_admin_notice' ) );
			}
			add_action( 'admin_head', array( $this, 'rtmedia_hide_encoding_tab' ) );

			add_filter( 'wp_mediaelement_fallback', array( $this, 'mediaelement_add_class' ), 20, 2 );
		}
	}

	/**
	 * Display errors if any while settings are save.
	 */
	public function add_settings_errors() {
		settings_errors( 'rt-transcoder-settings-group' );
	}

	/**
	 * Register transcoder settings.
	 *
	 * @since    1.0.0
	 */
	public function register_transcoder_settings() {
		register_setting( 'rt-transcoder-settings-group', 'number_of_thumbs' );
		register_setting( 'rt-transcoder-settings-group', 'rtt_override_thumbnail' );
		register_setting( 'rt-transcoder-settings-group', 'rtt_client_check_status_button' );
	}

	/**
	 * Load language translation.
	 *
	 * @since    1.0.0
	 */
	public function load_translation() {
		load_plugin_textdomain( 'godam', false, basename( GODAM_PATH ) . '/languages/' );
	}

	/**
	 * Remove actions and filters from old rtMedia (v4.0.2) plugin.
	 *
	 * @since   1.0.0
	 */
	public function disable_encoding() {
		global $rtmedia_admin;
		$rtmedia_encoding = $rtmedia_admin->rtmedia_encoding;
		if ( ! empty( $rtmedia_admin ) ) {
			remove_filter( 'media_row_actions', array( $rtmedia_admin, 'add_reencode_link' ) );
			remove_action( 'admin_head-upload.php', array( $rtmedia_admin, 'add_bulk_actions_regenerate' ) );
		}
		if ( isset( $rtmedia_admin->rtmedia_encoding ) ) {
			$rtmedia_encoding = $rtmedia_admin->rtmedia_encoding;
			remove_action( 'rtmedia_after_add_media', array( $rtmedia_encoding, 'encoding' ) );
			remove_action( 'rtmedia_before_default_admin_widgets', array( $rtmedia_encoding, 'usage_widget' ) );
			remove_action( 'admin_init', array( $rtmedia_encoding, 'save_api_key' ), 1 );
		}
	}

	/**
	 * Load styles and scripts
	 *
	 * @since    1.0.0
	 */
	public function enqueue_scripts_styles() {
		global $pagenow;

		$page = transcoder_filter_input( INPUT_GET, 'page', FILTER_SANITIZE_FULL_SPECIAL_CHARS );

		if ( 'admin.php' !== $pagenow || 'rt-transcoder' !== $page ) {
			return;
		}
		$suffix = defined( 'SCRIPT_DEBUG' ) && SCRIPT_DEBUG ? '' : '.min';

		wp_enqueue_style( 'rt-transcoder-admin-css', GODAM_URL . 'admin/css/rt-transcoder-admin' . $suffix . '.css', array(), GODAM_VERSION );
		wp_register_script( 'rt-transcoder-main', GODAM_URL . 'admin/js/rt-transcoder-admin' . $suffix . '.js', array( 'jquery' ), GODAM_VERSION, true );

		$localize_script_data = array(
			'admin_url'                             => esc_url( admin_url() ),
			'loader_image'                          => esc_url( admin_url( 'images/loading.gif' ) ),
			'disable_encoding'                      => esc_html__( 'Are you sure you want to disable the transcoding service?', 'godam' ),
			'enable_encoding'                       => esc_html__( 'Are you sure you want to enable the transcoding service?', 'godam' ),
			'something_went_wrong'                  => esc_html__( 'Something went wrong. Please ', 'godam' ) . '<a href onclick="location.reload();">' . esc_html__( 'refresh', 'godam' ) . '</a>' . esc_html__( ' page.', 'godam' ),
			'error_empty_key'                       => esc_html__( 'Please enter the license key.', 'godam' ),
			'security_nonce_for_enabling_encoding'  => wp_create_nonce( 'rt_enable_transcoding' ),
			'security_nonce_for_disabling_encoding' => wp_create_nonce( 'rt_disable_transcoding' ),
		);

		wp_localize_script( 'rt-transcoder-main', 'rt_transcoder_script', $localize_script_data );

		wp_enqueue_script( 'rt-transcoder-main' );
	}

	/**
	 * Create subscription form for various subscription plans.
	 *
	 * @since    1.0.0
	 *
	 * @param string $name   The name of subscription plan.
	 * @param float  $price  The price of subscription plan.
	 * @param bool   $force  If true then it always show subscriobe form.
	 * @return string
	 */
	public function transcoding_subscription_button( $name = 'No Name', $price = '0', $force = false ) {
		if ( $this->api_key ) {
			$this->transcoder_handler->update_usage( $this->api_key );
		}

		$usage_details = get_site_option( 'rt-transcoding-usage' );

		if ( isset( $usage_details[ $this->api_key ]->plan->name ) && ( strtolower( $usage_details[ $this->api_key ]->plan->name ) === strtolower( $name ) ) && $usage_details[ $this->api_key ]->sub_status && ! $force ) {
			$form = '<button disabled="disabled" type="submit" class="button button-primary bpm-unsubscribe">' . esc_html__( 'Current Plan', 'godam' ) . '</button>';
		} else {
			$plan_name = 'free' === $name ? 'Try Now' : 'Subscribe';
			$form      = '<a href="https://rtmedia.io/?transcoding-plan=' . $name . '" target="_blank" class="button button-primary">
						' . esc_html( $plan_name ) . '
					</a>';
		}

		return $form;
	}

	/**
	 * Display all video thumbnails on attachment edit page.
	 *
	 * @since   1.0.0
	 *
	 * @param array   $form_fields  An array of attachment form fields.
	 * @param WP_Post $post         The WP_Post attachment object.
	 * @return array $form_fields
	 */
	public function edit_video_thumbnail( $form_fields, $post ) {

		if ( isset( $post->post_mime_type ) ) {
			$media_type = explode( '/', $post->post_mime_type );
			if ( is_array( $media_type ) && 'video' === $media_type[0] ) {
				$media_id        = $post->ID;
				$thumbnail_array = get_post_meta( $media_id, '_rt_media_thumbnails', true );

				if ( empty( $thumbnail_array ) ) {
					$thumbnail_array = get_post_meta( $media_id, 'rtmedia_media_thumbnails', true );
				}

				$wp_video_thumbnail = get_post_meta( $media_id, '_rt_media_video_thumbnail', true );

				$video_thumb_html = '';
				if ( is_array( $thumbnail_array ) ) {
					$video_thumb_html .= '<ul> ';
					/* for WordPress backward compatibility */
					if ( function_exists( 'wp_get_upload_dir' ) ) {
						$uploads = wp_get_upload_dir();
					} else {
						$uploads = wp_upload_dir();
					}

					foreach ( $thumbnail_array as $key => $thumbnail_src ) {
						$checked          = false;
						$thumbnail_src_og = $thumbnail_src;
						if ( $wp_video_thumbnail === $thumbnail_src ) {
							$checked = 'checked=checked';
						}

						$file_url = $thumbnail_src;

						if ( 0 === strpos( $file_url, $uploads['baseurl'] ) ) {
							$thumbnail_src = $file_url;
						} else {
							$thumbnail_src = $uploads['baseurl'] . '/' . $file_url;
						}
						$thumbnail_src     = apply_filters( 'transcoded_file_url', $thumbnail_src, $media_id );
						$count             = $key + 1;
						$video_thumb_html .= '<li style="width: 150px;display: inline-block;"> ' .
							'<label for="rtmedia-upload-select-thumbnail-' . esc_attr( $count ) . '"> ' .
							'<input type="radio" ' . esc_attr( $checked ) . ' id="rtmedia-upload-select-thumbnail-' . esc_attr( $count ) . '" value="' . esc_attr( $thumbnail_src_og ) . '" name="rtmedia-thumbnail" /> ' .
							'<img src=" ' . esc_url( $thumbnail_src ) . '" style="max-height: 120px;max-width: 120px; vertical-align: middle;" /> ' .
							'</label></li>';
					}

					$video_thumb_html                      .= '</ul>';
					$form_fields['rtmedia_video_thumbnail'] = array(
						'label' => 'Video Thumbnails',
						'input' => 'html',
						'html'  => $video_thumb_html,
					);
				}
			}
		}
		return $form_fields;
	}

	/**
	 * Display all video thumbnails on attachment edit page.
	 *
	 * @since   1.0.0
	 *
	 * @param array   $form_fields  An array of attachment form fields.
	 * @param WP_Post $post         The WP_Post attachment object.
	 * @return array $form_fields
	 */
	public function edit_video_thumbnail_( $form_fields, $post ) {
		if ( isset( $post->post_mime_type ) ) {
			$media_type = explode( '/', $post->post_mime_type );
			if ( is_array( $media_type ) && 'video' === $media_type[0] ) {
				$media_id        = $post->ID;
				$thumbnail_array = get_post_meta( $media_id, '_rt_media_thumbnails', true );

				if ( empty( $thumbnail_array ) ) {
					$thumbnail_array = get_post_meta( $media_id, 'rtmedia_media_thumbnails', true );
				}

				$rtmedia_model    = new RTMediaModel();
				$rtmedia_media    = $rtmedia_model->get( array( 'media_id' => $media_id ) );
				$video_thumb_html = '';
				if ( is_array( $thumbnail_array ) ) {

					/* for WordPress backward compatibility */
					if ( function_exists( 'wp_get_upload_dir' ) ) {
						$uploads = wp_get_upload_dir();
					} else {
						$uploads = wp_upload_dir();
					}
					$base_url = $uploads['baseurl'];

					$video_thumb_html .= '<ul> ';

					foreach ( $thumbnail_array as $key => $thumbnail_src ) {
						$checked           = checked( $thumbnail_src, $rtmedia_media[0]->cover_art, false );
						$count             = $key + 1;
						$final_file_url    = $base_url . '/' . $thumbnail_src;
						$final_file_url    = apply_filters( 'transcoded_file_url', $final_file_url, $media_id );
						$video_thumb_html .= '<li style="width: 150px;display: inline-block;">
								<label for="rtmedia-upload-select-thumbnail-' . esc_attr( $count ) . '">
								<input type="radio" ' . esc_attr( $checked ) . ' id="rtmedia-upload-select-thumbnail-' . esc_attr( $count ) . '" value="' . esc_attr( $thumbnail_src ) . '" name="rtmedia-thumbnail" />
								<img src=" ' . esc_url( $final_file_url ) . '" style="max-height: 120px;max-width: 120px; vertical-align: middle;" />
								</label></li> ';
					}

					$video_thumb_html                      .= '  </ul>';
					$form_fields['rtmedia_video_thumbnail'] = array(
						'label' => 'Video Thumbnails',
						'input' => 'html',
						'html'  => $video_thumb_html,
					);
				}
			}
		}

		return $form_fields;
	}

	/**
	 * Save selected video thumbnail in attachment meta.
	 * Selected thumbnail use as cover art for buddypress activity if video was uploaded in activity.
	 *
	 * @since   1.0.0
	 *
	 * @param array $post       An array of post data.
	 * @return array $form_fields
	 */
	public function save_video_thumbnail( $post ) {

		$rtmedia_thumbnail = transcoder_filter_input( INPUT_POST, 'rtmedia-thumbnail', FILTER_SANITIZE_FULL_SPECIAL_CHARS );
		$id                = ( ! empty( $post['ID'] ) && 0 < intval( $post['ID'] ) ) ? intval( $post['ID'] ) : 0;

		if ( isset( $rtmedia_thumbnail ) ) {
			if ( class_exists( 'rtMedia' ) ) {
				$file_url = $rtmedia_thumbnail;
				/* for WordPress backward compatibility */
				if ( function_exists( 'wp_get_upload_dir' ) ) {
					$uploads = wp_get_upload_dir();
				} else {
					$uploads = wp_upload_dir();
				}
				if ( 0 === strpos( $file_url, $uploads['baseurl'] ) ) {
					$final_file_url = $file_url;
				} else {
					$final_file_url = $uploads['baseurl'] . '/' . $file_url;
				}

				$rtmedia_model = new RTMediaModel();
				$media         = $rtmedia_model->get( array( 'media_id' => $id ) );
				$media_id      = $media[0]->id;
				$rtmedia_model->update( array( 'cover_art' => $final_file_url ), array( 'media_id' => $id ) );
				rtt_update_activity_after_thumb_set( $media_id );
			}
			update_post_meta( $id, '_rt_media_video_thumbnail', $rtmedia_thumbnail );
		}

		return $post;
	}

	/**
	 * Display admin notice.
	 *
	 * @since   1.0.0
	 */
	public function transcoder_admin_notice() {
		$show_notice = get_site_option( 'transcoder_admin_notice', 1 );

		if ( '1' === $show_notice || 1 === $show_notice ) :
			?>
		<div class="notice notice-info transcoder-notice is-dismissible">
			<?php wp_nonce_field( '_transcoder_hide_notice_', 'transcoder_hide_notice_nonce' ); ?>
			<p>
				<?php esc_html_e( 'rtMedia encoding service has been disabled because you are using Transcoder plugin.', 'godam' ); ?>
			</p>
		</div>
		<script type="text/javascript">
			jQuery( document ).ready( function() {
				jQuery( '.transcoder-notice.is-dismissible' ).on( 'click', '.notice-dismiss', function() {
					var data = {
						action: 'transcoder_hide_admin_notice',
						transcoder_notice_nonce: jQuery('#transcoder_hide_notice_nonce').val()
					};
					jQuery.post( ajaxurl, data, function ( response ) {
						jQuery('.transcoder-notice').remove();
					});
				});
			});
		</script>
			<?php
		endif;
	}

	/**
	 * Set option to hide admin notice when user click on dismiss button.
	 *
	 * @since   1.0.0
	 */
	public function transcoder_hide_admin_notice() {
		if ( check_ajax_referer( '_transcoder_hide_notice_', 'transcoder_notice_nonce' ) ) {
			update_site_option( 'transcoder_admin_notice', '0' );
		}
		die();
	}

	/**
	 * Hide encoding tab in old rtMedia plugin.
	 *
	 * @since   1.0.0
	 */
	public function rtmedia_hide_encoding_tab() {
		?>
		<style>
			.rtmedia-tab-title.audiovideo-encoding {
				display: none;
			}
		</style>
		<?php
	}

	/**
	 * Filters the Mediaelement fallback output to add class.
	 *
	 * @since   1.0.0
	 *
	 * @param type $output  Fallback output for no-JS.
	 * @param type $url     Media file URL.
	 *
	 * @return string return fallback output.
	 */
	public function mediaelement_add_class( $output, $url ) {
		return sprintf( '<a class="no-popup" href="%1$s">%1$s</a>', esc_url( $url ) );
	}

	/**
	 * Display admin notice for activating the license and handle dismissal.
	 *
	 * @since 1.0.0
	 */
	public function license_activation_admin_notice() {

		// Get the license key from the site options.
		$license_key = get_site_option( 'rt-transcoding-api-key', '' );

		// Get plugin activation time.
		$activation_time       = get_site_option( 'godam_plugin_activation_time', 0 );
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
		$usage_data = get_site_option( 'rt-transcoding-usage', array() );
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
		$button_link  = ( $button_type === 'activate' ) ? admin_url( 'admin.php?page=godam' ) : admin_url( 'admin.php?page=video_editor' );

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
						<a href="<?php echo esc_url( admin_url( 'admin.php?page=godam' ) ); ?>" class="button button-primary">
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
