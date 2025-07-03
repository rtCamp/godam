<?php
/**
 * Assets class.
 *
 * @package GoDAM
 */

namespace RTGODAM\Inc;

defined( 'ABSPATH' ) || exit;

use RTGODAM\Inc\Traits\Singleton;
use WP_REST_Request;

/**
 * Class Assets
 */
class Pages {
	use Singleton;

	/**
	 * Hardcoded Slugs
	 *
	 * @var string
	 */
	private $menu_slug = 'rtgodam';

	/**
	 * Slug for the video editor page.
	 *
	 * @var string
	 */
	private $video_editor_slug = 'rtgodam_video_editor';

	/**
	 * Slug for the analytics page.
	 *
	 * @var string
	 */
	private $analytics_slug = 'rtgodam_analytics';

	/**
	 * Slug for the help page.
	 *
	 * @var string
	 */
	private $help_slug = 'rtgodam_help';

	/**
	 * Slug for dashboard page
	 *
	 * @var string
	 */
	private $settings_slug = 'rtgodam_settings';

	/**
	 * Menu pag ID.
	 *
	 * @var string
	 */
	private $menu_page_id = 'toplevel_page_rtgodam';

	/**
	 * Video editor page ID.
	 *
	 * @var string
	 */
	private $video_editor_page_id = 'godam_page_rtgodam_video_editor';

	/**
	 * Analytics page ID.
	 *
	 * @var string
	 */
	private $analytics_page_id = 'godam_page_rtgodam_analytics';

	/**
	 * Help page ID.
	 *
	 * @var string
	 */
	private $help_page_id = 'godam_page_rtgodam_help';

	/**
	 * Dashboard ID.
	 *
	 * @var string
	 */
	private $settings_page_id = 'godam_page_rtgodam_settings';

	/**
	 * Construct method.
	 */
	protected function __construct() {
		$this->setup_hooks();
	}

	/**
	 * To setup action/filter.
	 *
	 * @return void
	 */
	protected function setup_hooks() {
		/**
		 * Action
		 */
		add_action( 'admin_menu', array( $this, 'add_admin_pages' ) );
		add_action( 'admin_enqueue_scripts', array( $this, 'admin_enqueue_scripts' ) );
		add_action( 'admin_head', array( $this, 'handle_admin_head' ) );

		// Remove anti-spam field during shortcode render for WPForms in Video Editor Page.
		// @see https://github.com/rtCamp/godam/issues/597 issue link.
		add_filter( 'rest_pre_dispatch', array( $this, 'save_current_rest_api_request' ), 10, 3 );
		add_filter( 'wpforms_frontend_form_data', array( $this, 'remove_antispam_setting_from_wpforms' ), 10 );
	}

