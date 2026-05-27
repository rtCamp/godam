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
	 * Slug for tools page
	 *
	 * @var string
	 */
	private $tools_slug = 'rtgodam_tools';

	/**
	 * Slug for the what's new page.
	 *
	 * @var string
	 */
	private $whats_new_slug = 'rtgodam_whats_new';

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
	 * Tools page ID.
	 *
	 * @var string
	 */
	private $tools_page_id = 'godam_page_rtgodam_tools';

	/**
	 * Whats new page ID.
	 *
	 * @var string
	 */
	private $whats_new_page_id = 'godam_page_rtgodam_whats_new';

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

		// "What's New" page related actions.
		add_action( 'current_screen', array( $this, 'redirect_to_whats_new' ) );
		add_action( 'admin_menu', array( $this, 'remove_whats_new_page' ) );

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
		global $admin_page_hooks;

		/**
		 * If the user do not have capability to publish posts, bail out.
		 * That means the users is contributor or below, we don't show the menu.
		 */
		if ( ! current_user_can( 'publish_posts' ) ) {
			return;
		}

		add_menu_page(
			__( 'GoDAM', 'godam' ),
			__( 'GoDAM', 'godam' ),
			'edit_pages',
			$this->menu_slug,
			array( $this, 'render_dashboard_page' ),
			'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjQiIGhlaWdodD0iNjQiIHZpZXdCb3g9IjAgMCA2NCA2NCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHBhdGggZD0iTTI1LjU1NzggMjAuMDkxMUw4LjA1NTg3IDM3LjU5M0wzLjQ2Mzk3IDMzLjAwMTFDMC44MTg1MjEgMzAuMzU1NiAyLjA4MjEgMjUuODMzNiA1LjcyMjI4IDI0Ljk0NjRMMjUuNTYzMiAyMC4wOTY0TDI1LjU1NzggMjAuMDkxMVoiIGZpbGw9IndoaXRlIi8+CjxwYXRoIGQ9Ik00Ny4zNzczIDIxLjg4NjdMNDUuNTQzOCAyOS4zODc1TDIyLjY5NzIgNTIuMjM0MUwxMS4yNjA1IDQwLjc5NzRMMzQuMTY2MiAxNy44OTE2TDQxLjU3MDMgMTYuMDc5NkM0NS4wNzA2IDE1LjIyNDcgNDguMjMyMyAxOC4zODYzIDQ3LjM3MiAyMS44ODEzTDQ3LjM3NzMgMjEuODg2N1oiIGZpbGw9IndoaXRlIi8+CjxwYXRoIGQ9Ik00My41MDU5IDM4LjEwMzZMMzguNjY2NyA1Ny44OTA3QzM3Ljc3NDEgNjEuNTI1NSAzMy4yNTIxIDYyLjc4OTEgMzAuNjA2NiA2MC4xNDM2TDI2LjAzNjMgNTUuNTczMkw0My41MDU5IDM4LjEwMzZaIiBmaWxsPSJ3aGl0ZSIvPgo8L3N2Zz4K',
			11
		);

		// FIX: Force the admin page hook to use the untranslated slug.
		// This prevents screen ID changes when menu title is translated.
		$admin_page_hooks[ $this->menu_slug ] = 'godam'; // phpcs:ignore WordPress.WP.GlobalVariablesOverride.Prohibited

		add_submenu_page(
			$this->menu_slug,
			__( 'Dashboard', 'godam' ),
			__( 'Dashboard', 'godam' ),
			'edit_pages', // Dashboard is accessible to editors and above.
			$this->menu_slug,
			array( $this, 'render_dashboard_page' ),
			1
		);

		add_submenu_page(
			$this->menu_slug,
			__( 'Video Editor', 'godam' ),
			__( 'Video Editor', 'godam' ),
			'upload_files', // Video Editor is accessible to authors and above.
			$this->video_editor_slug,
			array( $this, 'render_video_editor_page' ),
			3
		);

		add_submenu_page(
			$this->menu_slug,
			__( 'Analytics', 'godam' ),
			__( 'Analytics', 'godam' ),
			'upload_files', // Analytics is accessible to authors and above.
			$this->analytics_slug,
			array( $this, 'render_analytics_page' ),
			2
		);

		// Only add Tools submenu if a valid API key is set.
		if ( rtgodam_is_api_key_valid() ) {
			add_submenu_page(
				$this->menu_slug,
				__( 'Tools', 'godam' ),
				__( 'Tools', 'godam' ),
				'edit_pages', // Tools is accessible to editors and above.
				$this->tools_slug,
				array( $this, 'render_tools_page' ),
				5
			);
		}

		add_submenu_page(
			$this->menu_slug,
			__( 'Settings', 'godam' ),
			__( 'Settings', 'godam' ),
			'manage_options', // Settings is accessible to admins and above.
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

		// Only add "What's New" submenu page if we are on a GoDAM menu.
		// phpcs:ignore WordPress.Security.NonceVerification.Recommended
		if ( isset( $_GET['page'] ) && false !== strpos( sanitize_key( $_GET['page'] ), $this->menu_slug ) ) {
			add_submenu_page(
				$this->menu_slug,
				__( 'What\'s New', 'godam' ),
				__( 'What\'s New', 'godam' ),
				'edit_posts',
				$this->whats_new_slug,
				array( $this, 'render_whats_new_page' ),
				8
			);
		}
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
		if ( $screen && in_array( $screen->id, array( $this->menu_page_id, $this->video_editor_page_id, $this->analytics_page_id, $this->help_page_id, $this->settings_page_id, $this->tools_page_id, $this->whats_new_page_id ), true ) ) {
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
	 * To render the tools page.
	 *
	 * @since 1.4.0
	 *
	 * @return void
	 */
	public function render_tools_page() {
		?>
		<div class="godam-admin-root">
			<div id="root-godam-tools"></div>
		</div>
		<?php
	}

	/**
	 * To render the help page.
	 *
	 * @return void
	 */
	public function render_help_page() {
		?>
		<div class="godam-admin-root">
			<div id="root-video-help"></div>
		</div>
		<?php
	}

	/**
	 * To render the godam page.
	 *
	 * @return void
	 */
	public function render_godam_page() {
		?>
		<div class="godam-admin-root">
			<div id="root-godam-settings">
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
		</div>
		<?php
	}

	/**
	 * To render the video-editor page.
	 *
	 * @return void
	 */
	public function render_video_editor_page() {
		// Check if user can edit media with given id.
		$attachment_id = isset( $_GET['id'] ) ? absint( $_GET['id'] ) : 0; // phpcs:ignore WordPress.Security.NonceVerification.Recommended

		if ( $attachment_id && ! current_user_can( 'edit_post', $attachment_id ) ) {
			?>
			<p class="godam-page-error"><?php echo esc_html( __( 'Sorry, you are not allowed to edit this item.', 'godam' ) ); ?></p>
			<?php
			return;
		}

		?>
		<div class="godam-admin-root godam-video-editor-page">
			<div id="root-video-editor">
				<div class="progress-bar-wrapper">
					<div class="progress-bar-container">
						<div class="progress-bar">
							<div class="progress-bar-inner"></div>
						</div>
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
		$is_premium_user = rtgodam_is_api_key_valid();
		?>
		<div class="godam-admin-root">
			<div id="root-video-dashboard" class="<?php echo $is_premium_user ? '' : 'free-user'; ?>"></div>
		</div>
		<?php
	}

	/**
	 * To render the analytics page.
	 *
	 * @return void
	 */
	public function render_analytics_page() {
		$is_premium_user = rtgodam_is_api_key_valid();
		?>
		<div class="godam-admin-root">
			<div id="root-video-analytics" class="<?php echo $is_premium_user ? '' : 'free-user'; ?>"></div>
		</div>
		<?php
	}

	/**
	 * To render the what's new page.
	 *
	 * @return void
	 */
	public function render_whats_new_page() {
		?>
		<div id="root-whats-new"></div>
		<?php
	}

	/**
	 * To enqueue scripts and styles in admin.
	 *
	 * @return void
	 */
	public function admin_enqueue_scripts() {
		$screen = get_current_screen();

		if ( $screen && in_array( $screen->id, array( $this->menu_page_id, $this->video_editor_page_id, $this->analytics_page_id, $this->settings_page_id, $this->help_page_id, $this->tools_page_id, $this->whats_new_page_id ), true ) ) {

			wp_register_script(
				'rtgodam-page-style',
				RTGODAM_URL . 'assets/build/pages/page-css.min.js',
				array( 'wp-components' ),
				filemtime( RTGODAM_PATH . 'assets/build/pages/page-css.min.js' ),
				true
			);

			wp_enqueue_script( 'rtgodam-page-style' );
			wp_enqueue_media();

			wp_register_style(
				'easydam-media-library',
				RTGODAM_URL . 'assets/build/css/media-library.css',
				array(),
				filemtime( RTGODAM_PATH . 'assets/build/css/media-library.css' )
			);

			wp_enqueue_style( 'easydam-media-library' );

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

			$is_gf_active           = is_plugin_active( 'gravityforms/gravityforms.php' );
			$is_cf7_active          = is_plugin_active( 'contact-form-7/wp-contact-form-7.php' );
			$is_wpforms_active      = is_plugin_active( 'wpforms-lite/wpforms.php' ) || is_plugin_active( 'wpforms/wpforms.php' );
			$is_jetpack_active      = is_plugin_active( 'jetpack/jetpack.php' );
			$is_sure_form_active    = is_plugin_active( 'sureforms/sureforms.php' );
			$is_forminator_active   = is_plugin_active( 'forminator/forminator.php' );
			$is_fluent_forms_active = is_plugin_active( 'fluentform/fluentform.php' );
			$is_met_form_active     = is_plugin_active( 'metform/metform.php' );

			// TODO Handle Everest Forms pro versions as well in future.
			$is_everest_forms_active = is_plugin_active( 'everest-forms/everest-forms.php' );

			$is_ninja_forms_active = is_plugin_active( 'ninja-forms/ninja-forms.php' );


			// Pass dynamic data to React using wp_localize_script.
			wp_localize_script(
				'transcoder-page-script-video-editor',
				'videoData',
				array(
					'nonce'              => wp_create_nonce( 'wp_rest' ),   // WordPress nonce for API requests.
					'currentUserId'      => get_current_user_id(),          // Current user ID.
					'currentUserRoles'   => wp_get_current_user()->roles,   // Current user roles.
					'validApiKey'        => rtgodam_is_api_key_valid(),
					'adminUrl'           => admin_url(),
					'godamBaseUrl'       => RTGODAM_IO_API_BASE,
					'gfActive'           => $is_gf_active,
					'cf7Active'          => $is_cf7_active,
					'wpformsActive'      => $is_wpforms_active,
					'jetpackActive'      => $is_jetpack_active,
					'sureformsActive'    => $is_sure_form_active,
					'forminatorActive'   => $is_forminator_active,
					'fluentformsActive'  => $is_fluent_forms_active,
					'everestFormsActive' => $is_everest_forms_active,
					'ninjaFormsActive'   => $is_ninja_forms_active,
					'metformActive'      => $is_met_form_active,
				)
			);

			wp_localize_script(
				'transcoder-page-script-video-editor',
				'posthogConfig',
				$this->get_posthog_config()
			);

			// Enqueue Gravity Forms styles if the plugin is active.
			if ( $is_gf_active ) {
				$this->enqueue_gravity_forms_styles();
			}

			// Enqueue Jetpack Forms styles if the plugin is active.
			if ( $is_jetpack_active ) {
				$this->enqueue_jetpack_forms_styles();
			}

			// Enqueue Sure Forms style if the plugin is active.
			if ( $is_sure_form_active ) {
				$this->enqueue_sureforms_styles();
			}

			// Enqueue Forminator Forms styles if the plugin is active.
			if ( $is_forminator_active ) {
				$this->enqueue_forminator_forms_styles();
			}

			// Enqueue Fluent Forms styles if the plugin is active.
			if ( $is_fluent_forms_active ) {
				$this->enqueue_fluent_forms_styles();
			}

			// Enqueue Everest Forms styles if the plugin is active.
			if ( $is_everest_forms_active ) {
				$this->enqueue_everest_forms_styles();
			}

			$rtgodam_user_data = rtgodam_get_user_data( true );

			wp_localize_script(
				'transcoder-page-script-video-editor',
				'userData',
				$rtgodam_user_data
			);

			// Localize easydamMediaLibrary data for the video editor.
			$enable_folder_organization = get_option( 'rtgodam-settings', array() )['general']['enable_folder_organization'] ?? true;
			$current_user_id            = get_current_user_id();

			$easydam_media_library_data = array(
				'ajaxUrl'                  => admin_url( 'admin-ajax.php' ),
				'nonce'                    => wp_create_nonce( 'easydam_media_library' ),
				'godamToolsNonce'          => wp_create_nonce( 'rtgodam_tools' ),
				'enableFolderOrganization' => $enable_folder_organization,
				'isPollPluginActive'       => is_plugin_active( 'wp-polls/wp-polls.php' ),
				'page'                     => $screen ? $screen->id : '',
				'userId'                   => $current_user_id,
				'canEditOthersMedia'       => current_user_can( 'edit_others_posts' ),
				'canManageOptions'         => current_user_can( 'manage_options' ),
				'canEditPages'             => current_user_can( 'edit_pages' ),
			);

			/**
			 * Filters the easydamMediaLibrary localized data on the video editor page.
			 * Add-ons can use this to provide additional data (e.g., WooCommerce status).
			 *
			 * @since 1.8.0
			 *
			 * @param array $easydam_media_library_data The data array.
			 */
			$easydam_media_library_data = apply_filters( 'godam_easydam_media_library_data', $easydam_media_library_data );

			wp_localize_script(
				'transcoder-page-script-video-editor',
				'easydamMediaLibrary',
				$easydam_media_library_data
			);

			// Localize video editor layer options and components via PHP filters.
			$layer_options    = apply_filters( 'godam_video_editor_layer_options', array() );
			$layer_components = apply_filters( 'godam_video_editor_layer_components', array() );

			wp_localize_script(
				'transcoder-page-script-video-editor',
				'godamVideoEditorConfig',
				array(
					'layerOptions'    => $layer_options,
					'layerComponents' => $layer_components,
				)
			);

			wp_set_script_translations( 'transcoder-page-script-video-editor', 'godam', RTGODAM_PATH . 'languages' );
			wp_enqueue_script( 'transcoder-page-script-video-editor' );

			/**
			 * Fires after the video editor scripts are enqueued.
			 * Add-ons can use this to enqueue their own scripts on the video editor page.
			 *
			 * @since 1.8.0
			 */
			do_action( 'godam_enqueue_video_editor_scripts' );

			if ( is_plugin_active( 'gravityforms/gravityforms.php' ) ) {
				$this->enqueue_gravity_forms_styles();
			}

			$poll_ajax_style = get_option( 'poll_ajax_style' );

			if ( is_plugin_active( 'wp-polls/wp-polls.php' ) && isset( $poll_ajax_style['loading'] ) && $poll_ajax_style['loading'] ) {

			// phpcs:ignore WordPress.NamingConventions.PrefixAllGlobals.NonPrefixedConstantFound -- WP Polls plugin constant.
				if ( ! defined( 'WP_POLLS_VERSION' ) ) {
					// phpcs:ignore WordPress.NamingConventions.PrefixAllGlobals.NonPrefixedConstantFound -- WP Polls plugin constant.
					define( 'WP_POLLS_VERSION', '2.77.3' );
				}

			// phpcs:ignore WordPress.NamingConventions.PrefixAllGlobals.NonPrefixedConstantFound -- WP Polls plugin constant.
				wp_enqueue_script( 'wp-polls', plugins_url( 'wp-polls/polls-js.js' ), array( 'jquery' ), WP_POLLS_VERSION, true );
			// phpcs:ignore WordPress.NamingConventions.PrefixAllGlobals.NonPrefixedConstantFound -- WP Polls plugin constant.
				wp_enqueue_style( 'wp-polls', plugins_url( 'wp-polls/polls-css.css' ), false, WP_POLLS_VERSION, 'all' );

				wp_localize_script(
					'wp-polls',
					'pollsL10n',
					array(
						'ajaxUrl'      => admin_url( 'admin-ajax.php' ),
						'textWait'     => __( 'Your last request is still being processed. Please wait a while ...', 'godam' ),
						'textValid'    => __( 'Please choose a valid poll answer.', 'godam' ),
						'textMultiple' => __( 'Maximum number of choices allowed: ', 'godam' ),
						'showLoading'  => (int) $poll_ajax_style['loading'],
						'showFading'   => (int) $poll_ajax_style['fading'],
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

			$rtgodam_user_data = rtgodam_get_user_data( true );

			wp_localize_script(
				'godam-page-script-dashboard',
				'userData',
				$rtgodam_user_data
			);

			$timezone     = wp_timezone();
			$current_time = new \DateTime( 'now', $timezone );
			$end_time     = new \DateTime( '2026-01-20 23:59:59', $timezone );

			wp_localize_script(
				'godam-page-script-dashboard',
				'posthogConfig',
				$this->get_posthog_config()
			);

			wp_localize_script(
				'godam-page-script-dashboard',
				'videoData',
				array(
					'adminUrl'              => admin_url( 'admin.php?page=rtgodam_settings#video-settings' ),
					'godamBaseUrl'          => RTGODAM_IO_API_BASE,
					'showNewYearSaleBanner' => ( $current_time <= $end_time ),
				)
			);

			wp_localize_script(
				'godam-page-script-dashboard',
				'godamPluginData',
				array(
					'flagBasePath' => RTGODAM_URL . 'assets/src/images/flags',
				)
			);

			/**
			 * Allow add-ons to enqueue scripts that extend the GoDAM dashboard page.
			 *
			 * Add-ons can register their own JS bundles here that register React
			 * components on `window.godamDashboardSections` to extend the
			 * dashboard with additional sections. This hook must fire before the
			 * main dashboard bundle is enqueued so those registrations are
			 * available when the dashboard app mounts.
			 *
			 * @since 1.11.0
			 */
			do_action( 'godam_enqueue_dashboard_page_scripts' );

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
				array( 'wp-element', 'wp-i18n' ),
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
					'godamBaseUrl'     => RTGODAM_IO_API_BASE,
				)
			);

			wp_localize_script(
				'transcoder-page-script-analytics',
				'posthogConfig',
				$this->get_posthog_config()
			);

			$rtgodam_user_data = rtgodam_get_user_data( true );

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

			/**
			 * Filter the list of extension tabs shown in the Interactive Layer
			 * Performance section.
			 *
			 * Add-ons (e.g. godam-for-woo) register an analytics tab by adding
			 * a tab descriptor to this array. Built-in tabs (CTA / Form /
			 * Hotspot) are always rendered by the React side and do not need
			 * to be added here.
			 *
			 * Each descriptor must be an associative array with at least:
			 *  - 'id'    (string)  the layer_type to query (whitelisted server-side)
			 *  - 'label' (string)  user-visible tab label, localized by the add-on
			 *
			 * @since vNEXT
			 *
			 * @param array $tabs Tab descriptors. Default empty array.
			 */
			$extension_tabs = apply_filters( 'godam_analytics_layer_tabs', array() );

			// Defensive: drop anything that isn't a well-formed descriptor.
			// PHP-side filtering keeps malformed entries from polluting the
			// React-side render where they'd silently break.
			if ( ! is_array( $extension_tabs ) ) {
				$extension_tabs = array();
			} else {
				$extension_tabs = array_values(
					array_filter(
						$extension_tabs,
						function ( $tab ) {
							return is_array( $tab )
								&& ! empty( $tab['id'] )
								&& is_string( $tab['id'] )
								&& ! empty( $tab['label'] )
								&& is_string( $tab['label'] );
						}
					)
				);
			}

			wp_localize_script(
				'transcoder-page-script-analytics',
				'godamAnalyticsConfig',
				array(
					'extensionTabs' => $extension_tabs,
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

			$rtgodam_user_data = rtgodam_get_user_data( true );

			wp_localize_script(
				'godam-page-script-help',
				'userData',
				$rtgodam_user_data
			);

			wp_localize_script(
				'godam-page-script-help',
				'posthogConfig',
				$this->get_posthog_config()
			);

			// Footer URL data for internal redirection.
			wp_localize_script(
				'godam-page-script-help',
				'footerData',
				array(
					'adminUrl' => admin_url( 'admin.php' ),
				)
			);

			wp_set_script_translations( 'godam-page-script-help', 'godam', RTGODAM_PATH . 'languages' );
			wp_enqueue_script( 'godam-page-script-help' );
		} elseif ( $screen && $this->settings_page_id === $screen->id ) {
			wp_register_script(
				'transcoder-page-script-godam',
				RTGODAM_URL . 'assets/build/pages/godam.min.js',
				array( 'wp-element', 'wp-i18n', 'wp-api-fetch' ),
				filemtime( RTGODAM_PATH . 'assets/build/pages/godam.min.js' ),
				true
			);

			$rtgodam_user_data = rtgodam_get_user_data( true );

			if ( ! empty( $rtgodam_user_data ) ) {
				wp_localize_script(
					'transcoder-page-script-godam',
					'userData',
					$rtgodam_user_data
				);
			}

			wp_localize_script(
				'transcoder-page-script-godam',
				'posthogConfig',
				$this->get_posthog_config()
			);

			// Footer URL data for internal redirection.
			wp_localize_script(
				'transcoder-page-script-godam',
				'footerData',
				array(
					'adminUrl' => admin_url( 'admin.php' ),
				)
			);

			wp_set_script_translations( 'transcoder-page-script-godam', 'godam', RTGODAM_PATH . 'languages' );

			if ( ! function_exists( 'is_plugin_active' ) ) {
				require_once ABSPATH . 'wp-admin/includes/plugin.php';
			}

			$addon_slugs = array( 'godam-for-woo/godam-for-woo.php' );

			/**
			 * Filter the list of recognised add-on plugin slugs.
			 *
			 * @param string[] $addon_slugs Plugin file slugs (e.g. 'godam-for-woo/godam-for-woo.php').
			 */
			$addon_slugs = apply_filters( 'godam_addon_plugin_slugs', $addon_slugs );

			$addon_statuses = array();
			foreach ( $addon_slugs as $slug ) {
				$file_exists             = file_exists( WP_PLUGIN_DIR . '/' . $slug );
				$addon_statuses[ $slug ] = array(
					'installed' => $file_exists ? '1' : '',
					'active'    => ( $file_exists && is_plugin_active( $slug ) ) ? '1' : '',
				);
			}

			// Required / dependency plugins (e.g. WooCommerce itself).
			$required_slugs = array( 'woocommerce/woocommerce.php' );

			/**
			 * Filter the list of required dependency plugin slugs to check.
			 *
			 * @param string[] $required_slugs Plugin file slugs.
			 */
			$required_slugs = apply_filters( 'godam_required_plugin_slugs', $required_slugs );

			foreach ( $required_slugs as $slug ) {
				$file_exists             = file_exists( WP_PLUGIN_DIR . '/' . $slug );
				$addon_statuses[ $slug ] = array(
					'installed' => $file_exists ? '1' : '',
					'active'    => ( $file_exists && is_plugin_active( $slug ) ) ? '1' : '',
				);
			}

			wp_localize_script(
				'transcoder-page-script-godam',
				'godamAddonStatuses',
				$addon_statuses
			);

			wp_enqueue_script( 'transcoder-page-script-godam' );

			/**
			 * Fires after the GoDAM settings page scripts are enqueued.
			 * Add-ons can use this to enqueue their own settings scripts.
			 *
			 * @since 1.8.0
			 */
			do_action( 'godam_enqueue_settings_page_scripts' );
		} elseif ( $screen && $this->tools_page_id === $screen->id ) {

			wp_register_script(
				'godam-page-script-tools',
				RTGODAM_URL . 'assets/build/pages/tools.min.js',
				array( 'wp-element', 'wp-i18n' ),
				filemtime( RTGODAM_PATH . 'assets/build/pages/tools.min.js' ),
				true
			);

			wp_set_script_translations( 'godam-page-script-tools', 'godam', RTGODAM_PATH . 'languages' );

			$rtgodam_user_data = rtgodam_get_user_data( true );

			wp_localize_script(
				'godam-page-script-tools',
				'userData',
				$rtgodam_user_data
			);

			wp_localize_script(
				'godam-page-script-tools',
				'posthogConfig',
				$this->get_posthog_config()
			);

			// Footer URL data for internal redirection.
			wp_localize_script(
				'godam-page-script-tools',
				'footerData',
				array(
					'adminUrl' => admin_url( 'admin.php' ),
				)
			);

			wp_enqueue_script( 'godam-page-script-tools' );
		} elseif ( $screen && $this->whats_new_page_id === $screen->id ) {

			wp_register_script(
				'godam-page-script-whats-new',
				RTGODAM_URL . 'assets/build/pages/whats-new.min.js',
				array( 'wp-element', 'wp-i18n' ),
				filemtime( RTGODAM_PATH . 'assets/build/pages/whats-new.min.js' ),
				true
			);

			wp_set_script_translations( 'godam-page-script-whats-new', 'godam', RTGODAM_PATH . 'languages' );

			wp_localize_script(
				'godam-page-script-whats-new',
				'headerData',
				array(
					'version' => RTGODAM_VERSION,
				)
			);

			wp_localize_script(
				'godam-page-script-whats-new',
				'posthogConfig',
				$this->get_posthog_config()
			);

			wp_enqueue_script( 'godam-page-script-whats-new' );
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

		$roles = wp_get_current_user()->roles;
		if ( current_user_can( 'manage_network' ) ) {
			$roles[] = 'superadmin';
		}

		// Add a localized script for the rest nonce.
		wp_localize_script(
			'media-library-react',
			'MediaLibrary',
			array(
				'nonce'    => wp_create_nonce( 'wp_rest' ),
				'userData' => rtgodam_get_user_data( true ),
				'roles'    => $roles,
			)
		);

		wp_localize_script(
			'media-library-react',
			'posthogConfig',
			$this->get_posthog_config()
		);
	}

	/**
	 * Get PostHog configuration for internal GoDAM analytics tracking.
	 * These are hardcoded public keys - clients don't need to configure anything.
	 *
	 * @return array PostHog configuration array with 'key', 'host', and 'enabled' settings.
	 */
	private function get_posthog_config() {
		$settings        = get_option( 'rtgodam-settings', array() );
		$enable_tracking = isset( $settings['general']['enable_posthog_tracking'] ) ? $settings['general']['enable_posthog_tracking'] : false;

		$config = array(
			'key'     => 'phc_9P3X3py1SfwrF78SXXkIyL2cHjkRTpvWzqf8RZJDaSk',
			'host'    => 'https://us.i.posthog.com',
			'enabled' => (int) $enable_tracking, // Convert boolean to int (0/1) for proper JS encoding.
		);

		if ( $enable_tracking ) {
			global $wpdb, $wp_version;

			if ( ! function_exists( 'get_plugins' ) ) {
				require_once ABSPATH . 'wp-admin/includes/plugin.php';
			}

			$all_plugins    = get_plugins();
			$active_plugins = get_option( 'active_plugins', array() );

			$config['properties'] = array(
				'php_version'          => phpversion(),
				'mysql_version'        => $wpdb->db_version(),
				'server_software'      => isset( $_SERVER['SERVER_SOFTWARE'] ) ? sanitize_text_field( wp_unslash( $_SERVER['SERVER_SOFTWARE'] ) ) : '',
				'wp_version'           => $wp_version,
				'site_language'        => get_locale(),
				'active_plugins_count' => count( $active_plugins ),
				'total_plugins_count'  => count( $all_plugins ),
				'user_count'           => count_users()['total_users'] ?? 0,
			);
		}

		return $config;
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
	 * Enqueue sureforms styles.
	 *
	 * @return void
	 */
	public function enqueue_sureforms_styles() {

		/**
		 * Enqueue the sureforms assets.
		 */
		if ( class_exists( 'SRFM\Inc\Frontend_Assets' ) ) {
			$instance = \SRFM\Inc\Frontend_Assets::get_instance();

			if ( $instance ) {
				$instance->register_scripts();
				$instance->enqueue_scripts_and_styles();
			}
		}
	}

	/**
	 * Enqueue the Forminator assets.
	 *
	 * @return void
	 */
	public function enqueue_forminator_forms_styles() {
		// Check if Forminator is active and url is available.
		if ( ! function_exists( 'forminator_plugin_url' ) && ! defined( 'FORMINATOR_VERSION' ) ) {
			return;
		}

		// Get Forminator plugin URL.
		$forminator_url = forminator_plugin_url();

		// Enqueue the CSS files.
		wp_enqueue_style( 'forminator-base', $forminator_url . 'assets/forminator-ui/css/src/form/forminator-form-default.base.min.css', array(), FORMINATOR_VERSION );
		wp_enqueue_style( 'forminator-grid', $forminator_url . 'assets/forminator-ui/css/src/grid/forminator-grid.open.min.css', array(), FORMINATOR_VERSION );
	}

	/**
	 * Enqueue Fluent Forms styles.
	 *
	 * @return void
	 */
	public function enqueue_fluent_forms_styles() {
		if ( ! defined( 'FLUENTFORM_VERSION' ) ) {
			return;
		}

		wp_enqueue_style(
			'fluent-forms-public',
			plugins_url( 'fluentform/assets/css/fluent-forms-public.css' ),
			array(),
			FLUENTFORM_VERSION
		);

		wp_enqueue_style(
			'fluent-forms-default',
			plugins_url( 'fluentform/assets/css/fluentform-public-default.css' ),
			array(),
			FLUENTFORM_VERSION
		);
	}

	/**
	 * Enqueue Everest Forms styles.
	 *
	 * @since 1.3.0
	 *
	 * @return void
	 */
	public function enqueue_everest_forms_styles() {
		if ( ! defined( 'EVF_VERSION' ) ) {
			return;
		}

		wp_enqueue_style( 'everest-forms-general', evf()->plugin_url() . '/assets/css/everest-forms.css', array(), EVF_VERSION );

		\EVF_Frontend_Scripts::load_scripts();
	}

	/**
	 * Save current rest api request.
	 *
	 * @since 1.2.0
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
	 * @since 1.2.0
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

	/**
	 * Redirects to "What's New" submenu page after a plugin update.
	 *
	 * @param object $screen The current screen object.
	 */
	public function redirect_to_whats_new( $screen ) {
		// Only redirect if on a valid GoDAM admin page.
		if (
			! is_admin() ||
			! $screen ||
			false === strpos( $screen->id, $this->menu_slug )
		) {
			return;
		}

		if ( get_option( 'rtgodam_show_whats_new' ) ) {
			// Redirect only once, then clean up any related data.
			delete_option( 'rtgodam_show_whats_new' );
			delete_transient( 'rtgodam_release_data' );

			// Redirect to "What's New" admin page.
			wp_safe_redirect( admin_url( 'admin.php?page=' . $this->whats_new_slug ) );
			exit;
		}
	}

	/**
	 * Remove the "What's New" submenu page once the user navigates away.
	 */
	public function remove_whats_new_page() {
		// phpcs:ignore WordPress.Security.NonceVerification.Recommended
		if ( ( isset( $_GET['page'] ) && sanitize_key( $_GET['page'] ) !== $this->whats_new_slug ) ) {
			remove_submenu_page( $this->menu_slug, $this->whats_new_slug );
		}
	}
}