	/**
	 * To add admin pages.
	 *
	 * @return void
	 */
	public function add_admin_pages() {
		add_menu_page(
			__( 'GoDAM', 'godam' ),
			__( 'GoDAM', 'godam' ),
			'manage_options',
			$this->menu_slug,
			array( $this, 'render_dashboard_page' ),
			'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjQiIGhlaWdodD0iNjQiIHZpZXdCb3g9IjAgMCA2NCA2NCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHBhdGggZD0iTTI1LjU1NzggMjAuMDkxMUw4LjA1NTg3IDM3LjU5M0wzLjQ2Mzk3IDMzLjAwMTFDMC44MTg1MjEgMzAuMzU1NiAyLjA4MjEgMjUuODMzNiA1LjcyMjI4IDI0Ljk0NjRMMjUuNTYzMiAyMC4wOTY0TDI1LjU1NzggMjAuMDkxMVoiIGZpbGw9IndoaXRlIi8+CjxwYXRoIGQ9Ik00Ny4zNzczIDIxLjg4NjdMNDUuNTQzOCAyOS4zODc1TDIyLjY5NzIgNTIuMjM0MUwxMS4yNjA1IDQwLjc5NzRMMzQuMTY2MiAxNy44OTE2TDQxLjU3MDMgMTYuMDc5NkM0NS4wNzA2IDE1LjIyNDcgNDguMjMyMyAxOC4zODYzIDQ3LjM3MiAyMS44ODEzTDQ3LjM3NzMgMjEuODg2N1oiIGZpbGw9IndoaXRlIi8+CjxwYXRoIGQ9Ik00My41MDU5IDM4LjEwMzZMMzguNjY2NyA1Ny44OTA3QzM3Ljc3NDEgNjEuNTI1NSAzMy4yNTIxIDYyLjc4OTEgMzAuNjA2NiA2MC4xNDM2TDI2LjAzNjMgNTUuNTczMkw0My41MDU5IDM4LjEwMzZaIiBmaWxsPSJ3aGl0ZSIvPgo8L3N2Zz4K',
			30
		);

		add_submenu_page(
			$this->menu_slug,
			__( 'Dashboard', 'godam' ),
			__( 'Dashboard', 'godam' ),
			'manage_options',
			$this->menu_slug,
			array( $this, 'render_dashboard_page' ),
			1
		);

		add_submenu_page(
			$this->menu_slug,
			__( 'Video Editor', 'godam' ),
			__( 'Video Editor', 'godam' ),
			'edit_posts',
			$this->video_editor_slug,
			array( $this, 'render_video_editor_page' ),
			3
		);

		add_submenu_page(
			$this->menu_slug,
			__( 'Analytics', 'godam' ),
			__( 'Analytics', 'godam' ),
			'edit_posts',
			$this->analytics_slug,
			array( $this, 'render_analytics_page' ),
			2
		);

		add_submenu_page(
			$this->menu_slug,
			__( 'Settings', 'godam' ),
			__( 'Settings', 'godam' ),
			'edit_posts',
			$this->settings_slug,
			array( $this, 'render_godam_page' ),
			6
		);

		add_submenu_page(
			$this->menu_slug,
			__( 'Help', 'godam' ),
			__( 'Help', 'godam' ),
			'edit_posts',
			$this->help_slug,
			array( $this, 'render_help_page' ),
			7
		);
	}

	/**
	 * To render the help page.
	 *
	 * @return void
	 */
	public function render_help_page() {
		?>
		<div id="root-video-help"></div>
		<?php
	}

	/**
	 * Handle admin head to remove admin notices.
	 *
	 * @return void
	 */
	public function handle_admin_head() {
		// Get the current screen object.
		$screen = get_current_screen();

		// Check if this is your custom admin page.
		if ( $screen && in_array( $screen->id, array( $this->menu_page_id, $this->video_editor_page_id, $this->analytics_page_id, $this->help_page_id, $this->settings_page_id ) ) ) {
			// Remove admin notices.
			remove_all_actions( 'admin_notices' );
			remove_all_actions( 'all_admin_notices' );

			// Remove "Thank you for creating with WordPress" text.
			add_filter( 'admin_footer_text', '__return_empty_string' );

			// Remove the WordPress version number.
			add_filter( 'update_footer', '__return_empty_string', 11 );
		}
	}

	/**
	 * To render the godam page.
	 *
	 * @return void
	 */
	public function render_godam_page() {
		?>
		<div id="root-easydam">
			<div class="wrap flex min-h-[80vh] gap-4 my-4">
				<!-- Sidebar Skeleton -->
				<div class="max-w-[220px] w-full rounded-lg bg-white shadow-md border border-gray-200">
					<nav class="loading-skeleton flex flex-col gap-4 p-4">
						<!-- Sidebar Tabs -->
						<div class="skeleton-container skeleton-container-short">
							<div class="skeleton-header w-3/4"></div>
						</div>
						<div class="skeleton-container skeleton-container-short">
							<div class="skeleton-header w-3/4"></div>
						</div>
						<div class="skeleton-container skeleton-container-short">
							<div class="skeleton-header w-3/4"></div>
						</div>
					</nav>
				</div>

				<!-- Main Content Skeleton -->
				<div id="main-content" class="w-full p-5 bg-white rounded-lg border">
					<!-- General Settings Form Skeleton -->
					<div class="loading-skeleton flex flex-col gap-4">
						<!-- Title -->
						<div class="skeleton-container skeleton-container-short">
							<div class="skeleton-header w-1/2"></div>
						</div>

						<!-- Input Field Skeleton -->
						<div class="skeleton-container">
							<div class="skeleton-line w-3/4"></div>
							<div class="skeleton-line short w-1/2"></div>
						</div>

						<!-- Buttons Skeleton -->
						<div class="flex gap-2">
							<div class="skeleton-button w-32 h-10"></div>
							<div class="skeleton-button w-40 h-10"></div>
						</div>
					</div>
				</div>
			</div>
		</div>
		<?php
	}

	/**
	 * To render the video-editor page.
	 *
	 * @return void
	 */
	public function render_video_editor_page() {
		?>
		<div id="root-video-editor">
			<div class="progress-bar-wrapper">
				<div class="progress-bar-container">
					<div class="progress-bar">
						<div class="progress-bar-inner"></div>
					</div>
				</div>
			</div>
		</div>
		<?php
	}

	/**
	 * To render the dashboard page.
	 *
	 * @return void
	 */
	public function render_dashboard_page() {
		?>
		<div id="root-video-dashboard"></div>
		<?php
	}

	/**
	 * To render the analytics page.
	 *
	 * @return void
	 */
	public function render_analytics_page() {
		?>
		<div id="root-video-analytics"></div>
		<?php
	}

	/**
	 * To enqueue scripts and styles in admin.
	 *
	 * @return void
	 */
	public function admin_enqueue_scripts() {
		$screen = get_current_screen();

		if ( $screen && in_array( $screen->id, array( $this->menu_page_id, $this->video_editor_page_id, $this->analytics_page_id, $this->settings_page_id, $this->help_page_id ), true ) ) {

			wp_register_script(
				'rtgodam-page-style',
				RTGODAM_URL . 'assets/build/pages/page-css.min.js',
				array( 'wp-components' ),
				filemtime( RTGODAM_PATH . 'assets/build/pages/page-css.min.js' ),
				true
			);

			wp_enqueue_script( 'rtgodam-page-style' );
			wp_enqueue_media();
		}
		// Check if this is your custom admin page.
		if ( $screen && $this->video_editor_page_id === $screen->id ) {
			wp_register_script(
				'transcoder-page-script-video-editor',
				RTGODAM_URL . 'assets/build/pages/video-editor.min.js',
				array( 'wp-element', 'wp-i18n' ),
				filemtime( RTGODAM_PATH . 'assets/build/pages/video-editor.min.js' ),
				true
			);

			$is_gf_active      = is_plugin_active( 'gravityforms/gravityforms.php' );
			$is_cf7_active     = is_plugin_active( 'contact-form-7/wp-contact-form-7.php' );
			$is_wpforms_active = is_plugin_active( 'wpforms-lite/wpforms.php' ) || is_plugin_active( 'wpforms/wpforms.php' );
			$is_jetpack_active = is_plugin_active( 'jetpack/jetpack.php' );

			// Pass dynamic data to React using wp_localize_script.
			wp_localize_script(
				'transcoder-page-script-video-editor',
				'videoData',
				array(
					'nonce'            => wp_create_nonce( 'wp_rest' ),     // WordPress nonce for API requests.
					'currentUserId'    => get_current_user_id(),            // Current user ID.
					'currentUserRoles' => wp_get_current_user()->roles,     // Current user roles.
					'valid_api_key'    => rtgodam_is_api_key_valid(),
					'adminUrl'         => admin_url(),
					'gf_active'        => $is_gf_active,
					'cf7_active'       => $is_cf7_active,
					'wpforms_active'   => $is_wpforms_active,
					'jetpack_active'   => $is_jetpack_active,
				)
			);

			// Enqueue Gravity Forms styles if the plugin is active.
			if ( $is_gf_active ) {
				$this->enqueue_gravity_forms_styles();
			}

			// Enqueue WPForms styles if the plugin is active.
			if ( $is_wpforms_active ) {
				$this->enqueue_wpforms_styles();
			}

			// Enqueue Jetpack Forms styles if the plugin is active.
			if ( $is_jetpack_active ) {
				$this->enqueue_jetpack_forms_styles();
			}

			$rtgodam_user_data = rtgodam_get_user_data();

			wp_localize_script(
				'transcoder-page-script-video-editor',
				'userData',
				$rtgodam_user_data
			);

			wp_set_script_translations( 'transcoder-page-script-video-editor', 'godam', RTGODAM_PATH . 'languages' );
			wp_enqueue_script( 'transcoder-page-script-video-editor' );

			if ( is_plugin_active( 'gravityforms/gravityforms.php' ) ) {
				$this->enqueue_gravity_forms_styles();
			}

			$poll_ajax_style = get_option( 'poll_ajax_style' );

			if ( is_plugin_active( 'wp-polls/wp-polls.php' ) && isset( $poll_ajax_style['loading'] ) && $poll_ajax_style['loading'] ) {

				if ( ! defined( 'WP_POLLS_VERSION' ) ) {
					define( 'WP_POLLS_VERSION', '2.77.3' );
				}

				wp_enqueue_script( 'wp-polls', plugins_url( 'wp-polls/polls-js.js' ), array( 'jquery' ), WP_POLLS_VERSION, true );
				wp_enqueue_style( 'wp-polls', plugins_url( 'wp-polls/polls-css.css' ), false, WP_POLLS_VERSION, 'all' );

				wp_localize_script(
					'wp-polls',
					'pollsL10n',
					array(
						'ajax_url'      => admin_url( 'admin-ajax.php' ),
						'text_wait'     => __( 'Your last request is still being processed. Please wait a while ...', 'godam' ),
						'text_valid'    => __( 'Please choose a valid poll answer.', 'godam' ),
						'text_multiple' => __( 'Maximum number of choices allowed: ', 'godam' ),
						'show_loading'  => (int) $poll_ajax_style['loading'],
						'show_fading'   => (int) $poll_ajax_style['fading'],
					)
				);
			}

			$poll_ajax_style = get_option( 'poll_ajax_style' );

			if ( is_plugin_active( 'wp-polls/wp-polls.php' ) && isset( $poll_ajax_style['loading'] ) && $poll_ajax_style['loading'] ) {

				if ( ! defined( 'WP_POLLS_VERSION' ) ) {
					define( 'WP_POLLS_VERSION', '2.77.3' );
				}

				wp_enqueue_script( 'wp-polls', plugins_url( 'wp-polls/polls-js.js' ), array( 'jquery' ), WP_POLLS_VERSION, true );
				wp_enqueue_style( 'wp-polls', plugins_url( 'wp-polls/polls-css.css' ), false, WP_POLLS_VERSION, 'all' );

				wp_localize_script(
					'wp-polls',
					'pollsL10n',
					array(
						'ajax_url'      => admin_url( 'admin-ajax.php' ),
						'text_wait'     => __( 'Your last request is still being processed. Please wait a while ...', 'godam' ),
						'text_valid'    => __( 'Please choose a valid poll answer.', 'godam' ),
						'text_multiple' => __( 'Maximum number of choices allowed: ', 'godam' ),
						'show_loading'  => (int) $poll_ajax_style['loading'],
						'show_fading'   => (int) $poll_ajax_style['fading'],
					)
				);
			}
		} elseif ( $screen && $this->menu_page_id === $screen->id ) {
			wp_register_script(
				'd3-js',
				RTGODAM_URL . '/assets/src/libs/d3.js',
				array(),
				RTGODAM_VERSION,
				false
			);

			wp_register_script(
				'godam-page-script-dashboard',
				RTGODAM_URL . 'assets/build/pages/dashboard.min.js',
				array( 'wp-element' ),
				filemtime( RTGODAM_PATH . 'assets/build/pages/dashboard.min.js' ),
				true
			);

			$rtgodam_user_data = rtgodam_get_user_data();

			wp_localize_script(
				'godam-page-script-dashboard',
				'userData',
				$rtgodam_user_data
			);

			wp_localize_script(
				'godam-page-script-dashboard',
				'videoData',
				array(
					'adminUrl' => admin_url( 'admin.php?page=rtgodam_settings#video-settings' ),
				)
			);

			wp_localize_script(
				'godam-page-script-dashboard',
				'godamPluginData',
				array(
					'flagBasePath' => RTGODAM_URL . 'assets/src/images/flags',
				)
			);

			wp_enqueue_script( 'godam-page-script-dashboard' );
			wp_enqueue_script( 'd3-js' );

		} elseif ( $screen && $this->analytics_page_id === $screen->id ) {

			/**
			 * We are using the D3.js library for the analytics page.
			 *
			 * License: https://github.com/d3/d3/blob/main/LICENSE
			 */
			wp_register_script(
				'd3-js',
				RTGODAM_URL . '/assets/src/libs/d3.js',
				array(),
				RTGODAM_VERSION,
				false
			);

			wp_register_script(
				'transcoder-page-script-analytics',
				RTGODAM_URL . 'assets/build/pages/analytics.min.js',
				array( 'wp-element' ),
				filemtime( RTGODAM_PATH . 'assets/build/pages/analytics.min.js' ),
				true
			);

			wp_set_script_translations( 'transcoder-page-script-analytics', 'godam', RTGODAM_PATH . 'languages' );

			// Pass dynamic data to React using wp_localize_script.
			wp_localize_script(
				'transcoder-page-script-analytics',
				'videoData',
				array(
					'nonce'            => wp_create_nonce( 'wp_rest' ),     // WordPress nonce for API requests.
					'currentUserId'    => get_current_user_id(),            // Current user ID.
					'currentUserRoles' => wp_get_current_user()->roles,     // Current user roles.
					'adminUrl'         => admin_url( 'admin.php?page=rtgodam_settings#video-settings' ),
				)
			);

			$rtgodam_user_data = rtgodam_get_user_data();

			wp_localize_script(
				'transcoder-page-script-analytics',
				'userData',
				$rtgodam_user_data
			);

			wp_localize_script(
				'transcoder-page-script-analytics',
				'godamPluginData',
				array(
					'flagBasePath' => RTGODAM_URL . 'assets/src/images/flags',
				)
			);

			wp_enqueue_script( 'transcoder-page-script-analytics' );
			wp_enqueue_script( 'd3-js' );
		} elseif ( $screen && $this->help_page_id === $screen->id ) {
			wp_register_script(
				'godam-page-script-help',
				RTGODAM_URL . 'assets/build/pages/help.min.js',
				array( 'wp-element' ),
				filemtime( RTGODAM_PATH . 'assets/build/pages/help.min.js' ),
				true
			);

			$rtgodam_user_data = rtgodam_get_user_data();

			wp_localize_script(
				'godam-page-script-help',
				'userData',
				$rtgodam_user_data
			);

			wp_set_script_translations( 'godam-page-script-help', 'godam', RTGODAM_PATH . 'languages' );
			wp_enqueue_script( 'godam-page-script-help' );
		} elseif ( $screen && $this->settings_page_id === $screen->id ) {
			wp_register_script(
				'transcoder-page-script-godam',
				RTGODAM_URL . 'assets/build/pages/godam.min.js',
				array( 'wp-element', 'wp-i18n' ),
				filemtime( RTGODAM_PATH . 'assets/build/pages/godam.min.js' ),
				true
			);

			$rtgodam_user_data = rtgodam_get_user_data();

			if ( ! empty( $rtgodam_user_data ) ) {
				wp_localize_script(
					'transcoder-page-script-godam',
					'userData',
					$rtgodam_user_data
				);
			}

			wp_set_script_translations( 'transcoder-page-script-godam', 'godam', RTGODAM_PATH . 'languages' );
			wp_enqueue_script( 'transcoder-page-script-godam' );
		}

		wp_enqueue_style( 'wp-components' );

		wp_register_script(
			'media-library-react',
			RTGODAM_URL . 'assets/build/pages/media-library.min.js',
			array( 'wp-element', 'wp-i18n' ),
			filemtime( RTGODAM_PATH . 'assets/build/pages/media-library.min.js' ),
			true
		);

		wp_set_script_translations( 'media-library-react', 'godam', RTGODAM_PATH . 'languages' );

		wp_enqueue_script( 'media-library-react' );

		// Add a localized script for the rest nonce.
		wp_localize_script(
			'media-library-react',
			'MediaLibrary',
			array(
				'nonce'    => wp_create_nonce( 'wp_rest' ),
				'userData' => rtgodam_get_user_data(),
			)
		);
	}

	/**
	 * Enqueue Gravity Forms styles.
	 *
	 * @return void
	 */
	public function enqueue_gravity_forms_styles() {
		$gravity_forms_styles = array(
			'gravity-forms-orbital-theme'    => 'gravityforms/assets/css/dist/gravity-forms-orbital-theme.min.css',
			'gravity-forms-theme-foundation' => 'gravityforms/assets/css/dist/gravity-forms-theme-foundation.min.css',
			'gravity-forms-theme-framework'  => 'gravityforms/assets/css/dist/gravity-forms-theme-framework.min.css',
			'gravity-forms-theme'            => 'gravityforms/assets/css/dist/theme.min.css',
			'gravity-forms-theme-components' => 'gravityforms/assets/css/dist/theme-components.min.css',
			'gravity-forms-basic'            => 'gravityforms/assets/css/dist/basic.min.css',
			'common-css-utilities'           => 'gravityforms/assets/css/dist/common-css-utilities.min.css',
		);

		foreach ( $gravity_forms_styles as $handle => $path ) {
			wp_enqueue_style(
				$handle,
				plugins_url( $path ),
				array(),
				RTGODAM_VERSION
			);
		}
	}

	/**
	 * Enqueue WPForms styles.
	 *
	 * @return void
	 */
	public function enqueue_wpforms_styles() {

		if ( ! defined( 'WPFORMS_PLUGIN_URL' ) ) {
			return;
		}

		// Enqueue the WPForms styles.
		wp_enqueue_style(
			'wpforms-full',
			WPFORMS_PLUGIN_URL . 'assets/css/frontend/classic/wpforms-full.css',
			array(),
			WPFORMS_VERSION
		);
	}

	/**
	 * Enqueue Jetpack Forms styles.
	 *
	 * @return void
	 */
	public function enqueue_jetpack_forms_styles() {
		// Check if the Jetpack Forms class exists.
		if ( ! class_exists( 'Automattic\Jetpack\Forms\ContactForm\Contact_Form_Plugin' ) ) {
			return;
		}

		// Enqueue the main Jetpack forms stylesheet.
		wp_enqueue_style( 'grunion.css' );
		// In admin, we need to load the block library styles which include button styles.
		wp_enqueue_style( 'wp-block-library' );
	}

	/**
	 * Save current rest api request.
	 *
	 * @since n.e.x.t
	 *
	 * @param mixed           $result Response to replace the requested version with. Can be anything a normal endpoint can return, or null to not hijack the request.
	 * @param \WP_REST_Server $server Server instance.
	 * @param WP_REST_Request $request Request used to generate the response.
	 *
	 * @return mixed
	 */
	public function save_current_rest_api_request( $result, $server, $request ) {
		global $godam_current_rest_request;

		// Save the current REST API request.
		$godam_current_rest_request = $request;

		return $result;
	}

	/**
	 * Remove anti-spam settings from wpforms.
	 *
	 * @since n.e.x.t
	 *
	 * @param array $form_data Form data to be modified.
	 *
	 * @return array
	 */
	public function remove_antispam_setting_from_wpforms( $form_data ) {
		global $godam_current_rest_request;

		// Check if the global variable is set and is an instance of WP_REST_Request.
		if ( null === $godam_current_rest_request ) {
			return $form_data;
		}

		// Bail early if the global variable is not an instance of WP_REST_Request.
		if ( ! $godam_current_rest_request instanceof \WP_REST_Request ) {
			return $form_data;
		}

		if ( '/godam/v1/wpform' !== $godam_current_rest_request->get_route() ) {
			return $form_data;
		}

		// Remove the antispam settings from the form data.
		if ( isset( $form_data['settings'] ) ) {
			foreach ( $form_data['settings'] as $key => $value ) {
				if ( str_starts_with( $key, 'antispam' ) ) {
					unset( $form_data['settings'][ $key ] );
				}
			}
		}

		$godam_current_rest_request = null;

		return $form_data;
	}
}
